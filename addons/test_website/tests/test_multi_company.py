# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import HttpCase


class TestMultiCompany(HttpCase):

    def test_company_in_context(self):
        """ Test website company is set in context """
        website = self.env['website'].browse(1)
        company = self.env['res.company'].create({'name': "Adaa"})
        website.company_id = company
        response = self.url_open('/multi_company_website')
        self.assertEqual(response.json()[0], company.id)
