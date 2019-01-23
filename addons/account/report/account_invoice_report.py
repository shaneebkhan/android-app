# -*- coding: utf-8 -*-

from odoo import tools
from odoo import models, fields, api


class AccountInvoiceReport(models.Model):
    _name = "account.invoice.report"
    _description = "Invoices Statistics"
    _auto = False
    _rec_name = 'invoice_date'
    _order = 'invoice_date desc'

    @api.multi
    @api.depends('currency_id', 'invoice_date', 'price_subtotal', 'price_average', 'residual')
    def _compute_amounts_in_user_currency(self):
        """Compute the amounts in the currency of the user
        """
        user_currency_id = self.env.user.company_id.currency_id
        currency_rate_id = self.env['res.currency.rate'].search([
            ('rate', '=', 1),
            '|', ('company_id', '=', self.env.user.company_id.id), ('company_id', '=', False)], limit=1)
        base_currency_id = currency_rate_id.currency_id
        for record in self:
            date = record.invoice_date or fields.Date.today()
            company = record.company_id
            record.user_currency_price_total = base_currency_id._convert(record.price_subtotal, user_currency_id, company, date)
            record.user_currency_price_average = base_currency_id._convert(record.price_average, user_currency_id, company, date)
            record.user_currency_residual = base_currency_id._convert(record.residual, user_currency_id, company, date)

    name = fields.Char('Invoice #', readonly=True)
    invoice_date = fields.Date(readonly=True, string="Invoice Date")
    product_id = fields.Many2one('product.product', string='Product', readonly=True)
    quantity = fields.Float(string='Product Quantity', readonly=True)
    uom_template_name = fields.Char(string='Reference Unit of Measure', readonly=True)
    invoice_payment_term_id = fields.Many2one('account.payment.term', string='Payment Terms', oldname='payment_term', readonly=True)
    fiscal_position_id = fields.Many2one('account.fiscal.position', oldname='fiscal_position', string='Fiscal Position', readonly=True)
    currency_id = fields.Many2one('res.currency', string='Currency', readonly=True)
    categ_id = fields.Many2one('product.category', string='Product Category', readonly=True)
    journal_id = fields.Many2one('account.journal', string='Journal', readonly=True)
    partner_id = fields.Many2one('res.partner', string='Partner', readonly=True)
    commercial_partner_id = fields.Many2one('res.partner', string='Partner Company', help="Commercial Entity")
    company_id = fields.Many2one('res.company', string='Company', readonly=True)
    user_id = fields.Many2one('res.users', string='Salesperson', readonly=True)
    price_subtotal = fields.Float(string='Untaxed Total', readonly=True)
    user_currency_price_total = fields.Float(string="Total Without Tax in Currency", compute='_compute_amounts_in_user_currency', digits=0)
    price_average = fields.Float(string='Average Price', readonly=True, group_operator="avg")
    user_currency_price_average = fields.Float(string="Average Price in Currency", compute='_compute_amounts_in_user_currency', digits=0)
    nbr_lines = fields.Integer(string='Line Count', readonly=True)
    move_id = fields.Many2one('account.move', readonly=True)
    type = fields.Selection([
        ('out_invoice', 'Customer Invoice'),
        ('in_invoice', 'Vendor Bill'),
        ('out_refund', 'Customer Credit Note'),
        ('in_refund', 'Vendor Credit Note'),
        ], readonly=True)
    state = fields.Selection([
        ('draft', 'Draft'),
        ('posted', 'Open'),
        ('cancel', 'Cancelled')
        ], string='Invoice Status', readonly=True)
    invoice_payment_state = fields.Selection(selection=[
        ('not_paid', 'Not Paid'),
        ('in_payment', 'In Payment'),
        ('paid', 'paid')
    ], string='Payment Status', readonly=True)
    invoice_date_due = fields.Date(string='Due Date', readonly=True)
    account_id = fields.Many2one('account.account', string='Revenue/Expense Account', readonly=True, domain=[('deprecated', '=', False)])
    invoice_partner_bank_id = fields.Many2one('res.partner.bank', string='Bank Account', readonly=True)
    residual = fields.Float(string='Due Amount', readonly=True)
    user_currency_residual = fields.Float(string="Total Residual", compute='_compute_amounts_in_user_currency', digits=0)
    country_id = fields.Many2one('res.country', string="Partner Company's Country")
    analytic_account_id = fields.Many2one('account.analytic.account', string='Analytic Account', groups="analytic.group_analytic_accounting")
    amount_total = fields.Float(string='Total', readonly=True)

    _depends = {
        'account.move': [
            'name', 'state', 'type', 'partner_id', 'user_id', 'fiscal_position_id',
            'invoice_date', 'invoice_date_due', 'invoice_payment_term_id', 'invoice_partner_bank_id',
        ],
        'account.move.line': [
            'quantity', 'price_subtotal', 'amount_residual', 'balance', 'amount_currency',
            'move_id', 'product_id', 'product_uom_id', 'account_id', 'analytic_account_id',
            'journal_id', 'company_id', 'currency_id', 'partner_id',
        ],
        'product.product': ['product_tmpl_id'],
        'product.template': ['categ_id'],
        'uom.uom': ['category_id', 'factor', 'name', 'uom_type'],
        'res.partner': ['country_id'],
    }

    @api.model_cr
    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute('''
            CREATE OR REPLACE VIEW %s AS (
                SELECT
                    line.id,
                    line.move_id,
                    line.product_id,
                    line.account_id,
                    line.analytic_account_id,
                    line.journal_id,
                    line.company_id,
                    line.currency_id,
                    line.partner_id                                                         AS commercial_partner_id,
                    move.name,
                    move.state,
                    move.type,
                    move.residual,
                    move.amount_total,
                    move.partner_id,
                    move.user_id,
                    move.fiscal_position_id,
                    move.invoice_payment_state,
                    move.invoice_date,
                    move.invoice_date_due,
                    move.invoice_payment_term_id,
                    move.invoice_partner_bank_id,
                    uom_template.name                                                       AS uom_template_name,
                    template.categ_id,
                    SUM(NULLIF(
                        (CASE WHEN move.type IN ('out_refund', 'in_invoice') THEN -1 ELSE 1 END * line.quantity)
                        / (uom_line.factor * uom_template.factor), 1.0
                    ))                                                                      AS quantity,
                    SUM((
                        CASE WHEN move.type IN ('out_refund', 'in_invoice')
                        THEN -1 ELSE 1 END * line.price_subtotal
                    ))                                                                      AS price_subtotal,
                    SUM(line.price_subtotal / NULLIF(
                        (CASE WHEN move.type IN ('out_refund', 'in_invoice') THEN -1 ELSE 1 END * line.quantity)
                        / (uom_line.factor * uom_template.factor), 1.0
                    ))                                                                      AS price_average,
                    COALESCE(partner.country_id, commercial_partner.country_id)             AS country_id
                FROM account_move_line line
                    LEFT JOIN res_partner partner ON partner.id = line.partner_id
                    LEFT JOIN product_product product ON product.id = line.product_id
                    LEFT JOIN account_account account ON account.id = line.account_id
                    LEFT JOIN account_account_type user_type ON user_type.id = account.user_type_id
                    LEFT JOIN product_template template ON template.id = product.product_tmpl_id
                    LEFT JOIN uom_uom uom_line ON uom_line.id = line.product_uom_id
                    LEFT JOIN uom_uom uom_template ON uom_template.id = template.uom_id
                    INNER JOIN account_move move ON move.id = line.move_id
                    LEFT JOIN res_partner commercial_partner ON commercial_partner.id = move.commercial_partner_id
                WHERE move.type IN ('out_invoice', 'out_refund', 'in_invoice', 'in_refund')
                    AND line.account_id IS NOT NULL
                    AND user_type.type NOT IN ('receivable', 'payable')
                    AND line.tax_line_id IS NULL
                GROUP BY
                    line.id,
                    line.move_id,
                    line.product_id,
                    line.account_id,
                    line.analytic_account_id,
                    line.journal_id,
                    line.company_id,
                    line.currency_id,
                    line.partner_id,
                    move.name,
                    move.state,
                    move.type,
                    move.residual,
                    move.amount_total,
                    move.partner_id,
                    move.user_id,
                    move.fiscal_position_id,
                    move.invoice_payment_state,
                    move.invoice_date,
                    move.invoice_date_due,
                    move.invoice_payment_term_id,
                    move.invoice_partner_bank_id,
                    uom_template.name,
                    template.categ_id,
                    COALESCE(partner.country_id, commercial_partner.country_id)
            )
        ''' % self._table)


class ReportInvoiceWithPayment(models.AbstractModel):
    _name = 'report.account.report_invoice_with_payments'
    _description = 'Account report with payment lines'

    @api.model
    def _get_report_values(self, docids, data=None):
        report = self.env['ir.actions.report']._get_report_from_name('account.report_invoice_with_payments')
        return {
            'doc_ids': docids,
            'doc_model': report.model,
            'docs': self.env[report.model].browse(docids),
            'report_type': data.get('report_type') if data else '',
        }
