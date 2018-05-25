# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.tools.translate import html_translate


class Website(models.Model):
    _inherit = 'website'

    def _get_default_cookies_msg(self):
        return _("""This website makes use of cookies to enhance browsing experience and provide additional functionality. <a href='/page/cookies'>Details</a>""")

    def _get_default_signup_msg(self):
        return _("""Using our services, you agree to our <a href="/page/legal">Terms of Use</a> and our <a href="/page/privacy">Privacy Policy</a>.""")

    ga_anonymize_ip = fields.Boolean(string='G.A. anonymize IP addresses', default=0)
    cookies_bar = fields.Boolean(string='Add cookies bar', help='Use a simplified cookies bar on your website.', default=0)
    cookies_bar_msg = fields.Html(string='Cookies bar Message', default=_get_default_cookies_msg, translate=html_translate)
    cookies_bar_btn = fields.Char(string='Cookies bar Button', default='Allow cookies', translate=True)

    signup_consent = fields.Boolean(string='Signup consent', default=0)
    signup_consent_msg = fields.Html(string='Signup consent message', default=_get_default_signup_msg, translate=html_translate)
    signup_force_checkbox = fields.Boolean(string='Signup consent with checkbox', default=0)


class WebsitePrivacyConfig(models.TransientModel):
    _inherit = 'website.config.settings'

    ga_anonymize_ip = fields.Boolean(string='GA anonymized', related='website_id.ga_anonymize_ip',
                                     help="https://developers.google.com/analytics/devguides/collection/analyticsjs/ip-anonymization")

    cookies_bar = fields.Boolean(string='Enable cookies bar', help='Use a simplified cookies bar on your website.', related='website_id.cookies_bar')
    cookies_bar_msg = fields.Html(string='- Message', related='website_id.cookies_bar_msg')
    cookies_bar_btn = fields.Char(string='- Button', related='website_id.cookies_bar_btn')

    module_auth_signup = fields.Boolean('Auth Signup')
    signup_consent = fields.Boolean(string='Signup consent')
    # signup_consent = fields.Boolean(string='Signup consent', related='website_id.signup_consent')
    signup_consent_msg = fields.Html(string='Signup consent message', related='website_id.signup_consent_msg')
    signup_force_checkbox = fields.Boolean(string='Signup consent with checkbox', related='website_id.signup_force_checkbox')

    module_website_form = fields.Boolean('Website Form')
    website_form_meta = fields.Boolean(string='Website form meta', help='Add meta data like IP in the record description')

    module_website_sale = fields.Boolean("Website Sale")
    website_sale_show_cgv = fields.Boolean(string='Ecommerce CGV', help='Add a checkbox to valid CGV before to confirm an order')

    @api.model
    def get_default_website_form_meta(self, fields):
        website_form_installed = self.env.ref('base.module_website_form').state == 'installed'
        website_id = self.env['website'].get_current_website()
        return {
            'website_form_meta': website_form_installed and website_id.website_form_enable_metadata,
        }

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

    @api.model
    def get_default_signup_consent(self, fields):
        auth_signup_installed = self.env.ref('base.module_auth_signup').state == 'installed'
        # signup_enabled = self.env['ir.config_parameter'].get_param('auth_signup.allow_uninvited', 'False') == 'True'
        website_id = self.env['website'].get_current_website()
        return {
            # 'signup_consent': auth_signup_installed and signup_enabled and website_id.signup_consent,
            'signup_consent': auth_signup_installed and website_id.signup_consent,
        }

    @api.one
    def set_signup_consent(self):
        website_id = self.env['website'].get_current_website()
        website_id.signup_consent = self.signup_consent
        auth_signup_installed = self.env.ref('base.module_auth_signup').state == 'installed'
        if auth_signup_installed:
            view_consent = self.env['ir.ui.view'].search([('key', '=', 'website_privacy.signup_consent')]) # TODO: ajouter website = website.id or False
            if self.signup_consent and not view_consent:
                    view_arch = """
                    <data inherit_id="auth_signup.fields" name="Privacy Signup Consent">
                        <xpath expr="//div[contains(@class, 'field-confirm_password')]" position="after">
                            <div class="privacy-consent mb16">
                                <input type="checkbox" id="privacy-content-chkbx" class="privacy-content-chkbx pull-left mr8" required="required" t-if="website.signup_force_checkbox"/>
                                <label for="privacy-content-chkbx" t-field="website.signup_consent_msg"/>
                            </div>
                        </xpath>
                    </data>
                    """
                    view_consent = self.env['ir.ui.view'].create({
                        'name': 'Privacy Signup Consent',
                        'type': 'qweb',
                        'arch': view_arch,
                        'inherit_id': self.env.ref('auth_signup.fields').id,
                        'key': 'website_privacy.signup_consent',
                    })
                    self.env['ir.model.data'].create({
                        'module': 'website_privacy',
                        'name': 'signup_consent',
                        'res_id': view_consent.id,
                        'model': 'ir.ui.view',
                    })
            view_consent.active = self.signup_consent
