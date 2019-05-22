# -*- coding: utf-8 -*-

from odoo import api, models, fields, tools, _

import random
import datetime
from faker import Faker
fake = Faker()


class AccountGenerator(models.TransientModel):
    _name = "account.generator"
    _description = "Generator"

    generator = fields.Selection([('aml', 'Journal Entry'), ('partner', 'Partner')])

    number_to_generate = fields.Integer()
    customer = fields.Boolean()
    supplier = fields.Boolean()
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

    def generate_partners(self):
        create_vals = []
        for i in range(self.number_to_generate):
            create_vals.append({
                'name': faker.name(),
                'customer': self.customer,
                'supplier': self.supplier,
                'street_name': faker.street_name(),
                'street_number': faker.building_number(),
                'city': faker.city(),
            })
        partner_ids = self.env['res.partner'].create(create_vals)
