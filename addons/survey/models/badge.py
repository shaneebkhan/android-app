# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class GamificationBadge(models.Model):
    _inherit = 'gamification.badge'

    survey_ids = fields.One2many('survey.survey', 'certification_badge_id', 'Survey Ids')
    survey_id = fields.Many2one('survey.survey', 'Survey', compute='_compute_survey_id', store=True)

    @api.depends('survey_ids')
    def _compute_survey_id(self):
        for badge in self:
            if badge.survey_ids:
                badge.survey_id = badge.survey_ids[0]
            else:
                badge.survey_id = None
