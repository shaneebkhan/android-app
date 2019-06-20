# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class Users(models.Model):
    _inherit = "res.users"

    def _get_default_unit(self):
        return self.env.user.unit_id or self.env.user.company_id.partner_id

    unit_id = fields.Many2one(
        'res.partner',
        string="Current Unit",
        ondelete="restrict",
        default=_get_default_unit)

    @api.onchange('company_id')
    def _onchange_company(self):
        self.unit_id = self.company_id.partner_id

    @api.multi
    def write(self, vals):
        # With multi-company setup, when user switches company from topbar,
        # the default unit should also change
        if 'company_id' in vals:
            company = self.env['res.company'].browse(vals['company_id'])
            self.unit_id = company.partner_id
        return super(Users, self).write(vals)
