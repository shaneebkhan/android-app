# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


class Website(models.Model):
    _inherit = 'website'

    def _get_default_cookies_msg(self):
        return _("""This website makes use of cookies to enhance browsing experience and provide additional functionality. <a href='/page/cookies'>Details</a>""")

    def _get_default_signup_msg(self):
        return _("""Using our services, you agree to our <a href="/page/legal">Terms of Use</a> and our <a href="/page/privacy">Privacy Policy</a>.""")

    ga_anonymize_ip = fields.Boolean(string='G.A. anonymize IP addresses', default=0)
    cookies_bar = fields.Boolean(string='Add cookies bar', help='Use a simplified cookies bar on your website.', default=0)
    cookies_bar_msg = fields.Text(string='Cookies bar Message', default=_get_default_cookies_msg)
    cookies_bar_btn = fields.Char(string='Cookies bar Button', default='Allow cookies')

    signup_consent = fields.Text(string='Signup consent', default=_get_default_signup_msg)
    signup_force_checkbox = fields.Boolean(string='Signup consent', default=0)


class WebsitePrivacyConfig(models.TransientModel):
    _inherit = 'website.config.settings'

    ga_anonymize_ip = fields.Boolean(string='GA anonymized', related='website_id.ga_anonymize_ip',
                                     help="https://developers.google.com/analytics/devguides/collection/analyticsjs/ip-anonymization")

    cookies_bar = fields.Boolean(string='Enable cookies bar', help='Use a simplified cookies bar on your website.', related='website_id.cookies_bar')
    cookies_bar_msg = fields.Text(string='- Message', related='website_id.cookies_bar_msg')
    cookies_bar_btn = fields.Char(string='- Button', related='website_id.cookies_bar_btn')

    signup_consent = fields.Text(string='Signup consent', related='website_id.signup_consent')
    signup_force_checkbox = fields.Boolean(string='Consent with checkbox', related='website_id.signup_force_checkbox')

    module_website_form = fields.Boolean('Website Form')
    website_form_meta = fields.Boolean(string='Website form meta', help='Add meta data like IP in the record description')

    module_website_sale = fields.Boolean("Website Sale")
    website_sale_show_cgv = fields.Boolean(string='Ecommerce CGV', help='Add a checkbox to valid CGV before to confirm an order')

    @api.one
    def get_website_form_meta_enabled(self, fields):
        website_form_installed = self.env.ref('base.module_website_form').state == 'installed'
        self.website_form_meta = website_form_installed and self.website_id.website_form_enable_metadata

    @api.one
    def set_website_form_meta(self):
        website_form_installed = self.env.ref('base.module_website_form').state == 'installed'
        if website_form_installed:
            self.website_id.website_form_enable_metadata = self.website_form_meta

    @api.model
    def get_default_website_sale_show_cgv(self, fields):
        website_sale_installed = self.env.ref('base.module_website_sale').state == 'installed'
        view = self.env.ref('website_sale.payment_sale_note', raise_if_not_found=False)
        return {
            'website_sale_show_cgv': view and website_sale_installed and view.active
        }

    def set_website_sale_show_cgv(self):
        website_sale_installed = self.env.ref('base.module_website_sale').state == 'installed'
        view = self.env.ref('website_sale.payment_sale_note', raise_if_not_found=False)
        if view and website_sale_installed:
            view.active = self.website_sale_show_cgv
