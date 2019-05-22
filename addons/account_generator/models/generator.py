# -*- coding: utf-8 -*-

from odoo import api, models, fields, tools, _

import random
import datetime
from faker import Faker
fake = Faker()


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

    def generate_amls(self):
        company_id = self.env.user.company_id
        create_vals = []
        partner_ids = self.env['res.partner'].search([])
        account_ids = self.env['account.account'].search([('company_id', '=', company_id.id)])
        for i in range(self.number_to_generate):
            amount = random.uniform(-10000, 10000)
            date = fake.date_time_between(start_date='-3y', end_date='now')
            create_vals.append({
                'line_ids': [(0, 0, {
                        'debit': amount > 0 and amount or 0,
                        'credit': amount < 0 and -amount or 0,
                        'account_id': random.choice(account_ids).id,
                        'partner_id': random.choice(partner_ids).id,
                    }), (0, 0, {
                        'debit': amount < 0 and -amount or 0,
                        'credit': amount > 0 and amount or 0,
                        'account_id': random.choice(account_ids).id,
                        'partner_id': random.choice(partner_ids).id,
                    }),
                ],
                'date': date,
            })
        line_ids = self.env['account.move'].create(create_vals)
        if self.post():
            line_ids.post()
        return {
            'name': _('Generated Journal Entries'),
            'view_type': 'form',
            'view_mode': 'tree,form',
            'res_model': 'account.move',
            'view_id': False,
            'type': 'ir.actions.act_window',
            'domain': [('id', 'in', line_ids.ids)],
        }

    def generate_partners(self):
        create_vals = []
        for i in range(self.number_to_generate):
            create_vals.append({
                'name': fake.name(),
                'customer': self.customer,
                'supplier': self.supplier,
                'company_type': self.company_type,
                'street': fake.street_address(),
                'city': fake.city(),
                'phone': fake.phone_number(),
                'email': fake.email(),
            })
        partner_ids = self.env['res.partner'].create(create_vals)
        return {
            'name': _('Generated Partners'),
            'view_type': 'form',
            'view_mode': 'tree,form',
            'res_model': 'res.partner',
            'view_id': False,
            'type': 'ir.actions.act_window',
            'domain': [('id', 'in', partner_ids.ids)],
        }

    def generate_invoices(self):
        def generate_line():
            return (0, 0, {'name': fake.bs(), 'account_id': random.choice(account_ids).id, 'quantity': random.randint(1, 50), 'price_unit': random.uniform(1, 10000)})

        company_id = self.env.user.company_id
        partner_ids = self.env['res.partner'].search([('customer', '=', self.customer), ('supplier', '=', self.supplier)])
        account_ids = self.env['account.account'].search([('company_id', '=', company_id.id)])

        create_vals = []
        for i in range(self.number_to_generate):
            date = fake.date_time_between(start_date='-3y', end_date='now').date()
            create_vals.append({
                'partner_id': random.choice(partner_ids).id,
                'invoice_line_ids': [generate_line() for i in range(random.randint(1, self.number_of_lines))],
                'date_invoice': date,
            })
        invoice_ids = self.env['account.invoice'].create(create_vals)
        if self.post:
            invoice_ids.action_invoice_open()
        return {
            'name': _('Generated Invoices'),
            'view_type': 'form',
            'view_mode': 'tree,form',
            'res_model': 'account.invoice',
            'view_id': False,
            'type': 'ir.actions.act_window',
            'domain': [('id', 'in', invoice_ids.ids)],
        }

    def generate_bank_statement(self):
        def generate_line():
            return (0, 0, {'date': fake.date_time_between(start_date='-3m', end_date='now').date(), 'name': fake.bs(), 'partner_id': random.choice(partner_ids).id, 'amount': random.uniform(-10000, 10000)})

        company_id = self.env.user.company_id
        journal_ids = self.env['account.journal'].search([('type', '=', 'bank')])
        partner_ids = self.env['res.partner'].search([('customer', '=', self.customer), ('supplier', '=', self.supplier)])

        create_vals = []
        for i in range(self.number_to_generate):
            create_vals.append({
                'journal_id': random.choice(journal_ids).id,
                'line_ids': [generate_line() for i in range(random.randint(1, self.number_of_lines))],
                'date': fields.Date.today(),
            })
        bank_statement_ids = self.env['account.bank.statement'].create(create_vals)
        return {
            'name': _('Generated Bank Statement'),
            'view_type': 'form',
            'view_mode': 'tree,form',
            'res_model': 'account.bank.statement',
            'view_id': False,
            'type': 'ir.actions.act_window',
            'domain': [('id', 'in', bank_statement_ids.ids)],
        }
