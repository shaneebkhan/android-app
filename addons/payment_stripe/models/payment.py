# coding: utf-8

import logging
import requests
import pprint
from werkzeug import urls

from odoo import api, fields, models, _
from odoo.tools.float_utils import float_round

from odoo.addons.payment.models.payment_acquirer import ValidationError
from odoo.addons.payment_stripe.controllers.main import StripeController

_logger = logging.getLogger(__name__)

# The following currencies are integer only, see https://stripe.com/docs/currencies#zero-decimal
INT_CURRENCIES = [
    u'BIF', u'XAF', u'XPF', u'CLP', u'KMF', u'DJF', u'GNF', u'JPY', u'MGA', u'PYG', u'RWF', u'KRW',
    u'VUV', u'VND', u'XOF'
]


class PaymentAcquirerStripe(models.Model):
    _inherit = 'payment.acquirer'

    provider = fields.Selection(selection_add=[('stripe', 'Stripe')])
    stripe_secret_key = fields.Char(required_if_provider='stripe', groups='base.group_user')
    stripe_publishable_key = fields.Char(required_if_provider='stripe', groups='base.group_user')
    stripe_image_url = fields.Char(
        "Checkout Image URL", groups='base.group_user',
        help="A relative or absolute URL pointing to a square image of your "
             "brand or product. As defined in your Stripe profile. See: "
             "https://stripe.com/docs/checkout")

    @api.multi
    def stripe_form_generate_values(self, tx_values):
        self.ensure_one()

        base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url')
        stripe_session_data = {
            'payment_method_types[]': 'card',
            'line_items[][amount]': int(tx_values['amount'] if tx_values['currency'].name in INT_CURRENCIES else float_round(tx_values['amount'] * 100, 2)),
            'line_items[][currency]': tx_values['currency'].name,
            'line_items[][quantity]': 1,
            'line_items[][name]': tx_values['reference'],
            'client_reference_id': tx_values['reference'],
            'success_url': urls.url_join(base_url, StripeController._success_url) + '?reference=%s' % tx_values['reference'],
            'cancel_url': urls.url_join(base_url, StripeController._cancel_url) + '?reference=%s' % tx_values['reference'],
            'customer_email': tx_values['partner_email'],
        }
        tx_values['session_id'] = self._create_stripe_session(stripe_session_data)

        return tx_values

    @api.multi
    def _stripe_request(self, url, data=False):
        self.ensure_one()
        url = urls.url_join(self._get_stripe_api_url(), url)
        headers = {'AUTHORIZATION': 'Bearer %s' % self.sudo().stripe_secret_key}
        resp = requests.post(url, data, headers=headers)
        resp.raise_for_status()
        return resp.json()

    @api.multi
    def _create_stripe_session(self, kwargs):
        self.ensure_one()
        resp = self._stripe_request('checkout/sessions', kwargs)
        if resp.get('payment_intent') and kwargs.get('client_reference_id'):
            tx = self.env['payment.transaction'].sudo().search([('reference', '=', kwargs['client_reference_id'])])
            tx.stripe_payment_intent = resp['payment_intent']
        return resp['id']

    @api.model
    def _get_stripe_api_url(self):
        return 'https://api.stripe.com/v1/'

    @api.model
    def stripe_s2s_form_process(self, data):
        payment_token = self.env['payment.token'].sudo().create({
            'acquirer_id': int(data['acquirer_id']),
            'partner_id': int(data['partner_id']),
            'stripe_payment_method': data.get('id'),
            'name': 'XXXXXXXXXXXX%s' % data.get('card', {}).get('last4'),
            'acquirer_ref': data.get('customer')
        })
        return payment_token

    def _get_feature_support(self):
        """Get advanced feature support by provider.

        Each provider should add its technical in the corresponding
        key for the following features:
            * tokenize: support saving payment data in a payment.tokenize
                        object
        """
        res = super(PaymentAcquirerStripe, self)._get_feature_support()
        res['tokenize'].append('stripe')
        return res


