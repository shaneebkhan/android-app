# coding: utf-8

from odoo import fields, models


class StripeConnect(models.Model):
    _name = 'stripe.connect'
    _description = 'Stripe Connect'

    client_id = fields.Char('Stripe Platform\'s Client Id', required=True)
    client_secret = fields.Char('Stripe Platform\'s Secret Key', required=True)
