# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.tests.common import Form
from odoo.exceptions import UserError


class AccrualAccountingWizard(models.TransientModel):
    _name = 'account.accrual.accounting.wizard'
    _description = 'Create accrual entry.'

    date = fields.Date(required=True)
    accrual_account = fields.Many2one('account.account', required=True)

    def amend_entries(self):
        move_data = []
        active_move_line_ids = self.env['account.move.line'].browse(self.env.context['active_ids'])
        for aml in active_move_line_ids:
            move_data.append({
                'date': self.date,
                'line_ids': [
                    (0, 0, {
                        'debit': aml.credit,
                        'credit': aml.debit,
                        'account_id': aml.account_id.id,
                    }),
                    (0, 0, {
                        'debit': aml.debit,
                        'credit': aml.credit,
                        'account_id': self.accrual_account.id,
                    }),
                ],
            })
        self.env['account.move'].create(move_data)
        active_move_line_ids.write({'account_id': self.accrual_account.id})
