# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from odoo import api, fields, models
from odoo.exceptions import UserError
from odoo.tools.translate import _


_logger = logging.getLogger(__name__)


class Attachment(models.Model):

    _inherit = "ir.attachment"

    # related for backward compatibility with saas-6
    website_url = fields.Char(string="Website URL", related='local_url', deprecated=True)
    key = fields.Char(help='Technical field used to resolve multiple attachments in a multi-website environment.')
    website_id = fields.Many2one('website')

    @api.multi
    def unlink(self):

        # ADD WEBSITE_ID  TODO
        self |= self.search([('key', 'in', self.filtered('key').mapped('key'))])
        return super(Attachment, self).unlink()

    @api.multi
    def write(self, vals):
        current_website = self.env['website'].get_current_website().id
        if 'website_id' not in vals and self._context.get('website_id'):
            print(">> attachment write website FORCED %s" % current_website)
            vals['website_id'] = current_website

        super(Attachment, self).write(vals)
        return True

    @api.model
    def create(self, vals):
        current_website = self.env['website'].get_current_website().id
        if 'website_id' not in vals and self._context.get('website_id'):
            print(">> attachment create website FORCED %s" % current_website)
            vals['website_id'] = current_website

        return super(Attachment, self).create(vals)
