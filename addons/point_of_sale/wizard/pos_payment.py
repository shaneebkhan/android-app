# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.tools import float_is_zero


class PosMakePayment(models.TransientModel):
    _name = 'pos.make.payment'
    _description = 'Point of Sale Make Payment Wizard'

    def _default_amount(self):
        active_id = self.env.context.get('active_id')
        if active_id:
            order = self.env['pos.order'].browse(active_id)
            return (order.amount_total - order.amount_paid)
        return False

    def _default_payment_method(self):
        active_id = self.env.context.get('active_id')
        if active_id:
            order_id = self.env['pos.order'].browse(active_id)
            payment_method_ids = order_id.session_id.payment_method_ids
            cash_payment_method = payment_method_ids.filtered(lambda pm: pm.is_cash_count)[0]
            return payment_method_ids and (cash_payment_method or payment_method_ids[0]) or False
        return False

    def _default_payment_method_options(self):
        active_id = self.env.context.get('active_id')
        if active_id:
            order_id = self.env['pos.order'].browse(active_id)
            return order_id.session_id.payment_method_ids
        return self.env['pos.payment.method'].search([])

    amount = fields.Float(digits=0, required=True, default=_default_amount)
    payment_method_id = fields.Many2one('pos.payment.method', string='Payment Method', default=_default_payment_method)
    payment_name = fields.Char(string='Payment Reference')
    payment_date = fields.Date(string='Payment Date', required=True, default=lambda *a: fields.Date.today())
    payment_method_option_ids = fields.Many2many('pos.payment.method', string='Payment Method Options', store=False, default=_default_payment_method_options)

    @api.multi
    def check(self):
        """Check the order:
        if the order is not paid: continue payment,
        if the order is paid print ticket.
        """
        self.ensure_one()

        order = self.env['pos.order'].browse(self.env.context.get('active_id', False))
        currency = order.pricelist_id.currency_id

        data = self.read()[0]
        data.update({
            'pos_order_id': order.id,
            'currency_id': currency.id,
            'amount': currency.round(data['amount']) if currency else data['amount'],
            'name': data['payment_name'],
            'payment_method_id': data['payment_method_id'][0],
        })

        amount_to_pay = order.amount_total - order.amount_paid
        precision = currency.rounding or 0.01
        if not float_is_zero(amount_to_pay, precision_rounding=precision):
            # add_payment mutates the order. order.amount_paid is updated.
            order.add_payment(data)

        if float_is_zero(order.amount_total - order.amount_paid, precision_rounding=precision):
            order.action_pos_order_paid()
            return {'type': 'ir.actions.act_window_close'}

        return self.launch_payment()

    def launch_payment(self):
        return {
            'name': _('Payment'),
            'view_mode': 'form',
            'res_model': 'pos.make.payment',
            'view_id': False,
            'target': 'new',
            'views': False,
            'type': 'ir.actions.act_window',
            'context': self.env.context,
        }
