# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase


class TestCommissionsCommon(TransactionCase):
    def setUp(self):
        super(TestCommissionsCommon, self).setUp()

        self.company = self.env.user.company_id

        self.account_type_receivable = self.env['account.account.type'].create({
            'name': 'receivable',
            'type': 'receivable'
        })

        self.account_receivable = self.env['account.account'].create({
            'name': 'Ian Anderson',
            'code': 'IA',
            'user_type_id': self.account_type_receivable.id,
            'company_id': self.company.id,
            'reconcile': True
        })

        self.account_sale = self.env['account.account'].create({
            'code': 'SERV-2020',
            'name': 'Product Sales - (test)',
            'reconcile': True,
            'user_type_id': self.env.ref('account.data_account_type_revenue').id,
        })

        self.categ = self.env['product.category'].create({
            'name': 'software',
        })

        self.simple_version = self.env['product.product'].create({
            'name': 'Simple Version',
            'categ_id': self.categ.id,
            'property_account_income_id': self.account_sale.id,
        })

        self.better_version = self.env['product.product'].create({
            'name': 'Better Version',
            'categ_id': self.categ.id,
            'property_account_income_id': self.account_sale.id,
        })

        self.ultimate_version = self.env['product.product'].create({
            'name': 'Ultimate Version',
            'categ_id': self.categ.id,
            'property_account_income_id': self.account_sale.id,
        })

        self.gold = self.env['res.partner.grade'].create({
            'name': 'Gold',
            'commission_ids': [
                (0, 0, {
                    'rate': 15.0,
                    'product_ids': [
                        (4, self.simple_version.product_tmpl_id.id, 0),
                    ],
                })
            ]
        })

        self.platinum = self.env['res.partner.grade'].create({
            'name': 'Platinum',
            'commission_ids': [
                (0, 0, {
                    'rate': 20.0,
                    'product_ids': [
                        (4, self.simple_version.product_tmpl_id.id, 0),
                    ],
                }),
                (0, 0, {
                    'rate': 15.0,
                    'product_ids': [
                        (4, self.better_version.product_tmpl_id.id, 0),
                    ]
                })
            ]
        })

        self.partner_gold = self.env['res.partner'].create({
            'name': 'Partner Gold',
            'grade_id': self.gold.id,
            'supplier': True,
            'customer': False,
            'company_id': self.company.id,
            'property_account_receivable_id': self.account_receivable.id,
            'property_account_payable_id': self.account_receivable.id,
        })

        self.partner_platinum = self.env['res.partner'].create({
            'name': 'Partner Platinum',
            'grade_id': self.platinum.id,
            'supplier': True,
            'customer': False,
            'company_id': self.company.id,
            'property_account_receivable_id': self.account_receivable.id,
            'property_account_payable_id': self.account_receivable.id,
        })

        self.customer = self.env['res.partner'].create({
            'name': 'Customer',
            'property_account_receivable_id': self.account_receivable.id,
            'property_account_payable_id': self.account_receivable.id,
            'company_id': self.company.id,
            'customer': True,
        })

        self.bank_account = self.env['account.journal'].create({
            'name': 'Test journal',
            'code': 'TEST',
            'type': 'bank',
        })


