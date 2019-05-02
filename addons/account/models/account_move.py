# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.exceptions import RedirectWarning, UserError, ValidationError
from odoo.tools import float_is_zero, float_compare, safe_eval, date_utils
from odoo.tools.misc import formatLang
from odoo.addons import decimal_precision as dp

from datetime import date, datetime
from itertools import groupby
from stdnum.iso7064 import mod_97_10
from itertools import zip_longest
from collections import OrderedDict

import json
import re
import logging
import ast

_logger = logging.getLogger(__name__)


class AccountMove(models.Model):
    _name = "account.move"
    _inherit = ['portal.mixin', 'mail.thread', 'mail.activity.mixin']
    _description = "Journal Entries"
    _order = 'date desc, id desc'

    @api.model
    def _get_default_type(self):
        ''' Get the default type from context. 'misc' is set by default. '''
        return self._context.get('type', 'misc')

    @api.model
    def _get_default_journal(self):
        ''' Get the default journal.
        - The default journal could by passed through the context using the 'default_journal_id' key containing its id.
        - The default journal is determined by the default type (see '_get_default_type').
        '''
        move_type = self._get_default_type()

        if self._context.get('default_journal_id'):
            # /!\ No check ensuring the consistency between the default journal and the default type if passed by the
            # context.
            return self.env['account.journal'].browse(self._context['default_journal_id'])

        journal_type = 'general'
        if move_type in ('out_invoice', 'out_refund', 'out_receipt'):
            journal_type = 'sale'
        elif move_type in ('in_invoice', 'in_refund', 'in_receipt'):
            journal_type = 'purchase'
        company_id = self._context.get('default_company_id', self.env.user.company_id.id)
        domain = [('company_id', '=', company_id), ('type', '=', journal_type)]
        journal = self.env['account.journal'].search(domain, limit=1)

        if not journal:
            raise UserError(_('Please define an accounting %s journal in your company.') % journal_type)
        return journal

    @api.model
    def _get_default_currency(self):
        ''' Get the default currency from either the journal or either the company. '''
        journal = self._get_default_journal()
        return journal.currency_id or journal.company_id.currency_id

    @api.model
    def _get_default_invoice_incoterm(self):
        ''' Get the default incoterm for invoice. '''
        return self.env.user.company_id.incoterm_id

    # ==== Business fields ====
    name = fields.Char(string='Number', required=True, readonly=True, copy=False, default='/')
    date = fields.Date(string='Date', required=True, index=True, readonly=True,
        states={'draft': [('readonly', False)]},
        default=fields.Date.context_today)
    ref = fields.Char(string='Reference', copy=False, readonly=True,
        states={'draft': [('readonly', False)]})
    narration = fields.Text(string='Internal Note')
    state = fields.Selection(selection=[
            ('draft', 'Unposted'),
            ('posted', 'Posted'),
            ('cancel', 'cancelled')
        ], string='Status', required=True, readonly=True, copy=False, tracking=True,
        default='draft')
    type = fields.Selection(selection=[
            ('misc', 'Miscellaneous Operations'),
            ('out_invoice', 'Customer Invoice'),
            ('out_refund', 'Customer Credit Note'),
            ('in_invoice', 'Vendor Bill'),
            ('in_refund', 'Vendor Credit Note'),
            ('out_receipt', 'Sales Receipt'),
            ('in_receipt', 'Purchase Receipt'),
        ], String='Type', required=True, store=True, index=True, readonly=True, tracking=True,
        default=_get_default_type)
    amount_tax = fields.Monetary(string='Tax', store=True, readonly=True,
        compute='_compute_amount')
    amount_untaxed = fields.Monetary(string='Untaxed Amount', store=True, readonly=True, tracking=True,
        compute='_compute_amount')
    amount_total = fields.Monetary(string='Total', store=True, readonly=True,
        compute='_compute_amount',
        inverse='_inverse_amount_total')
    residual = fields.Monetary(string='Amount Due', store=True,
        compute='_compute_amount')
    user_id = fields.Many2one('res.users', readonly=True, copy=False, tracking=True,
        states={'draft': [('readonly', False)]},
        string='Salesperson',
        default=lambda self: self.env.user)
    journal_id = fields.Many2one('account.journal', string='Journal', required=True, readonly=True,
        states={'draft': [('readonly', False)]},
        domain=lambda self: [('company_id', '=', self.env.user.company_id.id)],
        default=_get_default_journal)
    company_id = fields.Many2one(string='Company', store=True, readonly=True,
        related='journal_id.company_id')
    company_currency_id = fields.Many2one(string='Company Currency', readonly=True,
        related='journal_id.company_id.currency_id')
    currency_id = fields.Many2one('res.currency', store=True, readonly=True, tracking=True,
        states={'draft': [('readonly', False)]},
        string='Currency',
        default=_get_default_currency)
    foreign_currency_id = fields.Many2one('res.currency', string='Foreign Currency',
        compute='_compute_foreign_currency_id')
    partner_id = fields.Many2one('res.partner', readonly=True, tracking=True,
        states={'draft': [('readonly', False)]},
        string='Customer/Vendor')
    commercial_partner_id = fields.Many2one('res.partner', string='Commercial Entity', store=True, readonly=True,
        compute='_compute_commercial_partner_id')
    fiscal_position_id = fields.Many2one('account.fiscal.position', string='Fiscal Position', readonly=True,
        states={'draft': [('readonly', False)]},
        help = "Fiscal positions are used to adapt taxes and accounts for particular customers or sales orders/invoices. "
               "The default value comes from the customer.")
    line_ids = fields.One2many('account.move.line', 'move_id', string='Journal Items', copy=True, readonly=True,
        states={'draft': [('readonly', False)]})
    reconcile_model_id = fields.Many2many('account.reconcile.model', compute='_compute_reconcile_model', search='_search_reconcile_model', string="Reconciliation Model", readonly=True)
    to_check = fields.Boolean(string='To Check', default=False,
        help='If this checkbox is ticked, it means that the user was not sure of all the related informations at the time of the creation of the move and that the move needs to be checked again.')
    amount_by_group = fields.Binary(string="Tax amount by group",
        compute='_compute_invoice_taxes_by_group',
        help="type: [(name, amount, base, formated amount, formated base)]")

    # ==== Cash basis feature fields ====
    matched_percentage = fields.Float(string='Percentage Matched', store=True, readonly=True, digits=0,
        compute='_compute_matched_percentage',
        help="Technical field used in cash basis method")
    tax_cash_basis_rec_id = fields.Many2one(
        'account.partial.reconcile',
        string='Tax Cash Basis Entry of',
        help="Technical field used to keep track of the tax cash basis reconciliation. "
             "This is needed when cancelling the source: it will post the inverse journal entry to cancel that part too.")

    # ==== Auto-post feature fields ====
    auto_post = fields.Boolean(string='Post Automatically', default=False,
        help='If this checkbox is ticked, this entry will be automatically posted at its date.')

    # ==== Reverse feature fields ====
    reverse_entry_id = fields.Many2one('account.move', string="Reverse entry", readonly=True, copy=False)
    reverse_entry_ids = fields.One2many('account.move', 'reverse_entry_id', string="Reverse entries", readonly=True)

    # ==== Onchange fields ====
    recompute_taxes = fields.Boolean(store=False)

    # =========================================================
    # Invoice related fields
    # =========================================================

    # ==== Business fields ====
    invoice_payment_state = fields.Selection(selection=[
            ('not_paid', 'Not Paid'),
            ('in_payment', 'In Payment'),
            ('paid', 'paid')
        ], string='Payment Status', store=True, readonly=True, copy=False, tracking=True,
        compute='_compute_amount')
    invoice_date = fields.Date(string='Invoice/Bill Date', readonly=True, index=True, copy=False,
        states={'draft': [('readonly', False)]},
        help="Keep empty to use the current date")
    invoice_date_due = fields.Date(string='Due Date', readonly=True, index=True, copy=False,
        states={'draft': [('readonly', False)]},
        help="If you use payment terms, the due date will be computed automatically at the generation "
             "of accounting entries. The Payment terms may compute several due dates, for example 50% "
             "now and 50% in one month, but if you want to force a due date, make sure that the payment "
             "term is not set on the invoice. If you keep the Payment terms and the due date empty, it "
             "means direct payment.")
    invoice_payment_ref = fields.Char(string='Payment Reference', index=True, copy=False, readonly=True,
        states={'draft': [('readonly', False)]},
        help="The payment reference to set on journal items.")
    invoice_sent = fields.Boolean(readonly=True, default=False, copy=False,
        help="It indicates that the invoice has been sent.")
    invoice_origin = fields.Char(string='Origin', readonly=True, tracking=True)
    invoice_payment_term_id = fields.Many2one('account.payment.term', string='Payment Terms',
        readonly=True, states={'draft': [('readonly', False)]},
        help="If you use payment terms, the due date will be computed automatically at the generation "
             "of accounting entries. If you keep the payment terms and the due date empty, it means direct payment. "
             "The payment terms may compute several due dates, for example 50% now, 50% in one month.")
    invoice_line_ids = fields.One2many('account.move.line', 'move_id', string='Invoice lines',
        copy=False, readonly=True,
        domain=lambda self: [('display_type', 'in', self.env['account.move.line']._get_invoice_line_types())],
        states={'draft': [('readonly', False)]})
    invoice_partner_bank_id = fields.Many2one('res.partner.bank', string='Bank Account',
        help='Bank Account Number to which the invoice will be paid. A Company bank account if this is a Customer Invoice or Vendor Credit Note, otherwise a Partner bank account number.',
        readonly=True, states={'draft': [('readonly', False)]})
    invoice_incoterm_id = fields.Many2one('account.incoterms', string='Incoterm',
        default=_get_default_invoice_incoterm,
        help='International Commercial Terms are a series of predefined commercial terms used in international transactions.')

    # ==== Payment widget fields ====
    invoice_outstanding_credits_debits_widget = fields.Text(groups="account.group_account_invoice",
        compute='_compute_payments_widget_to_reconcile_info')
    invoice_payments_widget = fields.Text(groups="account.group_account_invoice",
        compute='_compute_payments_widget_reconciled_info')
    invoice_has_outstanding = fields.Boolean(groups="account.group_account_invoice",
        compute='_compute_payments_widget_to_reconcile_info')

    # ==== Vendor bill fields ====
    invoice_vendor_bill_id = fields.Many2one('account.move', store=False, readonly=True,
        states={'draft': [('readonly', False)]},
        string='Vendor Bill',
        help="Auto-complete from a past bill.")
    invoice_source_email = fields.Char(string='Source Email', tracking=True)
    invoice_vendor_display_name = fields.Char(compute='_compute_invoice_vendor_display_info', store=True)
    invoice_vendor_icon = fields.Char(compute='_compute_invoice_vendor_display_info', store=False)

    # ==== Cash rounding fields ====
    invoice_cash_rounding_id = fields.Many2one('account.cash.rounding', string='Cash Rounding Method',
        readonly=True, states={'draft': [('readonly', False)]},
        help='Defines the smallest coinage of the currency that can be used to pay by cash.')

    # ==== Fields to set the sequence, on the first invoice of the journal ====
    invoice_sequence_number_next = fields.Char(string='Next Number',
        compute='_compute_invoice_sequence_number_next',
        inverse='_inverse_invoice_sequence_number_next')
    invoice_sequence_number_next_prefix = fields.Char(string='Next Number Prefix',
        compute="_compute_invoice_sequence_number_next")

    # ==== Suspense account fields ====
    invoice_edition_mode_available = fields.Boolean(compute='_get_edition_mode_available',
        groups='account.group_account_invoice')

    # ==== Display purpose fields ====
    invoice_filter_type_domain = fields.Char(compute='_compute_invoice_filter_type_domain',
        help="Technical field used to have a dynamic domain on the form view.")

    # -------------------------------------------------------------------------
    # ONCHANGE METHODS
    # -------------------------------------------------------------------------

    @api.onchange('invoice_date')
    def _onchange_invoice_date(self):
        if self.invoice_date:
            self.date = self.invoice_date

    @api.onchange('journal_id')
    def _onchange_journal(self):
        if self.journal_id:
            # Don't trigger '_onchange_currency' if the currency is the same.
            new_currency = self.journal_id.currency_id or self.journal_id.company_id.currency_id
            if new_currency != self.currency_id:
                self.currency_id = new_currency

    @api.onchange('partner_id')
    def _onchange_partner_id(self):
        # Force a call to 'onchange' when changing the partner.
        pass

    @api.onchange('date')
    def _onchange_date(self):
        for line in self.line_ids:
            line._onchange_price_subtotal()

    @api.onchange('currency_id')
    def _onchange_currency(self):
        company_currency = self.company_id.currency_id
        has_foreign_currency = self.currency_id and self.currency_id != company_currency

        for line in self.line_ids:
            new_currency = has_foreign_currency and self.currency_id
            if new_currency != line.currency_id:
                line.currency_id = new_currency
                line._onchange_price_subtotal()

    @api.onchange('invoice_payment_ref')
    def _onchange_invoice_payment_ref(self):
        for line in self.line_ids.filtered(lambda line: line._is_invoice_payment_term_line()):
            line.name = self.invoice_payment_ref

    @api.onchange('type')
    def _onchange_type(self):
        ''' Onchange made to filter the partners depending of the type. '''
        if self.type in ('out_invoice', 'out_refund', 'out_receipt'):
            return {'domain': {'partner_id': [('customer', '=', True)]}}
        elif self.type in ('in_invoice', 'in_refund', 'in_receipt'):
            return {'domain': {'partner_id': [('supplier', '=', True)]}}

    @api.onchange('company_id')
    def _onchange_company_id(self):
        if self.company_id:
            for line in self.line_ids:
                if any(tax.company_id != self.company_id for tax in line.tax_ids):
                    line.tax_ids = line.tax_ids.filtered(lambda tax: tax.company_id == self.company_id)
                    line.recompute_tax_line = True
        if self.type in ('out_invoice', 'in_refund') and self.company_id.partner_id:
            partner_bank_result = self.env['res.partner.bank'].search(
                [('partner_id', '=', self.company_id.partner_id.id)], limit=1)
            if partner_bank_result:
                self.invoice_partner_bank_id = partner_bank_result
            return {'domain': {'invoice_partner_bank_id': [('partner_id', '=', self.company_id.partner_id.id)]}}

    @api.onchange('invoice_line_ids', 'line_ids')
    def _onchange_line_ids(self):
        pass

    @api.onchange('invoice_payment_term_id', 'invoice_date_due', 'invoice_cash_rounding_id', 'invoice_vendor_bill_id')
    def _onchange_force_onchange(self):
        pass

    @api.multi
    def _onchange_account_move_pre_hook(self, field_names):
        # Manage change of partner_id.
        # This is made at the beginning as a change of the fiscal position has a direct impact to newly created lines.
        if 'partner_id' in field_names and self.partner_id:
            if 'invoice_payment_term_id' not in field_names:
                if self.type in ('out_invoice', 'out_refund', 'out_receipt'):
                    self.invoice_payment_term_id = self.partner_id.property_payment_term_id
                elif self.type in ('in_invoice', 'in_refund', 'in_receipt'):
                    self.invoice_payment_term_id = self.partner_id.property_supplier_payment_term_id
            if 'fiscal_position_id' not in field_names:
                # Find the new fiscal position.
                delivery_partner_id = self._get_invoice_delivery_partner_id()
                new_fiscal_position_id = self.env['account.fiscal.position'].get_fiscal_position(
                    self.partner_id.id, delivery_id=delivery_partner_id)
                self.fiscal_position_id = self.env['account.fiscal.position'].browse(new_fiscal_position_id)

        # Load from old vendor bill.
        if self.invoice_vendor_bill_id:
            # Copy invoice lines.
            for line in self.invoice_vendor_bill_id.invoice_line_ids:
                copied_vals = line.copy_data()[0]
                copied_vals['move_id'] = self.id
                new_line = self.env['account.move.line'].new(copied_vals)
                new_line.recompute_tax_line = True

            # Copy payment terms.
            self.invoice_payment_term_id = self.invoice_vendor_bill_id.invoice_payment_term_id

            # Copy currency.
            if self.currency_id != self.invoice_vendor_bill_id.currency_id:
                self.currency_id = self.invoice_vendor_bill_id.currency_id

            # Reset
            self.invoice_vendor_bill_id = False

    @api.multi
    def _onchange_process_dynamic_lines(self, options):
        recompute_all_taxes = options.get('recompute_all_taxes')
        recompute_check_taxes = options.get('recompute_check_taxes')

        is_invoice = self.type in ('out_invoice', 'out_refund', 'in_invoice', 'in_refund', 'out_receipt', 'in_receipt')
        base_lines = self.env['account.move.line']
        taxes_lines = self.env['account.move.line']
        terms_lines = self.env['account.move.line']
        rounding_lines = self.env['account.move.line']
        taxes_map = {}
        terms_map = {}

        # Dispatch lines and pre-compute some aggregated values like taxes.
        for line in self.line_ids:
            if line.recompute_tax_line:
                recompute_all_taxes = True
                line.recompute_tax_line = False
            if line.tax_line_id:
                taxes_lines += line
                key = (
                    line.tax_line_id.id,
                    line.currency_id.id,
                    line.tax_line_id.analytic and tuple(line.analytic_tag_ids.ids),
                    line.tax_line_id.analytic and line.analytic_account_id.id,
                )
                taxes_map[key] = [line, 0.0, 0.0, False]
            elif is_invoice and line._is_invoice_payment_term_line():
                terms_lines += line
                terms_map[fields.Date.to_string(line.date_maturity)] = line
            elif is_invoice and line._is_invoice_cash_rounding_line():
                rounding_lines += line
            elif is_invoice and line._is_invoice_line():
                base_lines += line
            else:
                base_lines += line

        # Compute taxes.
        if recompute_all_taxes or recompute_check_taxes:

            # Compute taxes amounts.
            for line in base_lines:
                if not line.tax_ids:
                    continue

                balance_taxes_res = line.tax_ids.with_context(force_price_include=False).compute_all(
                    line.balance, currency=line.company_currency_id, partner=line.partner_id)
                if line.currency_id:
                    # Multi-currencies mode: Taxes are computed both in company's currency / foreign currency.
                    amount_currency_taxes_res = line.tax_ids.with_context(force_price_include=False).compute_all(
                        line.amount_currency, currency=line.currency_id, partner=line.partner_id)
                else:
                    # Single-currency mode: Only company's currency is considered.
                    amount_currency_taxes_res = {'taxes': [{'amount': 0.0} for tax_res in balance_taxes_res['taxes']]}

                tax_exigible = True
                for b_tax_res, ac_tax_res in zip(balance_taxes_res['taxes'], amount_currency_taxes_res['taxes']):
                    tax = self.env['account.tax'].browse(b_tax_res['id'])
                    if tax.tax_exigibility == 'on_payment':
                        tax_exigible = False

                    key = (
                        tax.id,
                        line.currency_id.id,
                        tax.analytic and tuple(line.analytic_tag_ids.ids),
                        tax.analytic and line.analytic_account_id.id,
                    )
                    if key not in taxes_map:
                        taxes_map[key] = [None, 0.0, 0.0, True]
                        recompute_all_taxes = True
                    taxes_map[key][1] += b_tax_res['amount']
                    taxes_map[key][2] += ac_tax_res['amount']
                    taxes_map[key][3] = True
                line.tax_exigible = tax_exigible

            # Compute taxes lines.
            for key, value in taxes_map.items():
                if not recompute_all_taxes:
                    continue

                tax_line, balance, amount_currency, processed = value

                if tax_line:
                    tax_line.update({
                        'amount_currency': amount_currency,
                        'debit': balance > 0.0 and balance or 0.0,
                        'credit': balance < 0.0 and -balance or 0.0,
                    })
                else:
                    account = line._get_default_tax_account(tax, balance)
                    tax_line = self.env['account.move.line'].new({
                        'name': tax.name,
                        'debit': balance > 0.0 and balance or 0.0,
                        'credit': balance < 0.0 and -balance or 0.0,
                        'quantity': 1.0,
                        'amount_currency': amount_currency,
                        'date_maturity': line.date_maturity,
                        'tax_exigible': tax.tax_exigibility == 'on_invoice',
                        'move_id': self.id,
                        'currency_id': line.currency_id.id,
                        'company_id': line.company_id.id,
                        'company_currency_id': line.company_currency_id.id,
                        'account_id': account.id,
                        'partner_id': line.partner_id.id,
                        'tax_line_id': tax.id,
                        'analytic_account_id': line.analytic_account_id.id if tax.analytic else False,
                        'analytic_tag_ids': [(6, 0, line.analytic_tag_ids.ids)] if tax.analytic else False,
                        'display_type': 'tax',
                    })
                    taxes_lines += tax_line
                tax_line._onchange_amount_currency()
                tax_line._onchange_balance()

            # Drop taxes lines that are no longer required.
            for key, value in taxes_map.items():
                if not value[3]:
                    self.line_ids -= value[0]
                    taxes_lines -= value[0]

        if is_invoice:
            # Compute totals.
            total_balance = total_amount_currency = 0.0
            for line in base_lines:
                total_balance += line.balance
                total_amount_currency += line.amount_currency
            for line in taxes_lines:
                total_balance += line.balance
                total_amount_currency += line.amount_currency

            # Compute cash rounding.
            if self.invoice_cash_rounding_id:
                # Clear lines if the mode has changed.
                strategy = self.invoice_cash_rounding_id.strategy
                if rounding_lines and \
                        (strategy == 'biggest_tax' and rounding_lines.display_type == 'product_cr') \
                        or (strategy == 'add_invoice_line' and rounding_lines.display_type == 'tax_cr'):
                    self.line_ids -= rounding_lines
                    rounding_lines = self.env['account.move.line']

                if self.currency_id == self.company_id.currency_id:
                    diff_balance = self.invoice_cash_rounding_id.compute_difference(self.company_id.currency_id, total_balance)
                    diff_amount_currency = 0.0
                    currency = False
                else:
                    currency = self.currency_id
                    diff_amount_currency = self.invoice_cash_rounding_id.compute_difference(self.currency_id, total_amount_currency)
                    diff_balance = currency._convert(diff_amount_currency, self.company_id.currency_id, self.company_id, self.date)

                if strategy == 'biggest_tax' and rounding_lines:
                    rounding_lines.update({
                        'amount_currency': diff_amount_currency,
                        'debit': diff_balance > 0.0 and diff_balance or 0.0,
                        'credit': diff_balance < 0.0 and -diff_balance or 0.0,
                    })
                    total_balance += diff_balance
                    total_amount_currency += diff_amount_currency
                elif strategy == 'biggest_tax' and not rounding_lines:
                    # Search for the biggest tax.
                    biggest_tax_line = None
                    for tax_line in taxes_lines:
                        if not biggest_tax_line or tax_line.balance > biggest_tax_line.balance:
                            biggest_tax_line = tax_line

                    if biggest_tax_line:
                        rounding_lines = self.env['account.move.line'].new({
                            'name': _('%s (rounding)') % biggest_tax_line.name,
                            'debit': diff_balance > 0.0 and diff_balance or 0.0,
                            'credit': diff_balance < 0.0 and -diff_balance or 0.0,
                            'quantity': 1.0,
                            'amount_currency': diff_amount_currency,
                            'account_id': biggest_tax_line.account_id.id,
                            'partner_id': self.partner_id.id,
                            'move_id': self.id,
                            'currency_id': currency and currency.id,
                            'company_id': self.company_id.id,
                            'company_currency_id': self.company_id.currency_id.id,
                            'date_maturity': self.invoice_date_due,
                            'tax_line_id': biggest_tax_line.tax_line_id.id,
                            'display_type': 'tax_cr',
                            'sequence': 9999,
                        })
                        total_balance += diff_balance
                        total_amount_currency += diff_amount_currency
                elif strategy == 'add_invoice_line' and rounding_lines:
                    rounding_lines.update({
                        'amount_currency': diff_amount_currency,
                        'debit': diff_balance > 0.0 and diff_balance or 0.0,
                        'credit': diff_balance < 0.0 and -diff_balance or 0.0,
                    })
                    total_balance += diff_balance
                    total_amount_currency += diff_amount_currency
                elif strategy == 'add_invoice_line' and not rounding_lines:
                    rounding_lines = self.env['account.move.line'].new({
                        'name': self.invoice_cash_rounding_id.name,
                        'debit': diff_balance > 0.0 and diff_balance or 0.0,
                        'credit': diff_balance < 0.0 and -diff_balance or 0.0,
                        'quantity': 1.0,
                        'amount_currency': diff_amount_currency,
                        'account_id': self.invoice_cash_rounding_id.account_id.id,
                        'partner_id': self.partner_id.id,
                        'move_id': self.id,
                        'currency_id': currency and currency.id,
                        'company_id': self.company_id.id,
                        'company_currency_id': self.company_id.currency_id.id,
                        'sequence': 9999,
                        'date_maturity': self.invoice_date_due,
                        'display_type': 'product_cr',
                    })
                    total_balance += diff_balance
                    total_amount_currency += diff_amount_currency

                rounding_lines._onchange_amount_currency()
                rounding_lines._onchange_balance()
            else:
                self.line_ids -= rounding_lines

            # Compute payment terms.
            if not self.invoice_date:
                self.invoice_date = fields.Date.context_today(self)

            if self.invoice_payment_term_id:
                terms_date = self.invoice_date
            else:
                terms_date = self.invoice_date_due or self.invoice_date

            if not base_lines and not taxes_lines:
                self.line_ids -= terms_lines
                return

            # Compute payment terms account.
            # Find the receivable/payable account.
            # /!\ The partner could not be set on a receipt.
            if terms_lines:
                # Retrieve account from previous payment terms lines.
                account = terms_lines[0].account_id
            elif self.partner_id:
                # Retrieve account from partner.
                if self.type in ('out_invoice', 'out_refund', 'out_receipt'):
                    account = self.partner_id.property_account_receivable_id
                elif self.type in ('in_invoice', 'in_refund', 'in_receipt'):
                    account = self.partner_id.property_account_payable_id
                else:
                    account = None
            elif self.type in ('out_receipt', 'in_receipt', 'out_invoice', 'out_refund', 'in_invoice', 'in_refund'):
                # Search new account.
                domain = [('company_id', '=', self.company_id.id)]
                domain.append(('internal_type', '=', 'receivable' if self.type == 'out_receipt' else 'payable'))
                account = self.env['account.account'].search(domain, limit=1)
            else:
                account = None

            # Compute payment terms lines.
            max_date_maturity = False
            if self.invoice_payment_term_id:
                to_compute = self.invoice_payment_term_id.compute(
                    total_balance, date_ref=terms_date, currency=self.currency_id)
                if self.currency_id != self.company_id.currency_id:
                    # Multi-currencies.
                    to_compute_currency = self.invoice_payment_term_id.compute(
                        total_amount_currency, date_ref=terms_date, currency=self.currency_id)
                    to_compute = [(b[0], b[1], ac[1]) for b, ac in zip(to_compute, to_compute_currency)]
                else:
                    # Single-currency.
                    to_compute = [(b[0], b[1], 0.0) for b in to_compute]
            else:
                to_compute = [(fields.Date.to_string(terms_date), total_balance, total_amount_currency)]

            terms_lines_to_keep = self.env['account.move.line']
            for date_maturity, balance, amount_currency in to_compute:

                # Keep track of the max encountered maturity date.
                if not max_date_maturity or date_maturity > max_date_maturity:
                    max_date_maturity = date_maturity

                candidate = terms_map.pop(date_maturity, None)

                if candidate:
                    candidate.update({
                        'amount_currency': -amount_currency,
                        'debit': balance < 0.0 and -balance or 0.0,
                        'credit': balance > 0.0 and balance or 0.0,
                    })
                else:
                    candidate = self.env['account.move.line'].new({
                        'name': self.invoice_payment_ref or '/',
                        'debit': balance < 0.0 and -balance or 0.0,
                        'credit': balance > 0.0 and balance or 0.0,
                        'quantity': 1.0,
                        'amount_currency': -amount_currency,
                        'date_maturity': date_maturity,
                        'move_id': self.id,
                        'currency_id': self.currency_id.id if self.currency_id != self.company_id.currency_id else False,
                        'account_id': account.id,
                        'partner_id': self.commercial_partner_id.id,
                        'display_type': 'balance',
                    })
                terms_lines_to_keep += candidate

            terms_lines_to_keep._onchange_amount_currency()
            terms_lines_to_keep._onchange_balance()
            self.line_ids -= terms_lines - terms_lines_to_keep
            terms_lines = terms_lines_to_keep

            # Set date_maturity in others lines.
            for line in base_lines:
                line.date_maturity = max_date_maturity
            for line in taxes_lines:
                line.date_maturity = max_date_maturity

            # Update invoice_payment_ref.
            self.invoice_payment_ref = terms_lines and terms_lines[0].name or '/'

            # Update the date_maturity.
            self.invoice_date_due = max_date_maturity

    @api.multi
    def _onchange_account_move_post_hook(self, field_names, snapshot0, snapshot1):
        def field_has_changed(field_name):
            return field_name in field_names or snapshot0.get(field_name) != snapshot1.get(field_name)

        recompute_all_taxes = recompute_check_taxes = recompute_auto_balance = False

        if field_has_changed('currency_id') or field_has_changed('date'):
            recompute_all_taxes = True

            # Currency has changed so 'amount_currency' must be recomputed.
            self.line_ids._onchange_price_subtotal()
        if field_has_changed('invoice_cash_rounding_id') \
                or field_has_changed('invoice_payment_term_id') \
                or field_has_changed('invoice_payment_ref') \
                or field_has_changed('invoice_date_due'):
            recompute_auto_balance = True

        self._onchange_process_dynamic_lines({
            'recompute_all_taxes': recompute_all_taxes or self.recompute_taxes,
            'recompute_check_taxes': recompute_check_taxes,
            'recompute_auto_balance': recompute_auto_balance,
        })

    @api.multi
    def _onchange(self, field_names, field_onchange, nametree, snapshot0):
        # OVERRIDE

        with self.env.do_in_onchange():
            # Synchronize 'invoice_line_ids' with 'line_ids' by applying the changes made on a o2m to the another one.
            # For example, if a line has been removed/modified, the changes must be made here to be present on the diff
            # returned client side.
            to_remove = self.env['account.move.line']
            for line in self.line_ids:
                if line.remove_line:
                    to_remove += line
                elif line.update_line:
                    line.update(ast.literal_eval(line.update_line))
                    line.update_line = None
            self.line_ids -= to_remove

            # Hook allowing loading dynamic data such news lines coming from another business document before executing the
            # onchange. This is made like this as it could impact a lot of fields.
            self._onchange_account_move_pre_hook(field_names)

        snapshot1, result = super(AccountMove, self)._onchange(field_names, field_onchange, nametree, snapshot0)

        with self.env.do_in_onchange():
            self._onchange_account_move_post_hook(field_names, snapshot0, snapshot1)
            snapshot1 = models.Snapshot(self, nametree)

        return snapshot1, result

    @api.multi
    def onchange(self, values, field_name, field_onchange):
        # OVERRIDE

        def is_invoice_line(command):
            # Check if the command is about an invoice line.
            display_types = self.env['account.move.line']._get_invoice_line_types()
            if command[0] == 0 and command[2]['display_type'] in display_types:
                return True
            if command[0] == 1:
                if 'display_type' in command[2]:
                    return command[2]['display_type'] in display_types
                else:
                    return self.env['account.move.line'].browse(command[1]).display_type in display_types
            if command[0] == 4 and self.env['account.move.line'].browse(command[1]).display_type in display_types:
                return True
            return False

        def serialize_dict(vals):
            new_vals = {}
            for k, v in vals.items():
                if isinstance(v, date):
                    new_vals[k] = fields.Date.to_string(v)
                elif isinstance(v, datetime):
                    new_vals[k] = fields.Datetime.to_string(v)
                elif k != 'id':
                    new_vals[k] = v
            return new_vals

        def hack_o2m_command(command):
            # Hack to simulate the changes comes from Python instead of the user interface to make sure the
            # correct diff is returned JS-side.
            if command[0] == 0:
                command = (command[0], command[1], {
                    'update_line': str(serialize_dict(command[2])),
                    'display_type': command[2]['display_type']
                })
            elif command[1] == 1:
                command = (1, command[1], {'update_line': str(serialize_dict(command[2]))})
            elif command[0] == 2:
                command = (1, command[1], {'remove_line': True})
                values['recompute_taxes'] = True
            return command

        def update_amls_from_imls(values):
            imls = values['invoice_line_ids']
            amls = values['line_ids']
            amls_map = OrderedDict()
            for aml in amls:
                amls_map[aml[1]] = (aml, False)
            values['invoice_line_ids'] = []
            values['line_ids'] = []
            for iml in imls:
                if iml[1] in amls_map:
                    iml = hack_o2m_command(iml)
                amls_map[iml[1]] = (iml, True)
                values['invoice_line_ids'].append(iml)
            for aml, processed in amls_map.values():
                if is_invoice_line(aml) and not processed:
                    values['recompute_taxes'] = True
                    continue
                values['line_ids'].append(aml)

        def update_imls_from_amls(values):
            amls = values['line_ids']
            values['invoice_line_ids'] = []
            values['line_ids'] = []
            for aml in amls:
                if is_invoice_line(aml):
                    aml = hack_o2m_command(aml)
                    values['invoice_line_ids'].append(aml)
                values['line_ids'].append(aml)

        def compute_diff_imls_from_amls(values):
            amls = values['line_ids']
            values['invoice_line_ids'] = []
            for aml in amls:
                if aml[0] == 5 or is_invoice_line(aml):
                    values['invoice_line_ids'].append(aml)

        if not isinstance(field_name, list):
            field_name = [field_name]

        if 'invoice_line_ids' in field_name:
            update_amls_from_imls(values)
        elif 'line_ids' in field_name:
            update_imls_from_amls(values)

        res = super(AccountMove, self).onchange(values, field_name, field_onchange)
        if 'value' in res and res['value'].get('line_ids'):
            compute_diff_imls_from_amls(res['value'])

        return res

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('type')
    def _compute_invoice_filter_type_domain(self):
        for move in self:
            if move.type in ('out_invoice', 'out_refund', 'out_receipt'):
                move.invoice_filter_type_domain = 'sale'
            elif move.type in ('in_invoice', 'in_refund', 'in_receipt'):
                move.invoice_filter_type_domain = 'purchase'
            else:
                move.invoice_filter_type_domain = False

    @api.depends('currency_id')
    def _compute_foreign_currency_id(self):
        for move in self:
            move.foreign_currency_id = move.currency_id != move.company_id.currency_id and move.currency_id

    @api.depends('partner_id')
    def _compute_commercial_partner_id(self):
        for move in self:
            move.commercial_partner_id = move.partner_id.commercial_partner_id

    @api.depends(
        'line_ids.debit', 'line_ids.credit',
        'line_ids.matched_debit_ids.amount', 'line_ids.matched_credit_ids.amount',
        'line_ids.account_id.user_type_id.type')
    def _compute_matched_percentage(self):
        """Compute the percentage to apply for cash basis method. This value is relevant only for moves that
        involve journal items on receivable or payable accounts.
        """
        for move in self:
            total_amount = 0.0
            total_reconciled = 0.0
            for line in move.line_ids:
                if line.account_id.user_type_id.type in ('receivable', 'payable'):
                    amount = abs(line.debit - line.credit)
                    total_amount += amount
                    for partial_line in (line.matched_debit_ids + line.matched_credit_ids):
                        total_reconciled += partial_line.amount
            precision_currency = move.currency_id or move.company_id.currency_id
            if float_is_zero(total_amount, precision_rounding=precision_currency.rounding):
                move.matched_percentage = 1.0
            else:
                move.matched_percentage = total_reconciled / total_amount

    @api.depends(
        'line_ids.debit',
        'line_ids.credit',
        'line_ids.currency_id',
        'line_ids.amount_currency',
        'line_ids.amount_residual',
        'line_ids.amount_residual_currency',
        'line_ids.payment_id.state')
    def _compute_amount(self):
        candidate_in_pay_move_ids = [move.id for move in self
                                     if isinstance(move.id, int)
                                     and move.type in ('out_invoice', 'out_refund', 'out_receipt', 'in_invoice', 'in_refund', 'in_receipt')]
        if candidate_in_pay_move_ids:
            self._cr.execute(
                '''
                    SELECT move.id
                    FROM account_move move
                    JOIN account_move_line line ON line.move_id = move.id
                    JOIN account_partial_reconcile part ON part.debit_move_id = line.id OR part.credit_move_id = line.id
                    JOIN account_move_line rec_line ON 
                        (rec_line.id = part.credit_move_id AND line.id = part.debit_move_id)
                        OR
                        (rec_line.id = part.debit_move_id AND line.id = part.credit_move_id)
                    JOIN account_payment payment ON payment.id = rec_line.payment_id
                    JOIN account_journal journal ON journal.id = rec_line.journal_id
                    WHERE payment.state IN ('posted', 'sent')
                    AND journal.post_at_bank_rec IS TRUE
                    AND move.id IN %s
                ''', [tuple(candidate_in_pay_move_ids)]
            )
            in_payment_set = set(res[0] for res in self._cr.fetchall())
        else:
            in_payment_set = {}

        for move in self:
            total_untaxed = 0.0
            total_untaxed_currency = 0.0
            total_tax = 0.0
            total_tax_currency = 0.0
            total_residual = 0.0
            total_residual_currency = 0.0
            currencies = set()

            for line in move.line_ids:
                if line.currency_id:
                    currencies.add(line.currency_id)

                if move.type == 'misc':
                    # Miscellaneous operation.
                    total_residual += line.amount_residual
                    total_residual_currency += line.amount_residual_currency

                    if not line.debit:
                        continue
                    if not line.tax_line_id:
                        total_untaxed += line.balance
                        total_untaxed_currency += line.amount_currency
                    else:
                        total_tax += line.balance
                        total_tax_currency += line.amount_currency
                else:
                    # Invoice.
                    if line._is_invoice_line():
                        total_untaxed += line.balance
                        total_untaxed_currency += line.amount_currency
                    elif line.tax_line_id:
                        total_tax += line.balance
                        total_tax_currency += line.amount_currency
                    elif line._is_invoice_payment_term_line():
                        total_residual += line.amount_residual
                        total_residual_currency += line.amount_residual_currency

            total = total_untaxed + total_tax
            total_currency = total_untaxed_currency + total_tax_currency

            if (move.type == 'misc' and total < 0.0) or move.type in ('out_invoice', 'in_refund', 'out_receipt'):
                sign = -1
            else:
                sign = 1

            move.amount_untaxed = sign * (total_untaxed_currency if len(currencies) == 1 else total_untaxed)
            move.amount_tax = sign * (total_tax_currency if len(currencies) == 1 else total_tax)
            move.amount_total = sign * (total_currency if len(currencies) == 1 else total)
            move.residual = -sign * (total_residual_currency if len(currencies) == 1 else total_residual)

            currency = len(currencies) == 1 and currencies.pop() or move.company_id.currency_id
            is_paid = currency and currency.is_zero(move.residual) or not move.residual

            # Compute 'invoice_payment_state'.
            if move.state == 'posted' and is_paid:
                if move.id in in_payment_set:
                    move.invoice_payment_state = 'in_payment'
                else:
                    move.invoice_payment_state = 'paid'
            else:
                move.invoice_payment_state = 'not_paid'

    @api.multi
    def _inverse_amount_total(self):
        for move in self:
            if len(move.line_ids) != 2 or move.type != 'misc':
                continue

            to_write = []

            if move.currency_id != move.company_id.currency_id:
                amount_currency = abs(move.amount_total)
                balance = move.currency_id._convert(amount_currency, move.currency_id, move.company_id, move.date)
            else:
                balance = abs(move.amount_total)
                amount_currency = 0.0

            for line in move.line_ids:
                to_write.append((1, line.id, {
                    'debit': line.balance > 0.0 and balance or 0.0,
                    'credit': line.balance < 0.0 and balance or 0.0,
                    'amount_currency': line.balance > 0.0 and amount_currency or -amount_currency,
                }))

            move.write({'line_ids': to_write})

    @api.depends('line_ids.reconcile_model_id')
    def _compute_reconcile_model(self):
        for move in self:
            move.reconcile_model_id = move.line_ids.mapped('reconcile_model_id')

    @api.multi
    def _get_domain_edition_mode_available(self):
        self.ensure_one()
        domain = self.env['account.move.line']._get_domain_for_edition_mode()
        domain += ['|', ('partner_id', '=?', self.partner_id.id), ('partner_id', '=', False)]
        if self.type in ('out_invoice', 'in_refund'):
            domain.append(('balance', '=', -self.residual))
        else:
            domain.append(('balance', '=', self.residual))
        return domain

    @api.multi
    def _get_edition_mode_available(self):
        for r in self:
            domain = r._get_domain_edition_mode_available()
            domain2 = [('state', '=', 'open'), ('residual', '=', r.residual), ('type', '=', r.type)]
            r.edition_mode_available = r.state == 'open' and (0 < self.env['account.move.line'].search_count(domain) < 5) and self.env[
                'account.move'].search_count(domain2) < 5

    @api.depends('partner_id', 'invoice_source_email')
    def _compute_invoice_vendor_display_info(self):
        for move in self:
            vendor_display_name = move.partner_id.name
            move.invoice_icon = ''
            if not vendor_display_name:
                if move.invoice_source_email:
                    vendor_display_name = _('From: ') + move.invoice_source_email
                    move.invoice_vendor_icon = '@'
                else:
                    vendor_display_name = ('Created by: ') + move.create_uid.name
                    move.invoice_vendor_icon = '#'
            move.invoice_vendor_display_name = vendor_display_name

    @api.depends('state', 'journal_id', 'invoice_date')
    def _compute_invoice_sequence_number_next(self):
        """ computes the prefix of the number that will be assigned to the first invoice/bill/refund of a journal, in order to
        let the user manually change it.
        """
        # Check user group.
        system_user = self.env.user._is_system()
        if not system_user:
            return

        # Check moves being candidates to set a custom number next.
        moves = self.filtered(lambda move: move.type in ('out_invoice', 'out_refund', 'in_invoice', 'in_refund') and move.name == '/')
        if not moves:
            return

        for key, group in groupby(moves, key=lambda move: (move.journal_id, move._get_sequence())):
            journal, sequence = key
            domain = [('journal_id', '=', journal.id), ('state', '=', 'posted')]
            if not isinstance(self.id, models.NewId):
                domain.append(('id', '!=', self.id))
            if journal.type == 'sale':
                domain.append(('type', 'in', ('out_invoice', 'out_refund')))
            elif journal.type == 'purchase':
                domain.append(('type', 'in', ('in_invoice', 'in_refund')))
            else:
                continue
            if self.search_count(domain):
                continue

            for move in group:
                prefix, dummy = sequence._get_prefix_suffix(date=move.invoice_date or fields.Date.today(), date_range=move.invoice_date)
                number_next = sequence._get_current_sequence().number_next_actual
                move.invoice_sequence_number_next_prefix = prefix
                move.invoice_sequence_number_next = '%%0%sd' % sequence.padding % number_next

    @api.multi
    def _inverse_invoice_sequence_number_next(self):
        ''' Set the number_next on the sequence related to the invoice/bill/refund'''
        # Check user group.
        if not self.env.user._is_admin():
            return

        # Set the next number in the sequence.
        for move in self:
            if not move.invoice_sequence_number_next:
                continue
            sequence = move._get_sequence()
            nxt = re.sub("[^0-9]", '', move.invoice_sequence_number_next)
            result = re.match("(0*)([0-9]+)", nxt)
            if result and sequence:
                date_sequence = sequence._get_current_sequence()
                date_sequence.number_next_actual = int(result.group(2))

    @api.multi
    def _compute_payments_widget_to_reconcile_info(self):
        for move in self:
            move.invoice_outstanding_credits_debits_widget = json.dumps(False)

            if move.state != 'posted' or move.type not in ('out_invoice', 'out_refund', 'in_invoice', 'in_refund'):
                continue
            pay_term_line_ids = move.line_ids.filtered(lambda line: line._is_invoice_payment_term_line())

            domain = [('move_id.state', '=', 'posted'),
                      ('account_id', 'in', pay_term_line_ids.mapped('account_id').ids),
                      ('partner_id', '=', move.commercial_partner_id.id),
                      ('reconciled', '=', False), '|', ('amount_residual', '!=', 0.0),
                      ('amount_residual_currency', '!=', 0.0)]

            if move.type in ('out_invoice', 'in_refund'):
                domain.extend([('credit', '>', 0), ('debit', '=', 0)])
                type_payment = _('Outstanding credits')
            else:
                domain.extend([('credit', '=', 0), ('debit', '>', 0)])
                type_payment = _('Outstanding debits')
            info = {'title': '', 'outstanding': True, 'content': [], 'move_id': move.id}
            lines = self.env['account.move.line'].search(domain)
            currency_id = move.currency_id
            if len(lines) != 0:
                for line in lines:
                    # get the outstanding residual value in invoice currency
                    if line.currency_id and line.currency_id == move.currency_id:
                        amount_to_show = abs(line.amount_residual_currency)
                    else:
                        currency = line.company_id.currency_id
                        amount_to_show = currency._convert(abs(line.amount_residual), move.currency_id, move.company_id,
                                                           line.date or fields.Date.today())
                    if float_is_zero(amount_to_show, precision_rounding=move.currency_id.rounding):
                        continue
                    info['content'].append({
                        'journal_name': line.ref or line.move_id.name,
                        'amount': amount_to_show,
                        'currency': currency_id.symbol,
                        'id': line.id,
                        'position': currency_id.position,
                        'digits': [69, move.currency_id.decimal_places],
                    })
                info['title'] = type_payment
                move.invoice_outstanding_credits_debits_widget = json.dumps(info)
                move.invoice_has_outstanding = True

    @api.multi
    def _get_reconciled_info_JSON_values(self):
        self.ensure_one()
        foreign_currency = self.currency_id if self.currency_id != self.company_id.currency_id else False

        reconciled_vals = []
        pay_term_line_ids = self.line_ids.filtered(lambda line: line._is_invoice_payment_term_line())
        partials = pay_term_line_ids.mapped('matched_debit_ids') + pay_term_line_ids.mapped('matched_credit_ids')
        for partial in partials:
            counterpart_lines = partial.debit_move_id + partial.credit_move_id
            counterpart_line = counterpart_lines.filtered(lambda line: line not in self.line_ids)

            if foreign_currency and partial.currency_id == foreign_currency:
                amount = partial.amount_currency
            else:
                amount = partial.company_currency_id._convert(partial.amount, self.currency_id, self.company_id, self.date)

            if float_is_zero(amount, precision_rounding=self.currency_id.rounding):
                continue

            ref = counterpart_line.move_id.name
            if counterpart_line.move_id.ref:
                ref += ' (' + counterpart_line.move_id.ref + ')'

            reconciled_vals.append({
                'name': counterpart_line.name,
                'journal_name': counterpart_line.journal_id.name,
                'amount': amount,
                'currency': self.currency_id.symbol,
                'digits': [69, self.currency_id.decimal_places],
                'position': self.currency_id.position,
                'date': counterpart_line.date,
                'payment_id': counterpart_line.id,
                'account_payment_id': counterpart_line.payment_id.id,
                'move_id': counterpart_line.move_id.id,
                'ref': ref,
            })
        return reconciled_vals

    @api.depends('type', 'line_ids.amount_residual')
    def _compute_payments_widget_reconciled_info(self):
        for move in self:
            if move.state != 'posted' or move.type not in ('out_invoice', 'out_refund', 'in_invoice', 'in_refund', 'out_receipt', 'in_receipt'):
                continue
            reconciled_vals = move._get_reconciled_info_JSON_values()
            if reconciled_vals:
                info = {
                    'title': _('Less Payment'),
                    'outstanding': False,
                    'content': reconciled_vals,
                }
                move.invoice_payments_widget = json.dumps(info, default=date_utils.json_default)
            else:
                move.invoice_payments_widget = json.dumps(False)

    @api.depends('line_ids.price_subtotal', 'line_ids.tax_base_amount', 'line_ids.tax_line_id', 'partner_id', 'currency_id')
    def _compute_invoice_taxes_by_group(self):
        ''' Helper to get the taxes grouped according their account.tax.group.
        This method is only used when printing the invoice.
        '''
        for move in self:
            lang_env = move.with_context(lang=move.partner_id.lang).env
            tax_lines = move.line_ids.filtered(lambda line: line.tax_line_id)
            res = {}
            for line in tax_lines:
                res.setdefault(line.tax_line_id.tax_group_id, {'base': 0.0, 'amount': 0.0})
                res[line.tax_line_id.tax_group_id]['amount'] += line.price_subtotal
                res[line.tax_line_id.tax_group_id]['base'] += line.tax_base_amount
            res = sorted(res.items(), key=lambda l: l[0].sequence)
            move.amount_by_group = [(
                group.name, amounts['amount'],
                amounts['base'],
                formatLang(lang_env, amounts['amount'], currency_obj=move.currency_id),
                formatLang(lang_env, amounts['base'], currency_obj=move.currency_id),
                len(res),
            ) for group, amounts in res]

    # -------------------------------------------------------------------------
    # CONSTRAINS METHODS
    # -------------------------------------------------------------------------

    @api.multi
    def _post_validate(self):
        for move in self:
            if move.line_ids:
                if not all([x.company_id.id == move.company_id.id for x in move.line_ids]):
                    raise UserError(_("Cannot create moves for different companies."))
        self.assert_balanced()
        return self._check_lock_date()

    @api.constrains('line_ids', 'journal_id')
    def _validate_move_modification(self):
        if 'posted' in self.mapped('line_ids.payment_id.state'):
            raise ValidationError(_("You cannot modify a journal entry linked to a posted payment."))

    @api.constrains('name')
    def _check_unique_invoice_name(self):

        if not self:
            return

        self._cr.execute('''
            SELECT move.id
            FROM account_move move
            INNER JOIN account_move move2 ON
                move2.name = move.name
                AND move2.company_id = move.company_id
                AND move2.journal_id = move.journal_id
                AND move2.type = move.type
                AND move2.id != move.id
            WHERE move.id IN %s
            AND move.type != 'misc'
            AND move2.type != 'misc'
            AND move.name != '/'
            AND move2.name != '/'
        ''', [tuple(self.ids)])
        res = self._cr.fetchone()
        if res:
            raise ValidationError(_('Invoice name must be unique per company'))

    @api.constrains('ref')
    def _check_duplicate_supplier_reference(self):
        moves = self.filtered(lambda move: move.type in ('in_invoice', 'in_refund') and move.ref)
        if not moves:
            return

        self._cr.execute('''
            SELECT move.id
            FROM account_move move
            INNER JOIN account_move move2 ON
                move2.ref = move.ref
                AND move2.company_id = move.company_id
                AND move2.commercial_partner_id = move.commercial_partner_id
                AND move2.type = move.type
                AND move2.id != move.id
            WHERE move.id IN %s
            AND move.type in ('in_invoice', 'in_refund')
            AND move.ref IS NOT NULL
        ''', [tuple(self.ids)])
        res = self._cr.fetchone()
        if res:
            raise ValidationError(_('Duplicated vendor reference detected. You probably encoded twice the same vendor bill/credit note.'))

    @api.multi
    def _check_lock_date(self):
        for move in self:
            lock_date = max(move.company_id.period_lock_date or date.min,
                            move.company_id.fiscalyear_lock_date or date.min)
            if self.user_has_groups('account.group_account_manager'):
                lock_date = move.company_id.fiscalyear_lock_date
            if move.date <= (lock_date or date.min):
                if self.user_has_groups('account.group_account_manager'):
                    message = _("You cannot add/modify entries prior to and inclusive of the lock date %s") % (
                        lock_date)
                else:
                    message = _(
                        "You cannot add/modify entries prior to and inclusive of the lock date %s. Check the company settings or ask someone with the 'Adviser' role") % (
                                  lock_date)
                raise UserError(message)
        return True

    @api.multi
    def assert_balanced(self):
        ''' Assert the move is fully balanced debit = credit.
        An error is raised if it's not the case.
        '''
        moves = self.filtered(lambda move: move.line_ids)
        if not moves:
            return

        # /!\ As this method is called in create / write, we can't make the assumption the computed stored fields
        # are already done. Then, this query MUST NOT depend of computed stored fields (e.g. balance).
        # It happens as the ORM makes the create with the 'no_recompute' statement.
        # It happens as the ORM makes the create with the 'no_recompute' statement.
        self._cr.execute('''
            SELECT line.move_id
            FROM account_move_line line
            JOIN account_move move ON move.id = line.move_id
            JOIN account_journal journal ON journal.id = move.journal_id
            JOIN res_company company ON company.id = journal.company_id
            JOIN res_currency currency ON currency.id = company.currency_id
            WHERE line.move_id IN %s
            GROUP BY line.move_id, currency.decimal_places
            HAVING ROUND(SUM(debit - credit), currency.decimal_places) != 0.0;
        ''', [tuple(self.ids)])

        if self._cr.fetchone():
            raise UserError(_("Cannot create unbalanced journal entry."))

    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------

    @api.model
    def _move_create_values_autocomplete(self, vals_list):
        new_vals_list = []
        for vals in vals_list:
            if not vals.get('invoice_line_ids'):
                new_vals_list.append(vals)
                continue
            if vals.get('line_ids'):
                vals.pop('invoice_line_ids', None)
                new_vals_list.append(vals)
                continue
            if not vals.get('type'):
                vals.pop('invoice_line_ids', None)
                new_vals_list.append(vals)
                continue
            vals['type'] = vals.get('type', self._get_default_type())
            if vals['type'] not in ('out_invoice', 'out_refund', 'in_invoice', 'in_refund', 'out_receipt', 'in_receipt'):
                new_vals_list.append(vals)
                continue

            vals['line_ids'] = vals.pop('invoice_line_ids')

            if vals.get('invoice_date') and not vals.get('date'):
                vals['date'] = vals['invoice_date']

            ctx_vals = {'type': vals['type']}
            if vals.get('journal_id'):
                ctx_vals['default_journal_id'] = vals['journal_id']
            self_ctx = self.with_context(**ctx_vals)
            new_vals = self_ctx._add_missing_default_values(vals)

            with self.env.do_in_onchange():
                move = self_ctx.new(new_vals)

                for line in move.line_ids:
                    # Do something only on invoice lines.
                    if line.display_type in ('line_section', 'line_note'):
                        continue

                    # Ensure related fields are well copied.
                    line.partner_id = move.partner_id
                    line.date = move.date
                    line.recompute_tax_line = True

                    # Shortcut to load the demo data.
                    if not line.account_id:
                        line.account_id = line._get_computed_account()
                        if not line.account_id:
                            if vals['type'] in ('out_invoice', 'out_refund', 'out_receipt'):
                                line.account_id = move.journal_id.default_credit_account_id
                            elif vals['type'] in ('in_invoice', 'in_refund', 'in_receipt'):
                                line.account_id = move.journal_id.default_debit_account_id

                    # Manage missing currency_id / amount_currency / debit / credit.
                    if move.currency_id != move.company_id.currency_id:
                        move._onchange_currency()
                    elif any(not line.balance and line.price_subtotal for line in move.line_ids):
                        move.line_ids._onchange_price_subtotal()

                move._onchange_process_dynamic_lines({'recompute_all_taxes': True})

            values = {name: move[name] for name in move._cache}
            values = move._convert_to_write(values)

            values.pop('invoice_line_ids', None)

            new_vals_list.append(values)
        return new_vals_list

    @api.model_create_multi
    def create(self, vals_list):
        # OVERRIDE
        vals_list = self._move_create_values_autocomplete(vals_list)

        moves = super(AccountMove, self).create(vals_list)

        # Trigger 'action_invoice_paid'.
        moves.filtered(lambda move: move.type in ('out_invoice', 'out_refund', 'in_invoice', 'in_refund', 'out_receipt', 'in_receipt')
                                    and move.invoice_payment_state in ('paid', 'in_payment')).action_invoice_paid()

        return moves

    @api.multi
    def write(self, vals):
        vals.pop('invoice_line_ids', None)

        not_paid_invoices = self.filtered(lambda move: move.type in ('out_invoice', 'out_refund', 'in_invoice', 'in_refund', 'out_receipt', 'in_receipt')
                                                       and move.invoice_payment_state not in ('paid', 'in_payment'))

        if 'line_ids' in vals and self._context.get('check_move_validity', True):
            # 'check_move_validity' is needed as the write will be done line per line.
            res = super(AccountMove, self.with_context(check_move_validity=False)).write(vals)
            self.assert_balanced()
        else:
            res = super(AccountMove, self).write(vals)

        # Ensure the move is still well balanced.
        if vals.get('line_ids') and self._context.get('check_move_validity', True):
            self.assert_balanced()

        # Trigger 'action_invoice_paid'.
        not_paid_invoices.filtered(lambda move: move.invoice_payment_state in ('paid', 'in_payment')).action_invoice_paid()

        return res

    @api.multi
    def unlink(self):
        for move in self:
            # check the lock date + check if some entries are reconciled
            move.line_ids._update_check()
            move.line_ids.unlink()
        return super(AccountMove, self).unlink()

    @api.multi
    @api.depends('name', 'state')
    def name_get(self):
        result = []
        for move in self:
            if move.type == 'misc':
                # Miscellaneous operation.
                if move.state == 'draft':
                    name = '* %s' % str(move.id)
                else:
                    name = move.name
            else:
                # Invoice.
                name = move._get_invoice_display_name(show_ref=True)
            result.append((move.id, name))
        return result

    @api.multi
    def _track_subtype(self, init_values):
        # OVERRIDE to add custom subtype depending of the state.
        self.ensure_one()

        if self.type not in ('out_invoice', 'out_refund', 'in_invoice', 'in_refund'):
            return super(AccountMove, self)._track_subtype(init_values)

        if 'invoice_payment_state' in init_values and self.invoice_payment_state == 'paid':
            return self.env.ref('account.mt_invoice_paid')
        elif 'state' in init_values and self.state == 'posted' and self.type in ('out_invoice', 'out_refund'):
            return self.env.ref('account.mt_invoice_validated')
        elif 'state' in init_values and self.state == 'draft' and self.type in ('out_invoice', 'out_refund'):
            return self.env.ref('account.mt_invoice_created')
        return super(AccountMove, self)._track_subtype(init_values)

    # -------------------------------------------------------------------------
    # BUSINESS METHODS
    # -------------------------------------------------------------------------

    @api.multi
    def _get_invoice_reference_euro_invoice(self):
        """ This computes the reference based on the RF Creditor Reference.
            The data of the reference is the database id number of the invoice.
            For instance, if an invoice is issued with id 43, the check number
            is 07 so the reference will be 'RF07 43'.
        """
        self.ensure_one()
        base = self.id
        check_digits = mod_97_10.calc_check_digits('{}RF'.format(base))
        reference = 'RF{} {}'.format(check_digits, " ".join(["".join(x) for x in zip_longest(*[iter(str(base))]*4, fillvalue="")]))
        return reference

    @api.multi
    def _get_invoice_reference_euro_partner(self):
        """ This computes the reference based on the RF Creditor Reference.
            The data of the reference is the user defined reference of the
            partner or the database id number of the parter.
            For instance, if an invoice is issued for the partner with internal
            reference 'food buyer 654', the digits will be extracted and used as
            the data. This will lead to a check number equal to 00 and the
            reference will be 'RF00 654'.
            If no reference is set for the partner, its id in the database will
            be used.
        """
        self.ensure_one()
        partner_ref = self.partner_id.ref
        partner_ref_nr = re.sub('\D', '', partner_ref or '')[-21:] or str(self.partner_id.id)[-21:]
        partner_ref_nr = partner_ref_nr[-21:]
        check_digits = mod_97_10.calc_check_digits('{}RF'.format(partner_ref_nr))
        reference = 'RF{} {}'.format(check_digits, " ".join(["".join(x) for x in zip_longest(*[iter(partner_ref_nr)]*4, fillvalue="")]))
        return reference

    @api.multi
    def _get_invoice_reference_odoo_invoice(self):
        """ This computes the reference based on the Odoo format.
            We simply return the number of the invoice, defined on the journal
            sequence.
        """
        self.ensure_one()
        return self.name

    @api.multi
    def _get_invoice_reference_odoo_partner(self):
        """ This computes the reference based on the Odoo format.
            The data used is the reference set on the partner or its database
            id otherwise. For instance if the reference of the customer is
            'dumb customer 97', the reference will be 'CUST/dumb customer 97'.
        """
        ref = self.partner_id.ref or str(self.partner_id.id)
        prefix = _('CUST')
        return '%s/%s' % (prefix, ref)

    @api.multi
    def _get_invoice_computed_reference(self):
        self.ensure_one()
        if self.journal_id.invoice_reference_type == 'none':
            return ''
        else:
            ref_function = getattr(self, '_get_invoice_reference_{}_{}'.format(self.journal_id.invoice_reference_model, self.journal_id.invoice_reference_type))
            if ref_function:
                return ref_function()
            else:
                raise UserError(_('The combination of reference model and reference type on the journal is not implemented'))

    @api.multi
    def _get_sequence(self):
        self.ensure_one()

        journal = self.journal_id
        if self.type in ('misc', 'out_invoice', 'in_invoice') or not journal.refund_sequence:
            return journal.sequence_id
        if not journal.refund_sequence_id:
            return
        return journal.refund_sequence_id

    @api.multi
    def _get_invoice_display_name(self, show_ref=False):
        ''' Helper to get the display name of an invoice depending of its type. '''
        self.ensure_one()
        if self.state == 'draft':
            return {
                'out_invoice': _('Draft Invoice'),
                'out_refund': _('Credit Note'),
                'in_invoice': _('Vendor Bill'),
                'in_refund': _('Vendor Credit Note'),
                'out_receipt': _('Sales Receipt'),
                'in_receipt': _('Purchase Receipt'),
            }[self.type]
        else:
            return ('%s' % self.name) + (show_ref and self.ref and '(%s)' % self.ref or '')

    @api.multi
    def _get_invoice_delivery_partner_id(self):
        ''' Hook allowing to retrieve the right delivery address depending of installed modules. '''
        self.ensure_one()
        return self.partner_id.address_get(['delivery'])['delivery']

    @api.multi
    def _get_invoice_intrastat_country_id(self):
        ''' Hook allowing to retrieve the intrastat country depending of installed modules. '''
        self.ensure_one()
        return self.partner_id.country_id.id

    @api.multi
    def _reverse_move_vals(self, default_values, cancel=False):
        self.ensure_one()

        move_vals = self.with_context(include_business_fields=True).copy_data(default=default_values)[0]
        for line_command in move_vals.get('line_ids', 0.0):
            line_vals = line_command[2]  # (0, 0, {...})

            amount_currency = -line_vals.get('amount_currency', 0.0)
            balance = line_vals['credit'] - line_vals['debit']

            line_vals.update({
                'amount_currency': amount_currency,
                'debit': balance > 0.0 and balance or 0.0,
                'credit': balance < 0.0 and -balance or 0.0,
            })

            if line_vals.get('tax_line_id') and move_vals['type'] in ('out_refund', 'in_refund'):
                tax_line_id = self.env['account.tax'].browse(line_vals['tax_line_id'])
                line_vals['account_id'] = self.env['account.move.line']._get_default_tax_account(tax_line_id, balance).id
        return move_vals

    @api.multi
    def _reverse_moves(self, default_values_list=None, cancel=False):
        ''' Reverse a recordset of account.move.
        :param default_values_list: A list of default values to consider per move.
                                    ('type' & 'reverse_entry_id' are computed in the method).
        :return:                    An account.move recordset, reverse of the current self.
        '''
        if not default_values_list:
            default_values_list = [{} for move in self]

        if cancel:
            lines = self.mapped('line_ids')
            # Avoid maximum recursion depth.
            if lines:
                lines.remove_move_reconcile()

        reverse_type_map = {
            'misc': 'misc',
            'out_invoice': 'out_refund',
            'in_invoice': 'in_refund',
            'in_refund': 'in_invoice',
            'out_receipt': 'in_receipt',
            'in_receipt': 'out_receipt',
        }

        move_vals_list = []
        for move, default_values in zip(self, default_values_list):
            default_values.update({
                'type': reverse_type_map[self.type],
                'reverse_entry_id': self.id,
            })
            move_vals_list.append(move._reverse_move_vals(default_values, cancel=cancel))
        reverse_moves = self.env['account.move'].create(move_vals_list)

        # Reconcile moves together to cancel the previous one.
        if cancel:
            reverse_moves.with_context(move_reverse_cancel=cancel).post()
            for move, reverse_move in zip(self, reverse_moves):
                accounts = move.mapped('line_ids.account_id') \
                    .filtered(lambda account: account.reconcile or account.internal_type == 'liquidity')
                for account in accounts:
                    (move.line_ids + reverse_move.line_ids)\
                        .filtered(lambda line: line.account_id == account)\
                        .reconcile()

        return reverse_moves

    @api.multi
    def post(self):
        for move in self:
            if move.auto_post and move.date > fields.Date.today():
                date_msg = move.date.strftime(self.env['res.lang']._lang_get(self.env.user.lang).date_format)
                raise UserError(_("This move is configured to be auto-posted on %s" % date_msg))

            if not move.partner_id:
                if move.type in ('out_invoice', 'out_refund'):
                    raise UserError(_("The field 'Customer' is required, please complete it to validate the Vendor Bill."))
                elif move.type in ('in_invoice', 'in_refund'):
                    raise UserError(_("The field 'Vendor' is required, please complete it to validate the Vendor Bill."))

            if (move.type in ('out_invoice', 'out_refund', 'in_invoice', 'in_refund', 'out_receipt', 'in_receipt') and\
                    float_compare(move.amount_total, 0.0, precision_rounding=move.currency_id.rounding) < 0):
                raise UserError(_("You cannot validate an invoice with a negative total amount. You should create a credit note instead."))

        self._post_validate()
        # Create the analytic lines in batch is faster as it leads to less cache invalidation.
        self.mapped('line_ids').create_analytic_lines()
        for move in self:
            to_write = {'state': 'posted'}

            if move.name == '/':
                # Get the journal's sequence.
                sequence = move._get_sequence()
                if not sequence:
                    raise UserError(_('Please define a sequence for the credit notes'))

                # Consume a new number.
                to_write['name'] = sequence.next_by_id(sequence_date=move.date)

            move.write(to_write)

            # Compute 'ref' for 'out_invoice'.
            if move.type == 'out_invoice' and not move.invoice_payment_ref:
                to_write = {
                    'invoice_payment_ref': move._get_invoice_computed_reference(),
                    'line_ids': []
                }
                for line in move.line_ids.filtered(lambda line: line._is_invoice_payment_term_line()):
                    to_write['line_ids'].append((1, line.id, {'name': to_write['invoice_payment_ref']}))
                move.write(to_write)

            if move == move.company_id.account_opening_move_id and not move.company_id.account_bank_reconciliation_start:
                # For opening moves, we set the reconciliation date threshold
                # to the move's date if it wasn't already set (we don't want
                # to have to reconcile all the older payments -made before
                # installing Accounting- with bank statements)
                move.company_id.account_bank_reconciliation_start = move.date

    @api.multi
    def action_post(self):
        if self.mapped('line_ids.payment_id') and any(self.mapped('journal_id.post_at_bank_rec')):
            raise UserError(_("A payment journal entry generated in a journal configured to post entries only when payments are reconciled with a bank statement cannot be manually posted. Those will be posted automatically after performing the bank reconciliation."))
        return self.post()

    @api.multi
    def js_assign_outstanding_line(self, line_id):
        self.ensure_one()
        lines = self.env['account.move.line'].browse(line_id)
        lines += self.line_ids.filtered(lambda line: line.account_id == lines[0].account_id and not line.reconciled)
        return lines.reconcile()

    @api.multi
    def button_draft(self):
        if any(move.state != 'cancel' for move in self):
            raise UserError(_('Only cancelled journal entries can be reset to draft.'))
        self.write({'state': 'draft'})

    @api.multi
    def button_cancel(self):
        AccountMoveLine = self.env['account.move.line']
        excluded_move_ids = []

        if self._context.get('edition_mode'):
            excluded_move_ids = AccountMoveLine.search(AccountMoveLine._get_domain_for_edition_mode() + [('move_id', 'in', self.ids)]).mapped('move_id').ids

        for move in self:
            if not move.journal_id.update_posted and move.id not in excluded_move_ids:
                raise UserError(_('You cannot modify a posted entry of this journal.\nFirst you should set the journal to allow cancelling entries.'))
            # We remove all the analytics entries for this journal
            move.mapped('line_ids.analytic_line_ids').unlink()
        if self.ids:
            self.check_access_rights('write')
            self.check_access_rule('write')
            self._check_lock_date()
            self._cr.execute('UPDATE account_move SET state=%s WHERE id IN %s', ('cancel', tuple(self.ids)))
            self.invalidate_cache()
        self._check_lock_date()
        return True

    @api.multi
    def action_invoice_sent(self):
        """ Open a window to compose an email, with the edi invoice template
            message loaded by default
        """
        self.ensure_one()
        template = self.env.ref('account.email_template_edi_invoice', raise_if_not_found=False)
        compose_form = self.env.ref('account.account_invoice_send_wizard_form', raise_if_not_found=False)
        ctx = dict(
            default_model='account.move',
            default_res_id=self.id,
            default_use_template=bool(template),
            default_template_id=template and template.id or False,
            default_composition_mode='comment',
            mark_invoice_as_sent=True,
            custom_layout="mail.mail_notification_paynow",
            force_email=True
        )
        return {
            'name': _('Send Invoice'),
            'type': 'ir.actions.act_window',
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'account.invoice.send',
            'views': [(compose_form.id, 'form')],
            'view_id': compose_form.id,
            'target': 'new',
            'context': ctx,
        }

    @api.multi
    def action_invoice_print(self):
        """ Print the invoice and mark it as sent, so that we can see more
            easily the next step of the workflow
        """
        self.filtered(lambda inv: not inv.invoice_sent).write({'invoice_sent': True})
        if self.user_has_groups('account.group_account_invoice'):
            return self.env.ref('account.account_invoices').report_action(self)
        else:
            return self.env.ref('account.account_invoices_without_payment').report_action(self)

    @api.multi
    def action_invoice_paid(self):
        ''' Hook to be overrided called when the invoice moves to the paid state. '''
        pass

    @api.multi
    def action_invoice_reconcile_to_check(self, params):
        self.ensure_one()
        domain = self._get_domain_edition_mode_available()
        ids = self.env['account.move.line'].search(domain).mapped('statement_line_id').ids
        action_context = {'show_mode_selector': False, 'company_ids': self.mapped('company_id').ids}
        action_context.update({'edition_mode': True})
        action_context.update({'statement_line_ids': ids})
        action_context.update({'partner_id': self.partner_id.id})
        action_context.update({'partner_name': self.partner_id.name})
        return {
            'type': 'ir.actions.client',
            'tag': 'bank_statement_reconciliation_view',
            'context': action_context,
        }

    @api.multi
    def action_account_invoice_payment(self):
        return self.env['account.payment']\
            .with_context(active_ids=self.ids, active_model='account.move', active_id=self.id)\
            .action_register_payment()

    @api.multi
    def _get_report_base_filename(self):
        return self._get_invoice_display_name()

    @api.multi
    def preview_invoice(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_url',
            'target': 'self',
            'url': self.get_portal_url(),
        }

    @api.multi
    def _compute_access_url(self):
        super(AccountMove, self)._compute_access_url()
        for move in self.filtered(lambda move: move.type in ('out_invoice', 'out_refund', 'in_invoice', 'in_refund')):
            move.access_url = '/my/invoices/%s' % (move.id)

    @api.multi
    def action_view_reverse_entry(self):
        self.ensure_one()

        # Create action.
        action = {
            'name': _('Reverse Moves'),
            'type': 'ir.actions.act_window',
            'res_model': 'account.move',
        }
        if len(self.reverse_entry_ids) == 1:
            action.update({
                'view_mode': 'form',
                'res_id': self.reverse_entry_ids.id,
            })
        else:
            action.update({
                'view_mode': 'tree',
                'domain': [('id', 'in', self.reverse_entry_ids.ids)],
            })
        return action

    @api.model
    def _run_post_draft_to_post(self):
        ''' This method is called from a cron job.
        It is used to post entries such as those created by the module
        account_asset.
        '''
        records = self.search([
            ('state', '=', 'draft'),
            ('date', '<=', fields.Date.today()),
            ('auto_post', '=', True),
        ])
        records.post()


