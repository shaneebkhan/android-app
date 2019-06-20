# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models


class HrExpense(models.Model):
    _inherit = "hr.expense"

    unit_id = fields.Many2one('res.partner', string="Operating Unit", ondelete="restrict", states={'draft': [('readonly', False)], 'refused': [('readonly', False)]}, default=lambda self: self.env.user._get_default_unit())

    @api.onchange('company_id')
    def _onchange_company_id(self):
        self.unit_id = self.company_id.partner_id

    @api.multi
    def _prepare_move_values(self):
        self.ensure_one()
        move_values = super(HrExpense, self)._prepare_move_values()
        move_values['unit_id'] = self.unit_id.id
        return move_values

    @api.multi
    def prepare_payment_vals(self, move_line_dst):
        self.ensure_one()
        payment_vals = super(HrExpense, self).prepare_payment_vals(move_line_dst)
        payment_vals['unit_id'] = self.unit_id.id
        return payment_vals

class HrExpenseSheet(models.Model):
    _inherit = "hr.expense.sheet"

    unit_id = fields.Many2one('res.partner', string="Operating Unit", readonly=True, ondelete="restrict", states={'draft': [('readonly', False)]}, default=lambda self: self.env.user._get_default_unit())

    @api.onchange('company_id')
    def _onchange_company_id(self):
        self.unit_id = self.env.context.get('default_unit_id') or self.company_id.partner_id
