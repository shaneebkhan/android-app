# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class Expense(models.Model):
    _inherit = 'hr.expense'

    project_id = fields.Many2one('project.project', string='Project', domain=[('analytic_account_id', '!=', False)], states={'draft': [('readonly', False)], 'reported': [('readonly', False)]})

    @api.onchange('project_id')
    def _onchange_project_id(self):
        if self.project_id:
            self.analytic_account_id = self.project_id.analytic_account_id
