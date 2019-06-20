# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class AccountBankStatement(models.Model):
    _inherit = "account.bank.statement"

    unit_id = fields.Many2one('res.partner', string="Operating Unit", ondelete="restrict",
        default=lambda self: self.env.user._get_default_unit())

    @api.onchange('company_id')
    def _onchange_company_id(self):
        self.unit_id = self.company_id.partner_id


class AccountBankStatementLine(models.Model):
    _inherit = "account.bank.statement.line"

    def _prepare_reconciliation_move(self, move_ref):
        data = super(AccountBankStatementLine, self)._prepare_reconciliation_move(move_ref)
        data['unit_id'] = self.statement_id.unit_id.id
        return data
