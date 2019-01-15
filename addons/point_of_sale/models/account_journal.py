# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# Copyright (C) 2004-2008 PC Solutions (<http://pcsol.be>). All Rights Reserved
from odoo import fields, models, api, _
from odoo.exceptions import UserError


class AccountJournal(models.Model):
    _inherit = 'account.journal'

    journal_user = fields.Boolean('Use in Point of Sale',
        help="Check this box if this journal define a payment method that can be used in a point of sale.")
    amount_authorized_diff = fields.Float('Amount Authorized Difference',
        help="This field depicts the maximum difference allowed between the ending balance and the theoretical cash when "
             "closing a session, for non-POS managers. If this maximum is reached, the user will have an error message at "
             "the closing of his session saying that he needs to contact his manager.")

    @api.model
    def _search(self, args, offset=0, limit=None, order=None, count=False, access_rights_uid=None):
        session_id = self.env.context.get('pos_session_id', False)
        if session_id:
            session = self.env['pos.session'].browse(session_id)
            if session:
                args += [('id', 'in', session.config_id.journal_ids.ids)]
        return super(AccountJournal, self)._search(args=args, offset=offset, limit=limit, order=order, count=count, access_rights_uid=access_rights_uid)

    @api.onchange('type')
    def onchange_type(self):
        if self.type not in ['bank', 'cash']:
            self.journal_user = False

    @api.multi
    def write(self, vals):
        """ Prevent to archive journals that are still used in an opened session """
        if not vals.get('active', True):
            self._check_pos_sessions(_("You cannot archive a journal that is used in a PoS session, close the session(s) first: \n"))
        return super(AccountJournal, self).write(vals)

    @api.multi
    def unlink(self):
        """ Prevent removing the journals that are still used in opened sessions """
        self._check_pos_sessions(_("You cannot remove a journal that is used in a PoS session, close the session(s) first: \n"))

        return super(AccountJournal, self).unlink()

    def _check_pos_sessions(self, error_msg):
        confs = self.env['pos.session'].search([
            ('state', '!=', 'closed'),'|', '|',
            ('config_id.journal_id', 'in', self.ids),
            ('config_id.journal_ids', 'in', self.ids),
            ('config_id.invoice_journal_id', 'in', self.ids),
        ]).mapped('config_id')
        if confs:
            # find the problematic journal back from the one in self
            journals = confs.mapped('journal_id')
            journals |= confs.mapped('journal_ids')
            journals |= confs.mapped('invoice_journal_id')
            journals = journals & self

            for journal in journals:
                configs = [config for config in confs
                        if journal in [config.journal_id, config.invoice_journal_id] or journal in config.journal_ids]

                error_msg += _("Journal: %s - PoS Config(s): %s \n") % (journal.name, ', '.join(config.name for config in configs))

            raise UserError(error_msg)
