# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models


class LandedCost(models.Model):
    _inherit = 'stock.landed.cost'

    unit_id = fields.Many2one('res.partner', string="Operating Unit", ondelete="restrict", default=lambda self: self.env.user._get_default_unit())

    @api.onchange('company_id')
    def _onchange_company_id(self):
        self.unit_id = self.company_id.partner_id

    @api.multi
    def button_validate(self):
        res = super(LandedCost, self).button_validate()
        for cost in self:
            cost.account_move_id.unit_id = cost.unit_id.id
        return res
