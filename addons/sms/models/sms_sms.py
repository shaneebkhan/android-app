# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import api, fields, models, tools

_logger = logging.getLogger(__name__)


class SmsSms(models.Model):
    _name = 'sms.sms'
    _description = 'Outgoing SMS'
    _rec_name = 'number'

    number = fields.Char('Number', required=True)
    body = fields.Text()
    partner_id = fields.Many2one('res.partner', 'Customer')
    mail_message_id = fields.Many2one('mail.message', index=True)
    state = fields.Selection([
        ('outgoing', 'In Queue'),
        ('sent', 'Sent'),
        ('error', 'Error'),
        ('canceled', 'Canceled')
    ], 'SMS Status', readonly=True, copy=False, default='pending', required=True)
    error_code = fields.Selection([
        ('sms_number_missing', 'Missing Number'),
        ('sms_number_format', 'Wrong Number Format'),
        ('sms_credit', 'Insufficient Credit'),
        ('sms_server', 'Server Error')
    ])

    @api.multi
    def send(self, auto_commit=False, raise_exception=False):
        for batch_ids in self._split_batch():
            self.browse(batch_ids)._send(
                auto_commit=auto_commit,
                raise_exception=raise_exception)
            _logger.info(
                'Sent batch %s SMS: %s', len(batch_ids), batch_ids)  # TDE FIXME: clean logger

    def _split_batch(self):
        batch_size = int(self.env['ir.config_parameter'].sudo().get_param('sms.session.batch.size', 10))
        for sms_batch in tools.split_every(batch_size, self.ids):
            yield sms_batch

    @api.multi
    def _send(self, auto_commit=False, raise_exception=False):
        """ This method try to send SMS after checking the number (presence and
            formatting). """
        print('-> sending', self)

        iap_data = [{
            'res_id': record.id,
            'number': record.number,
            'content': record.body,
        } for record in self]

        try:
            iap_results = self.env['sms.api']._send_sms_batch(iap_data)
        except Exception as e:
            print('\t-> exception when sending', e)
            self._postprocess_sent_sms([{'res_id': sms.id, 'state': 'server_error'} for sms in self])
        else:
            print('\t-> sent, gave', iap_results)
            self._postprocess_sent_sms(iap_results)

    def _postprocess_sent_sms(self, iap_results):
            done_sms_ids = [item['res_id'] for item in iap_results if item['state'] == 'success']
            credit_sms_ids = [item['res_id'] for item in iap_results if item['state'] == 'insufficient_credit']
            wrong_number_sms_ids = [item['res_id'] for item in iap_results if item['state'] == 'wrong_format_number']
            server_error_sms_ids = [item['res_id'] for item in iap_results if item['state'] == 'server_error']
            if done_sms_ids:
                self.browse(done_sms_ids).write({'state': 'sent'})
                found = self.env['mail.notification'].sudo().search([
                    ('is_sms', '=', True),
                    ('sms_id', 'in', done_sms_ids),
                    ('email_status', 'not in', ('sent', 'canceled'))]
                )
                found.write({
                    'email_status': 'sent',
                    'failure_type': '',
                    'failure_reason': ''
                })
            if credit_sms_ids:
                self.browse(credit_sms_ids).write({'state': 'error', 'error_code': 'sms_credit'})
                self.env['mail.notification'].sudo().search([
                    ('is_sms', '=', True),
                    ('sms_id', 'in', credit_sms_ids),
                    ('email_status', 'not in', ('sent', 'canceled'))]
                ).write({
                    'email_status': 'exception',
                    'failure_type': 'sms_credit',
                    'failure_reason': 'BLORK',
                })
            if wrong_number_sms_ids:
                self.browse(wrong_number_sms_ids).write({'state': 'error', 'error_code': 'sms_number_format'})
                self.env['mail.notification'].sudo().search([
                    ('is_sms', '=', True),
                    ('sms_id', 'in', wrong_number_sms_ids),
                    ('email_status', 'not in', ('sent', 'canceled'))]
                ).write({
                    'email_status': 'exception',
                    'failure_type': 'sms_number_format',
                    'failure_reason': 'BLORK',
                })
            if server_error_sms_ids:
                self.browse(server_error_sms_ids).write({'state': 'error', 'error_code': 'sms_server'})
                self.env['mail.notification'].sudo().search([
                    ('is_sms', '=', True),
                    ('sms_id', 'in', server_error_sms_ids),
                    ('email_status', 'not in', ('sent', 'canceled'))]
                ).write({
                    'email_status': 'exception',
                    'failure_type': 'sms_server',
                    'failure_reason': 'Unknown server error',
                })

        # if not failure_type or failure_type == 'RECIPIENT':  # if we have another error, we want to keep the mail.
        #     mail_to_delete_ids = [mail.id for mail in self if mail.auto_delete]
        #     self.browse(mail_to_delete_ids).sudo().unlink()

    @api.multi
    def _cancel(self):
        """ Cancel SMS """
        self.write({
            'state': 'canceled',
            'error_code': False
        })
        self._notify_sms_update()
