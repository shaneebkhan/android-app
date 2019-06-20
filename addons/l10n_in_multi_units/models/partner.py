# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResPartner(models.Model):
    _inherit = "res.partner"

    company_unit_id = fields.Many2one('res.company', string="Company of Current Unit", ondelete='cascade')
