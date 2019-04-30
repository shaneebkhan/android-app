# -*- coding: utf-8 -*-
from odoo.addons.account.tests.account_test_savepoint import AccountingSavepointCase
from odoo.tests.common import Form
from odoo.tests import tagged
from odoo.exceptions import ValidationError
from odoo import fields

import logging


_logger = logging.getLogger(__name__)


@tagged('post_install', '-at_install')
class TestAccountMove(AccountingSavepointCase):

    # -------------------------------------------------------------------------
    # TESTS Miscellaneous operations
    # -------------------------------------------------------------------------

    def test_misc_tax_lock_date_1(self):
        move = self.env['account.move'].create({
            'type': 'misc',
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
                    'account_id': self.parent_tax_sale_1.refund_account_id.id,
                    'debit': 150.0,
                    'credit': 0.0,
                    'tax_line_id': self.parent_tax_sale_1.id,
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
