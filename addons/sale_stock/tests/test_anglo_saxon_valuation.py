# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo.tests.common import SavepointCase
from odoo.exceptions import UserError


# TODO invoice more than delivered in partial delivery
# TODO invoice in two times
class TestAngloSaxonValuation(SavepointCase):
    @classmethod
    def setUpClass(cls):
        super(TestAngloSaxonValuation, cls).setUpClass()
        cls.env.user.company_id.anglo_saxon_accounting = True
        cls.product = cls.env['product.product'].create({
            'name': 'product',
            'type': 'product',
            'categ_id': cls.env.ref('product.product_category_all').id,
        })
        cls.stock_input_account = cls.env['account.account'].create({
            'name': 'Stock Input',
            'code': 'StockIn',
            'user_type_id': cls.env.ref('account.data_account_type_current_assets').id,
        })
        cls.stock_output_account = cls.env['account.account'].create({
            'name': 'Stock Output',
            'code': 'StockOut',
            'reconcile': True,
            'user_type_id': cls.env.ref('account.data_account_type_current_assets').id,
        })
        cls.stock_valuation_account = cls.env['account.account'].create({
            'name': 'Stock Valuation',
            'code': 'StockVal',
            'user_type_id': cls.env.ref('account.data_account_type_current_assets').id,
        })
        cls.expense_account = cls.env['account.account'].create({
            'name': 'Expense Account',
            'code': 'Exp',
            'user_type_id': cls.env.ref('account.data_account_type_expenses').id,
        })
        cls.income_account = cls.env['account.account'].create({
            'name': 'Income Account',
            'code': 'Inc',
            'user_type_id': cls.env.ref('account.data_account_type_expenses').id,
        })
        cls.stock_journal = cls.env['account.journal'].create({
            'name': 'Stock Journal',
            'code': 'STJTEST',
            'type': 'general',
        })
        cls.product.write({
            'property_account_expense_id': cls.expense_account.id,
            'property_account_income_id': cls.income_account.id,
        })
        cls.product.categ_id.write({
            'property_stock_account_input_categ_id': cls.stock_input_account.id,
            'property_stock_account_output_categ_id': cls.stock_output_account.id,
            'property_stock_valuation_account_id': cls.stock_valuation_account.id,
            'property_stock_journal': cls.stock_journal.id,
            'property_valuation': 'real_time',
        })
        cls.stock_location = cls.env['stock.warehouse'].search([], limit=1).lot_stock_id
        cls.recv_account = cls.env['account.account'].create({
            'name': 'account receivable',
            'code': 'RECV',
            'user_type_id': cls.env.ref('account.data_account_type_current_assets').id,
        })
        cls.pay_account = cls.env['account.account'].create({
            'name': 'account payable',
            'code': 'PAY',
            'user_type_id': cls.env.ref('account.data_account_type_current_assets').id,
        })
        cls.customer = cls.env['res.partner'].create({
            'name': 'customer',
            'property_account_receivable_id': cls.recv_account.id,
            'property_account_payable_id': cls.pay_account.id,
        })
        cls.journal_sale = cls.env['account.journal'].create({
            'name': 'Sale Journal - Test',
            'code': 'AJ-SALE',
            'type': 'sale',
            'company_id': cls.env.user.company_id.id,
        })

    # -------------------------------------------------------------------------
    # Standard Ordered
    # -------------------------------------------------------------------------
    def test_standard_ordered_invoice_pre_delivery(self):
        """ Standard price set to 10. Sale order 2@12. Invoice without delivering. """
        self.product.categ_id.property_cost_method = 'standard'
        self.product.invoice_policy = 'order'
        self.product.standard_price = 10

        # Put two items in stock.
        inventory = self.env['stock.inventory'].create({
            'name': 'test',
            'location_ids': [(4, self.stock_location.id)],
            'product_ids': [(4, self.product.id)],
        })
        inventory.action_start()
        self.env['stock.inventory.line'].create({
            'inventory_id': inventory.id,
            'location_id': self.stock_location.id,
            'product_id': self.product.id,
            'product_qty': 2,
        })
        inventory.action_validate()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Invoice the sale order.
        invoice_id = sale_order._create_invoices()
        invoice = self.env['account.invoice'].browse(invoice_id)
        invoice.action_invoice_open()

        # Check the resulting accounting entries
        amls = invoice.move_id.line_ids
        self.assertEqual(len(amls), 4)
        stock_out_aml = amls.filtered(lambda aml: aml.account_id == self.stock_output_account)
        self.assertEqual(stock_out_aml.debit, 0)
        self.assertEqual(stock_out_aml.credit, 20)
        cogs_aml = amls.filtered(lambda aml: aml.account_id == self.expense_account)
        self.assertEqual(cogs_aml.debit, 20)
        self.assertEqual(cogs_aml.credit, 0)
        receivable_aml = amls.filtered(lambda aml: aml.account_id == self.recv_account)
        self.assertEqual(receivable_aml.debit, 24)
        self.assertEqual(receivable_aml.credit, 0)
        income_aml = amls.filtered(lambda aml: aml.account_id == self.income_account)
        self.assertEqual(income_aml.debit, 0)
        self.assertEqual(income_aml.credit, 24)

    def test_standard_ordered_invoice_post_partial_delivery_1(self):
        """ Standard price set to 10. Sale order 2@12. Invoice 1 after delivering 1. """
        self.product.categ_id.property_cost_method = 'standard'
        self.product.invoice_policy = 'order'
        self.product.standard_price = 10

        # Put two items in stock.
        inventory = self.env['stock.inventory'].create({
            'name': 'test',
            'location_ids': [(4, self.stock_location.id)],
            'product_ids': [(4, self.product.id)],
        })
        inventory.action_start()
        self.env['stock.inventory.line'].create({
            'inventory_id': inventory.id,
            'location_id': self.stock_location.id,
            'product_id': self.product.id,
            'product_qty': 2,
        })
        inventory.action_validate()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Deliver one.
        sale_order.picking_ids.move_lines.quantity_done = 1
        wiz = sale_order.picking_ids.button_validate()
        wiz = self.env[wiz['res_model']].browse(wiz['res_id'])
        wiz.process()

        # Invoice the sale order.
        invoice_id = sale_order._create_invoices()
        invoice = self.env['account.invoice'].browse(invoice_id)
        invoice.action_invoice_open()

        # Check the resulting accounting entries
        amls = invoice.move_id.line_ids
        self.assertEqual(len(amls), 4)
        stock_out_aml = amls.filtered(lambda aml: aml.account_id == self.stock_output_account)
        self.assertEqual(stock_out_aml.debit, 0)
        self.assertEqual(stock_out_aml.credit, 20)
        cogs_aml = amls.filtered(lambda aml: aml.account_id == self.expense_account)
        self.assertEqual(cogs_aml.debit, 20)
        self.assertEqual(cogs_aml.credit, 0)
        receivable_aml = amls.filtered(lambda aml: aml.account_id == self.recv_account)
        self.assertEqual(receivable_aml.debit, 24)
        self.assertEqual(receivable_aml.credit, 0)
        income_aml = amls.filtered(lambda aml: aml.account_id == self.income_account)
        self.assertEqual(income_aml.debit, 0)
        self.assertEqual(income_aml.credit, 24)

    def test_standard_ordered_invoice_post_delivery(self):
        """ Standard price set to 10. Sale order 2@12. Invoice after full delivery. """
        self.product.categ_id.property_cost_method = 'standard'
        self.product.invoice_policy = 'order'
        self.product.standard_price = 10

        # Put two items in stock.
        inventory = self.env['stock.inventory'].create({
            'name': 'test',
            'location_ids': [(4, self.stock_location.id)],
            'product_ids': [(4, self.product.id)],
        })
        inventory.action_start()
        self.env['stock.inventory.line'].create({
            'inventory_id': inventory.id,
            'location_id': self.stock_location.id,
            'product_id': self.product.id,
            'product_qty': 2,
        })
        inventory.action_validate()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Deliver one.
        sale_order.picking_ids.move_lines.quantity_done = 2
        sale_order.picking_ids.button_validate()

        # Invoice the sale order.
        invoice_id = sale_order._create_invoices()
        invoice = self.env['account.invoice'].browse(invoice_id)
        invoice.action_invoice_open()

        # Check the resulting accounting entries
        amls = invoice.move_id.line_ids
        self.assertEqual(len(amls), 4)
        stock_out_aml = amls.filtered(lambda aml: aml.account_id == self.stock_output_account)
        self.assertEqual(stock_out_aml.debit, 0)
        self.assertEqual(stock_out_aml.credit, 20)
        cogs_aml = amls.filtered(lambda aml: aml.account_id == self.expense_account)
        self.assertEqual(cogs_aml.debit, 20)
        self.assertEqual(cogs_aml.credit, 0)
        receivable_aml = amls.filtered(lambda aml: aml.account_id == self.recv_account)
        self.assertEqual(receivable_aml.debit, 24)
        self.assertEqual(receivable_aml.credit, 0)
        income_aml = amls.filtered(lambda aml: aml.account_id == self.income_account)
        self.assertEqual(income_aml.debit, 0)
        self.assertEqual(income_aml.credit, 24)

    # -------------------------------------------------------------------------
    # Standard Delivered
    # -------------------------------------------------------------------------
    def test_standard_delivered_invoice_pre_delivery(self):
        """ Standard price set to 10. Sale order 2@12. Invoice without delivering. """
        self.product.categ_id.property_cost_method = 'standard'
        self.product.invoice_policy = 'delivery'
        self.product.standard_price = 10

        # Put two items in stock.
        inventory = self.env['stock.inventory'].create({
            'name': 'test',
            'location_ids': [(4, self.stock_location.id)],
            'product_ids': [(4, self.product.id)],
        })
        inventory.action_start()
        self.env['stock.inventory.line'].create({
            'inventory_id': inventory.id,
            'location_id': self.stock_location.id,
            'product_id': self.product.id,
            'product_qty': 2,
        })
        inventory.action_validate()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Invoice the sale order.
        # Nothing delivered = nothing to invoice.
        with self.assertRaises(UserError):
            invoice_id = sale_order._create_invoices()

    def test_standard_delivered_invoice_post_partial_delivery(self):
        """ Standard price set to 10. Sale order 2@12. Invoice after delivering 1. """
        self.product.categ_id.property_cost_method = 'standard'
        self.product.invoice_policy = 'delivery'
        self.product.standard_price = 10

        # Put two items in stock.
        inventory = self.env['stock.inventory'].create({
            'name': 'test',
            'location_ids': [(4, self.stock_location.id)],
            'product_ids': [(4, self.product.id)],
        })
        inventory.action_start()
        self.env['stock.inventory.line'].create({
            'inventory_id': inventory.id,
            'location_id': self.stock_location.id,
            'product_id': self.product.id,
            'product_qty': 2,
        })
        inventory.action_validate()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Deliver one.
        sale_order.picking_ids.move_lines.quantity_done = 1
        wiz = sale_order.picking_ids.button_validate()
        wiz = self.env[wiz['res_model']].browse(wiz['res_id'])
        wiz.process()

        # Invoice the sale order.
        invoice_id = sale_order._create_invoices()
        invoice = self.env['account.invoice'].browse(invoice_id)
        invoice.action_invoice_open()

        # Check the resulting accounting entries
        amls = invoice.move_id.line_ids
        self.assertEqual(len(amls), 4)
        stock_out_aml = amls.filtered(lambda aml: aml.account_id == self.stock_output_account)
        self.assertEqual(stock_out_aml.debit, 0)
        self.assertEqual(stock_out_aml.credit, 10)
        cogs_aml = amls.filtered(lambda aml: aml.account_id == self.expense_account)
        self.assertEqual(cogs_aml.debit, 10)
        self.assertEqual(cogs_aml.credit, 0)
        receivable_aml = amls.filtered(lambda aml: aml.account_id == self.recv_account)
        self.assertEqual(receivable_aml.debit, 12)
        self.assertEqual(receivable_aml.credit, 0)
        income_aml = amls.filtered(lambda aml: aml.account_id == self.income_account)
        self.assertEqual(income_aml.debit, 0)
        self.assertEqual(income_aml.credit, 12)

    def test_standard_delivered_invoice_post_delivery(self):
        """ Standard price set to 10. Sale order 2@12. Invoice after full delivery. """
        self.product.categ_id.property_cost_method = 'standard'
        self.product.invoice_policy = 'delivery'
        self.product.standard_price = 10

        # Put two items in stock.
        inventory = self.env['stock.inventory'].create({
            'name': 'test',
            'location_ids': [(4, self.stock_location.id)],
            'product_ids': [(4, self.product.id)],
        })
        inventory.action_start()
        self.env['stock.inventory.line'].create({
            'inventory_id': inventory.id,
            'location_id': self.stock_location.id,
            'product_id': self.product.id,
            'product_qty': 2,
        })
        inventory.action_validate()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Deliver one.
        sale_order.picking_ids.move_lines.quantity_done = 2
        sale_order.picking_ids.button_validate()

        # Invoice the sale order.
        invoice_id = sale_order._create_invoices()
        invoice = self.env['account.invoice'].browse(invoice_id)
        invoice.action_invoice_open()

        # Check the resulting accounting entries
        amls = invoice.move_id.line_ids
        self.assertEqual(len(amls), 4)
        stock_out_aml = amls.filtered(lambda aml: aml.account_id == self.stock_output_account)
        self.assertEqual(stock_out_aml.debit, 0)
        self.assertEqual(stock_out_aml.credit, 20)
        cogs_aml = amls.filtered(lambda aml: aml.account_id == self.expense_account)
        self.assertEqual(cogs_aml.debit, 20)
        self.assertEqual(cogs_aml.credit, 0)
        receivable_aml = amls.filtered(lambda aml: aml.account_id == self.recv_account)
        self.assertEqual(receivable_aml.debit, 24)
        self.assertEqual(receivable_aml.credit, 0)
        income_aml = amls.filtered(lambda aml: aml.account_id == self.income_account)
        self.assertEqual(income_aml.debit, 0)
        self.assertEqual(income_aml.credit, 24)

    # -------------------------------------------------------------------------
    # AVCO Ordered
    # -------------------------------------------------------------------------
    def test_avco_ordered_invoice_pre_delivery(self):
        """ Standard price set to 10. Sale order 2@12. Invoice without delivering. """
        self.product.categ_id.property_cost_method = 'average'
        self.product.invoice_policy = 'order'
        self.product.standard_price = 10

        # Put two items in stock.
        inventory = self.env['stock.inventory'].create({
            'name': 'test',
            'location_ids': [(4, self.stock_location.id)],
            'product_ids': [(4, self.product.id)],
        })
        inventory.action_start()
        self.env['stock.inventory.line'].create({
            'inventory_id': inventory.id,
            'location_id': self.stock_location.id,
            'product_id': self.product.id,
            'product_qty': 2,
        })
        inventory.action_validate()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Invoice the sale order.
        invoice_id = sale_order._create_invoices()
        invoice = self.env['account.invoice'].browse(invoice_id)
        invoice.action_invoice_open()

        # Check the resulting accounting entries
        amls = invoice.move_id.line_ids
        self.assertEqual(len(amls), 4)
        stock_out_aml = amls.filtered(lambda aml: aml.account_id == self.stock_output_account)
        self.assertEqual(stock_out_aml.debit, 0)
        self.assertEqual(stock_out_aml.credit, 20)
        cogs_aml = amls.filtered(lambda aml: aml.account_id == self.expense_account)
        self.assertEqual(cogs_aml.debit, 20)
        self.assertEqual(cogs_aml.credit, 0)
        receivable_aml = amls.filtered(lambda aml: aml.account_id == self.recv_account)
        self.assertEqual(receivable_aml.debit, 24)
        self.assertEqual(receivable_aml.credit, 0)
        income_aml = amls.filtered(lambda aml: aml.account_id == self.income_account)
        self.assertEqual(income_aml.debit, 0)
        self.assertEqual(income_aml.credit, 24)

    def test_avco_ordered_invoice_post_partial_delivery(self):
        """ Standard price set to 10. Sale order 2@12. Invoice after delivering 1. """
        self.product.categ_id.property_cost_method = 'average'
        self.product.invoice_policy = 'order'
        self.product.standard_price = 10

        # Put two items in stock.
        inventory = self.env['stock.inventory'].create({
            'name': 'test',
            'location_ids': [(4, self.stock_location.id)],
            'product_ids': [(4, self.product.id)],
        })
        inventory.action_start()
        self.env['stock.inventory.line'].create({
            'inventory_id': inventory.id,
            'location_id': self.stock_location.id,
            'product_id': self.product.id,
            'product_qty': 2,
        })
        inventory.action_validate()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Deliver one.
        sale_order.picking_ids.move_lines.quantity_done = 1
        wiz = sale_order.picking_ids.button_validate()
        wiz = self.env[wiz['res_model']].browse(wiz['res_id'])
        wiz.process()

        # Invoice the sale order.
        invoice_id = sale_order._create_invoices()
        invoice = self.env['account.invoice'].browse(invoice_id)
        invoice.action_invoice_open()

        # Check the resulting accounting entries
        amls = invoice.move_id.line_ids
        self.assertEqual(len(amls), 4)
        stock_out_aml = amls.filtered(lambda aml: aml.account_id == self.stock_output_account)
        self.assertEqual(stock_out_aml.debit, 0)
        self.assertEqual(stock_out_aml.credit, 20)
        cogs_aml = amls.filtered(lambda aml: aml.account_id == self.expense_account)
        self.assertEqual(cogs_aml.debit, 20)
        self.assertEqual(cogs_aml.credit, 0)
        receivable_aml = amls.filtered(lambda aml: aml.account_id == self.recv_account)
        self.assertEqual(receivable_aml.debit, 24)
        self.assertEqual(receivable_aml.credit, 0)
        income_aml = amls.filtered(lambda aml: aml.account_id == self.income_account)
        self.assertEqual(income_aml.debit, 0)
        self.assertEqual(income_aml.credit, 24)

    def test_avco_ordered_invoice_post_delivery(self):
        """ Standard price set to 10. Sale order 2@12. Invoice after full delivery. """
        self.product.categ_id.property_cost_method = 'average'
        self.product.invoice_policy = 'order'
        self.product.standard_price = 10

        # Put two items in stock.
        inventory = self.env['stock.inventory'].create({
            'name': 'test',
            'location_ids': [(4, self.stock_location.id)],
            'product_ids': [(4, self.product.id)],
        })
        inventory.action_start()
        self.env['stock.inventory.line'].create({
            'inventory_id': inventory.id,
            'location_id': self.stock_location.id,
            'product_id': self.product.id,
            'product_qty': 2,
        })
        inventory.action_validate()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Deliver one.
        sale_order.picking_ids.move_lines.quantity_done = 2
        sale_order.picking_ids.button_validate()

        # Invoice the sale order.
        invoice_id = sale_order._create_invoices()
        invoice = self.env['account.invoice'].browse(invoice_id)
        invoice.action_invoice_open()

        # Check the resulting accounting entries
        amls = invoice.move_id.line_ids
        self.assertEqual(len(amls), 4)
        stock_out_aml = amls.filtered(lambda aml: aml.account_id == self.stock_output_account)
        self.assertEqual(stock_out_aml.debit, 0)
        self.assertEqual(stock_out_aml.credit, 20)
        cogs_aml = amls.filtered(lambda aml: aml.account_id == self.expense_account)
        self.assertEqual(cogs_aml.debit, 20)
        self.assertEqual(cogs_aml.credit, 0)
        receivable_aml = amls.filtered(lambda aml: aml.account_id == self.recv_account)
        self.assertEqual(receivable_aml.debit, 24)
        self.assertEqual(receivable_aml.credit, 0)
        income_aml = amls.filtered(lambda aml: aml.account_id == self.income_account)
        self.assertEqual(income_aml.debit, 0)
        self.assertEqual(income_aml.credit, 24)

    # -------------------------------------------------------------------------
    # AVCO Delivered
    # -------------------------------------------------------------------------
    def test_avco_delivered_invoice_pre_delivery(self):
        """ Standard price set to 10. Sale order 2@12. Invoice without delivering. """
        self.product.categ_id.property_cost_method = 'average'
        self.product.invoice_policy = 'delivery'
        self.product.standard_price = 10

        # Put two items in stock.
        inventory = self.env['stock.inventory'].create({
            'name': 'test',
            'location_ids': [(4, self.stock_location.id)],
            'product_ids': [(4, self.product.id)],
        })
        inventory.action_start()
        self.env['stock.inventory.line'].create({
            'inventory_id': inventory.id,
            'location_id': self.stock_location.id,
            'product_id': self.product.id,
            'product_qty': 2,
        })
        inventory.action_validate()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Invoice the sale order.
        # Nothing delivered = nothing to invoice.
        with self.assertRaises(UserError):
            invoice_id = sale_order._create_invoices()

    def test_avco_delivered_invoice_post_partial_delivery(self):
        """ Standard price set to 10. Sale order 2@12. Invoice after delivering 1. """
        self.product.categ_id.property_cost_method = 'average'
        self.product.invoice_policy = 'delivery'
        self.product.standard_price = 10

        # Put two items in stock.
        inventory = self.env['stock.inventory'].create({
            'name': 'test',
            'location_ids': [(4, self.stock_location.id)],
            'product_ids': [(4, self.product.id)],
        })
        inventory.action_start()
        self.env['stock.inventory.line'].create({
            'inventory_id': inventory.id,
            'location_id': self.stock_location.id,
            'product_id': self.product.id,
            'product_qty': 2,
        })
        inventory.action_validate()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Deliver one.
        sale_order.picking_ids.move_lines.quantity_done = 1
        wiz = sale_order.picking_ids.button_validate()
        wiz = self.env[wiz['res_model']].browse(wiz['res_id'])
        wiz.process()

        # Invoice the sale order.
        invoice_id = sale_order._create_invoices()
        invoice = self.env['account.invoice'].browse(invoice_id)
        invoice.action_invoice_open()

        # Check the resulting accounting entries
        amls = invoice.move_id.line_ids
        self.assertEqual(len(amls), 4)
        stock_out_aml = amls.filtered(lambda aml: aml.account_id == self.stock_output_account)
        self.assertEqual(stock_out_aml.debit, 0)
        self.assertEqual(stock_out_aml.credit, 10)
        cogs_aml = amls.filtered(lambda aml: aml.account_id == self.expense_account)
        self.assertEqual(cogs_aml.debit, 10)
        self.assertEqual(cogs_aml.credit, 0)
        receivable_aml = amls.filtered(lambda aml: aml.account_id == self.recv_account)
        self.assertEqual(receivable_aml.debit, 12)
        self.assertEqual(receivable_aml.credit, 0)
        income_aml = amls.filtered(lambda aml: aml.account_id == self.income_account)
        self.assertEqual(income_aml.debit, 0)
        self.assertEqual(income_aml.credit, 12)

    def test_avco_delivered_invoice_post_delivery(self):
        """ Standard price set to 10. Sale order 2@12. Invoice after full delivery. """
        self.product.categ_id.property_cost_method = 'average'
        self.product.invoice_policy = 'delivery'
        self.product.standard_price = 10

        # Put two items in stock.
        inventory = self.env['stock.inventory'].create({
            'name': 'test',
            'location_ids': [(4, self.stock_location.id)],
            'product_ids': [(4, self.product.id)],
        })
        inventory.action_start()
        self.env['stock.inventory.line'].create({
            'inventory_id': inventory.id,
            'location_id': self.stock_location.id,
            'product_id': self.product.id,
            'product_qty': 2,
        })
        inventory.action_validate()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Deliver one.
        sale_order.picking_ids.move_lines.quantity_done = 2
        sale_order.picking_ids.button_validate()

        # Invoice the sale order.
        invoice_id = sale_order._create_invoices()
        invoice = self.env['account.invoice'].browse(invoice_id)
        invoice.action_invoice_open()

        # Check the resulting accounting entries
        amls = invoice.move_id.line_ids
        self.assertEqual(len(amls), 4)
        stock_out_aml = amls.filtered(lambda aml: aml.account_id == self.stock_output_account)
        self.assertEqual(stock_out_aml.debit, 0)
        self.assertEqual(stock_out_aml.credit, 20)
        cogs_aml = amls.filtered(lambda aml: aml.account_id == self.expense_account)
        self.assertEqual(cogs_aml.debit, 20)
        self.assertEqual(cogs_aml.credit, 0)
        receivable_aml = amls.filtered(lambda aml: aml.account_id == self.recv_account)
        self.assertEqual(receivable_aml.debit, 24)
        self.assertEqual(receivable_aml.credit, 0)
        income_aml = amls.filtered(lambda aml: aml.account_id == self.income_account)
        self.assertEqual(income_aml.debit, 0)
        self.assertEqual(income_aml.credit, 24)

    # -------------------------------------------------------------------------
    # FIFO Ordered
    # -------------------------------------------------------------------------
    def test_fifo_ordered_invoice_pre_delivery(self):
        """ Receive at 8 then at 10. Sale order 2@12. Invoice without delivering. """
        self.product.categ_id.property_cost_method = 'fifo'
        self.product.invoice_policy = 'order'

        # Put two items in stock.
        in_move_1 = self.env['stock.move'].create({
            'name': 'a',
            'product_id': self.product.id,
            'location_id': self.env.ref('stock.stock_location_suppliers').id,
            'location_dest_id': self.stock_location.id,
            'product_uom': self.product.uom_id.id,
            'product_uom_qty': 1,
            'price_unit': 8,
        })
        in_move_1._action_confirm()
        in_move_1.quantity_done = 1
        in_move_1._action_done()
        in_move_2 = self.env['stock.move'].create({
            'name': 'a',
            'product_id': self.product.id,
            'location_id': self.env.ref('stock.stock_location_suppliers').id,
            'location_dest_id': self.stock_location.id,
            'product_uom': self.product.uom_id.id,
            'product_uom_qty': 1,
            'price_unit': 10,
        })
        in_move_2._action_confirm()
        in_move_2.quantity_done = 1
        in_move_2._action_done()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Invoice the sale order.
        invoice_id = sale_order._create_invoices()
        invoice = self.env['account.invoice'].browse(invoice_id)
        invoice.action_invoice_open()

        # Check the resulting accounting entries
        amls = invoice.move_id.line_ids
        self.assertEqual(len(amls), 4)
        stock_out_aml = amls.filtered(lambda aml: aml.account_id == self.stock_output_account)
        self.assertEqual(stock_out_aml.debit, 0)
        self.assertEqual(stock_out_aml.credit, 0)
        cogs_aml = amls.filtered(lambda aml: aml.account_id == self.expense_account)
        self.assertEqual(cogs_aml.debit, 0)
        self.assertEqual(cogs_aml.credit, 0)
        receivable_aml = amls.filtered(lambda aml: aml.account_id == self.recv_account)
        self.assertEqual(receivable_aml.debit, 24)
        self.assertEqual(receivable_aml.credit, 0)
        income_aml = amls.filtered(lambda aml: aml.account_id == self.income_account)
        self.assertEqual(income_aml.debit, 0)
        self.assertEqual(income_aml.credit, 24)

    def test_ordered_invoice_post_partial_delivery(self):
        """ Receive at 8 then at 10. Sale order 2@12. Invoice without delivering. """
        self.product.categ_id.property_cost_method = 'fifo'
        self.product.invoice_policy = 'order'

        # Put two items in stock.
        in_move_1 = self.env['stock.move'].create({
            'name': 'a',
            'product_id': self.product.id,
            'location_id': self.env.ref('stock.stock_location_suppliers').id,
            'location_dest_id': self.stock_location.id,
            'product_uom': self.product.uom_id.id,
            'product_uom_qty': 1,
            'price_unit': 8,
        })
        in_move_1._action_confirm()
        in_move_1.quantity_done = 1
        in_move_1._action_done()
        in_move_2 = self.env['stock.move'].create({
            'name': 'a',
            'product_id': self.product.id,
            'location_id': self.env.ref('stock.stock_location_suppliers').id,
            'location_dest_id': self.stock_location.id,
            'product_uom': self.product.uom_id.id,
            'product_uom_qty': 1,
            'price_unit': 10,
        })
        in_move_2._action_confirm()
        in_move_2.quantity_done = 1
        in_move_2._action_done()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Deliver one.
        sale_order.picking_ids.move_lines.quantity_done = 1
        wiz = sale_order.picking_ids.button_validate()
        wiz = self.env[wiz['res_model']].browse(wiz['res_id'])
        wiz.process()

        # Invoice the sale order.
        invoice_id = sale_order._create_invoices()
        invoice = self.env['account.invoice'].browse(invoice_id)
        invoice.action_invoice_open()

        # Check the resulting accounting entries
        amls = invoice.move_id.line_ids
        self.assertEqual(len(amls), 4)
        stock_out_aml = amls.filtered(lambda aml: aml.account_id == self.stock_output_account)
        self.assertEqual(stock_out_aml.debit, 0)
        self.assertEqual(stock_out_aml.credit, 16)
        cogs_aml = amls.filtered(lambda aml: aml.account_id == self.expense_account)
        self.assertEqual(cogs_aml.debit, 16)
        self.assertEqual(cogs_aml.credit, 0)
        receivable_aml = amls.filtered(lambda aml: aml.account_id == self.recv_account)
        self.assertEqual(receivable_aml.debit, 24)
        self.assertEqual(receivable_aml.credit, 0)
        income_aml = amls.filtered(lambda aml: aml.account_id == self.income_account)
        self.assertEqual(income_aml.debit, 0)
        self.assertEqual(income_aml.credit, 24)

    def test_fifo_ordered_invoice_post_delivery(self):
        """ Receive at 8 then at 10. Sale order 2@12. Invoice without delivering. """
        self.product.categ_id.property_cost_method = 'fifo'
        self.product.invoice_policy = 'order'

        # Put two items in stock.
        in_move_1 = self.env['stock.move'].create({
            'name': 'a',
            'product_id': self.product.id,
            'location_id': self.env.ref('stock.stock_location_suppliers').id,
            'location_dest_id': self.stock_location.id,
            'product_uom': self.product.uom_id.id,
            'product_uom_qty': 1,
            'price_unit': 8,
        })
        in_move_1._action_confirm()
        in_move_1.quantity_done = 1
        in_move_1._action_done()
        in_move_2 = self.env['stock.move'].create({
            'name': 'a',
            'product_id': self.product.id,
            'location_id': self.env.ref('stock.stock_location_suppliers').id,
            'location_dest_id': self.stock_location.id,
            'product_uom': self.product.uom_id.id,
            'product_uom_qty': 1,
            'price_unit': 10,
        })
        in_move_2._action_confirm()
        in_move_2.quantity_done = 1
        in_move_2._action_done()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Deliver one.
        sale_order.picking_ids.move_lines.quantity_done = 2
        sale_order.picking_ids.button_validate()

        # Invoice the sale order.
        invoice_id = sale_order._create_invoices()
        invoice = self.env['account.invoice'].browse(invoice_id)
        invoice.action_invoice_open()

        # Check the resulting accounting entries
        amls = invoice.move_id.line_ids
        self.assertEqual(len(amls), 4)
        stock_out_aml = amls.filtered(lambda aml: aml.account_id == self.stock_output_account)
        self.assertEqual(stock_out_aml.debit, 0)
        self.assertEqual(stock_out_aml.credit, 18)
        cogs_aml = amls.filtered(lambda aml: aml.account_id == self.expense_account)
        self.assertEqual(cogs_aml.debit, 18)
        self.assertEqual(cogs_aml.credit, 0)
        receivable_aml = amls.filtered(lambda aml: aml.account_id == self.recv_account)
        self.assertEqual(receivable_aml.debit, 24)
        self.assertEqual(receivable_aml.credit, 0)
        income_aml = amls.filtered(lambda aml: aml.account_id == self.income_account)
        self.assertEqual(income_aml.debit, 0)
        self.assertEqual(income_aml.credit, 24)

    # -------------------------------------------------------------------------
    # FIFO Delivered
    # -------------------------------------------------------------------------
    def test_fifo_delivered_invoice_pre_delivery(self):
        """ Standard price set to 10. Sale order 2@12. Invoice without delivering. """
        self.product.categ_id.property_cost_method = 'fifo'
        self.product.invoice_policy = 'delivery'
        self.product.standard_price = 10

        # Put two items in stock.
        in_move_1 = self.env['stock.move'].create({
            'name': 'a',
            'product_id': self.product.id,
            'location_id': self.env.ref('stock.stock_location_suppliers').id,
            'location_dest_id': self.stock_location.id,
            'product_uom': self.product.uom_id.id,
            'product_uom_qty': 1,
            'price_unit': 8,
        })
        in_move_1._action_confirm()
        in_move_1.quantity_done = 1
        in_move_1._action_done()
        in_move_2 = self.env['stock.move'].create({
            'name': 'a',
            'product_id': self.product.id,
            'location_id': self.env.ref('stock.stock_location_suppliers').id,
            'location_dest_id': self.stock_location.id,
            'product_uom': self.product.uom_id.id,
            'product_uom_qty': 1,
            'price_unit': 10,
        })
        in_move_2._action_confirm()
        in_move_2.quantity_done = 1
        in_move_2._action_done()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Invoice the sale order.
        # Nothing delivered = nothing to invoice.
        with self.assertRaises(UserError):
            invoice_id = sale_order._create_invoices()

    def test_fifo_delivered_invoice_post_partial_delivery(self):
        """ Standard price set to 10. Sale order 2@12. Invoice after delivering 1. """
        self.product.categ_id.property_cost_method = 'fifo'
        self.product.invoice_policy = 'delivery'
        self.product.standard_price = 10

        # Put two items in stock.
        in_move_1 = self.env['stock.move'].create({
            'name': 'a',
            'product_id': self.product.id,
            'location_id': self.env.ref('stock.stock_location_suppliers').id,
            'location_dest_id': self.stock_location.id,
            'product_uom': self.product.uom_id.id,
            'product_uom_qty': 1,
            'price_unit': 8,
        })
        in_move_1._action_confirm()
        in_move_1.quantity_done = 1
        in_move_1._action_done()
        in_move_2 = self.env['stock.move'].create({
            'name': 'a',
            'product_id': self.product.id,
            'location_id': self.env.ref('stock.stock_location_suppliers').id,
            'location_dest_id': self.stock_location.id,
            'product_uom': self.product.uom_id.id,
            'product_uom_qty': 1,
            'price_unit': 10,
        })
        in_move_2._action_confirm()
        in_move_2.quantity_done = 1
        in_move_2._action_done()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Deliver one.
        sale_order.picking_ids.move_lines.quantity_done = 1
        wiz = sale_order.picking_ids.button_validate()
        wiz = self.env[wiz['res_model']].browse(wiz['res_id'])
        wiz.process()

        # Invoice the sale order.
        invoice_id = sale_order._create_invoices()
        invoice = self.env['account.invoice'].browse(invoice_id)
        invoice.action_invoice_open()

        # Check the resulting accounting entries
        amls = invoice.move_id.line_ids
        self.assertEqual(len(amls), 4)
        stock_out_aml = amls.filtered(lambda aml: aml.account_id == self.stock_output_account)
        self.assertEqual(stock_out_aml.debit, 0)
        self.assertEqual(stock_out_aml.credit, 8)
        cogs_aml = amls.filtered(lambda aml: aml.account_id == self.expense_account)
        self.assertEqual(cogs_aml.debit, 8)
        self.assertEqual(cogs_aml.credit, 0)
        receivable_aml = amls.filtered(lambda aml: aml.account_id == self.recv_account)
        self.assertEqual(receivable_aml.debit, 12)
        self.assertEqual(receivable_aml.credit, 0)
        income_aml = amls.filtered(lambda aml: aml.account_id == self.income_account)
        self.assertEqual(income_aml.debit, 0)
        self.assertEqual(income_aml.credit, 12)

        # !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        sale_order.picking_ids[0].move_lines.quantity_done = 1
        sale_order.picking_ids[0].button_validate()
        invoice_id = sale_order._create_invoices()
        invoice2 = self.env['account.invoice'].browse(invoice_id)
        invoice2.action_invoice_open()
        amls = invoice2.move_id.line_ids
        self.assertEqual(len(amls), 4)
        stock_out_aml = amls.filtered(lambda aml: aml.account_id == self.stock_output_account)
        self.assertEqual(stock_out_aml.debit, 0)
        self.assertEqual(stock_out_aml.credit, 10)
        cogs_aml = amls.filtered(lambda aml: aml.account_id == self.expense_account)
        self.assertEqual(cogs_aml.debit, 10)
        self.assertEqual(cogs_aml.credit, 0)
        receivable_aml = amls.filtered(lambda aml: aml.account_id == self.recv_account)
        self.assertEqual(receivable_aml.debit, 12)
        self.assertEqual(receivable_aml.credit, 0)
        income_aml = amls.filtered(lambda aml: aml.account_id == self.income_account)
        self.assertEqual(income_aml.debit, 0)
        self.assertEqual(income_aml.credit, 12)

    def test_fifo_delivered_invoice_post_delivery(self):
        """ Standard price set to 10. Sale order 2@12. Invoice after full delivery. """
        self.product.categ_id.property_cost_method = 'fifo'
        self.product.invoice_policy = 'delivery'
        self.product.standard_price = 10

        # Put two items in stock.
        in_move_1 = self.env['stock.move'].create({
            'name': 'a',
            'product_id': self.product.id,
            'location_id': self.env.ref('stock.stock_location_suppliers').id,
            'location_dest_id': self.stock_location.id,
            'product_uom': self.product.uom_id.id,
            'product_uom_qty': 1,
            'price_unit': 8,
        })
        in_move_1._action_confirm()
        in_move_1.quantity_done = 1
        in_move_1._action_done()
        in_move_2 = self.env['stock.move'].create({
            'name': 'a',
            'product_id': self.product.id,
            'location_id': self.env.ref('stock.stock_location_suppliers').id,
            'location_dest_id': self.stock_location.id,
            'product_uom': self.product.uom_id.id,
            'product_uom_qty': 1,
            'price_unit': 10,
        })
        in_move_2._action_confirm()
        in_move_2.quantity_done = 1
        in_move_2._action_done()

        # Create and confirm a sale order for 2@12
        sale_order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'order_line': [
                (0, 0, {
                    'name': self.product.name,
                    'product_id': self.product.id,
                    'product_uom_qty': 2.0,
                    'product_uom': self.product.uom_id.id,
                    'price_unit': 12,
                })],
        })
        sale_order.action_confirm()

        # Deliver one.
        sale_order.picking_ids.move_lines.quantity_done = 2
        sale_order.picking_ids.button_validate()

        # Invoice the sale order.
        invoice_id = sale_order._create_invoices()
        invoice = self.env['account.invoice'].browse(invoice_id)
        invoice.action_invoice_open()

        # Check the resulting accounting entries
        amls = invoice.move_id.line_ids
        self.assertEqual(len(amls), 4)
        stock_out_aml = amls.filtered(lambda aml: aml.account_id == self.stock_output_account)
        self.assertEqual(stock_out_aml.debit, 0)
        self.assertEqual(stock_out_aml.credit, 18)
        cogs_aml = amls.filtered(lambda aml: aml.account_id == self.expense_account)
        self.assertEqual(cogs_aml.debit, 18)
        self.assertEqual(cogs_aml.credit, 0)
        receivable_aml = amls.filtered(lambda aml: aml.account_id == self.recv_account)
        self.assertEqual(receivable_aml.debit, 24)
        self.assertEqual(receivable_aml.credit, 0)
        income_aml = amls.filtered(lambda aml: aml.account_id == self.income_account)
        self.assertEqual(income_aml.debit, 0)
        self.assertEqual(income_aml.credit, 24)
