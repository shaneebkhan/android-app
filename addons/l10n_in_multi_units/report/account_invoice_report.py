# -*- coding: utf-8 -*-
from odoo import models, fields, api


class AccountInvoiceReport(models.Model):
    _inherit = "account.invoice.report"

    unit_id = fields.Many2one('res.partner', string="Unit", readonly=True)

    def _select(self):
        return super(AccountInvoiceReport, self)._select() + """,
            sub.unit_id
            """

    def _sub_select(self):
        return super(AccountInvoiceReport, self)._sub_select() + """,
            ai.unit_id
            """

    def _group_by(self):
        return super(AccountInvoiceReport, self)._group_by() + """,
            ai.unit_id
            """
