# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    reseller_id = fields.Many2one('res.partner', 'Reseller', help='This field is used to track the reseller in order to generate commisions')
    commission_rate = fields.Float('Commission Rate', default=0,
        help="Overrides all the commissions for this order, if set to 0 the commission_rate will be used")

    @api.multi
    def _prepare_invoice(self):
        res = super(SaleOrder, self)._prepare_invoice()
        res.update({
            'reseller_id': self.reseller_id.id,
            'commission_rate': self.commission_rate,
        })
        return res
