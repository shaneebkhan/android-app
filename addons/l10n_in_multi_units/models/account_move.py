# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class AccountMove(models.Model):
    _inherit = "account.move"

    unit_id = fields.Many2one(
        'res.partner',
        string="Operating Unit",
        ondelete="restrict",
        default=lambda self: self.env.user._get_default_unit())

    @api.onchange('company_id')
    def _onchange_company_id(self):
        self.unit_id = self.company_id.partner_id

    @api.model
    def create(self, vals):
        if not vals.get('unit_id'):
            if vals.get('journal_id'):
                journal_id = self.env['account.journal'].browse(vals['journal_id'])
                vals['unit_id'] = journal_id.unit_id and journal_id.unit_id.id or journal_id.company_id.partner_id.id
            else:
                vals['unit_id'] = self.env.user.company_id.partner_id.id
        return super(AccountMove, self).create(vals)

    @api.multi
    def _post_validate(self):
        for move in self:
            if move.line_ids:
                if move.unit_id and move.journal_id.unit_id and move.unit_id != move.journal_id.unit_id:
                    raise UserError(_("Cannot create moves for different unit."))
        return super(AccountMove, self)._post_validate()

    @api.model
    def _query_get(self, domain=None):
        context = dict(self._context or {})
        if context.get('unit_id'):
            domain += [('move_id.unit_id', '=', context['unit_id'])]

        if context.get('unit_ids'):
            domain += [('move_id.unit_id', 'in', context['unit_ids'])]
        return super(AccountMove, self)._query_get(domain=domain)
