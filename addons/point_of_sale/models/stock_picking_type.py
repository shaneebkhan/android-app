# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models, api, _
from odoo.exceptions import UserError


class StockPickingType(models.Model):
    _inherit = 'stock.picking.type'

    @api.multi
    def unlink(self):
        confs = self.env['pos.session'].search([
            ('state', '!=', 'closed'),
            ('config_id.picking_type_id', 'in', self.ids)
        ]).mapped('config_id')
        if confs:
            used_pickings = confs.mapped('picking_type_id')

            error_msg = _("You cannot remove a picking type that is used in a PoS session, close the session(s) first: \n")
            for picking_type in used_pickings:
                configs = [config for config in confs if config.picking_type_id == picking_type]

                error_msg += _("Picking Type: %s - PoS Config(s): %s \n") % (picking_type.name, ', '.join(config.name for config in configs))

            raise UserError(error_msg)
        return super(StockPickingType, self).unlink()
