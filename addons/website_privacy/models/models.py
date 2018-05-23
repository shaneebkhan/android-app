# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


class Website(models.Model):
    _inherit = 'website'

    def _get_default_cookies_msg(self):
        return _("""This website makes use of cookies to enhance browsing experience and provide additional functionality.
                    <a href='/page/cookies' class='btn btn-primary'>Details</a>""")

    def _get_default_signup_msg(self):
        return _("""Using our services, you agree to our <a href="/page/legal" class="small">Terms of Use</a> and our <a href="/page/privacy" class="small">Privacy Policy</a>""")

    ga_anonymize_ip = fields.Boolean(string='G.A. anonymize IP addresses', default=0)
    cookies_bar = fields.Boolean(string='Add cookies bar', help='Use a simplified cookies bar on your website.', default=0)
    cookies_bar_msg = fields.Char(string='Cookies bar Message', default=_get_default_cookies_msg)
    cookies_bar_btn = fields.Char(string='Cookies bar Button', default='Allow cookies')

    signup_consent = fields.Char(string='Signup consent', default=_get_default_signup_msg)
    signup_force_checkbox = fields.Boolean(string='Signup consent', default=0)


class WebsitePrivacyConfig(models.TransientModel):
    _inherit = 'website.config.settings'

    ga_anonymize_ip = fields.Boolean(string='Google Analytics: anonymize IP addresses',
                                     help="""Anonymize the IP addresses of hits sent to Google Analytics
                                       (https://developers.google.com/analytics/devguides/collection/analyticsjs/ip-anonymization)""",
                                     related='website_id.ga_anonymize_ip')
    cookies_bar = fields.Boolean(string='Add cookies bar', help='Use a simplified cookies bar on your website.', related='website_id.cookies_bar')
    cookies_bar_msg = fields.Char(string='Cookies bar Message', related='website_id.cookies_bar_msg')
    cookies_bar_btn = fields.Char(string='Cookies bar Button', related='website_id.cookies_bar_btn')

    signup_consent = fields.Char(string='Signup consent', related='website_id.signup_consent')
    signup_force_checkbox = fields.Boolean(string='Signup checkbox consent', related='website_id.signup_force_checkbox')

    # @api.model
    # def create(self, vals):
    #     TwitterConfig = super(WebsiteTwitterConfig, self).create(vals)
    #     if vals.get('twitter_api_key') or vals.get('twitter_api_secret') or vals.get('twitter_screen_name'):
    #         TwitterConfig._check_twitter_authorization()
    #     return TwitterConfig

    # @api.multi
    # def write(self, vals):
    #     TwitterConfig = super(WebsiteTwitterConfig, self).write(vals)
    #     if vals.get('twitter_api_key') or vals.get('twitter_api_secret') or vals.get('twitter_screen_name'):
    #         self._check_twitter_authorization()
    #     return TwitterConfig
