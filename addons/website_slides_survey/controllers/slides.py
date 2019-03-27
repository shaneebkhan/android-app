# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import werkzeug
import werkzeug.utils
import werkzeug.exceptions

from odoo import _
from odoo import http
from odoo.http import request

from odoo.addons.website_slides.controllers.main import WebsiteSlides
from collections import defaultdict


class WebsiteSlides(WebsiteSlides):

    @http.route(['/slides_survey/slide/get_certification_url'], type='http', auth='user', website=True)
    def slide_get_certification_url(self, slide_id, **kw):
        fetch_res = self._fetch_slide(slide_id)
        if fetch_res.get('error'):
            raise werkzeug.exceptions.NotFound()
        slide = fetch_res['slide']
        if slide.channel_id.is_member:
            slide.action_set_viewed()
        certification_url = slide._generate_certification_url().get(slide.id)
        if not certification_url:
            raise werkzeug.exceptions.NotFound()
        return werkzeug.utils.redirect(certification_url)

    # Utils
    # ---------------------------------------------------
    def _set_completed_slide(self, slide):
        if slide.slide_type == 'certification':
            raise werkzeug.exceptions.Forbidden(_("Certification slides are completed when the survey is succeeded."))
        return super(WebsiteSlides, self)._set_completed_slide(slide)

    def _get_valid_slide_post_values(self):
        result = super(WebsiteSlides, self)._get_valid_slide_post_values()
        result.append('survey_id')
        return result

    # Profile
    # ---------------------------------------------------
    def _prepare_user_slides_profile(self, user):
        values = super(WebsiteSlides, self)._prepare_user_slides_profile(user)
        values.update({
            'certificates': self._get_user_certificates(user)[user.id]
        })
        return values

    # All Users Page
    # ---------------------------------------------------
    def _prepare_all_users_values(self, users):
        result = super(WebsiteSlides, self)._prepare_all_users_values(users)
        certificates = self._get_user_certificates_count(users)
        for index, user in enumerate(users):
            result[index].update({
                'certification_count': certificates[user.partner_id.id] if certificates.get(user.partner_id.id) else None
            })
        return result

    def _get_user_certificates_count(self, users):
        partner_ids = [user.partner_id.id for user in users]
        domain = [
            ('partner_id', 'in', partner_ids),
            ('quizz_passed', '=', True),
            ('slide_partner_id.survey_quizz_passed', '=', True)
        ]
        certifications_data = request.env['survey.user_input'].sudo().read_group(
            domain,
            fields=['partner_id'],
            groupby=['partner_id']
        )
        users_certifications_count = {datum['partner_id'][0]: datum['partner_id_count'] for datum in certifications_data}
        return users_certifications_count

    def _get_user_certificates(self, users):
        partner_ids = [user.partner_id.id for user in users]
        domain = [
            ('partner_id', 'in', partner_ids),
            ('quizz_passed', '=', True),
            ('slide_partner_id.survey_quizz_passed', '=', True)
        ]
        certifications = request.env['survey.user_input'].sudo().search(domain)
        users_certifications = {
            user.id: [
                {
                    'survey_id': certification.survey_id,
                    'slide_id': certification.slide_id,
                    'quizz_score': certification.quizz_score
                } for certification in certifications if certification.partner_id == user.partner_id
            ] for user in users
        }
        return users_certifications
