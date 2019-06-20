# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class AccountJournal(models.Model):
    _inherit = "account.journal"

    unit_id = fields.Many2one('res.partner', string="Operating Unit", ondelete="restrict", help="Unit related to this journal. If need the same journal for company all unit then keep this empty.")

    _sql_constraints = [
        ('code_company_uniq', 'unique (code, name, company_id, unit_id)', 'The code and name of the journal must be unique per company unit!'),
    ]
