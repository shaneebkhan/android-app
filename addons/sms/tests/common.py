# -*- coding: utf-8 -*-

from contextlib import contextmanager
from unittest.mock import patch

from odoo.tests import common
from odoo.addons.sms.models.sms_api import SmsApi


class MockSMS(common.BaseCase):

    def tearDown(self):
        super(MockSMS, self).tearDown()
        self._clear_sms_sent

    @contextmanager
    def mockSMSGateway(self):
        self._sms = []

        def _sms_v1_handle_magic_body(body, sms_id, number):
            res = {'res_id': sms_id, 'state': 'success', 'credit': 1}
            splitted = body.split('_')
            if splitted[0] == 'ERROR':
                if len(splitted) == 3 and splitted[2] != number:
                    return res
                if splitted[1] == 'CREDIT':
                    res['credit'] = 0
                    res['state'] = 'insufficient_credit'
                    return res
                elif splitted[1] == 'WRONGNUMBER':
                    res['state'] = 'wrong_format_number'
                    return res
            return res

        def _contact_iap(local_endpoint, params):
            # mock single sms sending
            if local_endpoint == '/iap/message_send':
                self._sms += [{
                    'number': number,
                    'body': params['message'],
                } for number in params['numbers']]
                return True  # send_message v0 API returns always True
            # mock batch sending
            if local_endpoint == '/iap/sms/1/send':
                result = []
                for to_send in params['messages']:
                    res = _sms_v1_handle_magic_body(to_send['content'], to_send['res_id'], to_send['number'])
                    result.append(res)
                    if res['state'] == 'success':
                        self._sms.append({
                            'number': to_send['number'],
                            'body': to_send['content'],
                        })
                return result

        try:
            with patch.object(SmsApi, '_contact_iap', side_effect=_contact_iap) as contact_iap_mock:
                yield
        finally:
            pass

    def assertSMSSent(self, numbers, content):
        """ Check sent SMS. Order is not checked. Each number should have received
        the same content. Usefull to check batch sending.

        :param numbers: list of numbers;
        :param content: content to check for each number;
        """
        self.assertEqual(len(self._sms), len(numbers))
        for number in numbers:
            sent_sms = next((sms for sms in self._sms if sms['number'] == number), None)
            self.assertTrue(bool(sent_sms))
            self.assertEqual(sent_sms['body'], content)

    def _clear_sms_sent(self):
        self._sms = []

    def assertSMSFailed(self, partners, error_code):
        failed_sms = self.env['sms.sms'].search([
            ('partner_id', 'in', partners.ids),
            ('state', '=', 'error')
        ])
        self.assertEqual(len(failed_sms), len(partners))
        self.assertEqual(set(failed_sms.mapped('error_code')), set([error_code]))

    def assertSMSOutgoing(self, partners, content=None):
        outgoing_sms = self.env['sms.sms'].search([
            ('partner_id', 'in', partners.ids),
            ('state', '=', 'outgoing')
        ])
        self.assertEqual(len(outgoing_sms), len(partners))
        self.assertEqual(set(outgoing_sms.mapped('body')), set([content]))

    def assertSMSNotification(self, partners, content, messages, partners_notif_vals=None):
        notifications = self.env['mail.notification'].search([
            ('res_partner_id', 'in', partners.ids),
            ('mail_message_id', 'in', messages.ids),
            ('is_sms', '=', True),
        ])
        if partners_notif_vals:
            success_partners = partners.filtered(lambda p: p.id not in partners_notif_vals or partners_notif_vals[p.id]['state'] == 'sent')
            success_notifications = notifications.filtered(lambda n: n.res_partner_id in success_partners)
        else:
            success_partners = partners
            success_notifications = notifications

        self.assertEqual(notifications.mapped('res_partner_id'), partners)
        if success_notifications:
            self.assertEqual(set(success_notifications.mapped('email_status')), set(['sent']))
        self.assertSMSSent(success_partners.mapped('mobile'), content)

        if partners_notif_vals:
            for pid, values in partners_notif_vals.items():
                partner_notification = notifications.filtered(lambda n: n.res_partner_id.id == pid)
                self.assertTrue(len(partner_notification))
                self.assertEqual(partner_notification.email_status, values['state'])
                self.assertEqual(partner_notification.failure_type, values['failure_type'])
                self.assertSMSFailed(partner_notification.res_partner_id, values['failure_type'])

        for message in messages:
            self.assertIn(content, message.body)
