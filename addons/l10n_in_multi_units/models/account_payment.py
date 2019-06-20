# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class AccountPayment(models.Model):
    _inherit = "account.payment"

    unit_id = fields.Many2one('res.partner', string="Operating Unit", ondelete="restrict",
        default=lambda self: self.env.user._get_default_unit())
    show_unit_id_field = fields.Boolean(compute='_compute_show_unit_id_field')

    @api.depends('invoice_ids')
    def _compute_show_unit_id_field(self):
        for record in self:
            if len(record.invoice_ids.mapped('unit_id')) > 1:
                record.show_unit_id_field = True

    @api.onchange('journal_id')
    def _onchange_journal(self):
        self.unit_id = self.journal_id.company_id.partner_id
        return super(AccountPayment, self)._onchange_journal()

    def _get_move_vals(self, journal=None):
        move_vals = super(AccountPayment, self)._get_move_vals(journal)
        move_vals['unit_id'] = self.unit_id.id
        return move_vals
