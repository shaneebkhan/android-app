# -*- coding: utf-8 -*-
from odoo import http, tools, _
from odoo.http import request
from odoo.exceptions import ValidationError
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT
from datetime import date, datetime
from random import randint
import json


class PartnerDashboard(http.Controller):

    def get_my_subscription(self, partner):
        Subscription = request.env['sale.subscription']
        partner_id = partner.id
        return Subscription.sudo().search([('partner_id', '=', partner_id), ('template_id.code', '=', "PART")], limit=1, order='create_date desc')

    def get_subscriptions(self, partner):
        ENTERPRISE_USER_IDS = [request.env.ref('openerp_enterprise.product_user_month')]
        Subscription = request.env['sale.subscription']
        partner_id = partner.id
        subs_open = Subscription.sudo().search([('partner_id', '=', partner_id), ('name', 'not ilike', 'PART-'), ('state', '=', 'open')])
        subs = Subscription.sudo().search([('partner_id', '=', partner_id), ('name', 'not ilike', 'PART-')])

        year = date.today()
        last_year = year.replace(year=year.year - 1).strftime(DEFAULT_SERVER_DATETIME_FORMAT)

        last_12month_enterprise_user = 0
        current_enterprise_user = 0

        for sub in subs_open:
            if sub.recurring_next_date >= last_year:
                for line in sub.recurring_invoice_line_ids:
                    if line.product_id in ENTERPRISE_USER_IDS:
                        current_enterprise_user += line.quantity

        for sub in subs:
            if sub.recurring_next_date >= last_year:
                for line in sub.recurring_invoice_line_ids:
                    if line.product_id in ENTERPRISE_USER_IDS:
                        last_12month_enterprise_user += line.quantity

        return {
            'subscriptions': subs,
            'current_enterprise_user': current_enterprise_user,
            'last_12month_enterprise_user': last_12month_enterprise_user,
        }

    def get_events(self, partner):
        Events = request.env['event.event']
        event_experience = Events.search([('event_type_id', '=', 12)])
        events_tour = Events.search([('event_type_id', '=', 11)])

        odoo_events = []
        for event in event_experience:
            exp_date = datetime.strptime(event.date_begin, '%Y-%m-%d %X')
            if exp_date.date() > datetime.now().date() and len(odoo_events) <= 0:
                    odoo_events.append([event, datetime.strftime(exp_date, '%b %d'), event.country_id])

        for event in events_tour:
            date = datetime.strptime(event.date_begin, '%Y-%m-%d %X')
            if date.date() > datetime.now().date() and event.address_id.country_id == partner.country_id and len(odoo_events) <= 2:
                    odoo_events.append([event, datetime.strftime(date, '%b %d'), event.country_id])

        for event in events_tour:
            date = datetime.strptime(event.date_begin, '%Y-%m-%d %X')
            if date.date() > datetime.now().date() and event.address_id.country_id != partner.country_id and len(odoo_events) <= 1:
                    odoo_events.append([event, datetime.strftime(date, '%b %d'), event.country_id])
            elif len(odoo_events) >= 3:
                break

        return{
            'events': odoo_events,
        }

    def get_companies_size(self, partner):
        Partners = request.env['res.partner']

        partner_country = partner.country_id.id

        size_tag_ids = {'less5': 20, 'f5t20': 21, 'f20t50': 22, 'f50t250': 23, 'more250': 24, }

        less5 = Partners.search_count([('category_id', '=', size_tag_ids['less5']), ('country_id', '=', partner_country)])
        f5t20 = Partners.search_count([('category_id', '=', size_tag_ids['f5t20']), ('country_id', '=', partner_country)])
        f20t50 = Partners.search_count([('category_id', '=', size_tag_ids['f20t50']), ('country_id', '=', partner_country)])
        f50t250 = Partners.search_count([('category_id', '=', size_tag_ids['f50t250']), ('country_id', '=', partner_country)])
        more250 = Partners.search_count([('category_id', '=', size_tag_ids['more250']), ('country_id', '=', partner_country)])

        return [
            {
                "label": _('< 5'),
                "value": less5,
            },
            {
                "label": _('5-20'),
                "value": f5t20,
            },
            {
                "label": _('20-50'),
                "value": f20t50,
            },
            {
                "label": _('50-250'),
                "value": f50t250,
            },
            {
                "label": _('> 250'),
                "value": more250,
            },
        ]

    def get_purchase_orders(self, partner):
        ENTERPRISE_USER_IDS = [request.env.ref('openerp_enterprise.product_user_month')]
        PurchaseOrder = request.env['purchase.order']
        partner_id = partner.id
        orders = PurchaseOrder.search([('partner_id', '=', partner_id), ('name', 'not ilike', 'PART-')])

        year = date.today()
        last_year = year.replace(year=year.year - 1).strftime(DEFAULT_SERVER_DATETIME_FORMAT)

        purchase_total = 0

        for order in orders:
            if order.date_order >= last_year:
                for line in order.order_line:
                    if line.product_id in ENTERPRISE_USER_IDS:
                        purchase_total += line.price_subtotal

        return {
            'orders': orders,
            'commission_to_receive': purchase_total,
            'last_12months_purchase_total': purchase_total,
        }

    def get_country_stats(self, partner):
        Leads = request.env['crm.lead']
        Partners = request.env['res.partner']

        partner_country = partner.country_id.id
        country_customers = Leads.search_count([('country_id', '=', partner_country)])
        country_leads = Leads.search_count([('country_id', '=', partner_country)])
        country_partners = Partners.search_count(['&', ('country_id', '=', partner_country), ('is_company', '=', True)])

        return {
            'country_leads': country_leads,
            'country_partners': country_partners,
            'country_customers': country_customers,
        }

    def get_grade(self, partner):

        NEXT_GRADE_USERS_VALUE = {'Bronze': 50, 'Silver': 100, 'Gold': 0, 'Platinum': -10}
        NEXT_GRADE_CERTIFIED_VALUE = {'Bronze': 2, 'Silver': 4, 'Gold': 0, 'Platinum': -10}
        NEXT_GRADE_COMMISSION_VALUE = {'Bronze': 10, 'Silver': 20, 'Gold': 0, 'Platinum': -10}
        partner_grade = partner.grade_id.name

        next_level_users = 0
        next_level_certified = 0
        next_level_com = 0

        experts = []
        certified_experts = []
        nbr_certified = 0

        for child in partner.child_ids:
            for tag in child.category_id:
                if 'Certification' in tag.name:
                    if child not in experts:
                        experts.append(child)

        for expert in experts:
            tags = []
            for tag in expert.category_id:
                if 'Certification' in tag.name:
                    tags.append(tag)
            certified_experts.append([expert, tags])

        nbr_certified = len(certified_experts)

        if partner_grade:
            next_level_users = NEXT_GRADE_USERS_VALUE[partner_grade]
            next_level_certified = NEXT_GRADE_CERTIFIED_VALUE[partner_grade]
            next_level_com = NEXT_GRADE_COMMISSION_VALUE[partner_grade]

        return {
            'partner_grade': partner_grade,
            'next_level_users': next_level_users,
            'next_level_certified': next_level_certified,
            'next_level_com': next_level_com,
            'nbr_certif': nbr_certified,
            'certified_experts': certified_experts,
        }

    def get_opportunities(self, partner):
        Lead = request.env['crm.lead']
        won_opportunities = Lead.search_count([('partner_id', "=", partner.id), ('stage_id', '=', 4)])
        not_won_opportunities = Lead.search_count([('partner_id', "=", partner.id), ('stage_id', '!=', 4)])

        return{
            'won_opportunities': won_opportunities,
            'not_won_opportunities': not_won_opportunities,
        }

    def values(self, partner, saleman):
        values = {}

        # session = request.session  # ['geoip']['country_code']

        values = self.get_subscriptions(partner)
        values.update(self.get_purchase_orders(partner))
        values.update(self.get_country_stats(partner))
        values.update(self.get_events(partner))
        values.update(self.get_grade(partner))
        values.update(self.get_opportunities(partner))
        values['company_size'] = json.dumps(self.get_companies_size(partner))

        values.update({
            # 'session': session,
            'partner': partner,
            'country': partner.country_id.name,
            'currency': partner.country_id.currency_id.symbol,
            'my_sub': self.get_my_subscription(partner).code,
            'saleman': saleman,
        })

        return values

    @http.route(['/dashboard', '/dashboard/<access_token>'], type='http', auth="public", website=True)
    def index_token(self, access_token=None, **kw):
        Partner = request.env['res.partner']
        Subscription = request.env['sale.subscription']

        point_of_contact = [42, 43, 6, 3]

        if access_token:
            sub = Subscription.search([('uuid', '=', access_token), ('template_id.code', '=', "PART")])
            if sub:
                partner = sub.partner_id
            # else:
            #     partner = Partner.search([('id', '=', access_token)])
        else:
            partner = request.env.user.partner_id

        saleman = Partner.sudo().browse(point_of_contact[randint(0, len(point_of_contact) - 1)])

        my_sub = self.get_my_subscription(partner)

        if my_sub:
            if my_sub.user_id:
                saleman = Partner.sudo().browse(my_sub.user_id.partner_id.id)

        values = {
            'country_leads': 10,
            'country_partners': 2,
            'country_customers': 30,
            'saleman': saleman,
        }
        values['company_size'] = json.dumps(self.get_companies_size(partner))

        if request.website.is_public_user():
            values.update({'partner': False})
        else:
            values = self.values(partner, saleman)

        return request.render('partner_dashboard.dashboard', values)

    @http.route(['/dashboard/profile'], type='http', auth='public', website=True)
    def dasboardLead(self, redirect=None, **data):
        MANDATORY_FIELDS = ["name", "phone", "email", "street", "city", "country_id"]
        OPTIONAL_FIELDS = ["zipcode", "state_id", "vat", "company_name", "website_description"]

        error = {}
        error_message = []

        if request.website.is_public_user():
            partner = False
        else:
            partner = request.env.user.partner_id.commercial_partner_id

            if partner._vat_readonly(partner):
                data.pop('vat')
                data.pop('name')
                data.pop('company_name')

        if request.httprequest.method == 'POST':
            # Validation
            for field_name in MANDATORY_FIELDS:
                if not data.get(field_name):
                    error[field_name] = 'missing'

            # email validation
            if data.get('email') and not tools.single_email_re.match(data.get('email')):
                error["email"] = 'error'
                error_message.append(_('Invalid Email! Please enter a valid email address.'))

            # vat validation
            Partner = request.env["res.partner"]
            if data.get("vat") and hasattr(Partner, "check_vat"):
                if data.get("country_id"):
                    data["vat"] = request.env["res.partner"].fix_eu_vat_number(int(data.get("country_id")), data.get("vat"))
                partner_dummy = Partner.new({
                    'vat': data['vat'],
                    'country_id': (int(data['country_id']) if data.get('country_id') else False),
                })
                try:
                    partner_dummy.check_vat()
                except ValidationError:
                    error["vat"] = 'error'

            # error message for empty required fields
            if [err for err in error.values() if err == 'missing']:
                error_message.append(_('Some required fields are empty.'))

            if not error:
                resp = request.redirect('/dashboard')
                values = {key: data[key] for key in MANDATORY_FIELDS}
                values.update({key: data[key] for key in OPTIONAL_FIELDS if key in data})
                values.update({'zip': values.pop('zipcode', '')})

                import base64

                if data['image']:
                    file = request.httprequest.files['image']
                    img = base64.encodestring(file.stream.read())
                    values['image'] = img
                if not partner:
                    partner = request.env['res.partner'].sudo().create(values)
                    lead = request.env['crm.lead'].sudo().create({
                        'name': "NEW PARTNERSHIP !! %s" % partner.name,
                        'partner_id': partner.id,
                        'partner_name': data['company_name'],
                        'street': data['street'],
                        'email_from': data['email'],
                        'phone': data['phone'],
                        'contact_name': data['name'],
                    })
                    sign = lead.encode(lead.id)
                    resp.set_cookie('lead_id', sign, domain=lead.get_score_domain_cookies())
                else:
                    partner = partner.write(values)
                return resp

        countries = request.env['res.country'].sudo().search([])
        states = request.env['res.country.state'].sudo().search([])

        data.update({
            'partner': partner or request.env["res.partner"],
            'countries': countries,
            'states': states,
            'has_check_vat': hasattr(request.env['res.partner'], 'check_vat'),
            'error': error,
            'error_message': error_message,
        })

        response = request.render("partner_dashboard.partner_form", data)
        response.headers['X-Frame-Options'] = 'DENY'
        return response
