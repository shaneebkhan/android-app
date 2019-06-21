# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models, api, _
from odoo.exceptions import UserError
from odoo.addons.iap import jsonrpc,InsufficientCreditError

DEFAULT_ENDPOINT = 'https://iap-services.odoo.com'

class Lead(models.Model):
    _inherit = 'crm.lead'

    enriched_lead = fields.Boolean(string='Lead enriched based on email', default=False)

    @api.multi
    def lead_enrich_mail(self):
        domains = {}
        for record in self:
            if record.probability == 0:
                continue
            email_domain = record.partner_address_email or record.email_from
            if email_domain:
                domains[record.id] = email_domain.split('@')[1]
            else:
                record.message_post_with_view('crm_iap_lead_enrich.lead_enrich_message_no_mail', subtype_id=self.env.ref('mail.mt_note').id)        
        if domains:
            try:
                response_clearbit = self._make_request(domains)
                self._enrich_leads_from_response(response_clearbit)
                self.env['ir.config_parameter'].sudo().set_param('lead_enrich.already_notified', False)
            except InsufficientCreditError:
                data = {
                    'message_title': _("Lead enriched based on email address"),
                    'url' : self.env['iap.account'].get_credits_url('reveal'),
                }
                self.notify_no_more_credit('reveal', self._name, 'lead_enrich.already_notified')
                self.message_post_with_view('crm_iap_lead_enrich.lead_enrich_message_no_credit', values=data, subtype_id=self.env.ref('mail.mt_note').id)
    
    @api.model
    def enrich_with_cron(self):
        leads = self.search([('enriched_lead', '=', False),('reveal_id', '=', False),('probability','!=','0'),('probability','!=','100')])
        leads.lead_enrich_mail()

    @api.model
    def _make_request(self, domains):
        """This method will query the endpoint to get the data for the asked (lead.id, domain) pairs"""
        reveal_account = self.env['iap.account'].get('reveal')
        dbuuid = self.env['ir.config_parameter'].sudo().get_param('database.uuid')
        endpoint = self.env['ir.config_parameter'].sudo().get_param('reveal.endpoint', DEFAULT_ENDPOINT) + '/iap/clearbit/1/lead_enrichment_email'
        params = {
            'account_token': reveal_account.account_token,
            'dbuuid': dbuuid,
            'domains': domains,
        }
        return jsonrpc(endpoint, params=params, timeout=300)

    @api.model
    def _create_message_data(self, company_data):
        log_data = {
            'message_title': _("Lead enriched based on email address"),
            'twitter': company_data['twitter'],
            'description': company_data['description'],
            'logo': company_data['logo'],
            'name': company_data['name'],
            'phone_numbers': company_data['phone_numbers'],
            'facebook': company_data['facebook'],
            'linkedin': company_data['linkedin'],
            'crunchbase': company_data['crunchbase'],
            'tech': [t.replace('_', ' ').title() for t in company_data['tech']],
        }
        timezone = company_data['timezone']
        if timezone:
            log_data.update({
                'timezone': timezone.replace('_', ' ').title(),
                'timezone_url': company_data['timezone_url'],
            })
        return log_data

    @api.model
    def _send_message(self, company_data=False):
        if company_data:
            messages_to_post = self._create_message_data(company_data)
            self.message_post_with_view('crm_iap_lead.lead_message_template', values=messages_to_post, subtype_id=self.env.ref('mail.mt_note').id)
        else:
            self.message_post_with_view('crm_iap_lead_enrich.lead_enrich_message_not_found', subtype_id=self.env.ref('mail.mt_note').id)
    @api.model
    def _enrich_leads_from_response(self, data_clearbit):
        """ This method will get the response from the service and enrich the lead accordingly """
        for lead_id, data in data_clearbit.items():
            record = self.browse(int(lead_id))
            if record.exists():
                if data:
                    street = False
                    zip_code = False
                    city = False
                    country_id = False
                    state_id = False

                    if not(record.street or record.street2 or record.zip or record.city or record.state_id or record.country_id):
                        street = data["location"]
                        zip_code = data["postal_code"]
                        city = data["city"]
                        country = record.env['res.country'].search([('code', '=', data["country_code"])])
                        if country:
                            country_id = country.id
                            state = record.env['res.country.state'].search([('code', '=', data["state_code"]),('country_id', '=', country_id)])
                            if state:
                                state_id = state.id
                    record.write({
                        'description': record.description or data['description'],
                        'partner_name': record.partner_name or data['name'],
                        'reveal_id': record.reveal_id or data['clearbit_id'],
                        'website': record.website or ('https://www.%s' % data['domain'] if data['domain'] else False),
                        'phone': record.phone or (data["phone_numbers"][0] if (len(data["phone_numbers"])>0) else False),
                        'mobile': record.mobile or (data["phone_numbers"][1] if (len(data["phone_numbers"])>1) else False),
                        'street': record.street or street,
                        'city': record.city or city,
                        'zip': record.zip or zip_code,
                        'country_id': record.country_id.id or country_id,
                        'state_id': record.state_id.id or state_id,
                        'enriched_lead': True,
                    })
                    record._send_message(data)
                else:
                    record._send_message()

    def notify_no_more_credit(self, service_name, model_name, notification_parameter):
        """
        Notify when user has no credits anymore
        In order to avoid to spam people each hour, an ir.config_parameter is set
        """
        already_notified = self.env['ir.config_parameter'].sudo().get_param(notification_parameter, False)
        if already_notified:
            return
        mail_template = self.env.ref('crm_iap_lead_enrich.lead_enrichment_no_credits')
        iap_account = self.env['iap.account'].search([('service_name', '=', service_name)], limit=1)
        res = self.env[model_name].search_read([], ['create_uid'])
        uids = set(r['create_uid'][0] for r in res if r.get('create_uid'))
        res = self.env['res.users'].search_read([('id', 'in', list(uids))], ['email'])
        emails = set(r['email'] for r in res if r.get('email'))
        email_values = {
            'email_to': ','.join(emails)
        }
        mail_template.send_mail(iap_account.id, force_send=True, email_values=email_values)
        self.env['ir.config_parameter'].sudo().set_param(notification_parameter, True)