class TestCommissions(TestCommissionsCommon):

    def test_retrocession(self):
        """
            Testing the retrocession mechanism
        """
        sale_order = self.env['sale.order'].create({
            'name': 'Selling a Simple Version with retrocession',
            'partner_id': self.customer.id,
            'partner_invoice_id': self.customer.id,
            'partner_shipping_id': self.customer.id,
            'reseller_id': self.partner_gold.id,
            'commission_rate': 10,
            'order_line': [
                (0, 0, {
                    'name': 'Simple Version 1X price=100',
                    'product_id': self.simple_version.id,
                    'price_unit': 100.0,
                    'product_uom_qty': 1,
                }),
            ],
        })

        # SO Flow
        sale_order.action_confirm()
        invoice = self.env['account.invoice'].browse(sale_order._create_invoices())

        self.assertEqual(invoice.reseller_id, self.partner_gold, 'Reseller should have been forwarded to invoice')
        self.assertEqual(invoice.commission_rate, 10, 'Commission Rate should have been forwarded to invoice')
        self.assertEqual(invoice.amount_untaxed, 100.0, 'Amount untaxed should be of 100')

        # Invoice Flow
        invoice.action_invoice_open()
        invoice.pay_and_reconcile(self.bank_account, invoice.amount_total)

        purchase_order = self.env['purchase.order'].search([('partner_id', '=', self.partner_gold.id)], limit=1)

        self.assertEqual(purchase_order.partner_id, self.partner_gold, 'There should be a purchase order for the reseller')

        self.assertEqual(purchase_order.amount_total, 10.0, 'The amount on the purchase order should be 10.0 because of retrocession')

    def test_commissions(self):
        """
            Testing the commission base mechanism
        """
        sale_order = self.env['sale.order'].create({
            'name': 'Selling a Simple Version',
            'partner_id': self.customer.id,
            'partner_invoice_id': self.customer.id,
            'partner_shipping_id': self.customer.id,
            'reseller_id': self.partner_gold.id,
            'order_line': [
                (0, 0, {
                    'name': 'Simple Version 1X price=100',
                    'product_id': self.simple_version.id,
                    'price_unit': 100.0,
                    'product_uom_qty': 1,
                }),
            ],
        })

        # SO Flow
        sale_order.action_confirm()
        invoice = self.env['account.invoice'].browse(sale_order._create_invoices())

        self.assertEqual(invoice.reseller_id, self.partner_gold, 'Reseller should have been forwarded to invoice')
        self.assertEqual(invoice.amount_untaxed, 100.0, 'Amount untaxed should be of 100')

        # Invoice Flow
        invoice.action_invoice_open()
        invoice.pay_and_reconcile(self.bank_account, invoice.amount_total)

        purchase_order = self.env['purchase.order'].search([('partner_id', '=', self.partner_gold.id)], limit=1)

        self.assertEqual(purchase_order.partner_id, self.partner_gold, 'There should be a purchase order for the reseller')

        self.assertEqual(purchase_order.amount_total, 15.0, 'The amount on the purchase order should be 15')

    def test_multiple_commissions(self):
        """
            Testing with multiple products, some that have commissions, some that don't have
            the mechanism should create only one line in the final purchase order containing the
            sum of the commissions due on the invoice.

            When reconciled in multiple steps, purchase order should be created on the first call and lines
            should not be created afterwards
        """
        sale_order = self.env['sale.order'].create({
            'name': 'Selling a Simple and an Better version',
            'partner_id': self.customer.id,
            'partner_invoice_id': self.customer.id,
            'partner_shipping_id': self.customer.id,
            'reseller_id': self.partner_platinum.id,
            'order_line': [
                (0, 0, {
                    'name': 'Simple Version 1X price=100',
                    'product_id': self.simple_version.id,
                    'price_unit': 100.0,
                    'product_uom_qty': 1,
                }),
                (0, 0, {
                    'name': 'Better Version 2X price=200',
                    'product_id': self.better_version.id,
                    'price_unit': 200.0,
                    'product_uom_qty': 2,
                }),
                (0, 0, {
                    'name': 'Ultimate version 1X price=400',
                    'product_id': self.ultimate_version.id,
                    'price_unit': 400.0,
                    'product_uom_qty': 1,
                })
            ],
        })

        # SO Flow
        sale_order.action_confirm()
        invoice = self.env['account.invoice'].browse(sale_order._create_invoices())

        self.assertEqual(invoice.reseller_id, self.partner_platinum, 'Reseller should have been forwarded to invoice')
        self.assertEqual(invoice.amount_untaxed, 900.0, 'Amount untaxed should be of 900')

        # Invoice Flow
        invoice.action_invoice_open()
        # Paying only the simple version first
        invoice.pay_and_reconcile(self.bank_account, 100.0)

        purchase_order = self.env['purchase.order'].search([('partner_id', '=', self.partner_platinum.id)], limit=1)

        self.assertEqual(purchase_order.partner_id, self.partner_platinum, 'There should be a purchase order for the reseller')

        # Paying the better versions
        invoice.pay_and_reconcile(self.bank_account, 400.0)
        # Paying the ultimate version
        invoice.pay_and_reconcile(self.bank_account, 400.0)

        self.assertEqual(len(purchase_order.order_line), 1, 'There should be only one line in the purchase order')
        self.assertEqual(purchase_order.amount_total, 80.0, 'The amount on the purchase order should be 80')

    def test_multiple_invoices(self):
        """
            If multiple invoices are made for the same reseller, we should update the same
            purchase order until it is confirmed at which point we create a new one.
        """
        sale_order = self.env['sale.order'].create({
            'name': 'Selling a Better Version',
            'partner_id': self.customer.id,
            'partner_invoice_id': self.customer.id,
            'partner_shipping_id': self.customer.id,
            'reseller_id': self.partner_gold.id,
            'order_line': [
                (0, 0, {
                    'name': 'Better Version 1X price=200',
                    'product_id': self.better_version.id,
                    'price_unit': 200.0,
                    'product_uom_qty': 1,
                }),
            ],
        })

        # SO Flow
        sale_order.action_confirm()
        invoice = self.env['account.invoice'].browse(sale_order._create_invoices())

        self.assertEqual(invoice.reseller_id, self.partner_gold, 'Reseller should have been forwarded to invoice')
        self.assertEqual(invoice.amount_untaxed, 200.0, 'Amount untaxed should be of 200')

        # Invoice Flow
        invoice.action_invoice_open()
        invoice.pay_and_reconcile(self.bank_account, invoice.amount_total)

        purchase_order = self.env['purchase.order'].search([('partner_id', '=', self.partner_gold.id)], limit=1)

        self.assertEqual(purchase_order, self.env['purchase.order'], 'There should be no purchase order')

        sale_order = self.env['sale.order'].create({
            'name': 'Selling a Simple Version',
            'partner_id': self.customer.id,
            'partner_invoice_id': self.customer.id,
            'partner_shipping_id': self.customer.id,
            'reseller_id': self.partner_gold.id,
            'order_line': [
                (0, 0, {
                    'name': 'Simple Version 1X price=100',
                    'product_id': self.simple_version.id,
                    'price_unit': 100.0,
                    'product_uom_qty': 1,
                }),
            ],
        })

        # SO Flow
        sale_order.action_confirm()
        invoice = self.env['account.invoice'].browse(sale_order._create_invoices())

        self.assertEqual(invoice.reseller_id, self.partner_gold, 'Reseller should have been forwarded to invoice')
        self.assertEqual(invoice.amount_untaxed, 100.0, 'Amount untaxed should be of 100')

        # Invoice Flow
        invoice.action_invoice_open()
        invoice.pay_and_reconcile(self.bank_account, invoice.amount_total)

        purchase_order = self.env['purchase.order'].search([('partner_id', '=', self.partner_gold.id)], limit=1)

        self.assertEqual(purchase_order.partner_id, self.partner_gold, 'There should be a purchase order for the reseller')
        self.assertEqual(len(purchase_order.order_line), 1, 'Only one line')
        self.assertEqual(purchase_order.amount_total, 15.0, 'The amount should be 15')

        sale_order = self.env['sale.order'].create({
            'name': 'Selling a Simple Version',
            'partner_id': self.customer.id,
            'partner_invoice_id': self.customer.id,
            'partner_shipping_id': self.customer.id,
            'reseller_id': self.partner_gold.id,
            'order_line': [
                (0, 0, {
                    'name': 'Simple Version 10X price=100',
                    'product_id': self.simple_version.id,
                    'price_unit': 100.0,
                    'product_uom_qty': 10,
                }),
            ],
        })

        # SO Flow
        sale_order.action_confirm()
        invoice = self.env['account.invoice'].browse(sale_order._create_invoices())

        self.assertEqual(invoice.reseller_id, self.partner_gold, 'Reseller should have been forwarded to invoice')
        self.assertEqual(invoice.amount_untaxed, 1000.0, 'Amount untaxed should be of 1000')

        # Invoice Flow
        invoice.action_invoice_open()
        invoice.pay_and_reconcile(self.bank_account, invoice.amount_total)

        self.assertEqual(purchase_order.partner_id, self.partner_gold, 'There should be a purchase order for the reseller')
        self.assertEqual(len(purchase_order.order_line), 2, 'Two lines')
        self.assertEqual(purchase_order.amount_total, 165.0, 'The amount should be 165')

        self.assertEqual(len(self.env['purchase.order'].search([('partner_id', '=', self.partner_gold.id)])), 1, 'There should be only one purchase order for partner gold')
        purchase_order.button_done()

        sale_order = self.env['sale.order'].create({
            'name': 'Selling a Simple Version',
            'partner_id': self.customer.id,
            'partner_invoice_id': self.customer.id,
            'partner_shipping_id': self.customer.id,
            'reseller_id': self.partner_gold.id,
            'order_line': [
                (0, 0, {
                    'name': 'Simple Version 1X price=100',
                    'product_id': self.simple_version.id,
                    'price_unit': 100.0,
                    'product_uom_qty': 1,
                }),
            ],
        })

        # SO Flow
        sale_order.action_confirm()
        invoice = self.env['account.invoice'].browse(sale_order._create_invoices())

        self.assertEqual(invoice.reseller_id, self.partner_gold, 'Reseller should have been forwarded to invoice')
        self.assertEqual(invoice.amount_untaxed, 100.0, 'Amount untaxed should be of 100')

        # Invoice Flow
        invoice.action_invoice_open()
        invoice.pay_and_reconcile(self.bank_account, invoice.amount_total)

        purchase_order = self.env['purchase.order'].search([('partner_id', '=', self.partner_gold.id)], limit=1)

        self.assertEqual(purchase_order.partner_id, self.partner_gold, 'There should be a purchase order for the reseller')
        self.assertEqual(len(purchase_order.order_line), 1, 'Only one line')
        self.assertEqual(purchase_order.amount_total, 15.0, 'The amount should be 15')

        self.assertEqual(len(self.env['purchase.order'].search([('partner_id', '=', self.partner_gold.id)])), 2, 'There should be two purchase orders for partner gold')

    def test_refund_invoice(self):
        sale_order = self.env['sale.order'].create({
            'name': 'Selling a Simple Version',
            'partner_id': self.customer.id,
            'partner_invoice_id': self.customer.id,
            'partner_shipping_id': self.customer.id,
            'reseller_id': self.partner_gold.id,
            'order_line': [
                (0, 0, {
                    'name': 'Simple Version 1X price=100',
                    'product_id': self.simple_version.id,
                    'price_unit': 100.0,
                    'product_uom_qty': 1,
                }),
            ],
        })

        # SO Flow
        sale_order.action_confirm()
        invoice = self.env['account.invoice'].browse(sale_order._create_invoices())

        # Invoice Flow
        invoice.action_invoice_open()
        invoice.pay_and_reconcile(self.bank_account, invoice.amount_total)

        # Refund Flow
        credit_note_wizard = self.env['account.invoice.refund'].with_context({'active_ids': [invoice.id], 'active_id': invoice.id}).create({
            'filter_refund': 'refund',
            'description': 'Refund for %s' % sale_order.display_name,
        })

        credit_note_wizard.invoice_refund()

        invoice_refund = sale_order.invoice_ids.sorted(key=lambda inv: inv.id, reverse=False)[-1]

        # Validate the refund
        invoice_refund.action_invoice_open()
        invoice_refund.pay_and_reconcile(self.bank_account, invoice_refund.amount_total)

        # Check if purchase order line has been created
        purchase_order = self.env['purchase.order'].search([('partner_id', '=', self.partner_gold.id)], limit=1)

        self.assertEqual(len(purchase_order.order_line), 2, 'There should be two order lines when refunded')

        self.assertEqual(purchase_order.amount_total, 0, 'The total on the purchase order should be of 0')
        self.assertEqual(purchase_order.order_line.mapped('price_total'), [15, -15], 'The prices on the lines should be of 15 and -15')
