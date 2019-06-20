
# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class PurchaseOrder(models.Model):
    _inherit = "purchase.order"

    READONLY_STATES = {
            'purchase': [('readonly', True)],
            'done': [('readonly', True)],
            'cancel': [('readonly', True)],
    }

    unit_id = fields.Many2one('res.partner', string="Operating Unit", ondelete="restrict", states=READONLY_STATES, default=lambda self: self.env.user._get_default_unit())

    @api.onchange('partner_id', 'company_id')
    def onchange_partner_id(self):
        self.unit_id = self.company_id.partner_id
        return super(PurchaseOrder, self).onchange_partner_id()

    @api.multi
    def action_view_invoice(self):
        result = super(PurchaseOrder, self).action_view_invoice()
        result['context']['default_unit_id'] = self.unit_id.id
        return result
