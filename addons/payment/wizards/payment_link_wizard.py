# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class PaymentLinkWizard(models.TransientModel):
    _name = "payment.link.wizard"
    _description = "Generate Payment Link"

    @api.model
    def default_get(self, fields):
        res = super(PaymentLinkWizard, self).default_get(fields)
        res_id = self._context.get('active_id')
        res_model = self._context.get('active_model')
        res.update({'res_id': res_id, 'res_model': res_model})
        if res_id and res_model == 'account.invoice':
            record = self.env[res_model].browse(res_id)
            res.update({
                'description': record.reference,
                'amount': record.amount_total,
                'currency_id': record.currency_id.id,
                'partner_id': record.partner_id.id
            })
        return res

    res_model = fields.Char('Related Document Model', required=True)
    res_id = fields.Integer('Related Document ID', required=True)
    amount = fields.Monetary(currency_field='currency_id', required=True)
    currency_id = fields.Many2one('res.currency')
    partner_id = fields.Many2one('res.partner')
    link = fields.Char(string='Payment link')
    description = fields.Char('Payment Ref')

    def generate_payment_link(self):
        self.ensure_one()
        record = self.env[self.res_model].browse(self.res_id)
        if hasattr(record, '_validate_payment_link'):
            record._validate_payment_link(self.amount)
        base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url')
        self.link = '%s/website_payment/pay?reference=%s&amount=%s&currency_id=%s&partner_id=%s' % (base_url, self.description, self.amount, self.currency_id.id, self.partner_id.id)
        return {
            'name': _('Payment Link'),
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'payment.link.wizard',
            'res_id': self.id,
            'target': 'new',
        }
