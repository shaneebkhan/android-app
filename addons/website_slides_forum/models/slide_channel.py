# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _
from odoo.addons.http_routing.models.ir_http import slug


class Channel(models.Model):
    _inherit = 'slide.channel'

    forum_id = fields.Many2one('forum.forum', 'Course Forum')
    active_posts_count = fields.Integer('Number of active forum posts', compute="_compute_active_posts_count")

    _sql_constraints = [
        ('forum_uniq', 'unique (forum_id)', "Only one forum per slide channel!"),
    ]

    def _compute_active_posts_count(self):
        self.active_posts_count = self.env['forum.post'].search_count([('forum_id', '=', self.forum_id.id), ('state', '=', 'active')])

    def action_redirect_to_forum(self):
        if self.forum_id:
            return {
                'name': _('Forum for this channel'),
                'type': 'ir.actions.act_url',
                'url': '/forum/%s' % (slug(self.forum_id)),
                'target': 'self',
            }
        return
