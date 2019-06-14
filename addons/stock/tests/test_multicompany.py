# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import SavepointCase
from odoo.exceptions import AccessError


class StockMove(SavepointCase):
    @classmethod
    def setUpClass(cls):
        super(StockMove, cls).setUpClass()
        cls.comp1 = cls.env['res.company'].create({
            'name': 'main_company',
        })
        cls.comp2 = cls.env['res.company'].create({
            'name': 'secondary_company',
        })

        cls.new_user = cls.env['res.users'].create({
            'name': 'stock user!',
            'login': 'stockuser',
            'groups_id': [(6, 0, cls.env.ref('stock.group_stock_user').ids)],
            'company_id': cls.comp1.id,
            'company_ids': [(6, 0, cls.comp1.ids)],
        })
        cls.new_user.partner_id.email = 'xxx@odoo.com'

        cls.picking_type_internal = cls.env.ref('stock.picking_type_internal')
        cls.stock_location = cls.env.ref('stock.stock_location_stock')
        cls.product = cls.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'categ_id': cls.env.ref('product.product_category_all').id,
        })

    def test_multicompany_1(self):
        """ Validate a picking in secondary company while user is on main company
        every new object should be located in secondary company.
        """
        internal_picking = self.env['stock.picking'].create({
            'location_id': self.stock_location.id,
            'location_dest_id': self.stock_location.id,
            'picking_type_id': self.picking_type_internal.id,
            'company_id': self.comp2.id,
        })
        move1 = self.env['stock.move'].create({
            'picking_id': internal_picking.id,
            'name': internal_picking.name,
            'product_id': self.product.id,
            'product_uom': self.product.uom_id.id,
            'location_id': self.stock_location.id,
            'location_dest_id': self.stock_location.id,
            'product_uom_qty': 10,
        })
        self.assertEquals(move1.company_id, self.comp2, 'The move was created in the wrong company')

        # Can't access move1 as not in allowed companies
        with self.assertRaises(AccessError):
            move1.sudo(self.new_user).name

        self.new_user.company_ids = [(4, self.comp2.id)]
        move1.sudo(self.new_user).name

        internal_picking.action_confirm()
        move1.quantity_done = 10
        internal_picking.button_validate()
        self.assertEquals(move1.move_line_ids.company_id, self.comp2, 'The move line was created in the wrong company')

    def test_multicompany_2(self):
        """ Validate a picking in secondary company while user is on main company
        every new object should be located in secondary company.
        """
        inventory = self.env['stock.inventory'].create({
            'company_id': self.comp2.id,
            'name': 'inventory'
        })
        inventory.action_start()
        line1 = self.env['stock.inventory.line'].create({
            'inventory_id': inventory.id,
            'product_id': self.product.id,
            'product_uom_id': self.product.uom_id.id,
            'location_id': self.stock_location.id,
            'product_qty': 10,
        })
        self.assertEquals(line1.company_id, self.comp2, 'The line was created in the wrong company')

        self.new_user.company_ids = [(4, self.comp2.id)]
        inventory.action_validate()
        self.assertEquals(inventory.move_ids.company_id, self.comp2, 'The moves was created in the wrong company')
