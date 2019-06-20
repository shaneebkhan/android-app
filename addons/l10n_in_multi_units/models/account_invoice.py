# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class AccountInvoice(models.Model):
    _inherit = "account.invoice"

    unit_id = fields.Many2one('res.partner', string="Operating Unit",
        ondelete="restrict", readonly=True, states={'draft': [('readonly', False)]},
        default=lambda self: self.env.user._get_default_unit())

    @api.onchange('partner_id', 'company_id')
    def _onchange_partner_id(self):
        res = super(AccountInvoice, self)._onchange_partner_id()
        self.unit_id = self.company_id.partner_id
        return res

    @api.multi
    def action_move_create(self):
        # TODO: CHECK
        super(AccountInvoice, self).action_move_create()
        for inv in self:
            inv.move_id.write({'unit_id': inv.unit_id.id})
        return True
