# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models, api


class AccountVoucher(models.Model):
    _inherit = 'account.voucher'

    unit_id = fields.Many2one('res.partner', string="Operating Unit", ondelete="restrict",
        default = lambda self: self.env.user._get_default_unit())

    @api.multi
    def voucher_pay_now_payment_create(self):
        res = super(AccountVoucher, self).voucher_pay_now_payment_create()
        res['unit_id'] = self.unit_id.id
        return res
