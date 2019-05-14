
# -*- coding: utf-8 -*-
from odoo.addons.account.tests.account_test_savepoint import AccountingSavepointCase
from odoo.tests.common import Form
from odoo.tests import tagged
from odoo import fields

import logging
_logger = logging.getLogger(__name__)


@tagged('post_install', '-at_install')
class TestAccountMoveOutReceipt(AccountingSavepointCase):

    # -------------------------------------------------------------------------
    # TESTS out_receipt ONCHANGE
    # -------------------------------------------------------------------------

    def test_out_receipt_onchange_1(self):
        move_form = Form(self.env['account.move'].with_context(default_type='out_receipt'))
        move_form.invoice_date = fields.Date.from_string('2019-01-01')
        move_form.partner_id = self.partner_a
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
        move = move_form.save()

        self.assertAmlsValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1150.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'display_type': False,
                'date_maturity': False,
                'tax_exigible': True,
            },
        ])
        self.assertAmlsValues(move.line_ids, [
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
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
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 150.0,
                'price_subtotal': 150.0,
                'price_total': 150.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 150.0,
                'display_type': 'tax',
                'date_maturity': False,
                'tax_exigible': True,
            },
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1150.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'display_type': False,
                'date_maturity': False,
                'tax_exigible': True,
            },
        ])
        self.assertRecordValues(move, [{
            'partner_id': self.partner_a.id,
            'currency_id': self.company_parent.currency_id.id,
            'journal_id': self.parent_journal_sale_1.id,
            'date': fields.Date.from_string('2019-01-01'),
            'fiscal_position_id': False,
            'invoice_payment_ref': '/',
            'invoice_payment_term_id': self.pay_terms_immediate.id,
            'amount_untaxed': 1000.0,
            'amount_tax': 150.0,
            'amount_total': 1150.0,
            'amount_residual': 1150.0,
        }])

    # -------------------------------------------------------------------------
    # TESTS out_receipt CREATE
    # -------------------------------------------------------------------------

    def test_out_receipt_create_invoice_line_ids_1_single_currency(self):
        # Test creating an account_move with the least information.
        move = self.env['account.move'].with_context(default_type='out_receipt').create({
            'type': 'out_receipt',
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

        self.assertAmlsValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1150.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'display_type': False,
                'date_maturity': False,
                'tax_exigible': True,
            },
        ])
        self.assertAmlsValues(move.line_ids, [
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
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
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 150.0,
                'price_subtotal': 150.0,
                'price_total': 150.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 150.0,
                'display_type': 'tax',
                'date_maturity': False,
                'tax_exigible': True,
            },
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1150.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'display_type': False,
                'date_maturity': False,
                'tax_exigible': True,
            },
        ])
        self.assertRecordValues(move, [{
            'partner_id': self.partner_a.id,
            'currency_id': self.company_parent.currency_id.id,
            'journal_id': self.parent_journal_sale_1.id,
            'date': fields.Date.from_string('2019-01-01'),
            'fiscal_position_id': False,
            'invoice_payment_ref': '/',
            'invoice_payment_term_id': False,
            'amount_untaxed': 1000.0,
            'amount_tax': 150.0,
            'amount_total': 1150.0,
            'amount_residual': 1150.0,
        }])
