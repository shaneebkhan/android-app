# -*- coding: utf-8 -*-
from odoo.addons.account.tests.account_test_savepoint import AccountingSavepointCase
from odoo.tests.common import Form
from odoo.tests import tagged
from odoo.exceptions import ValidationError
from odoo import fields

import logging


_logger = logging.getLogger(__name__)


@tagged('post_install', '-at_install')
class TestAccountMoveEntry(AccountingSavepointCase):

    # -------------------------------------------------------------------------
    # TESTS Miscellaneous operations ONCHANGE
    # -------------------------------------------------------------------------

    def test_misc_onchange_1_default_get(self):
        move_form = Form(self.env['account.move'])
        move_form.date = fields.Date.from_string('2019-01-01')
        with move_form.line_ids.new() as line_form:
            line_form.account_id = self.parent_acc_revenue_1
            line_form.partner_id = self.partner_a
            line_form.debit = 50.0
        with move_form.line_ids.new() as line_form:
            # account_id & partner_id should be set by the default_get.
            # credit should be reset to 0.0 by setting the debit.
            line_form.debit = 50.0
        with move_form.line_ids.new() as line_form:
            # credit should be set by the default_get.
            line_form.account_id = self.parent_acc_revenue_2
            line_form.partner_id = self.partner_b
        move = move_form.save()

        self.assertAmlsValues(move.line_ids, [
            {
                'name': False,
                'product_id': False,
                'account_id': self.parent_acc_revenue_2.id,
                'partner_id': self.partner_b.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 0.0,
                'price_subtotal': 0.0,
                'price_total': 0.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 100.0,
                'display_type': False,
                'date_maturity': False,
                'tax_exigible': True,
            },
            {
                'name': False,
                'product_id': False,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 0.0,
                'price_subtotal': 0.0,
                'price_total': 0.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 50.0,
                'credit': 0.0,
                'display_type': False,
                'date_maturity': False,
                'tax_exigible': True,
            },
            {
                'name': False,
                'product_id': False,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 0.0,
                'price_subtotal': 0.0,
                'price_total': 0.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 50.0,
                'credit': 0.0,
                'display_type': False,
                'date_maturity': False,
                'tax_exigible': True,
            },
        ])
        self.assertRecordValues(move, [{
            'currency_id': self.company_parent.currency_id.id,
            'journal_id': self.parent_journal_misc_1.id,
            'date': fields.Date.from_string('2019-01-01'),
            'amount_total': 100.0,
            'amount_residual': 0.0,
        }])

    # -------------------------------------------------------------------------
    # TESTS Miscellaneous operations MISC
    # -------------------------------------------------------------------------

    def test_misc_tax_lock_date_1(self):
        tax_repartition_line = self.parent_tax_sale_1.invoice_repartition_line_ids.filtered(lambda line: line.repartition_type == 'tax')
        move = self.env['account.move'].create({
            'type': 'entry',
            'date': fields.Date.from_string('2016-01-01'),
            'line_ids': [
                (0, None, {
                    'name': 'revenue line 1',
                    'account_id': self.parent_acc_revenue_1.id,
                    'debit': 500.0,
                    'credit': 0.0,
                }),
                (0, None, {
                    'name': 'revenue line 2',
                    'account_id': self.parent_acc_revenue_1.id,
                    'debit': 1000.0,
                    'credit': 0.0,
                    'tax_ids': [(6, 0, self.parent_tax_sale_1.ids)],
                }),
                (0, None, {
                    'name': 'tax line',
                    'account_id': self._get_tax_account(self.parent_tax_sale_1).id,
                    'debit': 150.0,
                    'credit': 0.0,
                    'tax_repartition_line_id': tax_repartition_line.id,
                }),
                (0, None, {
                    'name': 'counterpart line',
                    'account_id': self.parent_acc_receivable_1.id,
                    'debit': 0.0,
                    'credit': 1650.0,
                }),
            ]
        })

        # Set the tax lock date after the journal entry date.
        move.company_id.tax_lock_date = fields.Date.from_string('2017-01-01')

        # lines[0] = 'counterpart line'
        # lines[1] = 'tax line'
        # lines[2] = 'revenue line 1'
        # lines[3] = 'revenue line 2'
        lines = move.line_ids.sorted('debit')

        # Writing not affecting a tax is allowed.
        move.write({
            'line_ids': [
                (1, lines[0].id, {'credit': 1750.0}),
                (1, lines[2].id, {'debit': 600.0}),
            ],
        })

        # Writing something affecting a tax is not allowed.
        with self.assertRaises(ValidationError):
            move.write({
                'line_ids': [
                    (1, lines[0].id, {'credit': 2750.0}),
                    (1, lines[3].id, {'debit': 2000.0}),
                ],
            })

        with self.assertRaises(ValidationError):
            move.write({
                'line_ids': [
                    (1, lines[3].id, {'tax_ids': [(6, 0, (self.parent_tax_sale_1 + self.parent_tax_sale_1).ids)]}),
                ],
            })

        with self.assertRaises(ValidationError):
            move.write({
                'line_ids': [
                    (1, lines[0].id, {'credit': 1900.0}),
                    (1, lines[1].id, {'debit': 300.0}),
                ],
            })

        with self.assertRaises(ValidationError):
            move.unlink()
