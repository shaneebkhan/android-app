# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from odoo import fields, models, api
from odoo.exceptions import UserError
from odoo.tools.translate import _
_logger = logging.getLogger(__name__)


class Attachment(models.Model):

    _inherit = "ir.attachment"

    # related for backward compatibility with saas-6
    website_url = fields.Char(string="Website URL", related='local_url', deprecated=True)
    key = fields.Char(help='Technical field used to resolve multiple attachments in a multi-website environment.')
    website_id = fields.Many2one('website')

    @api.model
    def create(self, vals):
        website = self.env['website'].get_current_website(fallback=False)
        if website and 'website_id' not in vals and 'not_force_website_id' not in self.env.context:
            vals['website_id'] = website.id
        return super(Attachment, self).create(vals)

    @api.model
    def get_serving_groups(self):
        return super(Attachment, self).get_serving_groups() + ['website.group_website_designer']

    @api.multi
    def _get_most_specific(self):
        if len(set(self.mapped('key'))) > 1:
            # to imp: with groupby key
            raise UserError(_('Cannot have most_specific for several keys'))
        website_id = self.env.context.get('website_id')
        print(self.mapped(lambda x: (website_id, x.key, x.website_id)))
        rec_sorted = self.filtered(lambda v: not v.website_id or v.website_id.id == website_id).sorted(key=lambda p: not p.website_id)
        print(rec_sorted.mapped(lambda x: (x.website_id, x.key)))

        return rec_sorted and rec_sorted[0] or self.browse()
