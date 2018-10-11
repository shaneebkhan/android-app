# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase


class TestRobustness(TransactionCase):
    # TODO add test when something is already cancelled ; when is it the case?
    # TODO add test when product_qty of finished product is > 1
    # TODO: test next activities?
    # TODO: test qty decrease

    def setUp(self):
        super(TestRobustness, self).setUp()

        stock_location = self.env.ref('stock.stock_location_stock')
        self.comp1 = self.env['product.product'].create({
            'name': 'Component 1',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        self.env['stock.quant']._update_available_quantity(self.comp1, stock_location, 10.0)

        self.comp2 = self.env['product.product'].create({
            'name': 'Component 2',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        self.env['stock.quant']._update_available_quantity(self.comp2, stock_location, 10.0)

        self.finished = self.env['product.product'].create({
            'name': 'Finished',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })

        self.bom = self.env['mrp.bom'].create({
            'product_id': self.finished.id,
            'product_tmpl_id': self.finished.product_tmpl_id.id,
            'product_uom_id': self.env.ref('uom.product_uom_unit').id,
            'product_qty': 1.0,
            'type': 'normal',
            'bom_line_ids': [
                (0, 0, {'product_id': self.comp1.id, 'product_qty': 1}),
                (0, 0, {'product_id': self.comp2.id, 'product_qty': 1})
            ],
        })

        self.opened_mo = self.env['mrp.production'].create({
            'name': 'mo for finished',
            'product_id': self.finished.id,
            'product_uom_id': self.finished.uom_id.id,
            'product_qty': 1,
            'bom_id': self.bom.id,
        })

    def test_increase_qty_to_produce_increase_factor_1(self):
        """ On a reserved manufacturing order, before producing anything:
            - update the bom to increase the factor on one of the components
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Update the original BOM, increase the factor of `self.comp1`
        self.bom.bom_line_ids.filtered(lambda bl: bl.product_id.id == self.comp1.id).product_qty = 2

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.product_qty = 2
        change_product_qty_wiz.change_prod_qty()

        # Check that the new factor isn't applied, if it was one of the `product_qty` would be 3.0.
        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.quantity_done, 0)
        self.assertEqual(self.opened_mo.move_finished_ids.product_uom_qty, 2)

    def test_increase_qty_to_produce_increase_factor_2(self):
        """ On a reserved manufacturing order
            - produce
            - update the bom to increase the factor on one of the components
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Produce
        produce_wizard = self.env['mrp.product.produce'].with_context({
            'active_id': self.opened_mo.id,
            'active_ids': [self.opened_mo.id],
        }).create({})
        produce_wizard.product_qty = 1
        produce_wizard.do_produce()

        # Update the original BOM, increase the factor of `self.comp1`
        self.bom.bom_line_ids.filtered(lambda bl: bl.product_id.id == self.comp1.id).product_qty = 2

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.product_qty = 2
        change_product_qty_wiz.change_prod_qty()

        # Check that the new factor isn't applied, if it was one of the `product_qty` would be 3.0.
        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.quantity_done, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.product_uom_qty, 2)

    def test_increase_qty_to_produce_increase_factor_3(self):
        """ On a reserved manufacturing order
            - produce
            - post the production
            - update the bom to increase the factor on one of the components
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Produce
        produce_wizard = self.env['mrp.product.produce'].with_context({
            'active_id': self.opened_mo.id,
            'active_ids': [self.opened_mo.id],
        }).create({})
        produce_wizard.product_qty = 1
        produce_wizard.do_produce()

        # post the production
        self.opened_mo.post_inventory()

        # Update the original BOM, increase the factor of `self.comp1`
        self.bom.bom_line_ids.filtered(lambda bl: bl.product_id.id == self.comp1.id).product_qty = 2

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.product_qty = 2
        change_product_qty_wiz.change_prod_qty()

        # Check that the new factor isn't applied, if it was one of the `product_qty` would be 3.0.
        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state == 'done').quantity_done, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state == 'done').product_qty, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state != 'done').quantity_done, 0)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state != 'done').product_qty, 1)

    def test_increase_qty_to_produce_decrease_factor_1(self):
        """ On a reserved manufacturing order, before producing anything:
            - update the bom to decrease the factor on one of the components
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Update the original BOM, decrease the factor of `self.comp1`
        self.bom.bom_line_ids.filtered(lambda bl: bl.product_id.id == self.comp1.id).product_qty = 0

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.product_qty = 2
        change_product_qty_wiz.change_prod_qty()

        # Check that the new factor isn't applied, if it was one of the `product_qty` would be 3.0.
        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.quantity_done, 0)
        self.assertEqual(self.opened_mo.move_finished_ids.product_uom_qty, 2)

    def test_increase_qty_to_produce_decrease_factor_2(self):
        """ On a reserved manufacturing order
            - produce
            - update the bom to decrease the factor on one of the components
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Produce
        produce_wizard = self.env['mrp.product.produce'].with_context({
            'active_id': self.opened_mo.id,
            'active_ids': [self.opened_mo.id],
        }).create({})
        produce_wizard.product_qty = 1
        produce_wizard.do_produce()

        # Update the original BOM, decrease the factor of `self.comp1`
        self.bom.bom_line_ids.filtered(lambda bl: bl.product_id.id == self.comp1.id).product_qty = 0

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.product_qty = 2
        change_product_qty_wiz.change_prod_qty()

        # Check that the new factor isn't applied, if it was one of the `product_qty` would be 3.0.
        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.quantity_done, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.product_uom_qty, 2)

    def test_increase_qty_to_produce_decrease_factor_3(self):
        """ On a reserved manufacturing order
            - produce
            - post the production
            - update the bom to decrease the factor on one of the components
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Produce
        produce_wizard = self.env['mrp.product.produce'].with_context({
            'active_id': self.opened_mo.id,
            'active_ids': [self.opened_mo.id],
        }).create({})
        produce_wizard.product_qty = 1
        produce_wizard.do_produce()

        # post the production
        self.opened_mo.post_inventory()

        # Update the original BOM, decrease the factor of `self.comp1`
        self.bom.bom_line_ids.filtered(lambda bl: bl.product_id.id == self.comp1.id).product_qty = 0

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.product_qty = 2
        change_product_qty_wiz.change_prod_qty()

        # Check that the new factor isn't applied, if it was one of the `product_qty` would be 3.0.
        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state == 'done').quantity_done, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state == 'done').product_qty, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state != 'done').quantity_done, 0)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state != 'done').product_qty, 1)

    def test_increase_qty_to_produce_add_component_1(self):
        """ On a reserved manufacturing order, before producing anything:
            - update the bom to add a new component
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Update the original BOM, add `self.comp3` as component.
        comp3 = self.env['product.product'].create({
            'name': 'Component 3',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        self.env['mrp.bom.line'].create({
            'bom_id': self.bom.id,
            'product_qty': 1,
            'product_id': comp3.id,
        })

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.product_qty = 2
        change_product_qty_wiz.change_prod_qty()

        self.assertEqual(len(self.opened_mo.move_raw_ids), 2)
        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.quantity_done, 0)
        self.assertEqual(self.opened_mo.move_finished_ids.product_uom_qty, 2)

    def test_increase_qty_to_produce_add_component_2(self):
        """ On a reserved manufacturing order
            - produce
            - update the bom to add a new component
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Produce
        produce_wizard = self.env['mrp.product.produce'].with_context({
            'active_id': self.opened_mo.id,
            'active_ids': [self.opened_mo.id],
        }).create({})
        produce_wizard.product_qty = 1
        produce_wizard.do_produce()

        # Update the original BOM, add `self.comp3` as component.
        comp3 = self.env['product.product'].create({
            'name': 'Component 3',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        self.env['mrp.bom.line'].create({
            'bom_id': self.bom.id,
            'product_qty': 1,
            'product_id': comp3.id,
        })

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.product_qty = 2
        change_product_qty_wiz.change_prod_qty()

        self.assertEqual(len(self.opened_mo.move_raw_ids), 2)
        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.quantity_done, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.product_uom_qty, 2)

    def test_increase_qty_to_produce_add_component_3(self):
        """ On a reserved manufacturing order
            - produce
            - post the production
            - update the bom to add a new component
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Produce
        produce_wizard = self.env['mrp.product.produce'].with_context({
            'active_id': self.opened_mo.id,
            'active_ids': [self.opened_mo.id],
        }).create({})
        produce_wizard.product_qty = 1
        produce_wizard.do_produce()

        # post the production
        self.opened_mo.post_inventory()

        # Update the original BOM, add `self.comp3` as component.
        comp3 = self.env['product.product'].create({
            'name': 'Component 3',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        self.env['mrp.bom.line'].create({
            'bom_id': self.bom.id,
            'product_qty': 1,
            'product_id': comp3.id,
        })

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.product_qty = 2
        change_product_qty_wiz.change_prod_qty()

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state == 'done').quantity_done, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state == 'done').product_qty, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state != 'done').quantity_done, 0)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state != 'done').product_qty, 1)

    def test_increase_qty_to_produce_remove_component_1(self):
        """ On a reserved manufacturing order, before producing anything:
            - update the bom to remove component
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Update the original BOM, remove `self.comp1` as component.
        self.bom.bom_line_ids.filtered(lambda bl: bl.product_id == self.comp1).unlink()

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.product_qty = 2
        change_product_qty_wiz.change_prod_qty()

        self.assertEqual(len(self.opened_mo.move_raw_ids), 2)
        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.quantity_done, 0)
        self.assertEqual(self.opened_mo.move_finished_ids.product_uom_qty, 2)

    def test_increase_qty_to_produce_remove_component_2(self):
        """ On a reserved manufacturing order
            - produce
            - update the bom to remove component
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Produce
        produce_wizard = self.env['mrp.product.produce'].with_context({
            'active_id': self.opened_mo.id,
            'active_ids': [self.opened_mo.id],
        }).create({})
        produce_wizard.product_qty = 1
        produce_wizard.do_produce()

        # Update the original BOM, remove `self.comp1` as component.
        self.bom.bom_line_ids.filtered(lambda bl: bl.product_id == self.comp1).unlink()

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.product_qty = 2
        change_product_qty_wiz.change_prod_qty()

        self.assertEqual(len(self.opened_mo.move_raw_ids), 2)
        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.quantity_done, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.product_uom_qty, 2)

    def test_increase_qty_to_produce_remove_component_3(self):
        """ On a reserved manufacturing order
            - produce
            - post the production
            - update the bom to remove component
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Produce
        produce_wizard = self.env['mrp.product.produce'].with_context({
            'active_id': self.opened_mo.id,
            'active_ids': [self.opened_mo.id],
        }).create({})
        produce_wizard._onchange_product_qty()
        produce_wizard.product_qty = 1
        produce_wizard.do_produce()

        # post the production
        self.opened_mo.post_inventory()

        # Update the original BOM, remove `self.comp1` as component.
        self.bom.bom_line_ids.filtered(lambda bl: bl.product_id == self.comp1).unlink()

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.change_prod_qty()
        change_product_qty_wiz.product_qty = 2

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state == 'done').quantity_done, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state == 'done').product_qty, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state != 'done').quantity_done, 0)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state != 'done').product_qty, 1)

    def test_increase_qty_to_produce_change_finished_1(self):
        """ On a reserved manufacturing order, before producing anything:
            - update the bom to change the finished product
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Update the original BOM, change the finished product
        finished2 = self.env['product.product'].create({
            'name': 'finished 2',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        self.bom.write({
            'product_id': finished2.id,
            'product_tmpl_id': finished2.product_tmpl_id.id,
        })

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.product_qty = 2
        change_product_qty_wiz.change_prod_qty()

        self.assertEqual(self.opened_mo.move_finished_ids.mapped('product_id'), self.finished)
        self.assertEqual(len(self.opened_mo.move_raw_ids), 2)
        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.quantity_done, 0)
        self.assertEqual(self.opened_mo.move_finished_ids.product_uom_qty, 2)

    def test_increase_qty_to_produce_change_finished_2(self):
        """ On a reserved manufacturing order
            - produce
            - update the bom to change the finished product
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Produce
        produce_wizard = self.env['mrp.product.produce'].with_context({
            'active_id': self.opened_mo.id,
            'active_ids': [self.opened_mo.id],
        }).create({})
        produce_wizard.product_qty = 1
        produce_wizard.do_produce()

        # Update the original BOM, change the finished product
        finished2 = self.env['product.product'].create({
            'name': 'finished 2',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        self.bom.write({
            'product_id': finished2.id,
            'product_tmpl_id': finished2.product_tmpl_id.id,
        })

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.product_qty = 2
        change_product_qty_wiz.change_prod_qty()

        self.assertEqual(self.opened_mo.move_finished_ids.mapped('product_id'), self.finished)
        self.assertEqual(len(self.opened_mo.move_raw_ids), 2)
        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.quantity_done, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.product_uom_qty, 2)

    def test_increase_qty_to_produce_change_finished_3(self):
        """ On a reserved manufacturing order
            - produce
            - post the production
            - update the bom to change the finished product
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Produce
        produce_wizard = self.env['mrp.product.produce'].with_context({
            'active_id': self.opened_mo.id,
            'active_ids': [self.opened_mo.id],
        }).create({})
        produce_wizard.product_qty = 1
        produce_wizard.do_produce()

        # post the production
        self.opened_mo.post_inventory()

        # Update the original BOM, change the finished product
        finished2 = self.env['product.product'].create({
            'name': 'finished 2',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        self.bom.write({
            'product_id': finished2.id,
            'product_tmpl_id': finished2.product_tmpl_id.id,
        })

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.product_qty = 2
        change_product_qty_wiz.change_prod_qty()

        self.assertEqual(self.opened_mo.move_finished_ids.mapped('product_id'), self.finished)
        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.mapped('product_id'), self.finished)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state == 'done').quantity_done, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state == 'done').product_qty, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state != 'done').quantity_done, 0)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state != 'done').product_qty, 1)

    def test_increase_qty_to_produce_change_finished_variant_1(self):
        """ On a reserved manufacturing order, before producing anything:
            - update the bom to change the finished product variant
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Update the original BOM, change the finished product
        variant2 = self.env['product.product'].create({
            'name': 'variant',
            'product_tmpl_id': self.finished.product_tmpl_id.id,
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        self.bom.write({
            'product_id': variant2.id,
        })

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.product_qty = 2
        change_product_qty_wiz.change_prod_qty()

        self.assertEqual(self.opened_mo.move_finished_ids.mapped('product_id'), self.finished)
        self.assertEqual(len(self.opened_mo.move_raw_ids), 2)
        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.quantity_done, 0)
        self.assertEqual(self.opened_mo.move_finished_ids.product_uom_qty, 2)

    def test_increase_qty_to_produce_change_finished_variant_2(self):
        """ On a reserved manufacturing order
            - produce
            - update the bom to change the finished product variant
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Produce
        produce_wizard = self.env['mrp.product.produce'].with_context({
            'active_id': self.opened_mo.id,
            'active_ids': [self.opened_mo.id],
        }).create({})
        produce_wizard.product_qty = 1
        produce_wizard.do_produce()

        # Update the original BOM, change the finished product
        finished2 = self.env['product.product'].create({
            'name': 'finished 2',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        self.bom.write({
            'product_id': finished2.id,
            'product_tmpl_id': finished2.product_tmpl_id.id,
        })

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.product_qty = 2
        change_product_qty_wiz.change_prod_qty()

        self.assertEqual(self.opened_mo.move_finished_ids.mapped('product_id'), self.finished)
        self.assertEqual(len(self.opened_mo.move_raw_ids), 2)
        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.quantity_done, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.product_uom_qty, 2)

    def test_increase_qty_to_produce_change_finished_variant_3(self):
        """ On a reserved manufacturing order
            - produce
            - post the production
            - update the bom to change the finished product variant
            - increase the quantity to produce
        We check that the update on the BOM was not reflected on the moves after the quantity to
        produce was changed.
        """
        self.opened_mo.action_assign()
        self.assertEqual(self.opened_mo.state, 'confirmed')
        self.assertEqual(self.opened_mo.availability, 'assigned')

        self.assertEqual(self.opened_mo.move_raw_ids.mapped('unit_factor'), [1.0, 1.0])

        # Produce
        produce_wizard = self.env['mrp.product.produce'].with_context({
            'active_id': self.opened_mo.id,
            'active_ids': [self.opened_mo.id],
        }).create({})
        produce_wizard.product_qty = 1
        produce_wizard.do_produce()

        # post the production
        self.opened_mo.post_inventory()

        # Update the original BOM, change the finished product
        variant2 = self.env['product.product'].create({
            'name': 'variant',
            'product_tmpl_id': self.finished.product_tmpl_id.id,
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        self.bom.write({
            'product_id': variant2.id,
        })

        # Now we change the quantity to produce to more
        change_product_qty_wiz = self.env['change.production.qty'].with_context({
            'active_model': 'mrp.production',
            'active_id': self.opened_mo.id,
        }).create({})
        change_product_qty_wiz.product_qty = 2
        change_product_qty_wiz.change_prod_qty()

        self.assertEqual(self.opened_mo.move_finished_ids.mapped('product_id'), self.finished)
        self.assertEqual(self.opened_mo.move_raw_ids.mapped('product_qty'), [2.0, 2.0])
        self.assertEqual(self.opened_mo.product_qty, 2)
        self.assertEqual(self.opened_mo.move_finished_ids.mapped('product_id'), self.finished)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state == 'done').quantity_done, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state == 'done').product_qty, 1)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state != 'done').quantity_done, 0)
        self.assertEqual(self.opened_mo.move_finished_ids.filtered(lambda m: m.state != 'done').product_qty, 1)

