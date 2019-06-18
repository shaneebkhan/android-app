# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common, Form


class TestMrpMulticompany(common.TransactionCase):

    def setUp(self):
        super(TestMrpMulticompany, self).setUp()

        group_user = self.env.ref('base.group_user')
        group_stock_manager = self.env.ref('stock.group_stock_manager')
        group_mrp_manager = self.env.ref('mrp.group_mrp_manager')
        company_2 = self.env.ref('stock.res_company_1')
        self.company_3 = self.env['res.company'].create({'name': 'third_company'})
        self.multicompany_user_id = self.env['res.users'].create({
            'name': 'multicomp',
            'login': 'multicomp',
            'groups_id': [(6, 0, [group_user.id, group_stock_manager.id, group_mrp_manager.id])],
            'company_id': company_2.id,
            'company_ids': [(6, 0, [company_2.id, self.company_3.id])]
        })
        self.multicompany_user_id.partner_id.email = 'xxx@odoo.com'

    def test_00_multicompany_user(self):
        """check no error on getting default mrp.production values in multicompany setting"""
        StockLocation = self.env['stock.location'].sudo(self.multicompany_user_id)
        fields = ['location_src_id', 'location_dest_id']
        defaults = StockLocation.default_get(['location_id', 'location_dest_id', 'type'])
        for field in fields:
            if defaults.get(field):
                try:
                    StockLocation.check_access_rule([defaults[field]], 'read')
                except Exception as exc:
                    assert False, "unreadable location %s: %s" % (field, exc)

    def test_01_multicompany_user(self):
        """ check that the moves generated by the production (raws and finished)
        belong to the same company as the mo"""
        product = self.env['product.product'].create({'name': 'to_build', 'type': 'product'})
        component = self.env['product.product'].create({'name': 'component', 'type': 'product'})
        bom_1 = self.env['mrp.bom'].create({
            'product_id': product.id,
            'product_tmpl_id': product.product_tmpl_id.id,
            'product_uom_id': product.uom_id.id,
            'product_qty': 1.0,
            'company_id': False,
            'type': 'normal',
            'bom_line_ids': [
                (0, 0, {'product_id': component.id, 'product_qty': 1})
            ]})
        mo_form = Form(self.env['mrp.production'].sudo(self.multicompany_user_id))
        mo_form.product_id = product
        mo_form.bom_id = bom_1
        mo_form.product_uom_id = product.uom_id
        mo_form.product_qty = 2
        mo = mo_form.save()
        mo.action_confirm()
        self.assertEqual(mo.move_raw_ids.company_id, mo.company_id, 'moves belong to the wrong company')
        self.assertEqual(mo.move_finished_ids.company_id, mo.company_id, 'moves belong to the wrong company')

    def test_02_multicompany_user(self):
        """ check that the mo is created in th right company"""
        product = self.env['product.product'].create({'name': 'to_build'})
        component = self.env['product.product'].create({'name': 'Botox'})
        bom_1 = self.env['mrp.bom'].create({
            'product_id': product.id,
            'product_tmpl_id': product.product_tmpl_id.id,
            'product_uom_id': product.uom_id.id,
            'product_qty': 1.0,
            'company_id': False,
            'type': 'normal',
            'bom_line_ids': [
                (0, 0, {'product_id': component.id, 'product_qty': 1})
            ]})
        mo_form = Form(self.env['mrp.production'].sudo(self.multicompany_user_id))
        mo_form.product_id = product
        mo_form.bom_id = bom_1
        mo_form.product_uom_id = product.uom_id
        mo_form.product_qty = 2
        mo = mo_form.save()
        self.assertEqual(mo.company_id, self.multicompany_user_id.company_id, 'mo belong to the wrong company')
