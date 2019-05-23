#  -*- coding: utf-8 -*-
#  Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import models, fields, _, api


class StockZeroQuantityCount(models.TransientModel):

    _name = 'stock.zero.quantity.count'
    _description = 'Zero Quantity Count'

    is_done = fields.Boolean('Wizard was processed')
    pick_ids = fields.Many2many('stock.picking')
    location_id = fields.Many2one('stock.location')

    def get_zqc_inventory_wizard(self):
        view = self.env.ref('stock.view_stock_zero_quantity_count_inventory')
        wiz = self.env['stock.zero.quantity.count.inventory'].create({
            'src_wiz_id': self.id,
            'pick_ids': self.pick_ids,
            'location_id': self.location_id.id,
        })
        return {
            'name': _('Adjust inventory'),
            'type': 'ir.actions.act_window',
            'res_model': 'stock.zero.quantity.count.inventory',
            'res_id': wiz.id,
            'view_mode': 'form',
            'views': [(view.id, 'form')],
            'view_id': view.id,
            'target': 'new',
            'context': self.env.context,
        }

    def confirm_zqc(self):
        return self._update_remaining_zqc_wizards()

    def _update_remaining_zqc_wizards(self):
        wiz_ids = self.env.context.get('remaining_zqc_wizard_ids')
        if wiz_ids:
            wiz_ids = wiz_ids.remove(self.id)
        return self.pick_ids.with_context({'remaining_zqc_wizards': wiz_ids})._get_next_zqc_wizard()

class StockZeroQuantityCountInventory(models.TransientModel):
    _name = 'stock.zero.quantity.count.inventory'
    _description = 'Adjust inventory if theorical quantities are wrong'

    src_wiz_id = fields.Many2one('stock.zero.quantity.count')
    pick_ids = fields.Many2many('stock.picking')
    location_id = fields.Many2one('stock.location')
    inventory_line_ids = fields.Many2many('stock.inventory.line')

    def adjust_inventory(self):
        self.inventory_line_ids.write({'location_id': self.location_id.id})
        inventory = self.env['stock.inventory'].create({
            'name': 'Zero Quantity Count Adjustment',
            'location_id': self.src_wiz_id.location_id.id,
            'line_ids': [(6, 0, self.inventory_line_ids.ids)]
        })
        inventory.action_validate()
        return self._update_remaining_zqc_wizards()

    def cancel_inventory(self):
        return self._update_remaining_zqc_wizards()

    def _update_remaining_zqc_wizards(self):
        wiz_ids = self.env.context.get('remaining_zqc_wizard_ids')
        if wiz_ids:
            wiz_ids = wiz_ids.remove(self.src_wiz_id.id)
        return self.pick_ids.with_context({'remaining_zqc_wizards': wiz_ids})._get_next_zqc_wizard()
