# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class PosConfig(models.Model):
    _inherit = 'pos.config'

    unit_id = fields.Many2one(
        'res.partner',
        string="Operating Unit",
        ondelete="restrict",
        default=lambda self: self.env.user._get_default_unit())

    @api.onchange('company_id')
    def _onchange_company_id(self):
        self.unit_id = self.company_id.partner_id
