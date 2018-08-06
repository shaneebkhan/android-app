# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import logging
import werkzeug

from odoo import http, _
from odoo.exceptions import AccessError, UserError
from odoo.http import request
from odoo.addons.http_routing.models.ir_http import slug
from odoo.addons.website.models.ir_http import sitemap_qs2dom

_logger = logging.getLogger(__name__)


class WebsiteThemeInstall(http.Controller):

    @http.route(['/go_to_theme'], type='http', auth='user', website=True)
    def go_to_theme(self, *args, **post):
        _logger.warning( "%s forced" % request.website_id)
        request.website_id._force()
        request.session['installing_theme_on'] = request.website.id  # todo remove
        return request.redirect('/web#action=website_theme_install.theme_install_kanban_action')