class AccountMoveLine(models.Model):
    _name = 'account.move.line'
    _description = "Journal Item"
    _order = "sequence, date desc, id"

    @api.model
    def _get_invoice_line_types(self):
        return [False, 'line_section', 'line_note', 'product_cr']

    # ==== Business fields ====
    sequence = fields.Integer(default=10)
    name = fields.Char(string='Label')
    date = fields.Date(related='move_id.date', store=True, readonly=True, index=True, copy=False)
    ref = fields.Char(related='move_id.ref', store=True, copy=False, index=True, readonly=False)
    narration = fields.Text(related='move_id.narration', string='Narration', readonly=False)
    parent_state = fields.Selection(related='move_id.state', store=True, readonly=True)
    quantity = fields.Float(string='Quantity',
        default=1.0, digits=dp.get_precision('Product Unit of Measure'),
        help="The optional quantity expressed by this line, eg: number of product sold."
             "The quantity is not a legal requirement but is very useful for some reports.")
    price_unit = fields.Float(string='Unit Price', digits=dp.get_precision('Product Price'))
    discount = fields.Float(string='Discount (%)', digits=dp.get_precision('Discount'), default=0.0)
    debit = fields.Monetary(string='Debit', default=0.0, currency_field='company_currency_id')
    credit = fields.Monetary(string='Credit', default=0.0, currency_field='company_currency_id')
    balance = fields.Monetary(string='Balance', store=True,
        currency_field='company_currency_id',
        compute='_compute_balance',
        help="Technical field holding the debit - credit in order to open meaningful graph views from reports")
    debit_cash_basis = fields.Monetary(store=True,
        currency_field='company_currency_id',
        compute='_compute_cash_basis')
    credit_cash_basis = fields.Monetary(store=True,
        currency_field='company_currency_id',
        compute='_compute_cash_basis')
    balance_cash_basis = fields.Monetary(store=True,
        currency_field='company_currency_id',
        compute='_compute_cash_basis',
        help="Technical field holding the debit_cash_basis - credit_cash_basis in order to open meaningful graph views from reports")
    amount_currency = fields.Monetary(string='Balance in Currency', store=True, copy=True,
        help="The amount expressed in an optional other currency if it is a multi-currency entry.")
    amount_residual = fields.Monetary(string='Residual Amount', store=True,
        currency_field='company_currency_id',
        compute='_amount_residual',
        help="The residual amount on a journal item expressed in the company currency.")
    amount_residual_currency = fields.Monetary(string='Residual Amount in Currency', store=True,
        compute='_amount_residual',
        help="The residual amount on a journal item expressed in its currency (possibly not the company currency).")
    tax_base_amount = fields.Monetary(string="Base Amount", store=True,
        currency_field='company_currency_id',
        compute='_compute_tax_base_amount')
    price_subtotal = fields.Monetary(string='Subtotal', store=True, readonly=True,
        currency_field='always_set_currency_id',
        compute='_compute_price')
    price_total = fields.Monetary(string='Total', store=True, readonly=True,
        currency_field='always_set_currency_id',
        compute='_compute_price')
    reconciled = fields.Boolean(compute='_amount_residual', store=True)
    blocked = fields.Boolean(string='No Follow-up', default=False,
        help="You can check this box to mark this journal item as a litigation with the associated partner")
    date_maturity = fields.Date(string='Due date', index=True,
        help="This field is used for payable and receivable journal entries. You can put the limit date for the payment of this line.")
    tax_exigible = fields.Boolean(string='Appears in VAT report', default=True,
        help="Technical field used to mark a tax line as exigible in the vat report or not (only exigible journal items"
             " are displayed). By default all new journal items are directly exigible, but with the feature cash_basis"
             " on taxes, some will become exigible only when the payment is recorded.")
    recompute_tax_line = fields.Boolean(store=False, readonly=True,
        help="Technical field used to know on which lines the taxes must be recomputed.")
    remove_line = fields.Boolean(store=False, readonly=True)
    update_line = fields.Text(store=False, readonly=True)
    display_type = fields.Selection([
        ('line_section', 'Section'),
        ('line_note', 'Note'),
        ('product_cr', 'Product Cash Rounding Line'),
        ('tax_cr', 'Tax Cash Rounding Line'),
        ('tax', 'Tax Line'),
        ('balance', 'Auto-balance Line'),
    ], default=False, help="Technical field for UX purpose.")
    move_id = fields.Many2one('account.move', string='Journal Entry',
        index=True, required=True, auto_join=True, ondelete="cascade",
        help="The move of this entry line.")
    currency_id = fields.Many2one('res.currency', string='Currency')
    always_set_currency_id = fields.Many2one('res.currency', string='Foreign Currency',
        compute='_compute_always_set_currency_id')
    journal_id = fields.Many2one(related='move_id.journal_id', store=True, readonly=False, index=True, copy=False)
    company_id = fields.Many2one(related='move_id.company_id', store=True, readonly=True)
    company_currency_id = fields.Many2one(related='company_id.currency_id', string='Company Currency',
        readonly=True, store=True,
        help='Utility field to express amount currency')
    partner_id = fields.Many2one('res.partner', string='Partner', ondelete='restrict')
    product_uom_id = fields.Many2one('uom.uom', string='Unit of Measure')
    product_id = fields.Many2one('product.product', string='Product')
    account_id = fields.Many2one('account.account', string='Account',
        index=True, ondelete="cascade",
        domain=[('deprecated', '=', False)])
    payment_id = fields.Many2one('account.payment', string="Originator Payment", copy=False,
        help="Payment that created this entry")
    statement_line_id = fields.Many2one('account.bank.statement.line',
        string='Bank statement line reconciled with this entry',
        index=True, copy=False, readonly=True)
    statement_id = fields.Many2one(related='statement_line_id.statement_id', store=True, index=True, copy=False,
        help="The bank statement used for bank reconciliation")
    full_reconcile_id = fields.Many2one('account.full.reconcile', string="Matching Number", copy=False, index=True)
    matched_debit_ids = fields.One2many('account.partial.reconcile', 'credit_move_id', String='Matched Debits',
        help='Debit journal items that are matched with this journal item.')
    matched_credit_ids = fields.One2many('account.partial.reconcile', 'debit_move_id', String='Matched Credits',
        help='Credit journal items that are matched with this journal item.')
    tax_ids = fields.Many2many('account.tax', string='Taxes')
    tax_line_id = fields.Many2one('account.tax', string='Originator tax', ondelete='restrict')
    analytic_line_ids = fields.One2many('account.analytic.line', 'move_id', string='Analytic lines')
    analytic_account_id = fields.Many2one('account.analytic.account', string='Analytic Account', index=True)
    analytic_tag_ids = fields.Many2many('account.analytic.tag', string='Analytic Tags')
    reconcile_model_id = fields.Many2one('account.reconcile.model', string="Reconciliation Model", copy=False)

    _sql_constraints = [
        (
            'check_credit_debit',
            'CHECK(credit + debit>=0 AND credit * debit=0)',
            'Wrong credit or debit value in accounting entry !'
        ),
        (
            'check_accountable_required_fields',
             "CHECK(display_type IN ('line_section', 'line_note') OR account_id IS NOT NULL)",
             "Missing required account on accountable invoice line."
        ),
        (
            'check_non_accountable_fields_null',
             "CHECK(display_type NOT IN ('line_section', 'line_note') OR (amount_currency = 0 AND debit = 0 AND credit = 0 AND account_id IS NULL))",
             "Forbidden unit price, account and quantity on non-accountable invoice line"
        ),
        (
            'check_amount_currency_balance_sign',
            '''CHECK(
                currency_id IS NULL
                OR
                company_currency_id IS NULL
                OR
                (
                    (currency_id != company_currency_id)
                    AND
                    (
                        (balance > 0 AND amount_currency > 0)
                        OR (balance <= 0 AND amount_currency <= 0)
                        OR (balance >= 0 AND amount_currency >= 0)
                    )
                )
            )''',
            "The amount expressed in the secondary currency must be positive when account is debited and negative when account is credited."
        ),
    ]

    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------

    @api.multi
    def _is_invoice_line(self):
        self.ensure_one()
        return self.display_type in self._get_invoice_line_types()

    @api.multi
    def _is_invoice_payment_term_line(self):
        self.ensure_one()
        return self.display_type == 'balance'

    @api.multi
    def _is_invoice_cash_rounding_line(self):
        self.ensure_one()
        return self.display_type in ('product_cr', 'tax_cr')

    @api.model
    def _get_default_tax_account(self, tax, balance):
        if tax.tax_exigibility == 'on_payment':
            account = tax.account_id
        elif tax.type_tax_use == 'purchase':
            account = tax.refund_account_id if balance < 0 else tax.account_id
        else:
            account = tax.refund_account_id if balance >= 0 else tax.account_id
        return account

    @api.multi
    def _get_computed_name(self):
        self.ensure_one()

        if not self.product_id:
            return ''

        if self.partner_id.lang:
            product = self.product_id.with_context(lang=self.partner_id.lang)
        else:
            product = self.product_id

        values = []
        if product.partner_ref:
            values.append(product.partner_ref)
        if self.journal_id.type == 'sale':
            if product.description_sale:
                values.append(product.description_sale)
        elif self.journal_id.type == 'purchase':
            if product.description_purchase:
                values.append(product.description_purchase)
        return '\n'.join(values)

    @api.multi
    def _get_computed_price_unit(self):
        self.ensure_one()

        if not self.product_id:
            return self.price_unit
        elif self.move_id.type in ('out_invoice', 'out_refund', 'out_receipt'):
            # Out invoice.
            price_unit = self.product_id.lst_price
        elif self.move_id.type in ('in_invoice', 'in_refund', 'in_receipt'):
            # In invoice.
            price_unit = self.product_id.standard_price
        else:
            return self.price_unit

        if self.product_uom_id != self.product_id.uom_id:
            price_unit = self.product_id.uom_id._compute_price(price_unit, self.product_uom_id)

        company = self.move_id.company_id
        if self.move_id.currency_id != company.currency_id:
            price_unit = company.currency_id._convert(
                price_unit, self.move_id.currency_id, company, self.move_id.date)
        return price_unit

    @api.multi
    def _get_computed_account(self):
        self.ensure_one()

        if not self.product_id:
            return

        fiscal_position = self.move_id.fiscal_position_id
        accounts = self.product_id.product_tmpl_id.get_product_accounts(fiscal_pos=fiscal_position)
        if self.move_id.type in ('out_invoice', 'out_refund', 'out_receipt'):
            # Out invoice.
            return accounts['income']
        elif self.move_id.type in ('in_invoice', 'in_refund', 'in_receipt'):
            # In invoice.
            return accounts['expense']

    @api.multi
    def _get_computed_taxes(self):
        self.ensure_one()

        if self.move_id.type in ('out_invoice', 'out_refund', 'out_receipt'):
            # Out invoice.
            if self.product_id.taxes_id:
                tax_ids = self.product_id.taxes_id
            elif self.account_id.tax_ids:
                tax_ids = self.account_id.tax_ids
            elif self._is_invoice_line():
                tax_ids = self.move_id.company_id.account_sale_tax_id
            else:
                return
        elif self.move_id.type in ('in_invoice', 'in_refund', 'in_receipt'):
            # In invoice.
            if self.product_id.supplier_taxes_id:
                tax_ids = self.product_id.supplier_taxes_id
            elif self.account_id.tax_ids:
                tax_ids = self.account_id.tax_ids
            elif self._is_invoice_line():
                tax_ids = self.move_id.company_id.account_purchase_tax_id
            else:
                return
        else:
            # Miscellaneous operation.
            tax_ids = self.account_id.tax_ids

        if self.company_id:
            tax_ids = tax_ids.filtered(lambda tax: tax.company_id == self.company_id)

        fiscal_position = self.move_id.fiscal_position_id
        if tax_ids and fiscal_position:
            return fiscal_position.map_tax(tax_ids, partner=self.partner_id)
        else:
            return tax_ids

    @api.multi
    def _get_computed_uom(self):
        self.ensure_one()
        if self.product_id:
            return self.product_id.uom_id
        else:
            return False

    @api.model
    def _get_computed_business_vals(self, price_unit, quantity, discount, currency, product, partner, taxes):
        res = {}

        # Compute 'price_subtotal'.
        price_unit_wo_discount = price_unit * (1 - (discount / 100.0))
        subtotal = quantity * price_unit_wo_discount

        # Compute 'price_total'.
        if taxes:
            taxes_res = taxes.compute_all(price_unit_wo_discount,
                quantity=quantity, currency=currency, product=product, partner=partner)
            res['price_subtotal'] = taxes_res['total_excluded']
            res['price_total'] = taxes_res['total_included']
        else:
            res['price_total'] = res['price_subtotal'] = subtotal
        return res

    @api.model
    def _get_computed_accounting_vals(self, price_subtotal, move_type, currency, company, date):
        if move_type in ('out_refund', 'in_invoice', 'in_receipt'):
            sign = 1
        elif move_type in ('in_refund', 'out_invoice', 'out_receipt'):
            sign = -1
        else:
            sign = 1
        price_subtotal *= sign

        if currency and currency != company.currency_id:
            # Multi-currencies.
            # Use an OrderedDict as the currency_id must be set before the amount_currency when updating a record.
            amount_currency = price_subtotal
            balance = currency._convert(price_subtotal, company.currency_id, company, date)
            return {
                'amount_currency': amount_currency,
                'debit': balance > 0.0 and balance or 0.0,
                'credit': balance < 0.0 and -balance or 0.0,
            }
        else:
            # Single-currency.
            return {
                'amount_currency': 0.0,
                'debit': price_subtotal > 0.0 and price_subtotal or 0.0,
                'credit': price_subtotal < 0.0 and -price_subtotal or 0.0,
            }

    @api.model
    def _get_inversed_accounting_vals(self, price_unit, quantity, discount, balance, move_type, currency, taxes):
        if move_type in ('out_refund', 'in_invoice', 'in_receipt'):
            sign = 1
        elif move_type in ('in_refund', 'out_invoice', 'out_receipt'):
            sign = -1
        else:
            sign = 1
        balance *= sign

        if taxes:
            # Inverse taxes. E.g:
            #
            # Price Unit    | Taxes         | Originator Tax    |Price Subtotal     | Price Total
            # -----------------------------------------------------------------------------------
            # 110           | 10% incl, 5%  |                   | 100               | 115
            # 10            |               | 10% incl          | 10                | 10
            # 5             |               | 5%                | 5                 | 5
            #
            # When setting the balance to -200, the expected result is:
            #
            # Price Unit    | Taxes         | Originator Tax    |Price Subtotal     | Price Total
            # -----------------------------------------------------------------------------------
            # 110           | 10% incl, 5%  |                   | 100               | 115
            # 10            |               | 10% incl          | 10                | 10
            # 5             |               | 5%                | 5                 | 5
            taxes_res = taxes.with_context(force_price_include=False).compute_all(balance, currency=currency)
            for tax_res in taxes_res['taxes']:
                tax = self.env['account.tax'].browse(tax_res['id'])
                if tax.price_include:
                    balance += tax_res['amount']

        discount_factor = 1 - (discount / 100.0)
        if balance and discount_factor:
            # discount != 100%
            vals = {
                'quantity': quantity or 1.0,
                'price_unit': balance / discount_factor / (quantity or 1.0),
            }
        elif balance and not discount_factor:
            # discount == 100%
            vals = {
                'quantity': quantity or 1.0,
                'discount': 0.0,
                'price_unit': balance / (quantity or 1.0),
            }
        else:
            vals = {}
        return vals

    # -------------------------------------------------------------------------
    # ONCHANGE METHODS
    # -------------------------------------------------------------------------

    @api.onchange('amount_currency', 'currency_id', 'debit', 'credit', 'tax_ids', 'analytic_account_id', 'analytic_tag_ids')
    def _onchange_mark_recompute_taxes(self):
        ''' Recompute the dynamic onchange based on taxes.
        If the edited line is a tax line, don't recompute anything as the user must be able to
        set a custom value.

        See '_onchange_line_ids' in account.move for more details.
        '''
        for line in self:
            if not line.tax_line_id:
                line.recompute_tax_line = True

    @api.onchange('product_id')
    def _onchange_product_id(self):
        for line in self:
            if not line.product_id or line.display_type in ('line_section', 'line_note'):
                continue

            line.name = line._get_computed_name()
            line.account_id = line._get_computed_account()
            line.tax_ids = line._get_computed_taxes()
            line.product_uom_id = line._get_computed_uom()
            line.price_unit = line._get_computed_price_unit()

        if len(self) == 1:
            return {'domain': {'product_uom_id': [('category_id', '=', self.product_uom_id.category_id.id)]}}

    @api.onchange('product_uom_id')
    def _onchange_uom_id(self):
        ''' Recompute the 'price_unit' depending of the unit of measure. '''
        self.price_unit = self._get_computed_price_unit()

    @api.onchange('account_id')
    def _onchange_account_id(self):
        ''' Recompute 'tax_ids' based on 'account_id'. '''
        if not self.display_type in ('line_section', 'line_note'):
            self.tax_ids = self._get_computed_taxes()

    @api.onchange('price_subtotal', 'currency_id')
    def _onchange_price_subtotal(self):
        ''' Recompute 'amount_currency' OR 'debit' / 'credit' based on the 'price_subtotal'. '''
        for line in self:
            if line.move_id.type not in ('out_invoice', 'out_refund', 'in_invoice', 'in_refund', 'out_receipt', 'in_receipt'):
                continue

            line.update(line._get_computed_accounting_vals(
                line.price_subtotal,
                line.move_id.type,
                line.currency_id,
                line.move_id.company_id,
                line.date
            ))

    @api.multi
    def _onchange_balance(self):
        for line in self:
            if line.currency_id:
                continue
            if line.move_id.type not in ('out_invoice', 'out_refund', 'in_invoice', 'in_refund', 'out_receipt', 'in_receipt'):
                continue
            line.update(line._get_inversed_accounting_vals(
                line.price_unit,
                line.quantity,
                line.discount,
                line.balance,
                line.move_id.type,
                line.currency_id,
                line.tax_ids,
            ))

    @api.onchange('debit')
    def _onchange_debit(self):
        if self.debit:
            self.credit = 0.0
        self._onchange_balance()

    @api.onchange('credit')
    def _onchange_credit(self):
        if self.credit:
            self.debit = 0.0
        self._onchange_balance()

    @api.onchange('amount_currency', 'currency_id')
    def _onchange_amount_currency(self):
        for line in self:
            if not line.currency_id:
                continue
            if line.move_id.type not in ('out_invoice', 'out_refund', 'in_invoice', 'in_refund', 'out_receipt', 'in_receipt'):
                continue
            line.update(line._get_inversed_accounting_vals(
                line.price_unit,
                line.quantity,
                line.discount,
                line.amount_currency,
                line.move_id.type,
                line.currency_id,
                line.tax_ids,
            ))

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('quantity', 'discount', 'price_unit', 'tax_ids')
    def _compute_price(self):
        for line in self:
            line.update(line._get_computed_business_vals(
                line.price_unit,
                line.quantity,
                line.discount,
                line.currency_id,
                line.product_id,
                line.partner_id,
                line.tax_ids,
            ))

    @api.depends('currency_id')
    def _compute_amount_currency(self):
        for line in self:
            if not line.currency_id:
                line.amount_currency = 0.0

    @api.depends('currency_id')
    def _compute_always_set_currency_id(self):
        for line in self:
            line.always_set_currency_id = line.currency_id or line.company_currency_id

    @api.depends('debit', 'credit')
    def _compute_balance(self):
        for line in self:
            line.balance = line.debit - line.credit

    @api.depends('debit', 'credit', 'amount_currency', 'currency_id', 'matched_debit_ids', 'matched_credit_ids', 'matched_debit_ids.amount', 'matched_credit_ids.amount', 'move_id.state')
    def _amount_residual(self):
        """ Computes the residual amount of a move line from a reconcilable account in the company currency and the line's currency.
            This amount will be 0 for fully reconciled lines or lines from a non-reconcilable account, the original line amount
            for unreconciled lines, and something in-between for partially reconciled lines.
        """
        for line in self:
            if not line.account_id.reconcile and line.account_id.internal_type != 'liquidity':
                line.reconciled = False
                line.amount_residual = 0
                line.amount_residual_currency = 0
                continue
            #amounts in the partial reconcile table aren't signed, so we need to use abs()
            amount = abs(line.debit - line.credit)
            amount_residual_currency = abs(line.amount_currency) or 0.0
            sign = 1 if (line.debit - line.credit) > 0 else -1
            if not line.debit and not line.credit and line.amount_currency and line.currency_id:
                #residual for exchange rate entries
                sign = 1 if float_compare(line.amount_currency, 0, precision_rounding=line.currency_id.rounding) == 1 else -1

            for partial_line in (line.matched_debit_ids + line.matched_credit_ids):
                # If line is a credit (sign = -1) we:
                #  - subtract matched_debit_ids (partial_line.credit_move_id == line)
                #  - add matched_credit_ids (partial_line.credit_move_id != line)
                # If line is a debit (sign = 1), do the opposite.
                sign_partial_line = sign if partial_line.credit_move_id == line else (-1 * sign)

                amount += sign_partial_line * partial_line.amount
                #getting the date of the matched item to compute the amount_residual in currency
                if line.currency_id and line.amount_currency:
                    if partial_line.currency_id and partial_line.currency_id == line.currency_id:
                        amount_residual_currency += sign_partial_line * partial_line.amount_currency
                    else:
                        if line.balance and line.amount_currency:
                            rate = line.amount_currency / line.balance
                        else:
                            date = partial_line.credit_move_id.date if partial_line.debit_move_id == line else partial_line.debit_move_id.date
                            rate = line.currency_id.with_context(date=date).rate
                        amount_residual_currency += sign_partial_line * line.currency_id.round(partial_line.amount * rate)

            #computing the `reconciled` field.
            reconciled = False
            digits_rounding_precision = line.company_id.currency_id.rounding
            if (line.matched_debit_ids or line.matched_credit_ids) and float_is_zero(amount, precision_rounding=digits_rounding_precision):
                if line.currency_id and line.amount_currency:
                    if float_is_zero(amount_residual_currency, precision_rounding=line.currency_id.rounding):
                        reconciled = True
                else:
                    reconciled = True
            line.reconciled = reconciled

            line.amount_residual = line.move_id.company_id.currency_id.round(amount * sign)
            line.amount_residual_currency = line.currency_id and line.currency_id.round(amount_residual_currency * sign) or 0.0

    @api.depends('debit', 'credit', 'move_id.matched_percentage', 'move_id.journal_id')
    def _compute_cash_basis(self):
        for move_line in self:
            if move_line.journal_id.type in ('sale', 'purchase'):
                move_line.debit_cash_basis = move_line.debit * move_line.move_id.matched_percentage
                move_line.credit_cash_basis = move_line.credit * move_line.move_id.matched_percentage
            else:
                move_line.debit_cash_basis = move_line.debit
                move_line.credit_cash_basis = move_line.credit
            move_line.balance_cash_basis = move_line.debit_cash_basis - move_line.credit_cash_basis

    @api.depends('move_id.line_ids', 'move_id.line_ids.tax_line_id', 'move_id.line_ids.debit', 'move_id.line_ids.credit')
    def _compute_tax_base_amount(self):
        for move_line in self:
            if move_line.tax_line_id:
                base_lines = move_line.move_id.line_ids.filtered(lambda line: move_line.tax_line_id in line.tax_ids)
                move_line.tax_base_amount = abs(sum(base_lines.mapped('balance')))
            else:
                move_line.tax_base_amount = 0

    # -------------------------------------------------------------------------
    # CONSTRAINS METHODS
    # -------------------------------------------------------------------------

    @api.constrains('account_id')
    def _check_constrains_account_id(self):
        for line in self:
            account = line.account_id
            journal = line.journal_id

            if account.deprecated:
                raise UserError(_('The account %s (%s) is deprecated.') % (account.name, account.code))

            control_type_failed = journal.type_control_ids and account.user_type_id not in journal.type_control_ids
            control_account_failed = journal.account_control_ids and account not in journal.account_control_ids
            if control_type_failed or control_account_failed:
                raise UserError(_('You cannot use this general account in this journal, check the tab \'Entry Controls\' on the related journal.'))

    @api.constrains('tax_ids', 'tax_line_id')
    def _check_tax_lock_date1(self):
        for line in self:
            if line.date <= (line.company_id.tax_lock_date or date.min):
                raise ValidationError(
                    _("The operation is refused as it would impact an already issued tax statement. " +
                      "Please change the journal entry date or the tax lock date set in the settings ({}) to proceed").format(
                        line.company_id.tax_lock_date or date.min))

    @api.constrains('credit', 'debit', 'date')
    def _check_tax_lock_date2(self):
        for line in self:
            if (line.tax_ids or line.tax_line_id) and line.date <= (line.company_id.tax_lock_date or date.min):
                raise ValidationError(
                    _("The operation is refused as it would impact an already issued tax statement. " +
                      "Please change the journal entry date or the tax lock date set in the settings ({}) to proceed").format(
                        line.company_id.tax_lock_date or date.min))

    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------

    @api.model_cr
    def init(self):
        """ change index on partner_id to a multi-column index on (partner_id, ref), the new index will behave in the
            same way when we search on partner_id, with the addition of being optimal when having a query that will
            search on partner_id and ref at the same time (which is the case when we open the bank reconciliation widget)
        """
        cr = self._cr
        cr.execute('DROP INDEX IF EXISTS account_move_line_partner_id_index')
        cr.execute('SELECT indexname FROM pg_indexes WHERE indexname = %s', ('account_move_line_partner_id_ref_idx',))
        if not cr.fetchone():
            cr.execute('CREATE INDEX account_move_line_partner_id_ref_idx ON account_move_line (partner_id, ref)')

    @api.model_create_multi
    def create(self, vals_list):
        # OVERRIDE
        ACCOUNTING_FIELDS = ('debit', 'credit', 'amount_currency')
        BUSINESS_FIELDS = ('price_unit', 'quantity', 'discount', 'tax_ids')

        for vals in vals_list:
            move = self.env['account.move'].browse(vals['move_id'])

            if move.type in ('out_invoice', 'out_refund', 'in_invoice', 'in_refund', 'out_receipt', 'in_receipt'):
                currency = self.env['res.currency'].browse(vals.get('currency_id'))
                partner = self.env['res.partner'].browse(vals.get('partner_id'))
                taxes = self.resolve_2many_commands('tax_ids', vals.get('tax_ids', []), fields=['id'])
                taxes = self.env['account.tax'].browse(t['id'] for t in taxes)

                # Ensure consistency between accounting & business fields.
                if any(field in vals for field in ACCOUNTING_FIELDS):
                    if vals.get('currency_id'):
                        balance = vals.get('amount_currency', 0.0)
                    else:
                        balance = vals.get('debit', 0.0) - vals.get('credit', 0.0)
                    vals.update(self._get_inversed_accounting_vals(
                        vals.get('price_unit', 0.0),
                        vals.get('quantity', 0.0),
                        vals.get('discount', 0.0),
                        balance,
                        move.type,
                        currency,
                        taxes
                    ))
                elif any(field in vals for field in BUSINESS_FIELDS):
                    price_subtotal = self._get_computed_business_vals(
                        vals.get('price_unit', 0.0),
                        vals.get('quantity', 0.0),
                        vals.get('discount', 0.0),
                        currency,
                        self.env['product.product'].browse(vals.get('product_id')),
                        partner,
                        taxes
                    )['price_subtotal']
                    vals.update(self._get_computed_accounting_vals(
                        price_subtotal,
                        move.type,
                        currency,
                        move.company_id,
                        move.date,
                    ))

            # Ensure consistency between taxes & tax exigibility fields.
            if 'tax_exigible' in vals:
                continue
            if vals.get('tax_line_id'):
                tax = self.env['account.tax'].browse(vals['tax_line_id'])
                vals['tax_exigible'] = tax.tax_exigibility == 'on_invoice'
            elif vals.get('tax_ids'):
                taxes = self.resolve_2many_commands('tax_ids', vals['tax_ids'])
                vals['tax_exigible'] = not any([tax['tax_exigibility'] == 'on_payment' for tax in taxes])

        lines = super(AccountMoveLine, self).create(vals_list)

        # Check the move is balanced debit = credit.
        if self._context.get('check_move_validity', True):
            lines.mapped('move_id')._post_validate()

        return lines

    @api.multi
    def write(self, vals):
        # OVERRIDE
        ACCOUNTING_FIELDS = ('debit', 'credit', 'amount_currency')
        BUSINESS_FIELDS = ('price_unit', 'quantity', 'discount', 'tax_ids')

        if ('account_id' in vals) and self.env['account.account'].browse(vals['account_id']).deprecated:
            raise UserError(_('You cannot use a deprecated account.'))
        if any(key in vals for key in ('account_id', 'journal_id', 'date', 'move_id', 'debit', 'credit')):
            self._update_check()
        if not self._context.get('allow_amount_currency') and any(
                key in vals for key in ('amount_currency', 'currency_id')):
            # hackish workaround to write the amount_currency when assigning a payment to an invoice through the 'add' button
            # this is needed to compute the correct amount_residual_currency and potentially create an exchange difference entry
            self._update_check()
        # when making a reconciliation on an existing liquidity journal item, mark the payment as reconciled
        for record in self:
            if 'statement_line_id' in vals and record.payment_id:
                # In case of an internal transfer, there are 2 liquidity move lines to match with a bank statement
                if all(line.statement_id for line in record.payment_id.move_line_ids.filtered(
                        lambda r: r.id != record.id and r.account_id.internal_type == 'liquidity')):
                    record.payment_id.state = 'reconciled'

        result = super(AccountMoveLine, self).write(vals)
        if self._context.get('check_move_validity', True) and any(
                key in vals for key in ('account_id', 'journal_id', 'date', 'move_id', 'debit', 'credit')):
            move_ids = set()
            for line in self:
                if line.move_id.id not in move_ids:
                    move_ids.add(line.move_id.id)
            self.env['account.move'].browse(list(move_ids))._post_validate()

        for line in self:
            if line.move_id.type not in ('out_invoice', 'out_refund', 'in_invoice', 'in_refund', 'out_receipt', 'in_receipt'):
                continue

            # Ensure consistency between accounting & business fields.
            if any(field in vals for field in ACCOUNTING_FIELDS):
                price_subtotal = line.currency_id and line.amount_currency or line.debit - line.credit
                super(AccountMoveLine, line).write(self._get_inversed_accounting_vals(
                    line.price_unit,
                    line.quantity,
                    line.discount,
                    price_subtotal,
                    line.move_id.type,
                    line.currency_id,
                    line.tax_ids,
                ))
            elif any(field in vals for field in BUSINESS_FIELDS):
                price_subtotal = self._get_computed_business_vals(
                    line.price_unit,
                    line.quantity,
                    line.discount,
                    line.currency_id,
                    line.product_id,
                    line.partner_id,
                    line.tax_ids,
                )['price_subtotal']
                super(AccountMoveLine, line).write(self._get_computed_accounting_vals(
                    price_subtotal,
                    line.move_id.type,
                    line.currency_id,
                    line.move_id.company_id,
                    line.move_id.date,
                ))

        return result

    @api.multi
    def unlink(self):
        self._update_check()
        self._check_tax_lock_date2()
        move_ids = set()
        for line in self:
            if line.move_id.id not in move_ids:
                move_ids.add(line.move_id.id)
        result = super(AccountMoveLine, self).unlink()
        if self._context.get('check_move_validity', True) and move_ids:
            self.env['account.move'].browse(list(move_ids))._post_validate()
        return result

    @api.model
    def default_get(self, default_fields):
        # OVERRIDE
        values = super(AccountMoveLine, self).default_get(default_fields)

        if 'account_id' in default_fields \
            and (self._context.get('journal_id') or self._context.get('default_journal_id')) \
            and not values.get('account_id') \
            and self._context.get('type') in ('out_invoice', 'in_refund', 'out_receipt'):
            # Fill missing 'account_id'.
            journal = self.env['account.journal'].browse(self._context.get('default_journal_id', self._context['journal_id']))
            values['account_id'] = journal.default_credit_account_id.id
        elif 'account_id' in default_fields \
            and (self._context.get('journal_id') or self._context.get('default_journal_id')) \
            and not values.get('account_id') \
            and self._context.get('type') in ('in_invoice', 'out_refund', 'in_receipt'):
            # Fill missing 'account_id'.
            journal = self.env['account.journal'].browse(self._context.get('default_journal_id', self._context['journal_id']))
            values['account_id'] = journal.default_debit_account_id.id
        elif self._context.get('line_ids'):
            line_ids = self.move_id.resolve_2many_commands('line_ids', self._context['line_ids'],
                                                           fields=['credit', 'debit', 'partner_id', 'account_id'])

            # Suggest default value for debit / credit to balance the journal entry.
            balance = sum(line['debit'] - line['credit'] for line in line_ids)
            if balance < 0.0:
                values.update({'debit': -balance})
            if balance > 0.0:
                values.update({'credit': balance})

            # Suggest default value for 'partner_id'.
            if 'partner_id' in default_fields and not values.get('partner_id'):
                last_two_lines = line_ids[-2:]
                partners = set(line['partner_id'] for line in last_two_lines)
                if len(partners) == 1:
                    values['partner_id'] = partners.pop()

            # Suggest default value for 'account_id'.
            if 'account_id' in default_fields and not values.get('account_id'):
                last_two_lines = line_ids[-2:]
                accounts = set(line['account_id'] for line in last_two_lines)
                if len(accounts) == 1:
                    values['account_id'] = accounts.pop()
        return values

    @api.multi
    def _update_check(self):
        """ Raise Warning to cause rollback if the move is posted, some entries are reconciled or the move is older than the lock date"""
        move_ids = set()
        for line in self:
            err_msg = _('Move name (id): %s (%s)') % (line.move_id.name, str(line.move_id.id))
            if line.move_id.state != 'draft':
                raise UserError(_(
                    'You cannot do this modification on a posted journal entry, you can just change some non legal fields. You must revert the journal entry to cancel it.\n%s.') % err_msg)
            if line.reconciled and not (line.debit == 0 and line.credit == 0):
                raise UserError(_(
                    'You cannot do this modification on a reconciled entry. You can just change some non legal fields or you must unreconcile first.\n%s.') % err_msg)
            if line.move_id.id not in move_ids:
                move_ids.add(line.move_id.id)
        self.env['account.move'].browse(list(move_ids))._check_lock_date()
        return True

    @api.multi
    @api.depends('ref', 'move_id')
    def name_get(self):
        result = []
        for line in self:
            if line.ref:
                result.append((line.id, (line.move_id.name or '') + '(' + line.ref + ')'))
            else:
                result.append((line.id, line.move_id.name))
        return result

    # -------------------------------------------------------------------------
    # RECONCILIATION
    # -------------------------------------------------------------------------

    @api.multi
    def check_full_reconcile(self):
        """
        This method check if a move is totally reconciled and if we need to create exchange rate entries for the move.
        In case exchange rate entries needs to be created, one will be created per currency present.
        In case of full reconciliation, all moves belonging to the reconciliation will belong to the same account_full_reconcile object.
        """
        # Get first all aml involved
        part_recs = self.env['account.partial.reconcile'].search(['|', ('debit_move_id', 'in', self.ids), ('credit_move_id', 'in', self.ids)])
        amls = self
        todo = set(part_recs)
        seen = set()
        while todo:
            partial_rec = todo.pop()
            seen.add(partial_rec)
            for aml in [partial_rec.debit_move_id, partial_rec.credit_move_id]:
                if aml not in amls:
                    amls += aml
                    for x in aml.matched_debit_ids | aml.matched_credit_ids:
                        if x not in seen:
                            todo.add(x)
        partial_rec_ids = [x.id for x in seen]
        if not amls:
            return
        # If we have multiple currency, we can only base ourselve on debit-credit to see if it is fully reconciled
        currency = set([a.currency_id for a in amls if a.currency_id.id != False])
        multiple_currency = False
        if len(currency) != 1:
            currency = False
            multiple_currency = True
        else:
            currency = list(currency)[0]
        # Get the sum(debit, credit, amount_currency) of all amls involved
        total_debit = 0
        total_credit = 0
        total_amount_currency = 0
        maxdate = date.min
        to_balance = {}
        cash_basis_partial = self.env['account.partial.reconcile']
        for aml in amls:
            cash_basis_partial |= aml.move_id.tax_cash_basis_rec_id
            total_debit += aml.debit
            total_credit += aml.credit
            maxdate = max(aml.date, maxdate)
            total_amount_currency += aml.amount_currency
            # Convert in currency if we only have one currency and no amount_currency
            if not aml.amount_currency and currency:
                multiple_currency = True
                total_amount_currency += aml.company_id.currency_id._convert(aml.balance, currency, aml.company_id, aml.date)
            # If we still have residual value, it means that this move might need to be balanced using an exchange rate entry
            if aml.amount_residual != 0 or aml.amount_residual_currency != 0:
                if not to_balance.get(aml.currency_id):
                    to_balance[aml.currency_id] = [self.env['account.move.line'], 0]
                to_balance[aml.currency_id][0] += aml
                to_balance[aml.currency_id][1] += aml.amount_residual != 0 and aml.amount_residual or aml.amount_residual_currency

        # Check if reconciliation is total
        # To check if reconciliation is total we have 3 differents use case:
        # 1) There are multiple currency different than company currency, in that case we check using debit-credit
        # 2) We only have one currency which is different than company currency, in that case we check using amount_currency
        # 3) We have only one currency and some entries that don't have a secundary currency, in that case we check debit-credit
        #   or amount_currency.
        # 4) Cash basis full reconciliation
        #     - either none of the moves are cash basis reconciled, and we proceed
        #     - or some moves are cash basis reconciled and we make sure they are all fully reconciled

        digits_rounding_precision = amls[0].company_id.currency_id.rounding
        if (
                (
                    not cash_basis_partial or (cash_basis_partial and all([p >= 1.0 for p in amls._get_matched_percentage().values()]))
                ) and
                (
                    currency and float_is_zero(total_amount_currency, precision_rounding=currency.rounding) or
                    multiple_currency and float_compare(total_debit, total_credit, precision_rounding=digits_rounding_precision) == 0
                )
        ):

            exchange_move_id = False
            # Eventually create a journal entry to book the difference due to foreign currency's exchange rate that fluctuates
            if to_balance and any([not float_is_zero(residual, precision_rounding=digits_rounding_precision) for aml, residual in to_balance.values()]):
                exchange_move = self.env['account.move'].with_context(type='misc').create(
                    self.env['account.full.reconcile']._prepare_exchange_diff_move(move_date=maxdate, company=amls[0].company_id))
                part_reconcile = self.env['account.partial.reconcile']
                for aml_to_balance, total in to_balance.values():
                    if total:
                        rate_diff_amls, rate_diff_partial_rec = part_reconcile.create_exchange_rate_entry(aml_to_balance, exchange_move)
                        amls += rate_diff_amls
                        partial_rec_ids += rate_diff_partial_rec.ids
                    else:
                        aml_to_balance.reconcile()
                exchange_move.post()
                exchange_move_id = exchange_move.id
            #mark the reference of the full reconciliation on the exchange rate entries and on the entries
            self.env['account.full.reconcile'].create({
                'partial_reconcile_ids': [(6, 0, partial_rec_ids)],
                'reconciled_line_ids': [(6, 0, amls.ids)],
                'exchange_move_id': exchange_move_id,
            })

    @api.multi
    def _reconcile_lines(self, debit_moves, credit_moves, field):
        """ This function loops on the 2 recordsets given as parameter as long as it
            can find a debit and a credit to reconcile together. It returns the recordset of the
            account move lines that were not reconciled during the process.
        """
        (debit_moves + credit_moves).read([field])
        to_create = []
        cash_basis = debit_moves and debit_moves[0].account_id.internal_type in ('receivable', 'payable') or False
        cash_basis_percentage_before_rec = {}
        dc_vals ={}
        while (debit_moves and credit_moves):
            debit_move = debit_moves[0]
            credit_move = credit_moves[0]
            company_currency = debit_move.company_id.currency_id
            # We need those temporary value otherwise the computation might be wrong below
            temp_amount_residual = min(debit_move.amount_residual, -credit_move.amount_residual)
            temp_amount_residual_currency = min(debit_move.amount_residual_currency, -credit_move.amount_residual_currency)
            dc_vals[(debit_move.id, credit_move.id)] = (debit_move, credit_move, temp_amount_residual_currency)
            amount_reconcile = min(debit_move[field], -credit_move[field])

            #Remove from recordset the one(s) that will be totally reconciled
            # For optimization purpose, the creation of the partial_reconcile are done at the end,
            # therefore during the process of reconciling several move lines, there are actually no recompute performed by the orm
            # and thus the amount_residual are not recomputed, hence we have to do it manually.
            if amount_reconcile == debit_move[field]:
                debit_moves -= debit_move
            else:
                debit_moves[0].amount_residual -= temp_amount_residual
                debit_moves[0].amount_residual_currency -= temp_amount_residual_currency

            if amount_reconcile == -credit_move[field]:
                credit_moves -= credit_move
            else:
                credit_moves[0].amount_residual += temp_amount_residual
                credit_moves[0].amount_residual_currency += temp_amount_residual_currency
            #Check for the currency and amount_currency we can set
            currency = False
            amount_reconcile_currency = 0
            if field == 'amount_residual_currency':
                currency = credit_move.currency_id.id
                amount_reconcile_currency = temp_amount_residual_currency
                amount_reconcile = temp_amount_residual

            if cash_basis:
                tmp_set = debit_move | credit_move
                cash_basis_percentage_before_rec.update(tmp_set._get_matched_percentage())

            to_create.append({
                'debit_move_id': debit_move.id,
                'credit_move_id': credit_move.id,
                'amount': amount_reconcile,
                'amount_currency': amount_reconcile_currency,
                'currency_id': currency,
            })

        cash_basis_subjected = []
        part_rec = self.env['account.partial.reconcile']
        with self.env.norecompute():
            for partial_rec_dict in to_create:
                debit_move, credit_move, amount_residual_currency = dc_vals[partial_rec_dict['debit_move_id'], partial_rec_dict['credit_move_id']]
                # /!\ NOTE: Exchange rate differences shouldn't create cash basis entries
                # i. e: we don't really receive/give money in a customer/provider fashion
                # Since those are not subjected to cash basis computation we process them first
                if not amount_residual_currency and debit_move.currency_id and credit_move.currency_id:
                    part_rec.create(partial_rec_dict)
                else:
                    cash_basis_subjected.append(partial_rec_dict)

            for after_rec_dict in cash_basis_subjected:
                new_rec = part_rec.create(after_rec_dict)
                # if the pair belongs to move being reverted, do not create CABA entry
                if cash_basis and not (new_rec.debit_move_id + new_rec.credit_move_id).mapped('move_id').mapped('reverse_entry_id'):
                    new_rec.create_tax_cash_basis_entry(cash_basis_percentage_before_rec)
        self.recompute()

        return debit_moves+credit_moves

    @api.multi
    def auto_reconcile_lines(self):
        # Create list of debit and list of credit move ordered by date-currency
        debit_moves = self.filtered(lambda r: r.debit != 0 or r.amount_currency > 0)
        credit_moves = self.filtered(lambda r: r.credit != 0 or r.amount_currency < 0)
        debit_moves = debit_moves.sorted(key=lambda a: (a.date_maturity or a.date, a.currency_id))
        credit_moves = credit_moves.sorted(key=lambda a: (a.date_maturity or a.date, a.currency_id))
        # Compute on which field reconciliation should be based upon:
        field = self[0].account_id.currency_id and 'amount_residual_currency' or 'amount_residual'
        #if all lines share the same currency, use amount_residual_currency to avoid currency rounding error
        if self[0].currency_id and all([x.amount_currency and x.currency_id == self[0].currency_id for x in self]):
            field = 'amount_residual_currency'
        # Reconcile lines
        ret = self._reconcile_lines(debit_moves, credit_moves, field)
        return ret

    def _check_reconcile_validity(self):
        #Perform all checks on lines
        company_ids = set()
        all_accounts = []
        for line in self:
            company_ids.add(line.company_id.id)
            all_accounts.append(line.account_id)
            if (line.matched_debit_ids or line.matched_credit_ids) and line.reconciled:
                raise UserError(_('You are trying to reconcile some entries that are already reconciled.'))
        if len(company_ids) > 1:
            raise UserError(_('To reconcile the entries company should be the same for all entries.'))
        if len(set(all_accounts)) > 1:
            raise UserError(_('Entries are not from the same account.'))
        if not (all_accounts[0].reconcile or all_accounts[0].internal_type == 'liquidity'):
            raise UserError(_('Account %s (%s) does not allow reconciliation. First change the configuration of this account to allow it.') % (all_accounts[0].name, all_accounts[0].code))

    @api.multi
    def reconcile(self, writeoff_acc_id=False, writeoff_journal_id=False):
        # Empty self can happen if the user tries to reconcile entries which are already reconciled.
        # The calling method might have filtered out reconciled lines.
        if not self:
            return

        self._check_reconcile_validity()
        #reconcile everything that can be
        remaining_moves = self.auto_reconcile_lines()

        writeoff_to_reconcile = self.env['account.move.line']
        #if writeoff_acc_id specified, then create write-off move with value the remaining amount from move in self
        if writeoff_acc_id and writeoff_journal_id and remaining_moves:
            all_aml_share_same_currency = all([x.currency_id == self[0].currency_id for x in self])
            writeoff_vals = {
                'account_id': writeoff_acc_id.id,
                'journal_id': writeoff_journal_id.id
            }
            if not all_aml_share_same_currency:
                writeoff_vals['amount_currency'] = False
            writeoff_to_reconcile = remaining_moves._create_writeoff([writeoff_vals])
            #add writeoff line to reconcile algorithm and finish the reconciliation
            remaining_moves = (remaining_moves + writeoff_to_reconcile).auto_reconcile_lines()
        # Check if reconciliation is total or needs an exchange rate entry to be created
        (self + writeoff_to_reconcile).check_full_reconcile()
        return True

    def _create_writeoff(self, writeoff_vals):
        """ Create a writeoff move per journal for the account.move.lines in self. If debit/credit is not specified in vals,
            the writeoff amount will be computed as the sum of amount_residual of the given recordset.
            :param writeoff_vals: list of dicts containing values suitable for account_move_line.create(). The data in vals will
                be processed to create bot writeoff acount.move.line and their enclosing account.move.
        """
        def compute_writeoff_counterpart_vals(values):
            line_values = values.copy()
            line_values['debit'], line_values['credit'] = line_values['credit'], line_values['debit']
            if 'amount_currency' in values:
                line_values['amount_currency'] = -line_values['amount_currency']
            return line_values
        # Group writeoff_vals by journals
        writeoff_dict = {}
        for val in writeoff_vals:
            journal_id = val.get('journal_id', False)
            if not writeoff_dict.get(journal_id, False):
                writeoff_dict[journal_id] = [val]
            else:
                writeoff_dict[journal_id].append(val)

        partner_id = self.env['res.partner']._find_accounting_partner(self[0].partner_id).id
        company_currency = self[0].account_id.company_id.currency_id
        writeoff_currency = self[0].currency_id or company_currency
        line_to_reconcile = self.env['account.move.line']
        # Iterate and create one writeoff by journal
        writeoff_moves = self.env['account.move']
        for journal_id, lines in writeoff_dict.items():
            total = 0
            total_currency = 0
            writeoff_lines = []
            date = fields.Date.today()
            for vals in lines:
                # Check and complete vals
                if 'account_id' not in vals or 'journal_id' not in vals:
                    raise UserError(_("It is mandatory to specify an account and a journal to create a write-off."))
                if ('debit' in vals) ^ ('credit' in vals):
                    raise UserError(_("Either pass both debit and credit or none."))
                if 'date' not in vals:
                    vals['date'] = self._context.get('date_p') or fields.Date.today()
                vals['date'] = fields.Date.to_date(vals['date'])
                if vals['date'] and vals['date'] < date:
                    date = vals['date']
                if 'name' not in vals:
                    vals['name'] = self._context.get('comment') or _('Write-Off')
                if 'analytic_account_id' not in vals:
                    vals['analytic_account_id'] = self.env.context.get('analytic_id', False)
                #compute the writeoff amount if not given
                if 'credit' not in vals and 'debit' not in vals:
                    amount = sum([r.amount_residual for r in self])
                    vals['credit'] = amount > 0 and amount or 0.0
                    vals['debit'] = amount < 0 and abs(amount) or 0.0
                vals['partner_id'] = partner_id
                total += vals['debit']-vals['credit']
                if 'amount_currency' not in vals and writeoff_currency != company_currency:
                    vals['currency_id'] = writeoff_currency.id
                    sign = 1 if vals['debit'] > 0 else -1
                    vals['amount_currency'] = sign * abs(sum([r.amount_residual_currency for r in self]))
                    total_currency += vals['amount_currency']

                writeoff_lines.append(compute_writeoff_counterpart_vals(vals))

            # Create balance line
            writeoff_lines.append({
                'name': _('Write-Off'),
                'debit': total > 0 and total or 0.0,
                'credit': total < 0 and -total or 0.0,
                'amount_currency': total_currency,
                'currency_id': total_currency and writeoff_currency.id or False,
                'journal_id': journal_id,
                'account_id': self[0].account_id.id,
                'partner_id': partner_id
                })

            # Create the move
            writeoff_move = self.env['account.move'].create({
                'journal_id': journal_id,
                'date': date,
                'state': 'draft',
                'line_ids': [(0, 0, line) for line in writeoff_lines],
            })
            writeoff_moves += writeoff_move
            # writeoff_move.post()

            line_to_reconcile += writeoff_move.line_ids.filtered(lambda r: r.account_id == self[0].account_id).sorted(key='id')[-1:]
        if writeoff_moves:
            writeoff_moves.post()
        # Return the writeoff move.line which is to be reconciled
        return line_to_reconcile

    @api.multi
    def remove_move_reconcile(self):
        """ Undo a reconciliation """
        (self.mapped('matched_debit_ids') + self.mapped('matched_credit_ids')).unlink()

    @api.multi
    def _copy_data_extend_business_fields(self, values):
        ''' Hook allowing copying business fields under certain conditions.
        E.g. The link to the sale order lines must be preserved in case of a refund.
        '''
        self.ensure_one()

    @api.multi
    def copy_data(self, default=None):
        res = super(AccountMoveLine, self).copy_data(default=default)
        if self._context.get('include_business_fields'):
            for line, values in zip(self, res):
                line._copy_data_extend_business_fields(values)
        return res

    # -------------------------------------------------------------------------
    # MISC
    # -------------------------------------------------------------------------

    def _get_matched_percentage(self):
        """ This function returns a dictionary giving for each move_id of self, the percentage to consider as cash basis factor.
        This is actually computing the same as the matched_percentage field of account.move, except in case of multi-currencies
        where we recompute the matched percentage based on the amount_currency fields.
        Note that this function is used only by the tax cash basis module since we want to consider the matched_percentage only
        based on the company currency amounts in reports.
        """
        matched_percentage_per_move = {}
        for line in self:
            if not matched_percentage_per_move.get(line.move_id.id, False):
                lines_to_consider = line.move_id.line_ids.filtered(lambda x: x.account_id.internal_type in ('receivable', 'payable'))
                total_amount_currency = 0.0
                total_reconciled_currency = 0.0
                all_same_currency = False
                #if all receivable/payable aml and their payments have the same currency, we can safely consider
                #the amount_currency fields to avoid including the exchange rate difference in the matched_percentage
                if lines_to_consider and all([x.currency_id.id == lines_to_consider[0].currency_id.id for x in lines_to_consider]):
                    all_same_currency = lines_to_consider[0].currency_id.id
                    for line in lines_to_consider:
                        if all_same_currency:
                            total_amount_currency += abs(line.amount_currency)
                            for partial_line in (line.matched_debit_ids + line.matched_credit_ids):
                                if partial_line.currency_id and partial_line.currency_id.id == all_same_currency:
                                    total_reconciled_currency += partial_line.amount_currency
                                else:
                                    all_same_currency = False
                                    break
                if not all_same_currency:
                    #we cannot rely on amount_currency fields as it is not present on all partial reconciliation
                    matched_percentage_per_move[line.move_id.id] = line.move_id.matched_percentage
                else:
                    #we can rely on amount_currency fields, which allow us to post a tax cash basis move at the initial rate
                    #to avoid currency rate difference issues.
                    if total_amount_currency == 0.0:
                        matched_percentage_per_move[line.move_id.id] = 1.0
                    else:
                        matched_percentage_per_move[line.move_id.id] = total_reconciled_currency / total_amount_currency
        return matched_percentage_per_move

    def _get_analytic_tag_ids(self):
        self.ensure_one()
        return self.analytic_tag_ids.filtered(lambda r: not r.active_analytic_distribution).ids

    @api.multi
    def create_analytic_lines(self):
        """ Create analytic items upon validation of an account.move.line having an analytic account or an analytic distribution.
        """
        lines_to_create_analytic_entries = self.env['account.move.line']
        for obj_line in self:
            for tag in obj_line.analytic_tag_ids.filtered('active_analytic_distribution'):
                for distribution in tag.analytic_distribution_ids:
                    vals_line = obj_line._prepare_analytic_distribution_line(distribution)
                    self.env['account.analytic.line'].create(vals_line)
            if obj_line.analytic_account_id:
                lines_to_create_analytic_entries |= obj_line

        # create analytic entries in batch
        if lines_to_create_analytic_entries:
            values_list = lines_to_create_analytic_entries._prepare_analytic_line()
            self.env['account.analytic.line'].create(values_list)

    @api.multi
    def _prepare_analytic_line(self):
        """ Prepare the values used to create() an account.analytic.line upon validation of an account.move.line having
            an analytic account. This method is intended to be extended in other modules.
            :return list of values to create analytic.line
            :rtype list
        """
        result = []
        for move_line in self:
            amount = (move_line.credit or 0.0) - (move_line.debit or 0.0)
            default_name = move_line.name or (move_line.ref or '/' + ' -- ' + (move_line.partner_id and move_line.partner_id.name or '/'))
            result.append({
                'name': default_name,
                'date': move_line.date,
                'account_id': move_line.analytic_account_id.id,
                'tag_ids': [(6, 0, move_line._get_analytic_tag_ids())],
                'unit_amount': move_line.quantity,
                'product_id': move_line.product_id and move_line.product_id.id or False,
                'product_uom_id': move_line.product_uom_id and move_line.product_uom_id.id or False,
                'amount': amount,
                'general_account_id': move_line.account_id.id,
                'ref': move_line.ref,
                'move_id': move_line.id,
                'user_id': move_line.move_id.user_id.id or self._uid,
                'partner_id': move_line.partner_id.id,
                'company_id': move_line.analytic_account_id.company_id.id or self.env.user.company_id.id,
            })
        return result

    def _prepare_analytic_distribution_line(self, distribution):
        """ Prepare the values used to create() an account.analytic.line upon validation of an account.move.line having
            analytic tags with analytic distribution.
        """
        self.ensure_one()
        amount = -self.balance * distribution.percentage / 100.0
        default_name = self.name or (self.ref or '/' + ' -- ' + (self.partner_id and self.partner_id.name or '/'))
        return {
            'name': default_name,
            'date': self.date,
            'account_id': distribution.account_id.id,
            'partner_id': self.partner_id.id,
            'tag_ids': [(6, 0, [distribution.tag_id.id] + self._get_analytic_tag_ids())],
            'unit_amount': self.quantity,
            'product_id': self.product_id and self.product_id.id or False,
            'product_uom_id': self.product_uom_id and self.product_uom_id.id or False,
            'amount': amount,
            'general_account_id': self.account_id.id,
            'ref': self.ref,
            'move_id': self.id,
            'user_id': self.move_id.user_id.id or self._uid,
            'company_id': distribution.account_id.company_id.id or self.env.user.company_id.id,
        }

    @api.model
    def _query_get(self, domain=None):
        self.check_access_rights('read')

        context = dict(self._context or {})
        domain = domain or []
        if not isinstance(domain, (list, tuple)):
            domain = safe_eval(domain)

        date_field = 'date'
        if context.get('aged_balance'):
            date_field = 'date_maturity'
        if context.get('date_to'):
            domain += [(date_field, '<=', context['date_to'])]
        if context.get('date_from'):
            if not context.get('strict_range'):
                domain += ['|', (date_field, '>=', context['date_from']), ('account_id.user_type_id.include_initial_balance', '=', True)]
            elif context.get('initial_bal'):
                domain += [(date_field, '<', context['date_from'])]
            else:
                domain += [(date_field, '>=', context['date_from'])]

        if context.get('journal_ids'):
            domain += [('journal_id', 'in', context['journal_ids'])]

        state = context.get('state')
        if state and state.lower() != 'all':
            domain += [('move_id.state', '=', state)]

        if context.get('company_id'):
            domain += [('company_id', '=', context['company_id'])]

        if 'company_ids' in context:
            domain += [('company_id', 'in', context['company_ids'])]

        if context.get('reconcile_date'):
            domain += ['|', ('reconciled', '=', False), '|', ('matched_debit_ids.max_date', '>', context['reconcile_date']), ('matched_credit_ids.max_date', '>', context['reconcile_date'])]

        if context.get('account_tag_ids'):
            domain += [('account_id.tag_ids', 'in', context['account_tag_ids'].ids)]

        if context.get('account_ids'):
            domain += [('account_id', 'in', context['account_ids'].ids)]

        if context.get('analytic_tag_ids'):
            domain += [('analytic_tag_ids', 'in', context['analytic_tag_ids'].ids)]

        if context.get('analytic_account_ids'):
            domain += [('analytic_account_id', 'in', context['analytic_account_ids'].ids)]

        if context.get('partner_ids'):
            domain += [('partner_id', 'in', context['partner_ids'].ids)]

        if context.get('partner_categories'):
            domain += [('partner_id.category_id', 'in', context['partner_categories'].ids)]

        where_clause = ""
        where_clause_params = []
        tables = ''
        if domain:
            domain.append(('display_type', 'not in', ('line_section', 'line_note')))

            query = self._where_calc(domain)

            # Wrap the query with 'company_id IN (...)' to avoid bypassing company access rights.
            self._apply_ir_rules(query)

            tables, where_clause, where_clause_params = query.get_sql()
        return tables, where_clause, where_clause_params

    @api.multi
    def open_reconcile_view(self):
        [action] = self.env.ref('account.action_account_moves_all_a').read()
        ids = []
        for aml in self:
            if aml.account_id.reconcile:
                ids.extend([r.debit_move_id.id for r in aml.matched_debit_ids] if aml.credit > 0 else [r.credit_move_id.id for r in aml.matched_credit_ids])
                ids.append(aml.id)
        action['domain'] = [('id', 'in', ids)]
        return action

    @api.model
    def _get_domain_for_edition_mode(self):
        return [
            ('move_id.to_check', '=', True),
            ('full_reconcile_id', '=', False),
            ('statement_line_id', '!=', False),
        ]


