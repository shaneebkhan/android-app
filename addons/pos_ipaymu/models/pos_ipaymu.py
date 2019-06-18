# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import requests
# from requests import Request
import werkzeug
from odoo import models, fields, api, _
from odoo.tools.float_utils import float_compare

_logger = logging.getLogger(__name__)


class BarcodeRule(models.Model):
    _inherit = 'barcode.rule'

    type = fields.Selection(selection_add=[
        ('credit', 'Credit Card')
    ])


class PosIPaymuConfiguration(models.Model):
    _name = 'pos_ipaymu.configuration'

    name = fields.Char(required=True, help='Name of this IPaymu configuration')
    merchant_api_key = fields.Char(string='Merchant API Key', required=True, help='ID of the merchant to authenticate him on the payment provider server')
    #merchant_pwd = fields.Char(string='Merchant Password', required=True, help='Password of the merchant to authenticate him on the payment provider server')
    @api.model
    def get_merchant_api_key(self):
        data_merchant = self.env['pos_ipaymu.configuration'].search([],limit=1).merchant_api_key
        return data_merchant

    @api.model
    def get_qr_code(self, data):
        url = 'https://my.ipaymu.com/api/tagqr?key='+self.env['pos_ipaymu.configuration'].search([],limit=1).merchant_api_key+'&request=generate&price='+data['amount']+'&uniqid='+data['uniqid']+'&notify_url=http://autotoll.ipaymu.com'
        r = requests.post(url)
        r.raise_for_status()
        response = werkzeug.utils.unescape(r.content.decode())
        return response

    @api.model
    def get_status_payment(self, data):
        url = 'https://my.ipaymu.com/api/CekTransaksi.php?key='+self.env['pos_ipaymu.configuration'].search([],limit=1).merchant_api_key+'&id='+data['trx_id']+'&format=json'
        r = requests.post(url)
        r.raise_for_status()
        response = werkzeug.utils.unescape(r.content.decode())
        return response


class AccountJournal(models.Model):
    _inherit = 'account.journal'

    pos_ipaymu_config_id = fields.Many2one('pos_ipaymu.configuration', string='IPaymu Credentials', help='The configuration of IPaymu used for this journal')


