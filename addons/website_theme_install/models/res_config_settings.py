# coding: utf-8
from odoo import models
from odoo.http import request

import logging
_logger = logging.getLogger(__name__)


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    def install_theme_on_current_website(self):
        _logger.warning( "%s forced" % self.website_id.id)
        self.website_id._force()
        request.session['installing_theme_on'] = self.website_id.id  # todo remove
        return {
            'type': 'ir.actions.act_url',
            'url': '/web#action=website_theme_install.theme_install_kanban_action',
            'target': 'self',
        }
