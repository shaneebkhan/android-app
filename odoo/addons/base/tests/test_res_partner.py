# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase


class TestPartner(TransactionCase):

    def test_name_search(self):
        """ Check name_search on partner, especially with domain based on auto_join
        user_ids field. Check specific SQL of name_search correctly handle joined tables. """
        test_partner = self.env['res.partner'].create({'name': 'Vlad the Impaler'})
        test_user = self.env['res.users'].create({'name': 'Vlad the Impaler', 'login': 'vlad', 'email': 'vlad.the.impaler@example.com'})

        ns_res = self.env['res.partner'].name_search('Vlad', operator='ilike')
        self.assertEqual(set(i[0] for i in ns_res), set((test_partner | test_user.partner_id).ids))

        ns_res = self.env['res.partner'].name_search('Vlad', args=[('user_ids.email', 'ilike', 'vlad')])
        self.assertEqual(set(i[0] for i in ns_res), set(test_user.partner_id.ids))

    def test_child_partner_company(self):
        """Check the child's company should similar to that of parent's comapny, if change
        parent's company then it should also be change in child's company"""

        test_company1 = self.env['res.company'].create({'name': 'Company 1'})
        test_company2 = self.env['res.company'].create({'name': 'Company 2'})
        test_partner_parent = self.env['res.partner'].create({'name': 'Parent Partner', 'company_id': test_company1.id})
        test_partner_child = self.env['res.partner'].create({'name': 'Child Partner', 'parent_id': test_partner_parent.id, 'company_id': test_company2.id})

        self.assertEqual(test_partner_child.company_id, test_partner_parent.company_id, "Child's company should be same as parent's company")
        test_partner_parent.company_id = test_company2
        self.assertEqual(test_partner_child.company_id, test_partner_parent.company_id, "Child's company should be same as parent's company")
