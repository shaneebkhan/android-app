# -*- coding: utf-8 -*-

from odoo import api, models, fields, tools, _
from odoo.exceptions import UserError

import random
import datetime
import logging
import datetime
try:
    from faker import Faker
except ImportError:
    raise UserError('You need to install faker (see https://pypi.org/project/Faker/) in order to install account_generator')
fake = Faker()
_logger = logging.getLogger(__name__)


class AccountGenerator(models.TransientModel):
    _name = "account.generator"
    _description = "Generator"

    generator = fields.Selection([('aml', 'Journal Entry'), ('partner', 'Partner'), ('invoice', 'Invoice'), ('bank_statement', 'Bank Statement')], required=True, default='aml')

    number_to_generate = fields.Integer(default=10)
    number_of_lines = fields.Integer(default=10)
    customer = fields.Boolean(default=True)
    supplier = fields.Boolean(default=True)
    company_type = fields.Selection([('person', 'Person'), ('company', 'Company')], default='person')
    post = fields.Boolean()
    end_date = fields.Date(default=fields.Date.today() + datetime.timedelta(days=30*3))
    start_date = fields.Date(default=fields.Date.today() + datetime.timedelta(days=-365*3))

    partner_ids = fields.Many2many('res.partner')
    account_ids = fields.Many2many('account.account')
    journal_ids = fields.Many2many('account.journal')

    def generate_amls(self):
        def generate_line(amount=None):
            amount = amount or random.uniform(-10000, 10000)
            return (0, 0, {'debit': amount > 0 and amount or 0, 'credit': amount < 0 and -amount or 0, 'account_id': random.choice(account_ids).id, 'partner_id': random.choice(partner_ids).id})

        company_id = self.env.company_id
        create_vals = []
        partner_ids = self.partner_ids or self.env['res.partner'].search([])
        account_ids = self.account_ids or self.env['account.account'].search([('company_id', '=', company_id.id)])
        journal_ids = self.journal_ids or self.env['account.journal'].search([('company_id', '=', company_id.id)])
        for i in range(self.number_to_generate):
            date = fake.date_time_between_dates(datetime_start=self.start_date, datetime_end=self.end_date)
            create_vals.append({
                'line_ids': [generate_line() for i in range(random.randint(1, self.number_of_lines - 1))],
                'date': date,
                'journal_id': random.choice(journal_ids).id,
            })
            amount = sum(line[2]['debit'] - line[2]['credit'] for line in create_vals[-1]['line_ids'])
            create_vals[-1]['line_ids'].append(generate_line(-amount))
        line_ids, view = self.create_records('account.move', create_vals)
        if self.post:
            line_ids.post()
            _logger.info('Journal Entries posted')
        return view

    def generate_partners(self):
        create_vals = []
        for i in range(self.number_to_generate):
            create_vals.append({
                'name': fake.name() if self.company_type == 'person' else fake.company(),
                'customer': self.customer,
                'supplier': self.supplier,
                'company_type': self.company_type,
                'street': fake.street_address(),
                'city': fake.city(),
                'phone': fake.phone_number(),
                'email': fake.email(),
            })
        partner_ids, view = self.create_records('res.partner', create_vals)
        return view

    def generate_invoices(self):
        def generate_line(type):
            account_id = random.choice(rev_account_ids).id if type == 'out_invoice' else random.choice(exp_account_ids).id
            return (0, 0, {'name': fake.bs(), 'account_id': account_id, 'quantity': random.randint(1, 50), 'price_unit': random.uniform(1, 10000)})

        company_id = self.env.company_id
        partner_ids = self.partner_ids or self.env['res.partner'].search([('customer', '=', self.customer), ('supplier', '=', self.supplier)])
        if not partner_ids:
            raise UserError(_('No partner found'))
        exp_account_ids = self.account_ids or self.env['account.account'].search([('company_id', '=', company_id.id), ('user_type_id', '=', self.env.ref('account.data_account_type_expenses').id)])
        rev_account_ids = self.account_ids or self.env['account.account'].search([('company_id', '=', company_id.id), ('user_type_id', '=', self.env.ref('account.data_account_type_revenue').id)])
        account_ids = exp_account_ids + rev_account_ids
        if not account_ids:
            raise UserError(_('No account found'))
        rec_journal_ids = self.journal_ids or self.env['account.journal'].search([('company_id', '=', company_id.id), ('type', '=', 'sale')])
        pay_journal_ids = self.journal_ids or self.env['account.journal'].search([('company_id', '=', company_id.id), ('type', '=', 'purchase')])
        journal_ids = rec_journal_ids + pay_journal_ids
        if not journal_ids:
            raise UserError(_('No journal found'))

        create_vals = []
        for i in range(self.number_to_generate):
            date = fake.date_time_between_dates(datetime_start=self.start_date, datetime_end=self.end_date).date()
            partner_id = random.choice(partner_ids)
            type = random.choice([t[1] for t in [('supplier', 'in_invoice'), ('customer', 'out_invoice')] if getattr(partner_id, t[0])])
            create_vals.append({
                'partner_id': partner_id.id,
                'invoice_line_ids': [generate_line(type) for i in range(random.randint(1, self.number_of_lines))],
                'date_invoice': date,
                'type': type,
                'journal_id': random.choice(rec_journal_ids).id if type == 'out_invoice' else random.choice(pay_journal_ids).id
            })
        invoice_ids, view = self.create_records('account.invoice', create_vals)
        if self.post:
            invoice_ids.action_invoice_open()
            _logger.info('Invoices posted')
        return view

    def generate_bank_statement(self):
        def generate_line():
            return (0, 0, {'date': fake.date_between_dates(date_start=self.start_date, date_end=self.end_date), 'name': fake.bs(), 'partner_id': random.choice(partner_ids).id, 'amount': random.uniform(-10000, 10000)})

        company_id = self.env.company_id
        journal_ids = self.journal_ids or self.env['account.journal'].search([('type', '=', 'bank')])
        if not journal_ids:
            raise UserError(_('No journal found'))
        partner_ids = self.partner_ids or self.env['res.partner'].search([('customer', '=', self.customer), ('supplier', '=', self.supplier)])
        if not partner_ids:
            raise UserError(_('No partner found'))

        create_vals = []
        for i in range(self.number_to_generate):
            create_vals.append({
                'journal_id': random.choice(journal_ids).id,
                'line_ids': [generate_line() for i in range(random.randint(1, self.number_of_lines))],
                'date': self.end_date,
            })
        bank_statement_ids, view = self.create_records('account.bank.statement', create_vals)
        return view

    def create_records(self, model_name, create_vals):
        model = self.env[model_name]
        _logger.info('Start Create')
        record_ids = model.create(create_vals)
        _logger.info('{} created'.format(model._description))
        return record_ids, {
            'name': _('Generated {}'.format(model._description)),
            'view_type': 'form',
            'view_mode': 'tree,form',
            'res_model': model_name,
            'view_id': False,
            'type': 'ir.actions.act_window',
            'domain': [('id', 'in', record_ids.ids)],
        }
