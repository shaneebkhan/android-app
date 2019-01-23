# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import UserError
from odoo.tools.translate import _


class AccountMoveReversal(models.TransientModel):
    """
    Account move reversal wizard, it cancel an account move by reversing it.
    """
    _name = 'account.move.reversal'
    _description = 'Account Move Reversal'

    date = fields.Date(string='Reversal date', default=fields.Date.context_today, required=True)
    invoice_date = fields.Date(string='Credit Note Date', default=fields.Date.context_today, required=True)
    reason = fields.Char(string='Reason', required=True)
    refund_method = fields.Selection(selection=[
            ('refund', 'Create a draft credit note'),
            ('cancel', 'Cancel: create credit note and reconcile'),
            ('modify', 'Modify: create credit note, reconcile and create a new draft invoice')
        ], default='refund', string='Credit Method', required=True,
        help='Choose how you want to credit this invoice. You cannot Modify and Cancel if the invoice is already reconciled')
    journal_id = fields.Many2one('account.journal', string='Use Specific Journal', help='If empty, uses the journal of the journal entry to be reversed.')

    @api.model
    def default_get(self, default_fields):
        # OVERRIDE
        # Retrieve the value of the extended_state field.
        res = super(AccountMoveReversal, self).default_get(default_fields)

        moves = self.env['account.move'].browse(self._context['active_ids'])

        # Check for inconsistent move types.
        if any(move.state != 'posted' or move.type in ('out_refund', 'in_refund') for move in moves):
            raise UserError(_('Only posted journal entries being not already a refund can be reversed.'))

        return res

    @api.multi
    def reverse_moves(self):
        moves = self.env['account.move'].browse(self._context['active_ids'])

        # Create default values.
        default_values_list = []
        for move in moves:
            default_values_list.append({
                'ref': _('Reversal of: %s') % move.name,
                'date': self.date or move.date,
                'journal_id': self.journal_id and self.journal_id.id or move.journal_id.id,
            })

        # Handle reverse method.
        if self.refund_method == 'cancel':
            new_moves = moves._reverse_moves(default_values_list, cancel=True)
        elif self.refund_method == 'modify':
            new_moves = moves._reverse_moves(default_values_list, cancel=True)
            new_moves = moves.with_context(include_business_fields=True).copy()
        elif self.refund_method == 'refund':
            new_moves = moves._reverse_moves(default_values_list)
        else:
            return

        # Create action.
        action = {
            'name': _('Reverse Moves'),
            'type': 'ir.actions.act_window',
            'res_model': 'account.move',
        }
        if len(new_moves) == 1:
            action.update({
                'view_mode': 'form',
                'res_id': new_moves.id,
            })
        else:
            action.update({
                'view_mode': 'tree',
                'domain': [('id', 'in', new_moves.ids)],
            })
        return action