class AccountPartialReconcile(models.Model):
    _name = "account.partial.reconcile"
    _description = "Partial Reconcile"

    debit_move_id = fields.Many2one('account.move.line', index=True, required=True)
    credit_move_id = fields.Many2one('account.move.line', index=True, required=True)
    amount = fields.Monetary(currency_field='company_currency_id', help="Amount concerned by this matching. Assumed to be always positive")
    amount_currency = fields.Monetary(string="Amount in Currency")
    currency_id = fields.Many2one('res.currency', string='Currency')
    company_currency_id = fields.Many2one('res.currency', string="Company Currency", related='company_id.currency_id', readonly=True,
        help='Utility field to express amount currency')
    company_id = fields.Many2one('res.company', related='debit_move_id.company_id', store=True, string='Company', readonly=False)
    full_reconcile_id = fields.Many2one('account.full.reconcile', string="Full Reconcile", copy=False)
    max_date = fields.Date(string='Max Date of Matched Lines', compute='_compute_max_date',
        readonly=True, copy=False, store=True,
        help='Technical field used to determine at which date this reconciliation needs to be shown on the aged receivable/payable reports.')

    @api.multi
    @api.depends('debit_move_id.date', 'credit_move_id.date')
    def _compute_max_date(self):
        for rec in self:
            rec.max_date = max(
                rec.debit_move_id.date,
                rec.credit_move_id.date
            )

    @api.model
    def _prepare_exchange_diff_partial_reconcile(self, aml, line_to_reconcile, currency):
        return {
            'debit_move_id': aml.credit and line_to_reconcile.id or aml.id,
            'credit_move_id': aml.debit and line_to_reconcile.id or aml.id,
            'amount': abs(aml.amount_residual),
            'amount_currency': abs(aml.amount_residual_currency),
            'currency_id': currency and currency.id or False,
        }

    @api.model
    def create_exchange_rate_entry(self, aml_to_fix, move):
        """
        Automatically create a journal items to book the exchange rate
        differences that can occur in multi-currencies environment. That
        new journal item will be made into the given `move` in the company
        `currency_exchange_journal_id`, and one of its journal items is
        matched with the other lines to balance the full reconciliation.
        :param aml_to_fix: recordset of account.move.line (possible several
            but sharing the same currency)
        :param move: account.move
        :return: tuple.
            [0]: account.move.line created to balance the `aml_to_fix`
            [1]: recordset of account.partial.reconcile created between the
                tuple first element and the `aml_to_fix`
        """
        partial_rec = self.env['account.partial.reconcile']
        aml_model = self.env['account.move.line']

        created_lines = self.env['account.move.line']
        for aml in aml_to_fix:
            #create the line that will compensate all the aml_to_fix
            line_to_rec = aml_model.with_context(check_move_validity=False).create({
                'name': _('Currency exchange rate difference'),
                'debit': aml.amount_residual < 0 and -aml.amount_residual or 0.0,
                'credit': aml.amount_residual > 0 and aml.amount_residual or 0.0,
                'account_id': aml.account_id.id,
                'move_id': move.id,
                'currency_id': aml.currency_id.id,
                'amount_currency': aml.amount_residual_currency and -aml.amount_residual_currency or 0.0,
                'partner_id': aml.partner_id.id,
            })
            #create the counterpart on exchange gain/loss account
            exchange_journal = move.company_id.currency_exchange_journal_id
            aml_model.with_context(check_move_validity=False).create({
                'name': _('Currency exchange rate difference'),
                'debit': aml.amount_residual > 0 and aml.amount_residual or 0.0,
                'credit': aml.amount_residual < 0 and -aml.amount_residual or 0.0,
                'account_id': aml.amount_residual > 0 and exchange_journal.default_debit_account_id.id or exchange_journal.default_credit_account_id.id,
                'move_id': move.id,
                'currency_id': aml.currency_id.id,
                'amount_currency': aml.amount_residual_currency and aml.amount_residual_currency or 0.0,
                'partner_id': aml.partner_id.id,
            })

            #reconcile all aml_to_fix
            partial_rec |= self.create(
                self._prepare_exchange_diff_partial_reconcile(
                        aml=aml,
                        line_to_reconcile=line_to_rec,
                        currency=aml.currency_id or False)
            )
            created_lines |= line_to_rec
        return created_lines, partial_rec

    def _get_tax_cash_basis_base_account(self, line, tax):
        ''' Get the account of lines that will contain the base amount of taxes.
        :param line: An account.move.line record
        :param tax: An account.tax record
        :return: An account record
        '''
        return tax.cash_basis_base_account_id or line.account_id

    def _get_amount_tax_cash_basis(self, amount, line):
        return line.company_id.currency_id.round(amount)

    def create_tax_cash_basis_entry(self, percentage_before_rec):
        self.ensure_one()
        move_date = self.debit_move_id.date
        newly_created_move = self.env['account.move']
        with self.env.norecompute():
            for move in (self.debit_move_id.move_id, self.credit_move_id.move_id):
                #move_date is the max of the 2 reconciled items
                if move_date < move.date:
                    move_date = move.date
                percentage_before = percentage_before_rec[move.id]
                percentage_after = move.line_ids[0]._get_matched_percentage()[move.id]
                # update the percentage before as the move can be part of
                # multiple partial reconciliations
                percentage_before_rec[move.id] = percentage_after

                for line in move.line_ids:
                    if not line.tax_exigible:
                        #amount is the current cash_basis amount minus the one before the reconciliation
                        amount = line.balance * percentage_after - line.balance * percentage_before
                        rounded_amt = self._get_amount_tax_cash_basis(amount, line)
                        if float_is_zero(rounded_amt, precision_rounding=line.company_id.currency_id.rounding):
                            continue
                        if line.tax_line_id and line.tax_line_id.tax_exigibility == 'on_payment':
                            if not newly_created_move:
                                newly_created_move = self._create_tax_basis_move()
                            #create cash basis entry for the tax line
                            to_clear_aml = self.env['account.move.line'].with_context(check_move_validity=False).create({
                                'name': line.move_id.name,
                                'debit': abs(rounded_amt) if rounded_amt < 0 else 0.0,
                                'credit': rounded_amt if rounded_amt > 0 else 0.0,
                                'account_id': line.account_id.id,
                                'analytic_account_id': line.analytic_account_id.id,
                                'analytic_tag_ids': line.analytic_tag_ids.ids,
                                'tax_exigible': True,
                                'amount_currency': line.amount_currency and line.currency_id.round(-line.amount_currency * amount / line.balance) or 0.0,
                                'currency_id': line.currency_id.id,
                                'move_id': newly_created_move.id,
                                'partner_id': line.partner_id.id,
                            })
                            # Group by cash basis account and tax
                            self.env['account.move.line'].with_context(check_move_validity=False).create({
                                'name': line.name,
                                'debit': rounded_amt if rounded_amt > 0 else 0.0,
                                'credit': abs(rounded_amt) if rounded_amt < 0 else 0.0,
                                'account_id': line.tax_line_id.cash_basis_account_id.id,
                                'analytic_account_id': line.analytic_account_id.id,
                                'analytic_tag_ids': line.analytic_tag_ids.ids,
                                'tax_line_id': line.tax_line_id.id,
                                'tax_exigible': True,
                                'amount_currency': line.amount_currency and line.currency_id.round(line.amount_currency * amount / line.balance) or 0.0,
                                'currency_id': line.currency_id.id,
                                'move_id': newly_created_move.id,
                                'partner_id': line.partner_id.id,
                            })
                            if line.account_id.reconcile:
                                #setting the account to allow reconciliation will help to fix rounding errors
                                to_clear_aml |= line
                                to_clear_aml.reconcile()

                        if any([tax.tax_exigibility == 'on_payment' for tax in line.tax_ids]):
                            if not newly_created_move:
                                newly_created_move = self._create_tax_basis_move()
                            #create cash basis entry for the base
                            for tax in line.tax_ids.filtered(lambda t: t.tax_exigibility == 'on_payment'):
                                account_id = self._get_tax_cash_basis_base_account(line, tax)
                                self.env['account.move.line'].with_context(check_move_validity=False).create({
                                    'name': line.name,
                                    'debit': rounded_amt > 0 and rounded_amt or 0.0,
                                    'credit': rounded_amt < 0 and abs(rounded_amt) or 0.0,
                                    'account_id': account_id.id,
                                    'tax_exigible': True,
                                    'tax_ids': [(6, 0, [tax.id])],
                                    'move_id': newly_created_move.id,
                                    'currency_id': line.currency_id.id,
                                    'amount_currency': self.amount_currency and line.currency_id.round(line.amount_currency * amount / line.balance) or 0.0,
                                    'partner_id': line.partner_id.id,
                                })
                                self.env['account.move.line'].with_context(check_move_validity=False).create({
                                    'name': line.name,
                                    'credit': rounded_amt > 0 and rounded_amt or 0.0,
                                    'debit': rounded_amt < 0 and abs(rounded_amt) or 0.0,
                                    'account_id': account_id.id,
                                    'tax_exigible': True,
                                    'move_id': newly_created_move.id,
                                    'currency_id': line.currency_id.id,
                                    'amount_currency': self.amount_currency and line.currency_id.round(-line.amount_currency * amount / line.balance) or 0.0,
                                    'partner_id': line.partner_id.id,
                                })
        self.recompute()
        if newly_created_move:
            if move_date > (self.company_id.period_lock_date or date.min) and newly_created_move.date != move_date:
                # The move date should be the maximum date between payment and invoice (in case
                # of payment in advance). However, we should make sure the move date is not
                # recorded before the period lock date as the tax statement for this period is
                # probably already sent to the estate.
                newly_created_move.write({'date': move_date})
            # post move
            newly_created_move.post()

    def _create_tax_basis_move(self):
        # Check if company_journal for cash basis is set if not, raise exception
        if not self.company_id.tax_cash_basis_journal_id:
            raise UserError(_('There is no tax cash basis journal defined '
                              'for this company: "%s" \nConfigure it in Accounting/Configuration/Settings') %
                            (self.company_id.name))
        move_vals = {
            'journal_id': self.company_id.tax_cash_basis_journal_id.id,
            'tax_cash_basis_rec_id': self.id,
            'ref': self.credit_move_id.move_id.name if self.credit_move_id.payment_id else self.debit_move_id.move_id.name,
        }
        return self.env['account.move'].create(move_vals)

    @api.multi
    def unlink(self):
        """ When removing a partial reconciliation, also unlink its full reconciliation if it exists """
        full_to_unlink = self.env['account.full.reconcile']
        for rec in self:
            if rec.full_reconcile_id:
                full_to_unlink |= rec.full_reconcile_id
        #reverse the tax basis move created at the reconciliation time
        for move in self.env['account.move'].search([('tax_cash_basis_rec_id', 'in', self._ids)]):
            if move.date > (move.company_id.period_lock_date or date.min):
                move._reverse_moves([{'ref': _('Reversal of %s') % move.name}], cancel=True)
            else:
                move._reverse_moves([{'date': fields.Date.today(), 'ref': _('Reversal of %s') % move.name}], cancel=True)
        res = super(AccountPartialReconcile, self).unlink()
        if full_to_unlink:
            full_to_unlink.unlink()
        return res


