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
