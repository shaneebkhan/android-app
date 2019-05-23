# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import api, models, _

from odoo.addons.iap.models.iap import InsufficientCreditError

_logger = logging.getLogger(__name__)


class MailThread(models.AbstractModel):
    _inherit = 'mail.thread'

    def _get_default_sms_recipients(self):
        """ This method will likely need to be overriden by inherited models.
               :returns partners: recordset of res.partner
        """
        partners = self.env['res.partner']
        if hasattr(self, 'partner_id'):
            partners |= self.mapped('partner_id')
        if hasattr(self, 'partner_ids'):
            partners |= self.mapped('partner_ids')
        return partners

    def _message_sms(self, body, subtype_id=False, partner_ids=False, numbers=False):
        """ Main method to post a message on a record using SMS-based notification
        method.

        :param body: content of SMS;
        :param partner_ids: if set is a record set of partners to notify;
        :param numbers: if set is a list of phone numbers to notify;
        """
        print('_message_sms on', self, 'with partner_ids', partner_ids, 'and numbers', numbers, 'and subtype', subtype_id)
        self.ensure_one()
        if partner_ids is False and numbers is False:
            partners = self._get_default_sms_recipients()
            partner_ids = partners.ids
        if subtype_id is False:
            subtype_id = self.env['ir.model.data'].xmlid_to_res_id('mail.mt_comment')
        message = self.message_post(
            body=body, partner_ids=partner_ids or [],  # TDE FIXME: temp fix otherwise crash mail_thread.py
            message_type='sms', subtype_id=subtype_id)

        if numbers:
            sms_create_vals = [{
                'mail_message_id': message.id,
                'body': body,
                'partner_id': False,
                'number': number,
                'state': 'outgoing',
            } for number in numbers]
            if sms_create_vals:
                sms = self.env['sms.sms'].sudo().create(sms_create_vals)
                sms.send(auto_commit=False, raise_exception=False)

        return message

    @api.multi
    def _notify_thread(self, message, msg_vals=False, model_description=False, mail_auto_delete=True):
        rdata = super(MailThread, self)._notify_thread(message, msg_vals=msg_vals, model_description=model_description, mail_auto_delete=mail_auto_delete)
        sms_pdata = [r for r in rdata['partners'] if r['notif'] == 'sms']
        if sms_pdata:
            self._notify_records_by_sms(message, sms_pdata, msg_vals=msg_vals, put_in_queue=False)
        return rdata

    @api.multi
    def _notify_records_by_sms(self, message, partners_data, msg_vals=False, put_in_queue=False):
        print('_notify_records_by_sms', message, partners_data)
        sms_create_vals = [{
            'mail_message_id': message.id,
            'body': msg_vals['body'] if msg_vals and msg_vals.get('body') else message.body,
            'partner_id': partner.id,
            'number': partner.mobile,
            'state': 'outgoing',
        } for partner in self.env['res.partner'].sudo().browse([r['id'] for r in partners_data])
            if partner.mobile]

        if sms_create_vals:
            sms_all = self.env['sms.sms'].sudo().create(sms_create_vals)

            for sms in sms_all:
                notification = self.env['mail.notification'].sudo().search([
                    ('mail_message_id', '=', message.id),
                    ('res_partner_id', '=', sms.partner_id.id)
                ])
                # [s['partner_id'] for s in sms_create_vals])
                if notification:
                    notification.write({
                        'is_sms': True,
                        'is_read': True,  # handle by email discards Inbox notification
                        'sms_id': sms.id,
                        'email_status': 'ready',
                    })

            if not put_in_queue:
                sms_all.send(auto_commit=False, raise_exception=False)
