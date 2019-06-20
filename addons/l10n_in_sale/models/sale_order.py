# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class SaleOrder(models.Model):
    _inherit = "sale.order"

    l10n_in_reseller_partner_id = fields.Many2one('res.partner',
        string='Reseller', domain=[('vat', '!=', False)], states={'posted': [('readonly', True)]})
    unit_id = fields.Many2one(
        'res.partner',
        string="Operating Unit",
        ondelete="restrict",
        default=lambda self: self.env.user._get_default_unit())

    @api.onchange('company_id')
    def _onchange_company_id(self):
        self.unit_id = self.company_id.partner_id

    @api.multi
    def _prepare_invoice(self):
        invoice_vals = super(SaleOrder, self)._prepare_invoice()
        invoice_vals['unit_id'] = self.unit_id.id
        return invoice_vals

    @api.multi
    def _prepare_invoice(self):
        invoice_vals = super(SaleOrder, self)._prepare_invoice()
        invoice_vals['l10n_in_reseller_partner_id'] = self.l10n_in_reseller_partner_id.id
        return invoice_vals
