# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import timedelta
from odoo import api, fields, models, SUPERUSER_ID, _
from odoo.exceptions import UserError, ValidationError
from odoo.tools import float_is_zero
import json
import logging
import time
import itertools
from collections import defaultdict
from functools import partial

_logger = logging.getLogger(__name__)

def timeit(func):
    def wrapper(*args, **kwargs):
        start_time = time.time()
        res = func(*args, **kwargs)
        _logger.info(f"CALLING `{func.__name__}` took `{time.time() - start_time}` seconds to finish.......")
        return res
    return wrapper

class PosSession(models.Model):
    _name = 'pos.session'
    _order = 'id desc'
    _description = 'Point of Sale Session'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    POS_SESSION_STATE = [
        ('opening_control', 'Opening Control'),  # method action_pos_session_open
        ('opened', 'In Progress'),               # method action_pos_session_closing_control
        ('closing_control', 'Closing Control'),  # method action_pos_session_close
        ('closed', 'Closed & Posted'),
    ]

    def _confirm_orders(self):
        # This function is called when the pos.session is being closed and validated.
        # Note that this is different from creation of pos.order record.
        for session in self:
            journal = session.config_id.journal_id
            if not journal:
                raise UserError(_("You have to set a Sale Journal for the POS:%s") % (session.config_id.name,))
            orders = session.order_ids.filtered(lambda order: order.state == 'paid')
            orders.with_context(force_company=journal.company_id.id)._create_account_move_line(session)
            for order in session.order_ids.filtered(lambda o: o.state not in ['done', 'invoiced']):
                if order.state not in ('paid'):
                    raise UserError(
                        _("You cannot confirm all orders of this session, because they have not the 'paid' status.\n"
                          "{reference} is in state {state}, total amount: {total}, paid: {paid}").format(
                            reference=order.pos_reference or order.name,
                            state=order.state,
                            total=order.amount_total,
                            paid=order.amount_paid,
                        ))
                # create move lines here
                # including stock account journal items
                order.action_pos_order_done()
            orders_to_reconcile = session.order_ids._filtered_for_reconciliation()
            orders_to_reconcile.sudo()._reconcile_payments()

    company_id = fields.Many2one('res.company', related='config_id.company_id', string="Company", readonly=True)

    config_id = fields.Many2one(
        'pos.config', string='Point of Sale',
        help="The physical point of sale you will use.",
        required=True,
        index=True)
    name = fields.Char(string='Session ID', required=True, readonly=True, default='/')
    user_id = fields.Many2one(
        'res.users', string='Responsible',
        required=True,
        index=True,
        readonly=True,
        states={'opening_control': [('readonly', False)]},
        default=lambda self: self.env.uid)
    currency_id = fields.Many2one('res.currency', related='config_id.currency_id', string="Currency", readonly=False)
    start_at = fields.Datetime(string='Opening Date', readonly=True)
    stop_at = fields.Datetime(string='Closing Date', readonly=True, copy=False)

    state = fields.Selection(
        POS_SESSION_STATE, string='Status',
        required=True, readonly=True,
        index=True, copy=False, default='opening_control')

    sequence_number = fields.Integer(string='Order Sequence Number', help='A sequence number that is incremented with each order', default=1)
    login_number = fields.Integer(string='Login Sequence Number', help='A sequence number that is incremented each time a user resumes the pos session', default=0)

    cash_control = fields.Boolean(compute='_compute_cash_all', string='Has Cash Control')
    cash_journal_id = fields.Many2one('account.journal', compute='_compute_cash_all', string='Cash Journal', store=True)
    cash_register_id = fields.Many2one('account.bank.statement', compute='_compute_cash_all', string='Cash Register', store=True)

    cash_register_balance_end_real = fields.Monetary(
        related='cash_register_id.balance_end_real',
        string="Ending Balance",
        help="Total of closing cash control lines.",
        readonly=True)
    cash_register_balance_start = fields.Monetary(
        related='cash_register_id.balance_start',
        string="Starting Balance",
        help="Total of opening cash control lines.",
        readonly=True)
    cash_register_total_entry_encoding = fields.Monetary(
        related='cash_register_id.total_entry_encoding',
        string='Total Cash Transaction',
        readonly=True,
        help="Total of all paid sales orders")
    cash_register_balance_end = fields.Monetary(
        related='cash_register_id.balance_end',
        digits=0,
        string="Theoretical Closing Balance",
        help="Sum of opening balance and transactions.",
        readonly=True)
    cash_register_difference = fields.Monetary(
        related='cash_register_id.difference',
        string='Difference',
        help="Difference between the theoretical closing balance and the real closing balance.",
        readonly=True)

    journal_ids = fields.Many2many(
        'account.journal',
        related='config_id.journal_ids',
        readonly=True,
        string='Available Payment Methods')
    order_ids = fields.One2many('pos.order', 'session_id',  string='Orders')
    order_count = fields.Integer(compute='_compute_order_count')
    statement_ids = fields.One2many('account.bank.statement', 'pos_session_id', string='Bank Statement', readonly=True)
    picking_count = fields.Integer(compute='_compute_picking_count')
    rescue = fields.Boolean(string='Recovery Session',
        help="Auto-generated session for orphan orders, ignored in constraints",
        readonly=True,
        copy=False)
    move_id = fields.Many2one(comodel_name='account.move', string='Pos Session Journal Entry')
    payment_method_ids = fields.Many2many(comodel_name='pos.payment.method', string='Payment Methods')

    _sql_constraints = [('uniq_name', 'unique(name)', "The name of this POS Session must be unique !")]

    @api.multi
    def _compute_order_count(self):
        orders_data = self.env['pos.order'].read_group([('session_id', 'in', self.ids)], ['session_id'], ['session_id'])
        sessions_data = {order_data['session_id'][0]: order_data['session_id_count'] for order_data in orders_data}
        for session in self:
            session.order_count = sessions_data.get(session.id, 0)

    @api.multi
    def _compute_picking_count(self):
        for pos in self:
            pickings = pos.order_ids.mapped('picking_id').filtered(lambda x: x.state != 'done')
            pos.picking_count = len(pickings.ids)

    @api.multi
    def action_stock_picking(self):
        pickings = self.order_ids.mapped('picking_id').filtered(lambda x: x.state != 'done')
        action_picking = self.env.ref('stock.action_picking_tree_ready')
        action = action_picking.read()[0]
        action['context'] = {}
        action['domain'] = [('id', 'in', pickings.ids)]
        return action

    @api.depends('config_id', 'statement_ids')
    def _compute_cash_all(self):
        for session in self:
            session.cash_journal_id = session.cash_register_id = session.cash_control = False
            if session.config_id.cash_control:
                for statement in session.statement_ids:
                    if statement.journal_id.type == 'cash':
                        session.cash_control = True
                        session.cash_journal_id = statement.journal_id.id
                        session.cash_register_id = statement.id
                if not session.cash_control and session.state != 'closed':
                    raise UserError(_("Cash control can only be applied to cash journals."))

    @api.constrains('user_id', 'state')
    def _check_unicity(self):
        # open if there is no session in 'opening_control', 'opened', 'closing_control' for one user
        if self.search_count([
                ('state', 'not in', ('closed', 'closing_control')),
                ('user_id', '=', self.user_id.id),
                ('rescue', '=', False)
            ]) > 1:
            raise ValidationError(_("You cannot create two active sessions with the same responsible."))

    @api.constrains('config_id')
    def _check_pos_config(self):
        if self.search_count([
                ('state', '!=', 'closed'),
                ('config_id', '=', self.config_id.id),
                ('rescue', '=', False)
            ]) > 1:
            raise ValidationError(_("Another session is already opened for this point of sale."))

    @api.constrains('start_at')
    def _check_start_date(self):
        for record in self:
            company = record.config_id.journal_id.company_id
            start_date = record.start_at.date()
            if (company.period_lock_date and start_date <= company.period_lock_date) or (company.fiscalyear_lock_date and start_date <= company.fiscalyear_lock_date):
                raise ValidationError(_("You cannot create a session before the accounting lock date."))

    @api.model
    def create(self, values):
        config_id = values.get('config_id') or self.env.context.get('default_config_id')
        if not config_id:
            raise UserError(_("You should assign a Point of Sale to your session."))

        # journal_id is not required on the pos_config because it does not
        # exists at the installation. If nothing is configured at the
        # installation we do the minimal configuration. Impossible to do in
        # the .xml files as the CoA is not yet installed.
        pos_config = self.env['pos.config'].browse(config_id)
        ctx = dict(self.env.context, company_id=pos_config.company_id.id)
        if not pos_config.journal_id:
            default_journals = pos_config.with_context(ctx).default_get(['journal_id', 'invoice_journal_id'])
            if (not default_journals.get('journal_id') or
                    not default_journals.get('invoice_journal_id')):
                raise UserError(_("Unable to open the session. You have to assign a sales journal to your point of sale."))
            pos_config.with_context(ctx).sudo().write({
                'journal_id': default_journals['journal_id'],
                'invoice_journal_id': default_journals['invoice_journal_id']})

        pos_name = self.env['ir.sequence'].with_context(ctx).next_by_code('pos.session')
        if values.get('name'):
            pos_name += ' ' + values['name']

        BankStatement = self.env['account.bank.statement']
        uid = SUPERUSER_ID if self.env.user.has_group('point_of_sale.group_pos_user') else self.env.user.id
        def create_cash_statement(cash_journal):
            ctx['journal_id'] = cash_journal.id if pos_config.cash_control and cash_journal.type == 'cash' else False
            st_values = {
                'journal_id': cash_journal.id,
                'user_id': self.env.user.id,
                'name': pos_name,
                'balance_start': self.env["account.bank.statement"]._get_opening_balance(journal.id)
            }
            return BankStatement.with_context(ctx).sudo(uid).create(st_values)
        statement_ids = pos_config.payment_method_ids\
                            .filtered(lambda pm: pm.is_cash_count)\
                            .mapped('cash_journal_id')\
                            .mapped(create_cash_statement).ids

        values.update({
            'name': pos_name,
            'statement_ids': [(6, 0, statement_ids)],
            'config_id': config_id,
            'payment_method_ids': [(6, 0, pos_config.payment_method_ids.ids)],
        })

        res = super(PosSession, self.with_context(ctx).sudo(uid)).create(values)
        if not pos_config.cash_control:
            res.action_pos_session_open()

        return res

    @api.multi
    def unlink(self):
        for session in self.filtered(lambda s: s.statement_ids):
            session.statement_ids.unlink()
        return super(PosSession, self).unlink()

    @api.multi
    def login(self):
        self.ensure_one()
        self.write({
            'login_number': self.login_number + 1,
        })

    @api.multi
    def action_pos_session_open(self):
        # second browse because we need to refetch the data from the DB for cash_register_id
        # we only open sessions that haven't already been opened
        for session in self.filtered(lambda session: session.state == 'opening_control'):
            values = {}
            if not session.start_at:
                values['start_at'] = fields.Datetime.now()
            values['state'] = 'opened'
            session.write(values)
            session.statement_ids.button_open()
        return True

    @api.multi
    def action_pos_session_closing_control(self):
        self._check_pos_session_balance()
        for session in self:
            session.write({'state': 'closing_control', 'stop_at': fields.Datetime.now()})
            if not session.config_id.cash_control:
                session.action_pos_session_close()

    @api.multi
    def _check_pos_session_balance(self):
        # This is not useful anymore because statement lines are created during closing of session
        for session in self:
            for statement in session.statement_ids:
                if (statement != session.cash_register_id) and (statement.balance_end != statement.balance_end_real):
                    statement.write({'balance_end_real': statement.balance_end})

    @api.multi
    def action_pos_session_validate(self):
        self.action_pos_session_close()

    @api.multi
    @timeit
    def action_pos_session_close(self):
        for session in self:
            all_orders = session.order_ids
            invoiced_orders = all_orders.filtered(lambda o: o.invoice_id)
            not_invoiced_orders = all_orders.filtered(lambda o: not o.invoice_id)
            account_move, move_lines = self.create_account_move(session, invoiced_orders, not_invoiced_orders)
            if move_lines:
                self.reconcile_invoiced_receivable_lines(move_lines, invoiced_orders)
                self.reconcile_cash_receivable_lines(session, move_lines, all_orders)
                self.reconcile_stock_output_lines(session, account_move, invoiced_orders)
                account_move.post()
                session.write({'move_id': account_move.id})
            else:
                account_move.unlink()
        self.write({'state': 'closed'})
        self.delete_unused_statements()
        return {
            'type': 'ir.actions.client',
            'name': 'Point of Sale Menu',
            'tag': 'reload',
            'params': {'menu_id': self.env.ref('point_of_sale.menu_point_root').id},
        }

    @api.model
    @timeit
    def create_account_move(self, session, invoiced_orders, not_invoiced_orders):
        """ Creates account move and move lines for the session.
            Calculation based on orders (`invoiced_orders` and `not_invoiced_orders`).
        """
        journal = session.config_id.journal_id
        account_move = self.env['account.move'].create({
            'journal_id': journal.id,
            'date': fields.Date.context_today(self),
            'ref': session.name,
            'name': journal.sequence_id.next_by_id()
        })
        move_lines = self._create_account_move_lines(session, account_move, invoiced_orders, not_invoiced_orders)
        return account_move, move_lines

    @api.model
    @timeit
    def reconcile_invoiced_receivable_lines(self, move_lines, invoiced_orders):
        # this can contain Receivable POS, `not l.name` is the criterion that the line is not pos receivable.
        # Maybe it is necessary to create a field in an account.move.line that will qualify if it is a pos receivable line.
        receivable_lines = move_lines.filtered(lambda l: l.account_id.internal_type in ('payable', 'receivable') and not l.name)
        invoice_receivable_lines = invoiced_orders.mapped('invoice_id.move_id.line_ids').filtered(lambda l: l.account_id.internal_type in ('payable', 'receivable'))
        all_receivable_lines = invoice_receivable_lines | receivable_lines
        invoice_account_ids = invoice_receivable_lines.mapped('account_id').ids
        # Receivable POS records are filtered here because only the invoice_receivable_accounts are considered
        lines_by_account_id = [all_receivable_lines.filtered(lambda l: l.account_id.id == account_id) for account_id in invoice_account_ids]
        for lines in lines_by_account_id:
            lines.reconcile()

    @api.model
    @timeit
    def reconcile_cash_receivable_lines(self, session, move_lines, all_orders):
        all_payments = all_orders.mapped('pos_payment_ids')
        for statement in session.statement_ids:
            statement_payments = all_payments.filtered(lambda p: p.payment_method_id.cash_journal_id == statement.journal_id)
            cash_statement_lines = self._validate_cash_statement(session, statement, statement_payments)
            payment_methods = session.payment_method_ids.filtered(lambda pm: pm.cash_journal_id == statement.journal_id)
            receivable_pos_cash_lines = move_lines.filtered(lambda aml: aml.name in ['%s - %s' % (session.name, pm.name) for pm in payment_methods])
            statement_cash_receivable_lines = cash_statement_lines.mapped('journal_entry_ids').filtered(lambda aml: aml.account_id.internal_type == 'receivable')
            all_lines = (receivable_pos_cash_lines | statement_cash_receivable_lines)
            accounts = all_lines.mapped('account_id')
            lines_by_account = [all_lines.filtered(lambda l: l.account_id == account) for account in accounts]
            for lines in lines_by_account:
                lines.reconcile()

    @api.model
    @timeit
    def reconcile_stock_output_lines(self, session, account_move, invoiced_orders):
        invoice_account_moves = invoiced_orders.mapped('invoice_id').mapped('move_id')
        # TODO jcb: Maybe a need of optimization
        # There is a significant amount of time in performing this function even though
        # there are no involved anglo-saxon products.
        # Perhaps it is because of the pos_order_id put in each stock move.
        stock_moves = self.env['stock.move'].search([('pos_order_id', 'in', session.order_ids.ids)])
        account_moves = self.env['account.move'].search([('stock_move_id', 'in', stock_moves.ids)])
        for out_account in stock_moves.mapped(lambda m: m.product_id.categ_id.property_stock_account_output_categ_id):
            (account_moves | account_move | invoice_account_moves)\
                .mapped('line_ids')\
                .filtered(lambda line: line.account_id.id == out_account.id).reconcile()

    @api.multi
    def delete_unused_statements(self):
        self.mapped('statement_ids').filtered(lambda statement: not statement.line_ids).unlink()

    @api.model
    def _create_account_move_lines(self, session, account_move, invoiced_orders, not_invoiced_orders):
        all_orders = invoiced_orders | not_invoiced_orders
        receivable_pos_line_args = self._get_pos_receivable_lines(session, account_move, all_orders.mapped('pos_payment_ids'))
        invoiced_receivable_lines_args = self._get_invoiced_receivable_lines(account_move, invoiced_orders)
        sales_lines_args = self._get_sales_lines_data(account_move, not_invoiced_orders.mapped('lines'))
        tax_lines_args = self._get_tax_lines_data(account_move, not_invoiced_orders.mapped('lines'))
        anglo_saxon_lines_args = self._get_anglo_saxon_lines(account_move, not_invoiced_orders)
        line_args = invoiced_receivable_lines_args + sales_lines_args + tax_lines_args + anglo_saxon_lines_args + receivable_pos_line_args
        return self.env['account.move.line'].create(line_args)

    @api.model
    def _validate_cash_statement(self, session, statement, statement_payments):
        """ Validates each statement of the given session then returns
            cash account.bank.statement.line records.
        """
        cash_statement_lines = self._create_cash_statement_lines(session, statement, statement_payments)
        statement_line_ids = cash_statement_lines.ids
        if statement.balance_end != statement.balance_end_real:
            statement.write({'balance_end_real': statement.balance_end})
            statement.check_confirm_bank()
        return self.env['account.bank.statement.line'].browse(statement_line_ids)

    @api.model
    def _create_cash_statement_lines(self, session, statement, statement_payments):
        def create_arg_dict(payment_method):
            # create statement line for each payment method
            return dict(
                date=fields.Date.context_today(self),
                amount=sum(p.amount for p in statement_payments.filtered(lambda p: p.payment_method_id == payment_method)),
                name=session.name,
                statement_id=statement.id,
                account_id=payment_method.receivable_account_id.id,
            )
        cash_payment_methods = [pm for pm in session.payment_method_ids if pm.is_cash_count and (pm.cash_journal_id == statement.journal_id)]
        statement_lines_args = [create_arg_dict(pm) for pm in cash_payment_methods]
        return self.env['account.bank.statement.line'].create([args for args in statement_lines_args if args.get('amount')])

    @api.model
    def _get_invoiced_receivable_lines(self, account_move, invoiced_orders):
        def generate_line_args(account_id, amount):
            partial_args = dict(account_id=account_id, move_id=account_move.id)
            return self._credit_amount(partial_args, amount)

        account_amount_dict = defaultdict(lambda: 0.0)
        for order in invoiced_orders:
            account_id = order.invoice_id.account_id.id
            # Use `amount_total` (w/c includes tax) field since this will be
            # reconciled with receivable item in an invoice move which counts taxes.
            account_amount_dict[account_id] += order.amount_total

        return [generate_line_args(account_id, amount) for account_id, amount in account_amount_dict.items()]

    @api.model
    def _get_pos_receivable_lines(self, session, account_move, payments):
        def generate_line_args(pm, amount):
            data = dict(account_id=pm.receivable_account_id.id,
                        move_id=account_move.id,
                        name='%s - %s' % (session.name, pm.name))
            return self._debit_amount(data, amount)
        # Total amount grouped by payment method
        grouped_total_amount = [(pm, sum(payments.filtered(lambda p: p.payment_method_id == pm).mapped('amount'))) for pm in session.payment_method_ids]
        return [generate_line_args(pm, amount)
                    for pm, amount in grouped_total_amount
                    if not float_is_zero(amount, precision_rounding=session.currency_id.rounding)]

    @api.model
    def _get_sales_lines_data(self, account_move, order_lines):
        def get_income_account(order_line):
            if order_line.product_id.property_account_income_id.id:
                return order_line.product_id.property_account_income_id
            elif order_line.product_id.categ_id.property_account_income_categ_id.id:
                return order_line.product_id.categ_id.property_account_income_categ_id
            else:
                raise UserError(_('Please define income '
                                'account for this product: "%s" (id:%d).')
                                % (order_line.product_id.name, order_line.product_id.id))

        def generate_line_args(income_account_id, amount):
            partial_args = dict(account_id=income_account_id, move_id=account_move.id)
            return self._credit_amount(partial_args, amount)

        account_amount_dict = defaultdict(lambda: 0.0)
        for order_line in order_lines:
            income_account_id = get_income_account(order_line).id
            account_amount_dict[income_account_id] += order_line.price_subtotal

        return [generate_line_args(account_id, amount) for account_id, amount in account_amount_dict.items()]

    @api.model
    def _get_tax_lines_data(self, account_move, all_order_lines):
        """
        return [{**(account.move.line args for the taxes grouped by account_id and tax_id)}]
        """
        AccountTax = self.env['account.tax']

        def generate_line_args(account_id, tax_id, amount):
            tax = AccountTax.browse(tax_id)
            partial_args = dict(name=tax.name, account_id=account_id, move_id=account_move.id)
            return self._credit_amount(partial_args, amount)

        def compute_tax(order_line):
            currency = order_line.order_id.pricelist_id.currency_id
            # TODO jcb: not so sure if it is necessary to filter the
            # taxes because of the new implementation of multicompany
            tax_ids = order_line.tax_ids_after_fiscal_position\
                        .filtered(lambda t: t.company_id.id == order_line.order_id.company_id.id)
            price = order_line.price_unit * (1 - (order_line.discount or 0.0) / 100.0)
            return tax_ids\
                    .compute_all(price_unit=price, quantity=order_line.qty, currency=currency)\
                    .get('taxes', [])

        line_taxes = [compute_tax(line) for line in all_order_lines]

        # combine list of taxes into a single list
        # e.g. [[tax_a1, tax_a3], [tax_b2], [], [tax_c1, tax_c2, tax_c3]]
        #      -> [tax_a1, tax_a3, tax_b2, tax_c1, tax_c2, tax_c3]
        flat_line_taxes = itertools.chain.from_iterable(line_taxes)

        # group the taxes by account_id and tax id
        args_group_dict = defaultdict(lambda: 0.0)
        for tax in flat_line_taxes:
            args_group_dict[(tax['account_id'], tax['id'])] += tax['amount']

        return [generate_line_args(account_id, tax_id, amount) for (account_id, tax_id), amount in args_group_dict.items()]

    @api.model
    def _get_anglo_saxon_lines(self, account_move, not_invoiced_orders):
        """ Anglo saxon journal items were already created in the invoiced orders
            via the creation of account.invoice record.

            This method generates args for creating anglo-saxon journal items
            that are grouped by account.

            Calculation is based on the created stock moves when creating the
            picking for each order.
        """
        StockMove = self.env['stock.move']
        moves = StockMove\
            .search([('pos_order_id', 'in', not_invoiced_orders.ids)])\
            .filtered(lambda m: m.company_id.anglo_saxon_accounting)
        # group amounts by expense and output accounts
        credit_amounts = defaultdict(lambda: 0.0)
        debit_amounts = defaultdict(lambda: 0.0)
        for move in moves.filtered(lambda m: m.product_id.categ_id.property_valuation == 'real_time'):
            exp_account = move.product_id.property_account_expense_id or move.product_id.categ_id.property_account_expense_categ_id
            out_account = move.product_id.categ_id.property_stock_account_output_categ_id
            # TODO jcb: abs(move.product_uom_qty * move.price_unit) is used temporarily.
            # Check whether this is also applicable for returns.
            amount = abs(move.product_uom_qty * move.price_unit)
            debit_amounts[exp_account] += amount
            credit_amounts[out_account] += amount

        credit_lines = [self._credit_amount({'account_id': account.id, 'move_id': account_move.id}, amount) for account, amount in credit_amounts.items()]
        debit_lines = [self._debit_amount({'account_id': account.id, 'move_id': account_move.id}, amount) for account, amount in debit_amounts.items()]
        return credit_lines + debit_lines

    @api.model
    def _credit_amount(self, partial_move_line_args, amount):
        """ complete the `partial_move_line_args` by adding 'credit' and 'debit' fields with
            abs(`amount`) assign to the correct field.

            TODO jcb: The following is a note about the required parameter of currency._convert method
            required parameters: from_amount, to_currency, company, date
        """
        if amount > 0:
            return dict(credit=amount, debit=0.0, **partial_move_line_args)
        return dict(credit=0.0, debit=abs(amount), **partial_move_line_args)

    @api.model
    def _debit_amount(self, partial_move_line_args, amount):
        """ complete the `partial_move_line_args` by adding 'credit' and 'debit' fields with
            abs(`amount`) assign to the correct field.
        """
        if amount > 0:
            return dict(credit=0.0, debit=amount, **partial_move_line_args)
        return dict(credit=abs(amount), debit=0.0, **partial_move_line_args)

    @api.multi
    def show_journal_entries(self):
        # get all the linked moves to this move
        move = self.move_id
        lines = sum(move.line_ids\
                    .filtered(lambda aml: aml.account_id.reconcile)\
                    .mapped(lambda aml: [r.debit_move_id for r in aml.matched_debit_ids] if aml.credit > 0 else [r.credit_move_id for r in aml.matched_credit_ids]),
                    [])
        ids = [line.move_id.id for line in lines] + [move.id]
        domain = [('id', 'in', ids)]

        # call the account move action tree view with default filter (journal)
        # and domain containing the calculated ids above
        [action] = self.env.ref('account.action_move_journal_line').read()
        action['domain'] = [('id', 'in', ids)]
        action['context'] = json.dumps({'search_default_journal': 1})
        return action

    @api.multi
    def show_payments_list(self):
        [action] = self.env.ref('point_of_sale.action_show_pos_payment_button').read()
        action['domain'] = [('session_id', '=', self.id)]
        return action

    @api.multi
    def open_frontend_cb(self):
        if not self.ids:
            return {}
        for session in self.filtered(lambda s: s.user_id.id != self.env.uid):
            raise UserError(_("You cannot use the session of another user. This session is owned by %s. "
                              "Please first close this one to use this point of sale.") % session.user_id.name)
        return {
            'type': 'ir.actions.act_url',
            'target': 'self',
            'url':   '/pos/web/',
        }

    @api.multi
    def open_cashbox(self):
        self.ensure_one()
        context = dict(self._context)
        balance_type = context.get('balance') or 'start'
        context['bank_statement_id'] = self.cash_register_id.id
        context['balance'] = balance_type
        context['default_pos_id'] = self.config_id.id

        action = {
            'name': _('Cash Control'),
            'view_mode': 'form',
            'res_model': 'account.bank.statement.cashbox',
            'view_id': self.env.ref('account.view_account_bnk_stmt_cashbox').id,
            'type': 'ir.actions.act_window',
            'context': context,
            'target': 'new'
        }

        cashbox_id = None
        if balance_type == 'start':
            cashbox_id = self.cash_register_id.cashbox_start_id.id
        else:
            cashbox_id = self.cash_register_id.cashbox_end_id.id
        if cashbox_id:
            action['res_id'] = cashbox_id

        return action

    def action_view_order(self):
        return {
            'name': _('Orders'),
            'res_model': 'pos.order',
            'view_mode': 'tree,form',
            'type': 'ir.actions.act_window',
            'domain': [('session_id', 'in', self.ids)],
        }

    @api.model
    def _alert_old_session(self):
        # If the session is open for more then one week,
        # log a next activity to close the session.
        sessions = self.search([('start_at', '<=', (fields.datetime.now() - timedelta(days=7))), ('state', '!=', 'closed')])
        for session in sessions:
            if self.env['mail.activity'].search_count([('res_id', '=', session.id), ('res_model', '=', 'pos.session')]) == 0:
                session.activity_schedule('point_of_sale.mail_activity_old_session',
                        user_id=session.user_id.id, note=_("Your PoS Session is open since ") + fields.Date.to_string(session.start_at)
                        + _(", we advise you to close it and to create a new one."))

class ProcurementGroup(models.Model):
    _inherit = 'procurement.group'

    @api.model
    def _run_scheduler_tasks(self, use_new_cursor=False, company_id=False):
        super(ProcurementGroup, self)._run_scheduler_tasks(use_new_cursor=use_new_cursor, company_id=company_id)
        self.env['pos.session']._alert_old_session()
        if use_new_cursor:
            self.env.cr.commit()
