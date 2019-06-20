# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class SalePaymentLink(models.TransientModel):
    _inherit = "payment.link.wizard"
    _description = "Generate Sales Payment Link"

    @api.model
    def default_get(self, fields):
        res = super(SalePaymentLink, self).default_get(fields)
        if res['res_id'] and res['res_model'] == 'sale.order':
            record = self.env[res['res_model']].browse(res['res_id'])
            res.update({
                'description': record.name,
                'amount': record.amount_total - sum(record.invoice_ids.mapped('amount_total')),
                'currency_id': record.currency_id.id,
                'partner_id': record.partner_id.id
            })
        return res
