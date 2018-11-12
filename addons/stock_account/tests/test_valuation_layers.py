# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase


class TestStockValuationCommon(TransactionCase):
    def setUp(self):
        super(TestStockValuationCommon, self).setUp()
        self.stock_location = self.env.ref('stock.stock_location_stock')
        self.customer_location = self.env.ref('stock.stock_location_customers')
        self.supplier_location = self.env.ref('stock.stock_location_suppliers')
        self.uom_unit = self.env.ref('uom.product_uom_unit')
        self.product1 = self.env['product.product'].create({
            'name': 'product1',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })

        # Counter automatically incremented by `_make_in_move` and `_make_out_move`.
        self.days = 0

    def _make_in_move(self, product, quantity, unit_cost=None):
        """ Helper to create and validate a receipt move.
        """
        unit_cost = unit_cost or product.standard_price
        in_move = self.env['stock.move'].create({
            'name': 'in %s units @ %s per unit' % (str(quantity), str(unit_cost)),
            'product_id': product.id,
            'location_id': self.supplier_location.id,
            'location_dest_id': self.stock_location.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': quantity,
            'price_unit': unit_cost,
        })
        in_move._action_confirm()
        in_move._action_assign()
        in_move.move_line_ids.qty_done = quantity
        in_move._action_done()

        self.days += 1
        return in_move

    def _make_out_move(self, product, quantity):
        """ Helper to create and validate a delivery move.
        """
        out_move = self.env['stock.move'].create({
            'name': 'out %s units' % str(quantity),
            'product_id': product.id,
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': quantity,
        })
        out_move._action_confirm()
        out_move._action_assign()
        out_move.move_line_ids.qty_done = quantity
        out_move._action_done()

        self.days += 1
        return out_move


class TestStockValuationStandard(TestStockValuationCommon):
    def setUp(self):
        super(TestStockValuationStandard, self).setUp()
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'standard'
        self.product1.product_tmpl_id.standard_price = 10

    def test_manual_1(self):
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'

        move1 = self._make_in_move(self.product1, 10)
        move2 = self._make_in_move(self.product1, 10)
        move3 = self._make_out_move(self.product1, 15)

        self.assertEqual(self.product1.qty_at_date, 5)
        self.assertEqual(self.product1.stock_value, 50)

        valuation_layers = (move1 + move2 + move3).mapped('stock_valuation_layer_ids')
        self.assertEqual(len(valuation_layers), 3)
        # `remaining_qty` is not used in standard
        for valuation_layer in valuation_layers:
            self.assertEqual(valuation_layer.remaining_qty, 0)

    def test_automated_1(self):
        """ Similar than `test_manual_1` but in perpetual valuation.
        """
        self.product1.product_tmpl_id.categ_id.property_valuation = 'real_time'

        move1 = self._make_in_move(self.product1, 10)
        move2 = self._make_in_move(self.product1, 10)
        move3 = self._make_out_move(self.product1, 15)

        self.assertEqual(self.product1.qty_at_date, 5)
        self.assertEqual(self.product1.stock_value, 50)

        valuation_layers = (move1 + move2 + move3).mapped('stock_valuation_layer_ids')
        self.assertEqual(len(valuation_layers), 3)
        # `remaining_qty` is not used in standard
        for valuation_layer in valuation_layers:
            self.assertEqual(valuation_layer.remaining_qty, 0)
        import pudb; pudb.set_trace()
