# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    group_multi_operating_unit = fields.Boolean(string="Multi Operating Unit", implied_group='l10n_in_multi_units.group_multi_operating_unit')

    @api.multi
    def action_open_company(self):
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'res.company',
            'view_type': 'form',
            'view_mode': 'form',
            'res_id': self.company_id.id,
        }
