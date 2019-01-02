# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class SaleOrderCancel(models.TransientModel):
    _name = 'sale.order.cancel'
    _description = "Sales Order Cancel"

    sale_id = fields.Many2one('sale.order', string='Sale Order')

    @api.multi
    def action_cancel(self):
        self.ensure_one()
        self.sale_id.picking_ids.mapped('move_lines').write({'is_sale_cancel': True})
        self.sale_id.picking_ids.filtered(lambda m: m.state != 'done').action_cancel()
        self.sale_id.write({'state': 'cancel'})
        return True
