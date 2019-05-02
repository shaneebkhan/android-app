# -*- coding: utf-8 -*-
from odoo import fields
from odoo.tests.common import Form, SavepointCase
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class AccountingSavepointCase(SavepointCase):

    # -------------------------------------------------------------------------
    # DATA GENERATION
    # -------------------------------------------------------------------------

    @classmethod
    def setUpClass(cls):
        super(AccountingSavepointCase, cls).setUpClass()

        chart_template = cls.env.user.company_id.chart_template_id
        if not chart_template:
            chart_template = cls.env.ref('l10n_generic_coa.configurable_chart_template', raise_if_not_found=False)
        if not chart_template:
            cls.skipTest("Reports Tests skipped because the user's company has no chart of accounts.")

        # Create companies.
        cls.company_parent = cls.env['res.company'].create({
            'name': 'company_parent',
            'currency_id': cls.env.user.company_id.currency_id.id,
        })
        cls.gold_currency = cls.env['res.currency'].create({
            'name': 'Gold Coin',
            'symbol': '☺',
            'rounding': 0.001,
            'position': 'after',
            'currency_unit_label': 'Gold',
            'currency_subunit_label': 'Silver',
        })
        cls.company_child = cls.env['res.company'].create({
            'name': 'company_child',
            'currency_id': cls.gold_currency.id,
            'parent_id': cls.company_parent.id,
        })
        cls.rate1 = cls.env['res.currency.rate'].create({
            'name': '2016-01-01',
            'rate': 3.0,
            'currency_id': cls.gold_currency.id,
            'company_id': cls.company_parent.id,
        })
        cls.rate2 = cls.env['res.currency.rate'].create({
            'name': '2017-01-01',
            'rate': 2.0,
            'currency_id': cls.gold_currency.id,
            'company_id': cls.company_parent.id,
        })

        # Create user.
        user = cls.env['res.users'].create({
            'name': 'Because I am accountman!',
            'login': 'accountman',
            'groups_id': [(6, 0, cls.env.user.groups_id.ids)],
            'company_id': cls.company_parent.id,
            'company_ids': [(6, 0, (cls.company_parent + cls.company_child).ids)],
        })
        user.partner_id.email = 'accountman@test.com'

        # Shadow the current environment/cursor with one having the report user.
        # This is mandatory to test access rights.
        cls.env = cls.env(user=user)
        cls.cr = cls.env.cr

        # Rebrowse with the new environment.
        chart_template = cls.env['account.chart.template'].browse(chart_template.id)

        # Install the chart of accounts being the same as the current user's company.
        # The 'test' user is set by default on the company_parent meaning he has access to both companies.
        chart_template.load_for_current_company(15.0, 15.0)
        user.company_id = cls.company_child
        chart_template.load_for_current_company(15.0, 15.0)
        cls.company_child.currency_id = cls.gold_currency
        user.company_id = cls.company_parent

        # Make sure the sequences of child company is lower than the ones from the parent company.
        # Then, if a domain on the company is missing somewhere, the tests will be broken.
        cls.env['account.journal'].search([('company_id', '=', cls.company_parent.id)]).write({'sequence': 20})
        cls.env['account.journal'].search([('company_id', '=', cls.company_child.id)]).write({'sequence': 10})

        # Accounts definition.
        cls.parent_acc_revenue_1 = cls.env['account.account'].search([
            ('company_id', '=', cls.company_parent.id),
            ('user_type_id', '=', cls.env.ref('account.data_account_type_revenue').id)
        ], limit=1)
        cls.parent_acc_revenue_2 = cls.parent_acc_revenue_1.copy()
        cls.parent_acc_revenue_3 = cls.parent_acc_revenue_1.copy()
        cls.parent_acc_expense_1 = cls.env['account.account'].search([
            ('company_id', '=', cls.company_parent.id),
            ('user_type_id', '=', cls.env.ref('account.data_account_type_expenses').id)
        ], limit=1)
        cls.parent_acc_expense_2 = cls.parent_acc_expense_1.copy()
        cls.parent_acc_expense_3 = cls.parent_acc_expense_1.copy()
        cls.parent_acc_receivable_1 = cls.env['account.account'].search([
            ('company_id', '=', cls.company_parent.id),
            ('user_type_id.type', '=', 'receivable')
        ], limit=1)
        cls.parent_acc_receivable_2 = cls.parent_acc_receivable_1.copy()
        cls.parent_acc_payable_1 = cls.env['account.account'].search([
            ('company_id', '=', cls.company_parent.id),
            ('user_type_id.type', '=', 'payable')
        ], limit=1)
        cls.parent_acc_payable_2 = cls.parent_acc_payable_1.copy()

        # Journal definition.
        cls.parent_journal_misc_1 = cls.env['account.journal'].search([
            ('company_id', '=', cls.company_parent.id),
            ('type', '=', 'general')
        ], limit=1)
        cls.parent_journal_sale_1 = cls.env['account.journal'].search([
            ('company_id', '=', cls.company_parent.id),
            ('type', '=', 'sale')
        ], limit=1)
        cls.parent_journal_sale_2 = cls.parent_journal_sale_1.copy()
        cls.parent_journal_sale_2.currency_id = cls.gold_currency
        cls.parent_journal_purchase_1 = cls.env['account.journal'].search([
            ('company_id', '=', cls.company_parent.id),
            ('type', '=', 'purchase')
        ], limit=1)
        cls.parent_journal_purchase_2 = cls.parent_journal_purchase_1.copy()
        cls.parent_journal_purchase_2.currency_id = cls.gold_currency

        # Taxes definition.
        cls.parent_tax_sale_1 = cls.company_parent.account_sale_tax_id
        cls.parent_tax_sale_1.refund_account_id = cls.parent_tax_sale_1.account_id.copy()
        cls.parent_tax_sale_2 = cls.parent_tax_sale_1.copy()
        cls.parent_tax_sale_3 = cls.parent_tax_sale_2.copy()
        cls.parent_tax_sale_1_incl = cls.parent_tax_sale_3.copy()
        cls.parent_tax_sale_1_incl.write({
            'name': '%s incl' % cls.parent_tax_sale_1.name,
            'description': '%s incl' % cls.parent_tax_sale_1.description,
            'amount': cls.parent_tax_sale_1.amount,
            'price_include': True,
            'include_base_amount': True,
         })

        cls.parent_acc_tax_1 = cls.parent_tax_sale_1.account_id
        cls.parent_acc_tax_2 = cls.parent_acc_tax_1.copy()
        cls.parent_acc_tax_3 = cls.parent_acc_tax_2.copy()

        cls.parent_tax_sale_1_not_exigible = cls.parent_tax_sale_3.copy()
        cls.parent_tax_sale_1_not_exigible.write({
            'name': '%s exigible on payment' % cls.parent_tax_sale_1.name,
            'description': '%s exigible on payment' % cls.parent_tax_sale_1.description,
            'amount': cls.parent_tax_sale_1.amount,
            'tax_exigibility': 'on_payment',
            'cash_basis_account_id': cls.parent_acc_tax_2.id,
            'cash_basis_base_account_id': cls.parent_acc_tax_3.id,
         })

        cls.parent_tax_purchase_1 = cls.company_parent.account_purchase_tax_id
        cls.parent_tax_purchase_2 = cls.parent_tax_purchase_1.copy()
        cls.parent_tax_purchase_3 = cls.parent_tax_purchase_2.copy()
        cls.parent_tax_purchase_1_incl = cls.parent_tax_purchase_3.copy()
        cls.parent_tax_purchase_1_incl.write({
            'name': '%s incl' % cls.parent_tax_purchase_1.name,
            'description': '%s incl' % cls.parent_tax_purchase_1.description,
            'amount': cls.parent_tax_purchase_1.amount,
            'price_include': True,
            'include_base_amount': True,
         })

        cls.parent_tax_purchase_1_not_exigible = cls.parent_tax_purchase_3.copy()
        cls.parent_tax_purchase_1_not_exigible.write({
            'name': '%s exigible on payment' % cls.parent_tax_purchase_1.name,
            'description': '%s exigible on payment' % cls.parent_tax_purchase_1.description,
            'amount': cls.parent_tax_purchase_1.amount,
            'tax_exigibility': 'on_payment',
            'cash_basis_account_id': cls.parent_acc_tax_2.id,
            'cash_basis_base_account_id': cls.parent_acc_tax_3.id,
         })

        # Fiscal position definition.
        cls.parent_fp_1 = cls.env['account.fiscal.position'].create({
            'name': 'parent_fp_1',
            'tax_ids': [
                (0, None, {
                    'tax_src_id': cls.parent_tax_sale_1.id,
                    'tax_dest_id': cls.parent_tax_sale_3.id,
                }),
                (0, None, {
                    'tax_src_id': cls.parent_tax_purchase_1.id,
                    'tax_dest_id': cls.parent_tax_purchase_3.id,
                }),
            ],
            'account_ids': [
                (0, None, {
                    'account_src_id': cls.parent_acc_revenue_1.id,
                    'account_dest_id': cls.parent_acc_revenue_3.id,
                }),
                (0, None, {
                    'account_src_id': cls.parent_acc_expense_1.id,
                    'account_dest_id': cls.parent_acc_expense_3.id,
                }),
            ],
        })

        # Payment terms definition.
        cls.pay_terms_immediate = cls.env.ref('account.account_payment_term_immediate')
        cls.pay_terms_advance = cls.env['account.payment.term'].create({
            'name': '30% Advance End of Following Month',
            'note': 'Payment terms: 30% Advance End of Following Month',
            'line_ids': [
                (0, 0, {
                    'value': 'percent',
                    'value_amount': 30.0,
                    'sequence': 400,
                    'days': 0,
                    'option': 'day_after_invoice_date',
                }),
                (0, 0, {
                    'value': 'balance',
                    'value_amount': 0.0,
                    'sequence': 500,
                    'days': 31,
                    'option': 'day_following_month',
                }),
            ],
        })

        # Partners definition.
        cls.partner_a = cls.env['res.partner'].create({
            'name': 'partner_a',
            'property_payment_term_id': cls.pay_terms_immediate.id,
            'property_supplier_payment_term_id': cls.pay_terms_immediate.id,
            'property_account_receivable_id': cls.parent_acc_receivable_1.id,
            'property_account_payable_id': cls.parent_acc_payable_1.id,
            'company_id': False,
        })
        cls.partner_b = cls.env['res.partner'].create({
            'name': 'partner_b',
            'property_payment_term_id': cls.pay_terms_advance.id,
            'property_supplier_payment_term_id': cls.pay_terms_advance.id,
            'property_account_position_id': cls.parent_fp_1.id,
            'property_account_receivable_id': cls.parent_acc_receivable_2.id,
            'property_account_payable_id': cls.parent_acc_payable_2.id,
            'company_id': False,
        })

        # Uom definition.
        cls.uom_unit = cls.env.ref('uom.product_uom_unit')
        cls.uom_dozen = cls.env.ref('uom.product_uom_dozen')

        # Products definition.
        cls.product_a = cls.env['product.product'].create({
            'name': 'product_a',
            'lst_price': 1000.0,
            'standard_price': 800.0,
            'taxes_id': [(6, 0, cls.parent_tax_sale_1.ids)],
            'supplier_taxes_id': [(6, 0, cls.parent_tax_purchase_1.ids)],
            'uom_id': cls.uom_unit.id,
        })
        cls.product_a.product_tmpl_id.property_account_income_id = cls.parent_acc_revenue_1.id
        cls.product_a.product_tmpl_id.property_account_expense_id = cls.parent_acc_expense_1.id
        cls.product_b = cls.env['product.product'].create({
            'name': 'product_b',
            'lst_price': 2000.0,
            'standard_price': 1500.0,
            'taxes_id': [(6, 0, cls.parent_tax_sale_2.ids)],
            'supplier_taxes_id': [(6, 0, cls.parent_tax_purchase_2.ids)],
            'uom_id': cls.uom_dozen.id,
        })
        cls.product_b.product_tmpl_id.property_account_income_id = cls.parent_acc_revenue_2.id,
        cls.product_b.product_tmpl_id.property_account_expense_id = cls.parent_acc_expense_2.id,

    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------

    def assertAmlsValues(self, lines, expected_values_list):
        lines = lines.sorted(lambda line: (line.name or '', line.balance))
        self.assertRecordValues(lines, expected_values_list)

    @staticmethod
    def _search_candidate_records(records, searched_values):
        ''' Helper to find matching record based on some values.
        This method takes care about relational/monetary/date/datetime fields.
        :param records:         A records set.
        :param searched_values: A dictionary of values to match.
        :return:                A record in records or None.
        '''
        for i, record in enumerate(records):
            match = True
            for field_name in searched_values.keys():
                record_value = record[field_name]
                search_value = searched_values[field_name]
                field_type = record._fields[field_name].type
                if field_type == 'monetary':
                    # Compare monetary field.
                    currency_field_name = record._fields[field_name].currency_field
                    record_currency = record[currency_field_name]
                    if record_currency:
                        if record_currency.compare_amounts(search_value, record_value):
                            match = False
                            break
                    elif search_value != record_value:
                        match = False
                        break
                elif field_type in ('one2many', 'many2many'):
                    # Compare x2many relational fields.
                    # Empty comparison must be an empty list to be True.
                    if set(record_value.ids) != set(search_value):
                        match = False
                        break
                elif field_type == 'many2one':
                    # Compare many2one relational fields.
                    # Every falsy value is allowed to compare with an empty record.
                    if (record_value or search_value) and record_value.id != search_value:
                        match = False
                        break
                elif field_type == 'date':
                    if fields.Date.to_string(record_value) != search_value:
                        match = False
                        break
                elif field_type == 'datetime':
                    if fields.Datetime.to_string(record_value) != search_value:
                        match = False
                        break
                elif (search_value or record_value) and record_value != search_value:
                    # Compare others fields if not both interpreted as falsy values.
                    match = False
                    break
            if match:
                return i, record
        return -1, None