class PaymentTransactionStripe(models.Model):
    _inherit = 'payment.transaction'

    stripe_payment_intent = fields.Char(string='Stripe Payment Intent ID', readonly=True)

    def form_feedback(self, data, acquirer_name):
        if data.get('reference') and acquirer_name == 'stripe':
            transaction = self.env['payment.transaction'].search([('reference', '=', data['reference'])])

            url = 'payment_intents/%s' % transaction.stripe_payment_intent
            resp = transaction.acquirer_id._stripe_request(url)
            if resp.get('charges') and resp.get('charges').get('total_count'):
                resp = resp.get('charges').get('data')[0]

            data.update(resp)
            _logger.info('Stripe: entering form_feedback with post data %s' % pprint.pformat(data))
        return super(PaymentTransactionStripe, self).form_feedback(data, acquirer_name)

    def _create_stripe_charge(self, acquirer_ref=None, email=None):

        charge_params = {
            'amount': int(self.amount if self.currency_id.name in INT_CURRENCIES else float_round(self.amount * 100, 2)),
            'currency': self.currency_id.name,
            'payment_method_types[]': 'card',
            'customer': acquirer_ref,
            'off_session': 'recurring',
            'confirm': True,
            'payment_method': self.payment_token_id.stripe_payment_method
        }
        _logger.info('_create_stripe_charge: Sending values to stripe, values:\n%s', pprint.pformat(charge_params))

        res = self.acquirer_id._stripe_request('payment_intents', charge_params)
        if res.get('charges') and res.get('charges').get('total_count'):
            res = res.get('charges').get('data')[0]

        _logger.info('_create_stripe_charge: Values received:\n%s', pprint.pformat(res))
        return res

    @api.multi
    def stripe_s2s_do_transaction(self, **kwargs):
        self.ensure_one()
        result = self._create_stripe_charge(acquirer_ref=self.payment_token_id.acquirer_ref, email=self.partner_email)
        return self._stripe_s2s_validate_tree(result)

    def _create_stripe_refund(self):

        refund_params = {
            'charge': self.acquirer_reference,
            'amount': int(float_round(self.amount * 100, 2)), # by default, stripe refund the full amount (we don't really need to specify the value)
            'metadata[reference]': self.reference,
        }

        _logger.info('_create_stripe_refund: Sending values to stripe URL, values:\n%s', pprint.pformat(refund_params))
        res = self.acquirer_id._stripe_request('refunds', refund_params)
        _logger.info('_create_stripe_refund: Values received:\n%s', pprint.pformat(res))

        return res

    @api.multi
    def stripe_s2s_do_refund(self, **kwargs):
        self.ensure_one()
        result = self._create_stripe_refund()
        return self._stripe_s2s_validate_tree(result)

    @api.model
    def _stripe_form_get_tx_from_data(self, data):
        """ Given a data dict coming from stripe, verify it and find the related
        transaction record. """
        reference = data.get('reference')
        if not reference:
            stripe_error = data.get('error', {}).get('message', '')
            _logger.error('Stripe: invalid reply received from stripe API, looks like '
                          'the transaction failed. (error: %s)', stripe_error or 'n/a')
            error_msg = _("We're sorry to report that the transaction has failed.")
            if stripe_error:
                error_msg += " " + (_("Stripe gave us the following info about the problem: '%s'") %
                                    stripe_error)
            error_msg += " " + _("Perhaps the problem can be solved by double-checking your "
                                 "credit card details, or contacting your bank?")
            raise ValidationError(error_msg)

        tx = self.search([('reference', '=', reference)])
        if not tx:
            error_msg = (_('Stripe: no order found for reference %s') % reference)
            _logger.error(error_msg)
            raise ValidationError(error_msg)
        elif len(tx) > 1:
            error_msg = (_('Stripe: %s orders found for reference %s') % (len(tx), reference))
            _logger.error(error_msg)
            raise ValidationError(error_msg)
        return tx[0]

    @api.multi
    def _stripe_s2s_validate_tree(self, tree):
        self.ensure_one()
        if self.state != 'draft':
            _logger.info('Stripe: trying to validate an already validated tx (ref %s)', self.reference)
            return True

        status = tree.get('status')
        tx_id = tree.get('id')
        vals = {
            'date': fields.datetime.now(),
            'acquirer_reference': tx_id,
        }
        if status == 'succeeded':
            self.write(vals)
            self._set_transaction_done()
            self.execute_callback()
            if self.type == 'form_save':
                s2s_data = {
                    'customer': tree.get('customer'),
                    'id': tree.get('payment_method'),
                    'card': tree.get('payment_method_details').get('card'),
                    'acquirer_id': self.acquirer_id.id,
                    'partner_id': self.partner_id.id
                }
                token = self.acquirer_id.stripe_s2s_form_process(s2s_data)
                self.payment_token_id = token.id
            if self.payment_token_id:
                self.payment_token_id.verified = True
            return True
        if status == 'processing':
            self.write(vals)
            self._set_transaction_pending()
            return True
        else:
            error = tree.get('failure_message')
            _logger.warn(error)
            vals.update({'state_message': error})
            self.write(vals)
            self._set_transaction_cancel()
            return False

    @api.multi
    def _stripe_form_get_invalid_parameters(self, data):
        invalid_parameters = []
        if data.get('amount') != int(self.amount if self.currency_id.name in INT_CURRENCIES else float_round(self.amount * 100, 2)):
            invalid_parameters.append(('Amount', data.get('amount'), self.amount * 100))
        if data.get('currency').upper() != self.currency_id.name:
            invalid_parameters.append(('Currency', data.get('currency'), self.currency_id.name))
        if data.get('payment_intent') and data.get('payment_intent') != self.stripe_payment_intent:
            invalid_parameters.append(('Payment Intent', data.get('payment_intent'), self.stripe_payment_intent))
        return invalid_parameters

    @api.multi
    def _stripe_form_validate(self, data):
        return self._stripe_s2s_validate_tree(data)


class PaymentTokenStripe(models.Model):
    _inherit = 'payment.token'

    stripe_payment_method = fields.Char('Payment Method ID')

    @api.model
    def stripe_create(self, values):
        if values.get('stripe_payment_method') and not values.get('acquirer_ref'):
            partner_id = self.env['res.partner'].browse(values.get('partner_id'))
            payment_acquirer = self.env['payment.acquirer'].browse(values.get('acquirer_id'))

            # create customer to stipe
            customer_data = {
                'email': partner_id.email
            }
            cust_resp = payment_acquirer._stripe_request('customers', customer_data)

            # link customer with payment method
            api_url_payment_method = 'payment_methods/%s/attach' % values['stripe_payment_method']
            method_data = {
                'customer': cust_resp.get('id')
            }
            payment_acquirer._stripe_request(api_url_payment_method, method_data)
            return {
                'acquirer_ref': cust_resp['id'],
            }
        return values
