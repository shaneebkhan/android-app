# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# Copyright (C) 2004-2008 PC Solutions (<http://pcsol.be>). All Rights Reserved
from odoo import fields, models, api, _


class AccountBankStatement(models.Model):
    _inherit = 'account.bank.statement'

    pos_session_id = fields.Many2one('pos.session', string="Session", copy=False)
    account_id = fields.Many2one('account.account', related='journal_id.default_debit_account_id', readonly=True)


class AccountBankStatementLine(models.Model):
    _inherit = 'account.bank.statement.line'

    pos_statement_id = fields.Many2one('pos.order', string="POS statement", ondelete='cascade')


class AccountBankStmtCashWizard(models.Model):
    _inherit = 'account.bank.statement.cashbox'

    def confirm_cash_box(self):
        current_session = self.env['pos.session'].browse(self.env.context['pos_session_id'])
        if current_session.state == 'new_session':
            current_session.write({'state': 'opening_control'})

    @api.multi
    def set_default_cashbox(self):
        current_session = self.env['pos.session'].browse(self.env.context['pos_session_id'])
        lines = current_session.config_id.default_cashbox_id.cashbox_lines_ids
        context = dict(self._context)
        self['cashbox_lines_ids'] = False
        self['cashbox_lines_ids'] = [[0, 0, {'coin_value': line.coin_value, 'number': line.number, 'subtotal': line.subtotal}] for line in lines]

        return {
            'name': _('Cash Control'),
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'account.bank.statement.cashbox',
            'view_id': self.env.ref('point_of_sale.view_account_bnk_stmt_cashbox_close_modal').id,
            'type': 'ir.actions.act_window',
            'context': context,
            'target': 'new', 
            'res_id': self.id,
        }
