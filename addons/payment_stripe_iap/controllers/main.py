# -*- coding: utf-8 -*-
import requests
import werkzeug

from odoo import http
from odoo.http import request


class StripeController(http.Controller):

    @http.route('/payment/stripe/create_account/<model("payment.acquirer"):acquirer>', auth='user')
    def create_stripe_account(self, acquirer):
        company = request.env.user.company_id
        redirect_uri = request.env['ir.config_parameter'].sudo().get_param('web.base.url') + "/stripe/account_done"
        stripe_platform = request.env['stripe.connect'].search([], limit=1)

        return werkzeug.utils.redirect('https://connect.stripe.com/oauth/authorize?response_type=code&client_id='+stripe_platform.client_id+'&scope=read_write&redirect_uri='+redirect_uri+
            '&stripe_user[country]='+company.country_id.code+
            '&stripe_user[street_address]='+company.street+
            '&stripe_user[zip]='+company.zip+
            '&stripe_user[business_name]='+company.website+
            '&stripe_user[first_name]='+request.env.user.name)

    @http.route('/stripe/account_done', auth='user')
    def stripe_account_done(self, **post):
        acquirer = request.env['payment.acquirer'].search([('provider', '=', 'stripe')], limit=1)
        data = {
            'client_secret': request.env['stripe.connect'].search([], limit=1).client_secret,
            'code': post.get('code'),
            'grant_type': 'authorization_code'
        }
        response = requests.post('https://connect.stripe.com/oauth/token', data)
        response.raise_for_status()
        response = response.json()
        acquirer.write({
            'stripe_secret_key': response['access_token'],
            'stripe_publishable_key': response['stripe_publishable_key'],
            'environment': 'prod',
            'website_published': True,
            'stripe_connect_status_msg': True,
        })
        return werkzeug.utils.redirect('/web#id='+str(acquirer.id)+'&model=payment.acquirer&view_type=form')
