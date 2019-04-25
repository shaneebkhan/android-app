# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from werkzeug.exceptions import Forbidden

from odoo import api, fields, models
from odoo.tools.translate import html_translate


class KarmaError(Forbidden):
    """ Karma-related error, used for forum and posts. """
    pass


class KarmaRank(models.Model):
    _name = 'gamification.karma.rank'
    _description = 'Rank based on karma'
    _order = 'karma_min'

    name = fields.Text(string='Rank Name', translate=True, required=True)
    description = fields.Html(string='Description', translate=html_translate, sanitize_attributes=False,)
    description_motivational = fields.Html(
        string='Motivational', translate=html_translate, sanitize_attributes=False,
        help="Motivational phrase to reach this rank")
    karma_min = fields.Integer(string='Required Karma', help='Minimum karma needed to reach this rank')
    user_ids = fields.One2many('res.users', 'rank_id', string='Users', help="Users having this rank")
    image = fields.Image('Rank Icon', size='big', avoid_if_small=True)
    image_medium = fields.Image(
        "Medium-sized rank icon", related='image', size='medium',
        help="Medium-sized icon of the rank. It is automatically "
             "resized as a 128x128px image, with aspect ratio preserved. "
             "Use this field in form views or some kanban views.")
    image_small = fields.Image(
        "Small-sized rank icon", related='image', size='small',
        help="Small-sized icon of the rank. It is automatically "
             "resized as a 64x64px image, with aspect ratio preserved. "
             "Use this field anywhere a small image is required.")

    @api.model_create_multi
    def create(self, values_list):
        res = super(KarmaRank, self).create(values_list)
        users = self.env['res.users'].sudo().search([('karma', '>', 0)])
        users._recompute_rank()
        return res

    @api.multi
    def write(self, vals):
        res = super(KarmaRank, self).write(vals)
        users = self.env['res.users'].sudo().search([('karma', '>', 0)])
        users._recompute_rank()
        return res
