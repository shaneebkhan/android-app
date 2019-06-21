# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from itertools import chain
from collections import defaultdict
from functools import partial
from operator import attrgetter
from datetime import timedelta

from odoo import api, fields, models, SUPERUSER_ID, _
from odoo.exceptions import UserError, ValidationError
from odoo.tools import float_is_zero, groupby


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
    move_id = fields.Many2one('account.move', string='Journal Entry')
    payment_method_ids = fields.Many2many('pos.payment.method', string='Payment Methods')

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

        uid = SUPERUSER_ID if self.env.user.has_group('point_of_sale.group_pos_user') else self.env.user.id

        statement_ids = self.env['account.bank.statement']
        for cash_journal in pos_config.payment_method_ids.filtered(lambda pm: pm.is_cash_count).mapped('cash_journal_id'):
            ctx['journal_id'] = cash_journal.id if pos_config.cash_control and cash_journal.type == 'cash' else False
            st_values = {
                'journal_id': cash_journal.id,
                'user_id': self.env.user.id,
                'name': pos_name,
                'balance_start': self.env["account.bank.statement"]._get_opening_balance(cash_journal.id)
            }
            statement_ids |= statement_ids.with_context(ctx).sudo(uid).create(st_values)

        values.update({
            'name': pos_name,
            'statement_ids': [(6, 0, statement_ids.ids)],
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
    def action_pos_session_close(self):
        for session in self:
            all_orders = session.order_ids
            invoiced_orders = all_orders.filtered(lambda o: o.invoice_id)
            not_invoiced_orders = all_orders.filtered(lambda o: not o.invoice_id)
            account_move = self.create_account_move(session, invoiced_orders, not_invoiced_orders)
            move_lines = account_move.line_ids
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
        is_using_company_currency = session.currency_id == session.company_id.currency_id
        self._create_account_move_lines(session, account_move, invoiced_orders, not_invoiced_orders, is_using_company_currency)
        return account_move

    @api.model
    def reconcile_invoiced_receivable_lines(self, move_lines, invoiced_orders):
        receivable_lines = move_lines.filtered(lambda l: l.account_id.internal_type in ('payable', 'receivable') and not l.name)
        invoice_receivable_lines = invoiced_orders.mapped('invoice_id.move_id.line_ids').filtered(lambda l: l.account_id.internal_type in ('payable', 'receivable'))
        all_receivable_lines = invoice_receivable_lines | receivable_lines
        invoice_account_ids = invoice_receivable_lines.mapped('account_id').ids
        # Receivable POS records are filtered because only the invoice_receivable_accounts are considered
        lines_by_account_id = [all_receivable_lines.filtered(lambda l: l.account_id.id == account_id) for account_id in invoice_account_ids]
        for lines in lines_by_account_id:
            lines.reconcile()

    @api.model
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
    def reconcile_stock_output_lines(self, session, account_move, invoiced_orders):
        invoiced_account_moves = invoiced_orders.mapped('invoice_id').mapped('move_id')
        # TODO jcb: Maybe a need of optimization
        # There is a significant amount of time in performing this function even though
        # there are no involved anglo-saxon products.
        # Perhaps it is because of the pos_order_id put in each stock move.
        stock_moves = self.env['stock.move'].search([('pos_order_id', 'in', session.order_ids.ids)])
        account_moves = self.env['account.move'].search([('stock_move_id', 'in', stock_moves.ids)])
        for out_account in stock_moves.mapped(lambda m: m.product_id.categ_id.property_stock_account_output_categ_id):
            (account_moves | account_move | invoiced_account_moves)\
                .mapped('line_ids')\
                .filtered(lambda line: line.account_id.id == out_account.id).reconcile()

    @api.multi
    def delete_unused_statements(self):
        self.mapped('statement_ids').filtered(lambda statement: not statement.line_ids).unlink()

    @api.model
    def _create_account_move_lines(self, session, account_move, invoiced_orders, not_invoiced_orders, is_using_company_currency):
        all_orders = invoiced_orders | not_invoiced_orders
        receivable_pos_line_args = self._get_pos_receivable_lines(session, account_move, all_orders.mapped('pos_payment_ids'), is_using_company_currency)
        invoiced_receivable_lines_args = self._get_invoiced_receivable_lines(account_move, invoiced_orders, is_using_company_currency)
        sales_taxes_lines_args = self._get_sales_taxes_lines_data(account_move, not_invoiced_orders.mapped('lines'), is_using_company_currency)
        anglo_saxon_lines_args = self._get_anglo_saxon_lines(account_move, not_invoiced_orders, is_using_company_currency)
        line_args = invoiced_receivable_lines_args + sales_taxes_lines_args + anglo_saxon_lines_args + receivable_pos_line_args
        exchange_rate_line_args = [] if is_using_company_currency else self._get_exchange_rate_line(account_move, session, line_args)
        return self.env['account.move.line'].create(line_args+exchange_rate_line_args)

    @api.model
    def _validate_cash_statement(self, session, statement, statement_payments):
        """ Validates each statement of the given session then returns
            cash account.bank.statement.line records.
        """
        if not statement_payments:
            return self.env['account.bank.statement.line']
        cash_statement_lines = self._create_cash_statement_lines(session, statement, statement_payments)
        statement_line_ids = cash_statement_lines.ids
        if statement.balance_end != statement.balance_end_real:
            statement.write({'balance_end_real': statement.balance_end})
            statement.check_confirm_bank()
        return self.env['account.bank.statement.line'].browse(statement_line_ids)

    @api.model
    def _create_cash_statement_lines(self, session, statement, statement_payments):
        session_currency = session.currency_id
        company = session.company_id
        def create_vals(payment_method):
            # create statement line for each payment method
            method_payments = statement_payments.filtered(lambda p: p.payment_method_id == payment_method)
            method_currency = payment_method.cash_journal_id.currency_id or company.currency_id
            amount_converter = lambda payment: session_currency._convert(payment.amount, method_currency, company, payment.pos_order_id.date_order)
            return {
                'date': fields.Date.context_today(self),
                'amount': sum(method_payments.mapped(amount_converter)),
                'name': session.name,
                'statement_id': statement.id,
                'account_id': payment_method.receivable_account_id.id,
            }

        cash_payment_methods = [pm for pm in session.payment_method_ids if pm.is_cash_count and (pm.cash_journal_id == statement.journal_id)]
        statement_lines_args = [create_vals(pm) for pm in cash_payment_methods]
        return self.env['account.bank.statement.line'].create([args for args in statement_lines_args if args.get('amount')])

    @api.model
    def _get_exchange_rate_line(self, account_move, session, line_args):
        """
        if debit (receivable) than credit (sales):
            exchange rate difference -> gain
                Basically, more is gained than sales
                This also means that the difference has to be credited
        else:
            exchange rate difference -> loss
        """
        diff = sum(map(lambda line: line['debit'], line_args)) - sum(map(lambda line: line['credit'], line_args))
        if float_is_zero(diff, precision_rounding=session.currency_id.rounding):
            return []
        counter_amount = -session.currency_id.round(diff)
        gain_exchange_account = account_move.company_id.income_currency_exchange_account_id
        loss_exchange_account = account_move.company_id.expense_currency_exchange_account_id
        exchange_account, message = (gain_exchange_account, 'gain') if counter_amount < 0.0 else (loss_exchange_account, 'loss')
        return [{
            'account_id': exchange_account.id,
            'move_id': account_move.id,
            'name': "Currency conversion %s" % message,
            'amount_currency': 0.0,
            'currency_id': session.currency_id.id,
            'debit': counter_amount if counter_amount > 0.0 else 0.0,
            'credit': -counter_amount if counter_amount < 0.0 else 0.0,
        }]

    @api.model
    def _get_invoiced_receivable_lines(self, account_move, invoiced_orders, is_using_company_currency):
        if len(invoiced_orders) == 0:
            return []

        company = invoiced_orders[0].session_id.company_id
        session_currency = invoiced_orders[0].session_id.currency_id
        company_currency = company.currency_id

        def generate_move_line_vals(account_id, amount, amount_converted):
            partial_args = {'account_id': account_id, 'move_id': account_move.id}
            return self._credit_amount(partial_args, amount, amount_converted, session_currency, is_using_company_currency)

        def compute_total_amounts(orders):
            # Use `amount_total` (w/c includes tax) field since this will be
            # reconciled with receivable item in an invoice move which counts taxes.
            amount_converter = lambda order: session_currency._convert(order.amount_total, company_currency, company, order.date_order)
            total_amount = sum(order.amount_total for order in orders)
            total_amount_converted = 0 if is_using_company_currency else sum(amount_converter(order) for order in orders)
            return total_amount, total_amount_converted

        grouped_invoiced_orders = groupby(invoiced_orders, key=attrgetter('invoice_id.account_id.id'))
        account_amounts = [(account_id, compute_total_amounts(orders)) for account_id, orders in grouped_invoiced_orders]
        return [generate_move_line_vals(account_id, *amounts) for account_id, amounts in account_amounts]

    @api.model
    def _get_pos_receivable_lines(self, session, account_move, payments, is_using_company_currency):
        if not payments:
            return []

        split_payment_methods = session.payment_method_ids.filtered(lambda pm: pm.split_transactions)
        combine_payment_methods = session.payment_method_ids.filtered(lambda pm: not pm.split_transactions)
        split_pm_payments = payments.filtered(lambda payment: payment.payment_method_id <= split_payment_methods)
        combine_pm_payments = payments.filtered(lambda payment: payment.payment_method_id <= combine_payment_methods)

        return (self._receivable_lines_from_split_pm(session, account_move, split_pm_payments, is_using_company_currency)
                + self._receivable_lines_from_combine_pm(session, account_move, combine_payment_methods, combine_pm_payments, is_using_company_currency))

    @api.model
    def _receivable_lines_from_combine_pm(self, session, account_move, combine_payment_methods, combine_payments, is_using_company_currency):
        if not combine_payments:
            return []

        company = session.company_id
        session_currency = session.currency_id
        company_currency = company.currency_id

        def generate_move_line_vals(pm, amount, amount_converted):
            data = {
                'account_id': pm.receivable_account_id.id,
                'move_id': account_move.id,
                'name': '%s - %s' % (session.name, pm.name)
            }
            return self._debit_amount(data, amount, amount_converted, session_currency, is_using_company_currency)

        def compute_amount_sum(payments):
            if not payments:
                return (0.0, 0.0)
            amount_converter = lambda payment: session_currency._convert(payment.amount, company_currency, company, payment.pos_order_id.date_order)
            amount = sum(payments.mapped('amount'))
            amount_converted = 0.0 if is_using_company_currency else sum(payments.mapped(amount_converter))
            return amount, amount_converted

        # Total amount grouped by payment method
        grouped_total_amount = [(pm, *compute_amount_sum(combine_payments.filtered(lambda p: p.payment_method_id == pm))) for pm in combine_payment_methods]
        return [generate_move_line_vals(pm, amount, amount_converted)
                    for pm, amount, amount_converted in grouped_total_amount
                    if not float_is_zero(amount, precision_rounding=session.currency_id.rounding)]

    @api.model
    def _receivable_lines_from_split_pm(self, session, account_move, split_payments, is_using_company_currency):
        if not split_payments:
            return []

        company = session.company_id
        session_currency = session.currency_id
        company_currency = company.currency_id

        def generate_line_args(payment):
            amount_converted = session_currency._convert(payment.amount, company_currency, company, payment.pos_order_id.date_order)
            partial_args = {
                'account_id': payment.payment_method_id.receivable_account_id.id,
                'move_id': account_move.id,
                'partner_id': self.env["res.partner"]._find_accounting_partner(payment.partner_id).id,
                'name': '%s - %s' % (session.name, payment.payment_method_id.name),
            }
            return self._debit_amount(partial_args, payment.amount, amount_converted, session_currency, is_using_company_currency)

        return [generate_line_args(payment) for payment in split_payments]

    @api.model
    def _get_sales_taxes_lines_data(self, account_move, order_lines, is_using_company_currency):
        if not order_lines:
            return []

        company = order_lines[0].order_id.company_id
        session_currency = order_lines[0].order_id.currency_id
        company_currency = company.currency_id

        def credit_amount(partial_args, amount, amount_converted):
            return self._credit_amount(partial_args, amount, amount_converted, session_currency, is_using_company_currency)

        def get_income_account(order_line):
            if order_line.product_id.property_account_income_id.id:
                return order_line.product_id.property_account_income_id.id
            elif order_line.product_id.categ_id.property_account_income_categ_id.id:
                return order_line.product_id.categ_id.property_account_income_categ_id.id
            else:
                raise UserError(_('Please define income '
                                'account for this product: "%s" (id:%d).')
                                % (order_line.product_id.name, order_line.product_id.id))

        def prepare_line(order_line):
            tax_ids = order_line.tax_ids_after_fiscal_position\
                        .filtered(lambda t: t.company_id.id == order_line.order_id.company_id.id)
            price = order_line.price_unit * (1 - (order_line.discount or 0.0) / 100.0)
            taxes = tax_ids.compute_all(price_unit=price, quantity=order_line.qty, currency=session_currency).get('taxes', [])
            date_order = order_line.order_id.date_order
            taxes = [{'date_order': date_order, **tax} for tax in taxes]
            return {
                'date_order': order_line.order_id.date_order,
                'income_account_id': get_income_account(order_line),
                'amount': order_line.price_subtotal,
                'taxes': sorted(taxes, key=lambda tax: tax['id'])
            }

        def group_key(line):
            return (
                line['income_account_id'],
                tuple(
                    (tax['id'], tax['account_id'], tax['tax_repartition_line_id'])
                    for tax in line['taxes']
                )
            )

        def compute_sale_line_val(key, lines):
            tax_ids = [tax[0] for tax in key[1]]
            applied_taxes = self.env['account.tax'].browse(tax_ids)
            name = '' if not applied_taxes else 'Sales group: %s' % ', '.join([tax.name for tax in applied_taxes])
            partial_args = {'account_id': key[0], 'move_id': account_move.id, 'tax_ids': [(6, 0, tax_ids)], 'name': name}
            amount = sum(line['amount'] for line in lines)
            amount_converted = (not is_using_company_currency) and sum(
                session_currency._convert(line['amount'], company_currency, company, line['date_order'])
                for line in lines
            )
            return credit_amount(partial_args, amount, amount_converted)

        def compute_tax_line_val(tax_id, account_id, tax_repartition_line_id, taxes):
            tax = self.env['account.tax'].browse(tax_id)
            partial_args = {'account_id': account_id, 'move_id': account_move.id, 'tax_repartition_line_id': tax_repartition_line_id, 'name': tax.name}
            amount = sum(tax['amount'] for tax in taxes)
            amount_converted = (not is_using_company_currency) and sum(
                session_currency._convert(tax['amount'], company_currency, company, tax['date_order'])
                for tax in taxes
            )
            return credit_amount(partial_args, amount, amount_converted)

        def compute_tax_line_vals(key, lines):
            flat_taxes = chain.from_iterable(line['taxes'] for line in lines)
            grouped_taxes = groupby(flat_taxes, key=lambda tax: (tax['id'], tax['account_id'], tax['tax_repartition_line_id']))
            return [compute_tax_line_val(tax_id, account_id, tax_repartition_line_id, taxes) for (tax_id, account_id, tax_repartition_line_id), taxes in grouped_taxes]

        grouped_order_lines = groupby(map(prepare_line, order_lines), key=group_key)
        sales_lines = [compute_sale_line_val(key, lines) for key, lines in grouped_order_lines]
        taxes_lines = list(chain.from_iterable(compute_tax_line_vals(key, lines) for key, lines in grouped_order_lines))
        return sales_lines + taxes_lines

    @api.model
    def _get_anglo_saxon_lines(self, account_move, not_invoiced_orders, is_using_company_currency):
        """ Anglo saxon journal items were already created in the invoiced orders
            via the creation of account.invoice record.

            This method generates args for creating anglo-saxon journal items
            that are grouped by account.

            Calculation is based on the created stock moves when creating the
            picking for each order.
        """
        if len(not_invoiced_orders) == 0:
            return []

        company = not_invoiced_orders[0].company_id
        session_currency = not_invoiced_orders[0].currency_id
        company_currency = company.currency_id

        def generate_move_line_vals(method, account_id, amount, amount_currency):
            partial_args = {'account_id': account_id, 'move_id': account_move.id}
            return getattr(self, method)(partial_args, amount, amount_currency, session_currency, is_using_company_currency)

        StockMove = self.env['stock.move']
        moves = StockMove\
            .search([('pos_order_id', 'in', not_invoiced_orders.ids)])\
            .filtered(lambda m: m.company_id.anglo_saxon_accounting)
        # group amounts by expense and output accounts
        credit_amounts = defaultdict(lambda: {'amount': 0.0, 'amount_converted': 0.0})
        debit_amounts = defaultdict(lambda: {'amount': 0.0, 'amount_converted': 0.0})
        amount_converter = lambda amount, order_id: session_currency._convert(amount, company_currency, company, order_id.date_order)
        for move in moves.filtered(lambda m: m.product_id.categ_id.property_valuation == 'real_time'):
            exp_account = move.product_id.property_account_expense_id or move.product_id.categ_id.property_account_expense_categ_id
            out_account = move.product_id.categ_id.property_stock_account_output_categ_id
            # stock.move.value is recalculated after negative stock, but not the price_unit.
            # Also, stock.move.value is negative when the product goes out of the stock (e.g. sales),
            # so it is appropriate to revert the sign.
            amount = -move.value
            debit_amounts[exp_account]['amount'] += amount
            credit_amounts[out_account]['amount'] += amount
            if not is_using_company_currency:
                amount_converted = amount_converter(amount, move.pos_order_id)
                debit_amounts[exp_account]['amount_converted'] += amount_converted
                credit_amounts[out_account]['amount_converted'] += amount_converted

        credit_lines = [generate_move_line_vals('_credit_amount', account, **amounts) for account, amounts in credit_amounts.items()]
        debit_lines = [generate_move_line_vals('_debit_amount', account, **amounts) for account, amounts in debit_amounts.items()]
        return credit_lines + debit_lines

    @api.model
    def _credit_amount(self, partial_move_line_vals, amount_pos, amount_converted, session_currency, is_using_company_currency):
        """ `partial_move_line_vals` is completed by `credit`ing the given amounts.

        NOTE In pos, all passed amounts are in the currency of journal_id in the session.config_id.
            This means that amount fields in any pos record are actually equivalent to amount_currency
            in account module. Understanding this basic is important in correctly assigning values for
            'amount' and 'amount_currency' in the account.move.line record.

        :param partial_move_line_vals dict:
            initial values in creating account.move.line
        :param amount_pos float:
            amount derived from pos.payment, pos.order, or pos.order.line records
        :param amount_converted float:
            converted value of `amount_pos` from the given `session_currency` to company currency
        :param session_currency 'res.currency':
            currency of the session (based on config_id)
        :param is_using_company_currency bool:
            whether pos session is using company currency (`session_currency` == company currency)

        :return dict: complete values for creating 'amount.move.line' record
        """
        if is_using_company_currency:
            if amount_pos > 0:
                return {'credit': amount_pos, 'debit': 0.0, **partial_move_line_vals}
            else:
                return {'credit': 0.0, 'debit': abs(amount_pos), **partial_move_line_vals}
        else:
            if amount_converted > 0:
                init_vals = {'credit': amount_converted, 'debit': 0.0, **partial_move_line_vals}
            else:
                init_vals = {'credit': 0.0, 'debit': abs(amount_converted), **partial_move_line_vals}
            return {
                'amount_currency': -amount_pos if amount_converted > 0 else amount_pos,
                'currency_id': session_currency.id,
                **init_vals
            }

    @api.model
    def _debit_amount(self, partial_move_line_vals, amount_pos, amount_converted, session_currency, is_using_company_currency):
        """ `partial_move_line_vals` is completed by `debit`ing the given amounts.

        See _credit_amount docs for more details.
        """
        if is_using_company_currency:
            if amount_pos > 0:
                return {'credit': 0.0, 'debit': amount_pos, **partial_move_line_vals}
            else:
                return {'credit': abs(amount_pos), 'debit': 0.0, **partial_move_line_vals}
        else:
            if amount_converted > 0:
                init_vals = {'credit': 0.0, 'debit': amount_converted, **partial_move_line_vals}
            else:
                init_vals = {'credit': abs(amount_converted), 'debit': 0.0, **partial_move_line_vals}
            return {
                'amount_currency': amount_pos if amount_converted > 0 else -amount_pos,
                'currency_id': session_currency.id,
                **init_vals
            }

    @api.multi
    def show_journal_items(self):
        def get_matched_move_lines(aml):
            if aml.credit > 0:
                return [r.debit_move_id.id for r in aml.matched_debit_ids]
            else:
                return [r.credit_move_id.id for r in aml.matched_credit_ids]

        # get all the linked move lines to this account move.
        move = self.move_id
        non_reconcilable_lines = move.line_ids.filtered(lambda aml: not aml.account_id.reconcile)
        reconcilable_lines = move.line_ids - non_reconcilable_lines
        fully_reconciled_lines = reconcilable_lines.filtered(lambda aml: aml.full_reconcile_id)
        partially_reconciled_lines = reconcilable_lines - fully_reconciled_lines

        ids = (non_reconcilable_lines.ids
                + fully_reconciled_lines.mapped('full_reconcile_id').mapped('reconciled_line_ids').ids
                + sum(partially_reconciled_lines.mapped(get_matched_move_lines), partially_reconciled_lines.ids))

        # call the account move line action tree view with default filter (account)
        # and domain containing the calculated ids above
        [action] = self.env.ref('account.action_account_moves_all_a').read()
        action['domain'] = [('id', 'in', ids)]
        return action

    @api.multi
    def action_show_payments_list(self):
        return {
            'name': _('PoS Payments'),
            'type': 'ir.actions.act_window',
            'res_model': 'pos.payment',
            'view_id': self.env.ref('point_of_sale.view_pos_payment_tree').id,
            'view_mode': 'tree',
            'domain': [('session_id', '=', self.id)],
            'context': {'search_default_group_by_payment_method': 1}
        }

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
