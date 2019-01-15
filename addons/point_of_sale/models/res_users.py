# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, models, _
from odoo.exceptions import UserError


class ResUsers(models.Model):
    _inherit = 'res.users'

    @api.multi
    def unlink(self):
        running_sessions = self.env['pos.session'].search([
            ('user_id', 'in', self.ids),
            ('state', '!=', 'closed')
        ])
        if running_sessions:
            error_msg = _("You cannot remove users that are using a PoS session, close the session(s) first: \n")
            for session in running_sessions:
                error_msg += _("User: %s - PoS Config: %s \n") % (session.user_id.name, session.config_id.name)

            raise UserError(error_msg)
        return super(ResUsers, self).unlink()
