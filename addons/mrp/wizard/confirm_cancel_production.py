# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class MrpConfirmCancelProductin(models.TransientModel):
    _name = 'mrp.confirm.cancel.production'
    _description = 'Confirm Cancel Wizard'

    production_ids = fields.Many2many('mrp.production', string='Manufacturing Order')

    def action_done(self):
        for production in self.production_ids:
            production._action_cancel()
