# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


class Website(models.Model):
    _inherit = 'website'

    def _get_default_cookies_msg(self):
        return _("""This website makes use of cookies to enhance browsing experience and provide additional functionality. <a href='/page/cookies' class='btn btn-primary'>Details</a>""")

    def _get_default_signup_msg(self):
        return _("""Using our services, you agree to our <a href="/page/legal" class="small">Terms of Use</a> and our <a href="/page/privacy" class="small">Privacy Policy</a>""")

    ga_anonymize_ip = fields.Boolean(string='G.A. anonymize IP addresses', default=0)
    cookies_bar = fields.Boolean(string='Add cookies bar', help='Use a simplified cookies bar on your website.', default=0)
    cookies_bar_msg = fields.Text(string='Cookies bar Message', default=_get_default_cookies_msg)
    cookies_bar_btn = fields.Char(string='Cookies bar Button', default='Allow cookies')

    signup_consent = fields.Text(string='Signup consent', default=_get_default_signup_msg)
    signup_force_checkbox = fields.Boolean(string='Signup consent', default=0)


class WebsitePrivacyConfig(models.TransientModel):
    _inherit = 'website.config.settings'

    ga_anonymize_ip = fields.Boolean(string='GA anonymized',
                                     help="""Anonymize the IP addresses of hits sent to Google Analytics
                                       (https://developers.google.com/analytics/devguides/collection/analyticsjs/ip-anonymization)""",
                                     related='website_id.ga_anonymize_ip')
    cookies_bar = fields.Boolean(string='Enable cookies bar', help='Use a simplified cookies bar on your website.', related='website_id.cookies_bar')
    cookies_bar_msg = fields.Text(string='Message', related='website_id.cookies_bar_msg')
    cookies_bar_btn = fields.Char(string='Button', related='website_id.cookies_bar_btn')

    signup_consent = fields.Text(string='Signup consent', related='website_id.signup_consent')
    signup_force_checkbox = fields.Boolean(string='Consent with checkbox', related='website_id.signup_force_checkbox')

    website_form_installed = fields.Boolean(string='website_form is installed', compute='is_website_form_installed')
    website_form_meta = fields.Boolean(string='Website form meta', help='Add meta data like ip in the record description', compute='get_website_form_meta_enabled', inverse='set_website_form_meta')

    website_sale_installed = fields.Boolean(string='website_form is installed', compute='is_website_sale_installed')
    website_sale_show_cgv = fields.Boolean(string='Ecommerce CGV', help='Add a checkbox to valid CGV before to confirm an order', compute='get_website_sale_force_cgv', inverse='set_website_sale_force_cgv')

    @api.one
    def is_website_form_installed(self):
        self.website_form_installed = 'website_form' in self.env

    @api.one
    def get_website_form_meta_enabled(self):
        self.website_form_meta = self.is_website_form_installed and self.website_id.website_form_enable_metadata

    @api.one
    def set_website_form_meta(self):
        if self.is_website_form_installed:
            self.website_id.website_form_enable_metadata = self.website_form_meta

    @api.one
    def is_website_sale_installed(self):
        self.is_website_sale_installed = 'website_sale' in self.env

    @api.one
    def get_website_sale_force_cgv(self):
        view = self.env.ref('website_sale.payment_sale_note', raise_if_not_found=False)
        self.website_sale_show_cgv = self.is_website_sale_installed and view and view.active

    @api.one
    def set_website_sale_force_cgv(self):
        if self.is_website_sale_installed:
            view = self.env.ref('website_sale.payment_sale_note', raise_if_not_found=False)
            view.active = self.website_sale_show_cgv
