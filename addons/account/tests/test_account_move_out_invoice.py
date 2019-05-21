# -*- coding: utf-8 -*-
from odoo.addons.account.tests.account_test_savepoint import AccountingSavepointCase
from odoo.tests.common import Form
from odoo.tests import tagged
from odoo.exceptions import ValidationError
from odoo import fields

import logging

_logger = logging.getLogger(__name__)


@tagged('post_install', '-at_install')
class TestAccountMoveOutInvoice(AccountingSavepointCase):

    @classmethod
    def setUpClass(cls):
        super(TestAccountMoveOutInvoice, cls).setUpClass()
        cls.invariants = {
            'out_invoice': {},
            'out_refund': {},
        }
        cls.invariants['out_invoice'] = {
            'line_product': {
                'name': 'product_a',
                'product_id': cls.product_a.id,
                'account_id': cls.parent_acc_revenue_1.id,
                'partner_id': cls.partner_a.id,
                'product_uom_id': cls.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1150.0,
                'tax_ids': cls.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'display_type': False,
                'date_maturity': False,
                'tax_exigible': True,
            },
            'line_balance': {
                'name': '/',
                'product_id': False,
                'account_id': cls.parent_acc_receivable_1.id,
                'partner_id': cls.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -1150.0,
                'price_subtotal': -1150.0,
                'price_total': -1150.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 1150.0,
                'credit': 0.0,
                'display_type': 'balance',
                'date_maturity': fields.Date.from_string('2019-01-01'),
                'tax_exigible': True,
            },
            'line_tax': {
                'name': cls.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': cls.parent_tax_sale_1.account_id.id,
                'partner_id': cls.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 150.0,
                'price_subtotal': 150.0,
                'price_total': 150.0,
                'tax_ids': [],
                'tax_line_id': cls.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 150.0,
                'display_type': 'tax',
                'date_maturity': False,
                'tax_exigible': True,
            },
            'move': {
                'partner_id': cls.partner_a.id,
                'currency_id': cls.company_parent.currency_id.id,
                'journal_id': cls.parent_journal_sale_1.id,
                'date': fields.Date.from_string('2019-01-01'),
                'fiscal_position_id': False,
                'invoice_payment_ref': '/',
                'invoice_payment_term_id': cls.pay_terms_immediate.id,
                'amount_untaxed': 1000.0,
                'amount_tax': 150.0,
                'amount_total': 1150.0,
                'amount_residual': 1150.0,
            },
        }
        cls.invariants['out_refund'] = {
            'line_product': {
                **cls.invariants['out_invoice']['line_product'],
                'debit': cls.invariants['out_invoice']['line_product']['credit'],
                'credit': cls.invariants['out_invoice']['line_product']['debit'],
            },
            'line_balance': {
                **cls.invariants['out_invoice']['line_balance'],
                'debit': cls.invariants['out_invoice']['line_balance']['credit'],
                'credit': cls.invariants['out_invoice']['line_balance']['debit'],
            },
            'line_tax': {
                **cls.invariants['out_invoice']['line_tax'],
                'account_id': cls.parent_tax_sale_1.refund_account_id.id,
                'debit': cls.invariants['out_invoice']['line_tax']['credit'],
                'credit': cls.invariants['out_invoice']['line_tax']['debit'],
            },
            'move': cls.invariants['out_invoice']['move'],
        }
        cls.move_types = [
            'out_invoice',
            'out_refund',
        ]

    # -------------------------------------------------------------------------
    # TESTS out_invoice and out_refund ONCHANGE
    # -------------------------------------------------------------------------

    def test_out_invoice_line_onchange_product_1(self):
        for move_type in self.move_types:
            operational_field = 'credit' if move_type == 'out_invoice' else 'debit'
            counterpart_field = 'debit' if move_type == 'out_invoice' else 'credit'

            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_a
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [self.invariants[move_type]['line_product']])
            self.assertAmlsValues(move.line_ids, [
                self.invariants[move_type]['line_balance'],
                self.invariants[move_type]['line_tax'],
                self.invariants[move_type]['line_product'],
            ])
            self.assertRecordValues(move, [self.invariants[move_type]['move']])

            # Change the product set on the line.
            move_form = Form(move)
            with move_form.invoice_line_ids.edit(0) as line_form:
                line_form.product_id = self.product_b
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'name': 'product_b',
                    'product_id': self.product_b.id,
                    'account_id': self.parent_acc_revenue_2.id,
                    'product_uom_id': self.uom_dozen.id,
                    'price_unit': 2000.0,
                    'price_subtotal': 2000.0,
                    'price_total': 2300.0,
                    'tax_ids': self.parent_tax_sale_2.ids,
                    operational_field: 2000.0,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -2300.0,
                    'price_subtotal': -2300.0,
                    'price_total': -2300.0,
                    counterpart_field: 2300.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'name': self.parent_tax_sale_2.name,
                    'account_id': self.parent_tax_sale_2.account_id.id if move_type == 'out_invoice' else self.parent_tax_sale_2.refund_account_id.id,
                    'price_unit': 300.0,
                    'price_subtotal': 300.0,
                    'price_total': 300.0,
                    'tax_line_id': self.parent_tax_sale_2.id,
                    operational_field: 300.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'name': 'product_b',
                    'product_id': self.product_b.id,
                    'account_id': self.parent_acc_revenue_2.id,
                    'product_uom_id': self.uom_dozen.id,
                    'price_unit': 2000.0,
                    'price_subtotal': 2000.0,
                    'price_total': 2300.0,
                    'tax_ids': self.parent_tax_sale_2.ids,
                    operational_field: 2000.0,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'amount_untaxed': 2000.0,
                'amount_tax': 300.0,
                'amount_total': 2300.0,
                'amount_residual': 2300.0,
            }])

    def test_out_invoice_line_onchange_account_1(self):
        for move_type in self.move_types:
            # One product line, custom account.
            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_a
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
                line_form.account_id = self.parent_acc_revenue_2
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'account_id': self.parent_acc_revenue_2.id,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                self.invariants[move_type]['line_balance'],
                self.invariants[move_type]['line_tax'],
                {
                    **self.invariants[move_type]['line_product'],
                    'account_id': self.parent_acc_revenue_2.id,
                },
            ])
            self.assertRecordValues(move, [self.invariants[move_type]['move']])

            # One product line, custom account from aml tab.
            move_form = Form(move)
            index_product_line, _ = self._search_candidate_records(move.line_ids, {'name': 'product_a'})
            with move_form.line_ids.edit(index_product_line) as line_form:
                line_form.account_id = self.parent_acc_revenue_1
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'account_id': self.parent_acc_revenue_1.id,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                self.invariants[move_type]['line_balance'],
                self.invariants[move_type]['line_tax'],
                {
                    **self.invariants[move_type]['line_product'],
                    'account_id': self.parent_acc_revenue_1.id,
                },
            ])
            self.assertRecordValues(move, [self.invariants[move_type]['move']])

    def test_out_invoice_line_onchange_quantity_1(self):
        for move_type in self.move_types:
            operational_field = 'credit' if move_type == 'out_invoice' else 'debit'
            counterpart_field = 'debit' if move_type == 'out_invoice' else 'credit'

            # One product line, custom quantity.
            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_a
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
                line_form.quantity = 2
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'quantity': 2.0,
                    'price_subtotal': 2000.0,
                    'price_total': 2300.0,
                    operational_field: 2000.0,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -2300.0,
                    'price_subtotal': -2300.0,
                    'price_total': -2300.0,
                    counterpart_field: 2300.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'price_unit': 300.0,
                    'price_subtotal': 300.0,
                    'price_total': 300.0,
                    operational_field: 300.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'quantity': 2.0,
                    'price_subtotal': 2000.0,
                    'price_total': 2300.0,
                    operational_field: 2000.0,
                }
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'amount_untaxed': 2000.0,
                'amount_tax': 300.0,
                'amount_total': 2300.0,
                'amount_residual': 2300.0,
            }])

    def test_out_invoice_line_onchange_quantity_2(self):
        for move_type in self.move_types:
            operational_field = 'credit' if move_type == 'out_invoice' else 'debit'
            counterpart_field = 'debit' if move_type == 'out_invoice' else 'credit'

            # One product line, custom quantity.
            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_a
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
                line_form.quantity = 0.0
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'quantity': 0.0,
                    'price_subtotal': 0.0,
                    'price_total': 0.0,
                    operational_field: 0.0,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': 0.0,
                    'price_subtotal': 0.0,
                    'price_total': 0.0,
                    counterpart_field: 0.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'price_unit': 0.0,
                    'price_subtotal': 0.0,
                    'price_total': 0.0,
                    operational_field: 0.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'quantity': 0.0,
                    'price_subtotal': 0.0,
                    'price_total': 0.0,
                    operational_field: 0.0,
                },

            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'amount_untaxed': 0.0,
                'amount_tax': 0.0,
                'amount_total': 0.0,
                'amount_residual': 0.0,
            }])

    def test_out_invoice_line_onchange_price_unit_1(self):
        for move_type in self.move_types:
            operational_field = 'credit' if move_type == 'out_invoice' else 'debit'
            counterpart_field = 'debit' if move_type == 'out_invoice' else 'credit'

            # One product line, custom price_unit.
            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_a
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
                line_form.price_unit = 2000
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'price_unit': 2000.0,
                    'price_subtotal': 2000.0,
                    'price_total': 2300.0,
                    operational_field: 2000.0,
                }
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -2300.0,
                    'price_subtotal': -2300.0,
                    'price_total': -2300.0,
                    counterpart_field: 2300.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'price_unit': 300.0,
                    'price_subtotal': 300.0,
                    'price_total': 300.0,
                    operational_field: 300.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'price_unit': 2000.0,
                    'price_subtotal': 2000.0,
                    'price_total': 2300.0,
                    operational_field: 2000.0,

                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'amount_untaxed': 2000.0,
                'amount_tax': 300.0,
                'amount_total': 2300.0,
                'amount_residual': 2300.0,
            }])

            # Edit balance, check impact to the price_unit.
            move_form = Form(move)
            index_product_line, _ = self._search_candidate_records(move.line_ids, {'name': 'product_a'})
            with move_form.line_ids.edit(index_product_line) as line_form:
                setattr(line_form, operational_field, 3000)
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'price_unit': 3000.0,
                    'price_subtotal': 3000.0,
                    'price_total': 3450.0,
                    operational_field: 3000.0,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -3450.0,
                    'price_subtotal': -3450.0,
                    'price_total': -3450.0,
                    counterpart_field: 3450.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'price_unit': 450.0,
                    'price_subtotal': 450.0,
                    'price_total': 450.0,
                    operational_field: 450.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'price_unit': 3000.0,
                    'price_subtotal': 3000.0,
                    'price_total': 3450.0,
                    operational_field: 3000.0,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'amount_untaxed': 3000.0,
                'amount_tax': 450.0,
                'amount_total': 3450.0,
                'amount_residual': 3450.0,
            }])

    def test_out_invoice_line_onchange_discount_1(self):
        for move_type in self.move_types:
            operational_field = 'credit' if move_type == 'out_invoice' else 'debit'
            counterpart_field = 'debit' if move_type == 'out_invoice' else 'credit'

            # One product line having 50% discount.
            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_a
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
                line_form.discount = 50.0
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'discount': 50.0,
                    'price_unit': 1000.0,
                    'price_subtotal': 500.0,
                    'price_total': 575.0,
                    operational_field: 500.0,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -575.0,
                    'price_subtotal': -575.0,
                    'price_total': -575.0,
                    counterpart_field: 575.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'price_unit': 75.0,
                    'price_subtotal': 75.0,
                    'price_total': 75.0,
                    operational_field: 75.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'discount': 50.0,
                    'price_unit': 1000.0,
                    'price_subtotal': 500.0,
                    'price_total': 575.0,
                    operational_field: 500.0,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'amount_untaxed': 500.0,
                'amount_tax': 75.0,
                'amount_total': 575.0,
                'amount_residual': 575.0,
            }])

            # One more product line having 100% discount.
            move_form = Form(move)
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
                line_form.discount = 100
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'discount': 100.0,
                    'price_unit': 1000.0,
                    'price_subtotal': 0.0,
                    'price_total': 0.0,
                    operational_field: 0.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'name': 'product_a',
                    'discount': 50.0,
                    'price_unit': 1000.0,
                    'price_subtotal': 500.0,
                    'price_total': 575.0,
                    operational_field: 500.0,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -575.0,
                    'price_subtotal': -575.0,
                    'price_total': -575.0,
                    counterpart_field: 575.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'price_unit': 75.0,
                    'price_subtotal': 75.0,
                    'price_total': 75.0,
                    operational_field: 75.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'discount': 100.0,
                    'price_unit': 1000.0,
                    'price_subtotal': 0.0,
                    'price_total': 0.0,
                    operational_field: 0.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'name': 'product_a',
                    'discount': 50.0,
                    'price_unit': 1000.0,
                    'price_subtotal': 500.0,
                    'price_total': 575.0,
                    operational_field: 500.0,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'amount_untaxed': 500.0,
                'amount_tax': 75.0,
                'amount_total': 575.0,
                'amount_residual': 575.0,
            }])

            move_form = Form(move)
            # Edit balance of line having 50% discount.
            index_50discount_line, _ = self._search_candidate_records(move.line_ids, {'discount': 50.0})
            with move_form.line_ids.edit(index_50discount_line) as line_form:
                setattr(line_form, operational_field, 1000)
            # Edit balance of line having 100% discount.
            index_100discount_line, _ = self._search_candidate_records(move.line_ids, {'discount': 100.0})
            with move_form.line_ids.edit(index_100discount_line) as line_form:
                setattr(line_form, operational_field, 2000)
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'discount': 50.0,
                    'price_unit': 2000.0,
                    'price_subtotal': 1000.0,
                    'price_total': 1150.0,
                    operational_field: 1000.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'price_unit': 2000.0,
                    'price_subtotal': 2000.0,
                    'price_total': 2300.0,
                    operational_field: 2000.0,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -3450.0,
                    'price_subtotal': -3450.0,
                    'price_total': -3450.0,
                    counterpart_field: 3450.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'price_unit': 450.0,
                    'price_subtotal': 450.0,
                    'price_total': 450.0,
                    operational_field: 450.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'discount': 50.0,
                    'price_unit': 2000.0,
                    'price_subtotal': 1000.0,
                    'price_total': 1150.0,
                    operational_field: 1000.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'price_unit': 2000.0,
                    'price_subtotal': 2000.0,
                    'price_total': 2300.0,
                    operational_field: 2000.0,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'amount_untaxed': 3000.0,
                'amount_tax': 450.0,
                'amount_total': 3450.0,
                'amount_residual': 3450.0,
            }])

    def test_out_invoice_line_onchange_uom_1(self):
        for move_type in self.move_types:
            operational_field = 'credit' if move_type == 'out_invoice' else 'debit'
            counterpart_field = 'debit' if move_type == 'out_invoice' else 'credit'

            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_a
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
                line_form.product_uom_id = self.uom_dozen
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'product_uom_id': self.uom_dozen.id,
                    'price_unit': 12000.0,
                    'price_subtotal': 12000.0,
                    'price_total': 13800.0,
                    operational_field: 12000.0,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -13800.0,
                    'price_subtotal': -13800.0,
                    'price_total': -13800.0,
                    counterpart_field: 13800.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'price_unit': 1800.0,
                    'price_subtotal': 1800.0,
                    'price_total': 1800.0,
                    operational_field: 1800.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'product_uom_id': self.uom_dozen.id,
                    'price_unit': 12000.0,
                    'price_subtotal': 12000.0,
                    'price_total': 13800.0,
                    operational_field: 12000.0,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'amount_untaxed': 12000.0,
                'amount_tax': 1800.0,
                'amount_total': 13800.0,
                'amount_residual': 13800.0,
            }])

    def test_out_invoice_line_onchange_taxes_1_stackable_amounts(self):
        for move_type in self.move_types:
            operational_field = 'credit' if move_type == 'out_invoice' else 'debit'
            counterpart_field = 'debit' if move_type == 'out_invoice' else 'credit'

            # One product line with two taxes: 15% tax + 15% tax.
            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_a
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
            move = move_form.save()
            move_form = Form(move)
            with move_form.invoice_line_ids.edit(0) as line_form:
                line_form.tax_ids.add(self.parent_tax_sale_2)
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'price_total': 1300.0,
                    'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -1300.0,
                    'price_subtotal': -1300.0,
                    'price_total': -1300.0,
                    counterpart_field: 1300.0,
                },
                self.invariants[move_type]['line_tax'],
                {
                    **self.invariants[move_type]['line_tax'],
                    'name': self.parent_tax_sale_2.name,
                    'tax_line_id': self.parent_tax_sale_2.id,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'price_total': 1300.0,
                    'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'amount_tax': 300.0,
                'amount_total': 1300.0,
                'amount_residual': 1300.0,
            }])

            # One more product line with two taxes: 15% tax + 15% tax.
            # Taxes must be grouped with existing lines.
            move_form = Form(move)
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
                line_form.name = 'product_a bis'
                line_form.price_unit = 2000
            move = move_form.save()
            move_form = Form(move)
            index_product_line, _ = self._search_candidate_records(move.invoice_line_ids, {'name': 'product_a bis'})
            with move_form.invoice_line_ids.edit(index_product_line) as line_form:
                line_form.tax_ids.add(self.parent_tax_sale_2)
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'price_total': 1300.0,
                    'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'name': 'product_a bis',
                    'price_unit': 2000.0,
                    'price_subtotal': 2000.0,
                    'price_total': 2600.0,
                    'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                    operational_field: 2000.0,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -3900.0,
                    'price_subtotal': -3900.0,
                    'price_total': -3900.0,
                    counterpart_field: 3900.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'price_unit': 450.0,
                    'price_subtotal': 450.0,
                    'price_total': 450.0,
                    'tax_line_id': self.parent_tax_sale_1.id,
                    operational_field: 450.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'name': self.parent_tax_sale_2.name,
                    'price_unit': 450.0,
                    'price_subtotal': 450.0,
                    'price_total': 450.0,
                    'tax_line_id': self.parent_tax_sale_2.id,
                    operational_field: 450.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'price_total': 1300.0,
                    'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'name': 'product_a bis',
                    'price_unit': 2000.0,
                    'price_subtotal': 2000.0,
                    'price_total': 2600.0,
                    'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                    operational_field: 2000.0,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'amount_untaxed': 3000.0,
                'amount_tax': 900.0,
                'amount_total': 3900.0,
                'amount_residual': 3900.0,
            }])

            # Edit tax line manually.
            # Taxes shouldn't be recomputed as the user is free to edit the taxes like he wants.
            move_form = Form(move)
            index_tax_line, _ = self._search_candidate_records(move.line_ids, {'tax_line_id': self.parent_tax_sale_1.id})
            with move_form.line_ids.edit(index_tax_line) as line_form:
                setattr(line_form, operational_field, 600)
            move = move_form.save()

            self.assertRecordValues(move.invoice_line_ids.sorted('credit'), [
                {
                    **self.invariants[move_type]['line_product'],
                    'price_total': 1300.0,
                    'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'name': 'product_a bis',
                    'price_unit': 2000.0,
                    'price_subtotal': 2000.0,
                    'price_total': 2600.0,
                    'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                    operational_field: 2000.0,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -4050.0,
                    'price_subtotal': -4050.0,
                    'price_total': -4050.0,
                    counterpart_field: 4050.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'price_unit': 600.0,
                    'price_subtotal': 600.0,
                    'price_total': 600.0,
                    operational_field: 600.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'name': self.parent_tax_sale_2.name,
                    'price_unit': 450.0,
                    'price_subtotal': 450.0,
                    'price_total': 450.0,
                    'tax_line_id': self.parent_tax_sale_2.id,
                    operational_field: 450.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'price_total': 1300.0,
                    'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'name': 'product_a bis',
                    'price_unit': 2000.0,
                    'price_subtotal': 2000.0,
                    'price_total': 2600.0,
                    'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                    operational_field: 2000.0,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'amount_untaxed': 3000.0,
                'amount_tax': 1050.0,
                'amount_total': 4050.0,
                'amount_residual': 4050.0,
            }])

            # Remove a tax line.
            # Taxes shouldn't be recomputed as the user is free to edit the taxes like he wants.
            move_form = Form(move)
            index_tax_line, _ = self._search_candidate_records(move.line_ids, {'tax_line_id': self.parent_tax_sale_2.id})
            move_form.line_ids.remove(index=index_tax_line)
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'price_total': 1300.0,
                    'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'name': 'product_a bis',
                    'price_unit': 2000.0,
                    'price_subtotal': 2000.0,
                    'price_total': 2600.0,
                    'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                    operational_field: 2000.0,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -3600.0,
                    'price_subtotal': -3600.0,
                    'price_total': -3600.0,
                    counterpart_field: 3600.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'price_unit': 600.0,
                    'price_subtotal': 600.0,
                    'price_total': 600.0,
                    operational_field: 600.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'price_total': 1300.0,
                    'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'name': 'product_a bis',
                    'price_unit': 2000.0,
                    'price_subtotal': 2000.0,
                    'price_total': 2600.0,
                    'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                    operational_field: 2000.0,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'amount_untaxed': 3000.0,
                'amount_tax': 600.0,
                'amount_total': 3600.0,
                'amount_residual': 3600.0,
            }])

            # Remove product line. Taxes are recomputed.
            move_form = Form(move)
            index_product_line, _ = self._search_candidate_records(move.invoice_line_ids, {operational_field: 2000.0})
            move_form.invoice_line_ids.remove(index=index_product_line)
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'price_total': 1300.0,
                    'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                    operational_field: 1000.0,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -1300.0,
                    'price_subtotal': -1300.0,
                    'price_total': -1300.0,
                    counterpart_field: 1300.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'price_unit': 150.0,
                    'price_subtotal': 150.0,
                    'price_total': 150.0,
                    operational_field: 150.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'name': self.parent_tax_sale_2.name,
                    'price_unit': 150.0,
                    'price_subtotal': 150.0,
                    'price_total': 150.0,
                    'tax_line_id': self.parent_tax_sale_2.id,
                    operational_field: 150.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'price_total': 1300.0,
                    'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                    operational_field: 1000.0,
                },

            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'amount_untaxed': 1000.0,
                'amount_tax': 300.0,
                'amount_total': 1300.0,
                'amount_residual': 1300.0,
            }])

    def test_out_invoice_line_onchange_taxes_2_price_include(self):
        for move_type in self.move_types:
            counterpart_field = 'debit' if move_type == 'out_invoice' else 'credit'

            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_a
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
                line_form.price_unit = 1150
                line_form.tax_ids.clear()
                line_form.tax_ids.add(self.parent_tax_sale_1_incl)
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'price_unit': 1150.0,
                    'price_total': 1150.0,
                    'tax_ids': self.parent_tax_sale_1_incl.ids,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -1150.0,
                    'price_subtotal': -1150.0,
                    'price_total': -1150.0,
                    counterpart_field: 1150.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'name': self.parent_tax_sale_1_incl.name,
                    'tax_line_id': self.parent_tax_sale_1_incl.id,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'price_unit': 1150.0,
                    'price_total': 1150.0,
                    'tax_ids': self.parent_tax_sale_1_incl.ids,
                },
            ])
            self.assertRecordValues(move, [self.invariants[move_type]['move']])

    def test_out_invoice_line_onchange_taxes_3_exigibility_on_payment(self):
        for move_type in self.move_types:

            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_a
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
                line_form.tax_ids.clear()
                line_form.tax_ids.add(self.parent_tax_sale_1_not_exigible)
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'tax_ids': self.parent_tax_sale_1_not_exigible.ids,
                    'tax_exigible': False,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                self.invariants[move_type]['line_balance'],
                {
                    **self.invariants[move_type]['line_tax'],
                    'name': self.parent_tax_sale_1_not_exigible.name,
                    'account_id': self.parent_tax_sale_1_not_exigible.account_id.id,
                    'tax_line_id': self.parent_tax_sale_1_not_exigible.id,
                    'tax_exigible': False,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'tax_ids': self.parent_tax_sale_1_not_exigible.ids,
                    'tax_exigible': False,
                },
            ])

            self.assertRecordValues(move, [self.invariants[move_type]['move']])

    def test_out_invoice_onchange_payment_term_1(self):
        for move_type in self.move_types:
            counterpart_field = 'debit' if move_type == 'out_invoice' else 'credit'

            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_a
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
            move_form.invoice_payment_term_id = self.pay_terms_advance
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [self.invariants[move_type]['line_product']])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -345.0,
                    'price_subtotal': -345.0,
                    'price_total': -345.0,
                    counterpart_field: 345.0,
                },
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -805.0,
                    'price_subtotal': -805.0,
                    'price_total': -805.0,
                    counterpart_field: 805.0,
                    'date_maturity': fields.Date.from_string('2019-02-28'),
                },
                self.invariants[move_type]['line_tax'],
                self.invariants[move_type]['line_product'],
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'invoice_payment_term_id': self.pay_terms_advance.id,
            }])

            # Set a custom name / account for payment term lines.
            move_form = Form(move)
            move_form.invoice_payment_ref = 'turlututu'
            index_pay_term_line, _ = self._search_candidate_records(move.line_ids, {'date_maturity': '2019-01-01'})
            with move_form.line_ids.edit(index_pay_term_line) as line_form:
                line_form.name = 'tsoin tsoin'
                line_form.account_id = self.parent_acc_receivable_2
            move = move_form.save()


            self.assertAmlsValues(move.invoice_line_ids, [self.invariants[move_type]['line_product']])

            self.assertAmlsValues(move.line_ids, [
                self.invariants[move_type]['line_tax'],
                self.invariants[move_type]['line_product'],
                {
                    **self.invariants[move_type]['line_balance'],
                    'name': 'tsoin tsoin',
                    'account_id': self.parent_acc_receivable_2.id,
                    'price_unit': -345.0,
                    'price_subtotal': -345.0,
                    'price_total': -345.0,
                    counterpart_field: 345.0,
                },
                {
                    **self.invariants[move_type]['line_balance'],
                    'name': 'turlututu',
                    'price_unit': -805.0,
                    'price_subtotal': -805.0,
                    'price_total': -805.0,
                    counterpart_field: 805.0,
                    'date_maturity': fields.Date.from_string('2019-02-28'),
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'invoice_payment_ref': 'tsoin tsoin',
                'invoice_payment_term_id': self.pay_terms_advance.id,
            }])

            # Set an immediate payment terms.
            move_form = Form(move)
            move_form.invoice_payment_term_id = self.pay_terms_immediate
            move = move_form.save()


            self.assertAmlsValues(move.invoice_line_ids, [self.invariants[move_type]['line_product']])

            self.assertAmlsValues(move.line_ids, [
                self.invariants[move_type]['line_tax'],
                self.invariants[move_type]['line_product'],
                {
                    **self.invariants[move_type]['line_balance'],
                    'name': 'tsoin tsoin',
                    'account_id': self.parent_acc_receivable_2.id,
                    'price_unit': -1150.0,
                    'price_subtotal': -1150.0,
                    'price_total': -1150.0,
                    counterpart_field: 1150.0,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'invoice_payment_ref': 'tsoin tsoin',
                'invoice_payment_term_id': self.pay_terms_immediate.id,
            }])

    def test_out_invoice_onchange_amls_1(self):
        for move_type in self.move_types:
            operational_field = 'credit' if move_type == 'out_invoice' else 'debit'
            counterpart_field = 'debit' if move_type == 'out_invoice' else 'credit'

            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_a
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
            with move_form.line_ids.new() as line_form:
                line_form.account_id = self.parent_acc_revenue_2
                setattr(line_form, counterpart_field, 500)
                line_form.tax_ids.add(self.parent_tax_sale_1)
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'name': False,
                    'product_id': False,
                    'product_uom_id': False,
                    'account_id': self.parent_acc_revenue_2.id,
                    'price_unit': -500.0,
                    'price_subtotal': -500.0,
                    'price_total': -575.0,
                    operational_field: 0,
                    counterpart_field: 500.0,
                },
                self.invariants[move_type]['line_product'],
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'name': False,
                    'product_id': False,
                    'product_uom_id': False,
                    'account_id': self.parent_acc_revenue_2.id,
                    'price_unit': -500.0,
                    'price_subtotal': -500.0,
                    'price_total': -575.0,
                    operational_field: 0,
                    counterpart_field: 500.0,

                },
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -575.0,
                    'price_subtotal': -575.0,
                    'price_total': -575.0,
                    counterpart_field: 575.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'price_unit': 75.0,
                    'price_subtotal': 75.0,
                    'price_total': 75.0,
                    operational_field: 75.0,
                },
                self.invariants[move_type]['line_product'],
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'amount_untaxed': 500.0,
                'amount_tax': 75.0,
                'amount_total': 575.0,
                'amount_residual': 575.0,
            }])

    def test_out_invoice_onchange_partner_1(self):
        for move_type in self.move_types:
            operational_field = 'credit' if move_type == 'out_invoice' else 'debit'
            counterpart_field = 'debit' if move_type == 'out_invoice' else 'credit'

            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_b
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'account_id': self.parent_acc_revenue_3.id,
                    'partner_id': self.partner_b.id,
                    'tax_ids': self.parent_tax_sale_3.ids,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'account_id': self.parent_acc_receivable_2.id,
                    'partner_id': self.partner_b.id,
                    'price_unit': -345.0,
                    'price_subtotal': -345.0,
                    'price_total': -345.0,
                    counterpart_field: 345.0,
                },
                {
                    **self.invariants[move_type]['line_balance'],
                    'account_id': self.parent_acc_receivable_2.id,
                    'partner_id': self.partner_b.id,
                    'price_unit': -805.0,
                    'price_subtotal': -805.0,
                    'price_total': -805.0,
                    counterpart_field: 805.0,
                    'date_maturity': fields.Date.from_string('2019-02-28'),
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'name': self.parent_tax_sale_3.name,
                    'partner_id': self.partner_b.id,
                    'price_unit': 150.0,
                    'price_subtotal': 150.0,
                    'price_total': 150.0,
                    'tax_line_id': self.parent_tax_sale_3.id,
                    operational_field: 150.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'account_id': self.parent_acc_revenue_3.id,
                    'partner_id': self.partner_b.id,
                    'tax_ids': self.parent_tax_sale_3.ids,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'partner_id': self.partner_b.id,
                'fiscal_position_id': self.parent_fp_1.id,
                'invoice_payment_ref': '/',
                'invoice_payment_term_id': self.pay_terms_advance.id,
            }])

    def test_out_invoice_onchange_fiscal_position_1_applied_after(self):
        for move_type in self.move_types:
            # Create a new invoice with a single product line.
            # The fiscal position is applied at the end so the accounts remains untouched.
            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_a
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
            move_form.fiscal_position_id = self.parent_fp_1
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [self.invariants[move_type]['line_product']])
            self.assertAmlsValues(move.line_ids, [
                self.invariants[move_type]['line_balance'],
                self.invariants[move_type]['line_tax'],
                self.invariants[move_type]['line_product'],
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'fiscal_position_id': self.parent_fp_1.id,
            }])

    def test_out_invoice_onchange_fiscal_position_2_applied_before(self):
        for move_type in self.move_types:
            # Create a new invoice with a single product line.
            # The fiscal position is applied at the beginning so the accounts/taxes are mapped.
            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_a
            move_form.fiscal_position_id = self.parent_fp_1
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'account_id': self.parent_acc_revenue_3.id,
                    'tax_ids': self.parent_tax_sale_3.ids,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                self.invariants[move_type]['line_balance'],
                {
                    **self.invariants[move_type]['line_tax'],
                    'name': self.parent_tax_sale_3.name,
                    'account_id': self.parent_tax_sale_3.account_id.id if move_type == 'out_invoice' else self.parent_tax_sale_3.refund_account_id.id,
                    'tax_line_id': self.parent_tax_sale_3.id,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'account_id': self.parent_acc_revenue_3.id,
                    'tax_ids': self.parent_tax_sale_3.ids,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'fiscal_position_id': self.parent_fp_1.id,
            }])

    def test_out_invoice_onchange_cash_rounding_1(self):
        for move_type in self.move_types:
            operational_field = 'credit' if move_type == 'out_invoice' else 'debit'
            counterpart_field = 'debit' if move_type == 'out_invoice' else 'credit'

            rounding_add_line = self.env['account.cash.rounding'].create({
                'name': 'add_invoice_line',
                'rounding': 0.05,
                'strategy': 'add_invoice_line',
                'account_id': self.parent_acc_revenue_2.id,
                'rounding_method': 'UP',
            })
            rounding_biggest_tax = self.env['account.cash.rounding'].create({
                'name': 'biggest_tax',
                'rounding': 0.05,
                'strategy': 'biggest_tax',
                'rounding_method': 'DOWN',
            })

            # Create the invoice with one line.
            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_a
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
                line_form.price_unit = 9.99
            move_form.invoice_cash_rounding_id = rounding_add_line
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'name': 'add_invoice_line',
                    'product_id': False,
                    'account_id': self.parent_acc_revenue_2.id,
                    'product_uom_id': False,
                    'price_unit': 0.01,
                    'price_subtotal': 0.01,
                    'price_total': 0.01,
                    'tax_ids': [],
                    operational_field: 0.01,
                    'display_type': 'product_cr',
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'price_unit': 9.99,
                    'price_subtotal': 9.99,
                    'price_total': 11.49,
                    operational_field: 9.99,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -11.50,
                    'price_subtotal': -11.50,
                    'price_total': -11.50,
                    counterpart_field: 11.50,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'price_unit': 1.5,
                    'price_subtotal': 1.5,
                    'price_total': 1.5,
                    operational_field: 1.5,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'name': 'add_invoice_line',
                    'product_id': False,
                    'product_uom_id': False,
                    'account_id': self.parent_acc_revenue_2.id,
                    'price_unit': 0.01,
                    'price_subtotal': 0.01,
                    'price_total': 0.01,
                    'tax_ids': [],
                    operational_field: 0.01,
                    'display_type': 'product_cr',

                },
                {
                    **self.invariants[move_type]['line_product'],
                    'price_unit': 9.99,
                    'price_subtotal': 9.99,
                    'price_total': 11.49,
                    operational_field: 9.99,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'invoice_cash_rounding_id': rounding_add_line.id,
                'amount_untaxed': 10.0,
                'amount_tax': 1.5,
                'amount_total': 11.5,
                'amount_residual': 11.5,
            }])

            # Change the cash rounding by the one affecting the biggest tax.
            move_form = Form(move)
            move_form.invoice_cash_rounding_id = rounding_biggest_tax
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'price_unit': 9.99,
                    'price_subtotal': 9.99,
                    'price_total': 11.49,
                    operational_field: 9.99,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -11.45,
                    'price_subtotal': -11.45,
                    'price_total': -11.45,
                    counterpart_field: 11.45,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'price_unit': 1.5,
                    'price_subtotal': 1.5,
                    'price_total': 1.5,
                    operational_field: 1.5,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'name': '%s (rounding)' % self.parent_tax_sale_1.name,
                    'price_unit': -0.04,
                    'price_subtotal': -0.04,
                    'price_total': -0.04,
                    operational_field: 0,
                    counterpart_field: 0.04,
                    'display_type': 'tax_cr',
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'price_unit': 9.99,
                    'price_subtotal': 9.99,
                    'price_total': 11.49,
                    operational_field: 9.99,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'invoice_cash_rounding_id': rounding_biggest_tax.id,
                'amount_untaxed': 9.99,
                'amount_tax': 1.46,
                'amount_total': 11.45,
                'amount_residual': 11.45,
            }])

    def test_out_invoice_onchange_journal_1(self):
        ''' Set a custom journal having a foreign currency. '''
        for move_type in self.move_types:
            operational_field = 'credit' if move_type == 'out_invoice' else 'debit'
            counterpart_field = 'debit' if move_type == 'out_invoice' else 'credit'

            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_a
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
            move_form.journal_id = self.parent_journal_sale_2
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'currency_id': self.gold_currency.id,
                    'amount_currency': -1000.0 if move_type == "out_invoice" else 1000.0,
                    operational_field: 500.0,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'currency_id': self.gold_currency.id,
                    'amount_currency': 1150.0 if move_type == "out_invoice" else -1150.0,
                    counterpart_field: 575.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'currency_id': self.gold_currency.id,
                    'amount_currency': -150.0 if move_type == "out_invoice" else 150.0,
                    operational_field: 75.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'currency_id': self.gold_currency.id,
                    'amount_currency': -1000.0 if move_type == "out_invoice" else 1000.0,
                    operational_field: 500.0,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'journal_id': self.parent_journal_sale_2.id,
                'currency_id': self.gold_currency.id,
            }])

            # Reset the journal to the default one and then, the default currency.
            move_form = Form(move)
            move_form.journal_id = self.parent_journal_sale_1
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [self.invariants[move_type]['line_product']])
            self.assertAmlsValues(move.line_ids, [
                self.invariants[move_type]['line_balance'],
                self.invariants[move_type]['line_tax'],
                self.invariants[move_type]['line_product'],
            ])
            self.assertRecordValues(move, [self.invariants[move_type]['move']])

    def test_out_invoice_onchange_currency_1(self):
        for move_type in self.move_types:
            operational_field = 'credit' if move_type == 'out_invoice' else 'debit'
            counterpart_field = 'debit' if move_type == 'out_invoice' else 'credit'

            # Create an invoice with a single product line.
            # Set a foreign currency at the end: the product price remains unchanged.
            move_form = Form(self.env['account.move'].with_context(default_type=move_type))
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            move_form.partner_id = self.partner_a
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
            move_form.currency_id = self.gold_currency
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'currency_id': self.gold_currency.id,
                    'amount_currency': -1000.0 if move_type == "out_invoice" else 1000.0,
                    operational_field: 500.0,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -1150.0,
                    'price_subtotal': -1150.0,
                    'price_total': -1150.0,
                    'currency_id': self.gold_currency.id,
                    'amount_currency': 1150.0 if move_type == "out_invoice" else -1150.0,
                    counterpart_field: 575.0,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'currency_id': self.gold_currency.id,
                    'amount_currency': -150.0 if move_type == "out_invoice" else 150.0,
                    operational_field: 75.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'currency_id': self.gold_currency.id,
                    'amount_currency': -1000.0 if move_type == "out_invoice" else 1000.0,
                    operational_field: 500.0,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'currency_id': self.gold_currency.id,
            }])

            # Change the date having a different currency rate.
            move_form = Form(move)
            move_form.invoice_date = fields.Date.from_string('2016-01-01')
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'currency_id': self.gold_currency.id,
                    'amount_currency': -1000.0 if move_type == "out_invoice" else 1000.0,
                    operational_field: 333.33,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'currency_id': self.gold_currency.id,
                    'amount_currency': 1150.0 if move_type == "out_invoice" else -1150.0,
                    counterpart_field: 383.33,
                    'date_maturity': fields.Date.from_string('2016-01-01'),
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'currency_id': self.gold_currency.id,
                    'amount_currency': -150.0 if move_type == "out_invoice" else 150.0,
                    counterpart_field: 0.0,
                    operational_field: 50.0,
                    'display_type': 'tax',
                    'date_maturity': False,
                    'tax_exigible': True,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'currency_id': self.gold_currency.id,
                    'amount_currency': -1000.0 if move_type == "out_invoice" else 1000.0,
                    operational_field: 333.33,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'currency_id': self.gold_currency.id,
                'date': fields.Date.from_string('2016-01-01'),
            }])

            # Create a new line. Standard price must be converted to the new currency.
            move_form = Form(move)
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
            move = move_form.save()

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'currency_id': self.gold_currency.id,
                    'amount_currency': -1000.0 if move_type == "out_invoice" else 1000.0,
                    operational_field: 333.33,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'price_unit': 3000.0,
                    'price_subtotal': 3000.0,
                    'price_total': 3450.0,
                    'currency_id': self.gold_currency.id,
                    'amount_currency': -3000.0 if move_type == "out_invoice" else 3000.0,
                    operational_field: 1000.0,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -4600.0,
                    'price_subtotal': -4600.0,
                    'price_total': -4600.0,
                    'currency_id': self.gold_currency.id,
                    'amount_currency': 4600.0 if move_type == "out_invoice" else -4600.0,
                    'date_maturity': fields.Date.from_string('2016-01-01'),
                    counterpart_field: 1533.33,
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'price_unit': 600.0,
                    'price_subtotal': 600.0,
                    'price_total': 600.0,
                    'currency_id': self.gold_currency.id,
                    'amount_currency': -600.0 if move_type == "out_invoice" else 600.0,
                    operational_field: 200.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'currency_id': self.gold_currency.id,
                    'amount_currency': -1000.0 if move_type == "out_invoice" else 1000.0,
                    operational_field: 333.33,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'price_unit': 3000.0,
                    'price_subtotal': 3000.0,
                    'price_total': 3450.0,
                    'currency_id': self.gold_currency.id,
                    'amount_currency': -3000.0 if move_type == "out_invoice" else 3000.0,
                    operational_field: 1000.0,
                },
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'date': fields.Date.from_string('2016-01-01'),
                'currency_id': self.gold_currency.id,
                'amount_untaxed': 4000.0,
                'amount_tax': 600.0,
                'amount_total': 4600.0,
                'amount_residual': 4600.0,
            }])

    # -------------------------------------------------------------------------
    # TESTS out_invoice and out_refund CREATE
    # -------------------------------------------------------------------------

    def test_out_invoice_create_invoice_line_ids_1_single_currency(self):
        for move_type in self.move_types:
            # Test creating an account_move with the least information.
            move = self.env['account.move'].create({
                'type': move_type,
                'partner_id': self.partner_a.id,
                'invoice_date': fields.Date.from_string('2019-01-01'),
                'invoice_line_ids': [(0, None, {
                    'partner_id': self.partner_a.id,
                    'product_id': self.product_a.id,
                    'product_uom_id': self.product_a.uom_id.id,
                    'name': self.product_a.name,
                    'price_unit': 1000.0,
                    'quantity': 1,
                    'tax_ids': [(6, 0, self.product_a.taxes_id.ids)],
                })]
            })

            self.assertAmlsValues(move.invoice_line_ids, [self.invariants[move_type]['line_product']])
            self.assertAmlsValues(move.line_ids, [
                self.invariants[move_type]['line_balance'],
                self.invariants[move_type]['line_tax'],
                self.invariants[move_type]['line_product'],
            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'invoice_payment_term_id': False,
            }])

    def test_out_invoice_create_invoice_line_ids_2_multi_currency(self):
        for move_type in self.move_types:
            operational_field = 'credit' if move_type == 'out_invoice' else 'debit'
            counterpart_field = 'debit' if move_type == 'out_invoice' else 'credit'

            # Test creating an account_move with the least information.
            move = self.env['account.move'].create({
                'type': move_type,
                'partner_id': self.partner_a.id,
                'invoice_date': fields.Date.from_string('2016-01-01'),
                'currency_id': self.gold_currency.id,
                'invoice_line_ids': [(0, None, {
                    'partner_id': self.partner_a.id,
                    'product_id': self.product_a.id,
                    'product_uom_id': self.product_a.uom_id.id,
                    'name': self.product_a.name,
                    'price_unit': 3000.0,
                    'quantity': 1,
                    'tax_ids': [(6, 0, self.product_a.taxes_id.ids)],
                })]
            })

            self.assertAmlsValues(move.invoice_line_ids, [
                {
                    **self.invariants[move_type]['line_product'],
                    'price_unit': 3000.0,
                    'price_subtotal': 3000.0,
                    'price_total': 3450.0,
                    'currency_id': self.gold_currency.id,
                    'amount_currency': -3000.0 if move_type == "out_invoice" else 3000.0,
                    operational_field: 1000.0,
                },
            ])
            self.assertAmlsValues(move.line_ids, [
                {
                    **self.invariants[move_type]['line_balance'],
                    'price_unit': -3450.0,
                    'price_subtotal': -3450.0,
                    'price_total': -3450.0,
                    'currency_id': self.gold_currency.id,
                    'amount_currency': 3450.0 if move_type == "out_invoice" else -3450.0,
                    counterpart_field: 1150.0,
                    'date_maturity': fields.Date.from_string('2016-01-01'),
                },
                {
                    **self.invariants[move_type]['line_tax'],
                    'price_unit': 450.0,
                    'price_subtotal': 450.0,
                    'price_total': 450.0,
                    'currency_id': self.gold_currency.id,
                    'amount_currency': -450.0 if move_type == "out_invoice" else 450.0,
                    operational_field: 150.0,
                },
                {
                    **self.invariants[move_type]['line_product'],
                    'price_unit': 3000.0,
                    'price_subtotal': 3000.0,
                    'price_total': 3450.0,
                    'currency_id': self.gold_currency.id,
                    'amount_currency': -3000.0 if move_type == "out_invoice" else 3000.0,
                    operational_field: 1000.0,
                },

            ])
            self.assertRecordValues(move, [{
                **self.invariants[move_type]['move'],
                'currency_id': self.gold_currency.id,
                'date': fields.Date.from_string('2016-01-01'),
                'invoice_payment_term_id': False,
                'amount_untaxed': 3000.0,
                'amount_tax': 450.0,
                'amount_total': 3450.0,
                'amount_residual': 3450.0,
            }])

    # -------------------------------------------------------------------------
    # TESTS out_invoice ONCHANGE
    # -------------------------------------------------------------------------

    def test_out_invoice_onchange_invoice_sequence_number_1(self):
        move_form = Form(self.env['account.move'].with_context(default_type='out_invoice'))
        move_form.invoice_date = fields.Date.from_string('2019-01-01')
        move_form.partner_id = self.partner_a
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
        move = move_form.save()

        self.assertRecordValues(move, [{
            'invoice_sequence_number_next': '0001',
            'invoice_sequence_number_next_prefix': 'INV/2019/',
        }])

        move_form = Form(move)
        move_form.invoice_sequence_number_next = '0042'
        move = move_form.save()

        self.assertRecordValues(move, [{
            'invoice_sequence_number_next': '0042',
            'invoice_sequence_number_next_prefix': 'INV/2019/',
        }])

        move.post()

        self.assertRecordValues(move, [{'name': 'INV/2019/0042'}])

        move_form = Form(self.env['account.move'].with_context(default_type='out_invoice'))
        move_form.invoice_date = fields.Date.from_string('2019-01-01')
        move_form.partner_id = self.partner_a
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
        move = move_form.save()
        move.post()

        self.assertRecordValues(move, [{'name': 'INV/2019/0043'}])

    # -------------------------------------------------------------------------
    # TESTS out_refund ONCHANGE
    # -------------------------------------------------------------------------

    def test_in_refund_onchange_invoice_sequence_number_1(self):
        move_form = Form(self.env['account.move'].with_context(default_type='in_refund'))
        move_form.invoice_date = fields.Date.from_string('2019-01-01')
        move_form.partner_id = self.partner_a
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
        move = move_form.save()

        self.assertRecordValues(move, [{
            'invoice_sequence_number_next': '0001',
            'invoice_sequence_number_next_prefix': 'BILL/2019/',
        }])

        move_form = Form(move)
        move_form.invoice_sequence_number_next = '0042'
        move = move_form.save()

        self.assertRecordValues(move, [{
            'invoice_sequence_number_next': '0042',
            'invoice_sequence_number_next_prefix': 'BILL/2019/',
        }])

        move.post()

        self.assertRecordValues(move, [{'name': 'BILL/2019/0042'}])

        move_form = Form(self.env['account.move'].with_context(default_type='in_refund'))
        move_form.invoice_date = fields.Date.from_string('2019-01-01')
        move_form.partner_id = self.partner_a
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
        move = move_form.save()
        move.post()

        self.assertRecordValues(move, [{'name': 'BILL/2019/0043'}])