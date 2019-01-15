# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, api, _
from odoo.exceptions import UserError


class IrSequence(models.Model):
    _inherit = 'ir.sequence'

    @api.multi
    def write(self, vals):
        """ Prevent archiving the sequences that are still used in opened sessions """
        if not vals.get('active', True):
            self._check_pos_sessions(_("You cannot archive a sequence that is used in a PoS session, close the session(s) first: \n"))
        return super(IrSequence, self).write(vals)

    @api.multi
    def unlink(self):
        """ Prevent removing the sequences that are still used in opened sessions """
        self._check_pos_sessions(_("You cannot remove a sequence that is used in a PoS session, close the session(s) first: \n"))

        return super(IrSequence, self).unlink()

    def _check_pos_sessions(self, error_msg):
        confs = self.env['pos.session'].search([
            ('state', '!=', 'closed'),
            ('config_id.sequence_id', 'in', self.ids),
        ]).mapped('config_id')
        if confs:
            # find the problematic sequence back from the one in self
            sequences = confs.mapped('sequence_id')
            sequences = sequences & self

            for sequence in sequences:
                configs = [config for config in confs
                        if sequence == config.sequence_id]
                error_msg += _("Sequence: %s - PoS Config(s): %s \n") % (sequence.name, ', '.join(config.name for config in configs))
            raise UserError(error_msg)
