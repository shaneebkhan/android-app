# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class Channel(models.Model):
    _inherit = 'slide.channel'

    nbr_certification = fields.Integer("Number of Certifications", compute='_compute_slides_statistics', store=True)
    certified_partners_count = fields.Integer('Number of certified partners', compute="_compute_certified_partners_count")

    def _compute_certified_partners_count(self):
        certified_partners_data = self.env['slide.slide.partner'].sudo().read_group([
            ('slide_id.slide_type', '=', 'certification'),
            ('completed', '=', True),
            ('channel_id', 'in', self.ids)
        ], ['channel_id'], ['channel_id'])
        data_map = {datum['channel_id'][0]: datum['channel_id_count'] for datum in certified_partners_data}
        for channel in self:
            channel.certified_partners_count = data_map.get(channel.id, 0.0)

    @api.multi
    def action_certified_partners(self):
        self.ensure_one()
        if self.certified_partners_count > 0:
            action = self.env.ref('website_slides.slide_channel_partner_action').read()[0]
            slide_certifications = self.slide_ids.filtered(lambda slide: slide.slide_type == 'certification')
            if slide_certifications:
                partners_who_completed_the_slide = self.env['slide.slide.partner'].sudo().search([('completed', '=', True), ('slide_id', 'in', slide_certifications.ids)])
                action['view_mode'] = 'tree'
                action['domain'] = [('id', 'in', partners_who_completed_the_slide.ids)]
                return action
        return