class AccountFullReconcile(models.Model):
    _name = "account.full.reconcile"
    _description = "Full Reconcile"

    name = fields.Char(string='Number', required=True, copy=False, default=lambda self: self.env['ir.sequence'].next_by_code('account.reconcile'))
    partial_reconcile_ids = fields.One2many('account.partial.reconcile', 'full_reconcile_id', string='Reconciliation Parts')
    reconciled_line_ids = fields.One2many('account.move.line', 'full_reconcile_id', string='Matched Journal Items')
    exchange_move_id = fields.Many2one('account.move')

    @api.multi
    def unlink(self):
        """ When removing a full reconciliation, we need to revert the eventual journal entries we created to book the
            fluctuation of the foreign currency's exchange rate.
            We need also to reconcile together the origin currency difference line and its reversal in order to completely
            cancel the currency difference entry on the partner account (otherwise it will still appear on the aged balance
            for example).
        """
        for rec in self:
            if rec.exchange_move_id:
                # reverse the exchange rate entry after de-referencing it to avoid looping
                # (reversing will cause a nested attempt to drop the full reconciliation)
                to_reverse = rec.exchange_move_id
                rec.exchange_move_id = False
                to_reverse._reverse_moves([{
                    'date': fields.Date.today(),
                    'ref': _('Reversal of: %s') % to_reverse.name,
                }], cancel=True)
        return super(AccountFullReconcile, self).unlink()

    @api.model
    def _prepare_exchange_diff_move(self, move_date, company):
        if not company.currency_exchange_journal_id:
            raise UserError(_("You should configure the 'Exchange Rate Journal' in the accounting settings, to manage automatically the booking of accounting entries related to differences between exchange rates."))
        if not company.income_currency_exchange_account_id.id:
            raise UserError(_("You should configure the 'Gain Exchange Rate Account' in the accounting settings, to manage automatically the booking of accounting entries related to differences between exchange rates."))
        if not company.expense_currency_exchange_account_id.id:
            raise UserError(_("You should configure the 'Loss Exchange Rate Account' in the accounting settings, to manage automatically the booking of accounting entries related to differences between exchange rates."))
        res = {'journal_id': company.currency_exchange_journal_id.id}
        # The move date should be the maximum date between payment and invoice
        # (in case of payment in advance). However, we should make sure the
        # move date is not recorded after the end of year closing.
        if move_date > (company.fiscalyear_lock_date or date.min):
            res['date'] = move_date
        return res
