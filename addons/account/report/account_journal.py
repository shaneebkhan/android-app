# -*- coding: utf-8 -*-

import time
from odoo import api, models, _
from odoo.exceptions import UserError


class ReportJournal(models.AbstractModel):
    _name = 'report.account.report_journal'
    _description = 'Account Journal Report'

    def lines(self, target_move, journal_ids, sort_selection, data):
        if isinstance(journal_ids, int):
            journal_ids = [journal_ids]

        move_state = ['draft', 'posted']
        if target_move == 'posted':
            move_state = ['posted']

        query_get_clause = self._get_query_get_clause(data)
        params = [tuple(move_state), tuple(journal_ids)] + query_get_clause[2]
        query = 'SELECT "account_move_line".id FROM ' + query_get_clause[0] + ', account_move am, account_account acc WHERE "account_move_line".account_id = acc.id AND "account_move_line".move_id=am.id AND am.state IN %s AND "account_move_line".journal_id IN %s AND ' + query_get_clause[1] + ' ORDER BY '
        if sort_selection == 'date':
            query += '"account_move_line".date'
        else:
            query += 'am.name'
        query += ', "account_move_line".move_id, acc.code'
        self.env.cr.execute(query, tuple(params))
        ids = (x[0] for x in self.env.cr.fetchall())
        return self.env['account.move.line'].browse(ids)

    def _sum_debit(self, data, journal_id):
        move_state = ['draft', 'posted']
        if data['form'].get('target_move', 'all') == 'posted':
            move_state = ['posted']

        query_get_clause = self._get_query_get_clause(data)
        params = [tuple(move_state), tuple(journal_id.ids)] + query_get_clause[2]
        currency = self.env['res.company'].browse(data['form']['company_id'][0]).currency_id
        self.env.cr.execute('SELECT "account_move_line".debit, "account_move_line".date FROM ' + query_get_clause[0] + ', account_move am '
                        'WHERE "account_move_line".move_id=am.id AND am.state IN %s AND "account_move_line".journal_id IN %s AND ' + query_get_clause[1] + ' ',
                        tuple(params))
        sum_debit = 0.0
        for line_data in self.env.cr.dictfetchall():
            sum_debit += currency._convert(from_amount=line_data['debit'], to_currency=self.env.user.company_id.currency_id, company=self.env.user.company_id, date=line_data['date'])
        return sum_debit

    def _sum_credit(self, data, journal_id):
        move_state = ['draft', 'posted']
        if data['form'].get('target_move', 'all') == 'posted':
            move_state = ['posted']

        query_get_clause = self._get_query_get_clause(data)
        params = [tuple(move_state), tuple(journal_id.ids)] + query_get_clause[2]
        currency = self.env['res.company'].browse(data['form']['company_id'][0]).currency_id
        self.env.cr.execute('SELECT "account_move_line".credit, "account_move_line".date FROM ' + query_get_clause[0] + ', account_move am '
                        'WHERE "account_move_line".move_id=am.id AND am.state IN %s AND "account_move_line".journal_id IN %s AND ' + query_get_clause[1] + ' ',
                        tuple(params))
        sum_credit = 0.0
        for line_data in self.env.cr.dictfetchall():
            sum_credit += currency._convert(from_amount=line_data['credit'], to_currency=self.env.user.company_id.currency_id, company=self.env.user.company_id, date=line_data['date'])
        return sum_credit

    def _get_taxes(self, data, journal_id):
        currency = self.env['res.company'].browse(data['form']['company_id'][0]).currency_id
        move_state = ['draft', 'posted']
        if data['form'].get('target_move', 'all') == 'posted':
            move_state = ['posted']

        query_get_clause = self._get_query_get_clause(data)
        params = [tuple(move_state), tuple(journal_id.ids)] + query_get_clause[2]
        query = """
            SELECT rel.account_tax_id, "account_move_line".date, "account_move_line".balance AS base_amount
            FROM account_move_line_account_tax_rel rel, """ + query_get_clause[0] + """ 
            LEFT JOIN account_move am ON "account_move_line".move_id = am.id
            WHERE "account_move_line".id = rel.account_move_line_id
                AND am.state IN %s
                AND "account_move_line".journal_id IN %s
                AND """ + query_get_clause[1] + """ """
        self.env.cr.execute(query, tuple(params))
        ids = []
        base_amounts = {}
        for line_data in self.env.cr.dictfetchall():
            ids.append(line_data['account_tax_id'])
            converted_base_amount = currency._convert(from_amount=line_data['base_amount'], to_currency=self.env.user.company_id.currency_id, company=self.env.user.company_id, date=line_data['date'])
            if base_amounts.get(line_data['account_tax_id']):
                base_amounts[line_data['account_tax_id']] += converted_base_amount
            else:
                base_amounts[line_data['account_tax_id']] = converted_base_amount

        res = {}
        for tax in self.env['account.tax'].browse(list(set(ids))):
            sum_tax_amount = 0.0
            self.env.cr.execute('SELECT debit, credit, account_move_line.date FROM ' + query_get_clause[0] + ', account_move am '
                'WHERE "account_move_line".move_id=am.id AND am.state IN %s AND "account_move_line".journal_id IN %s AND ' + query_get_clause[1] + ' AND tax_line_id = %s',
                tuple(params + [tax.id]))
            for line_data in self.env.cr.dictfetchall():
                sum_tax_amount += currency._convert(from_amount=line_data['debit'] - line_data['credit'], to_currency=self.env.user.company_id.currency_id, company=self.env.user.company_id, date=line_data['date'])
            res[tax] = {
                'base_amount': base_amounts[tax.id],
                'tax_amount':  sum_tax_amount,
            }
            if journal_id.type == 'sale':
                #sales operation are credits
                res[tax]['base_amount'] = res[tax]['base_amount'] * -1
                res[tax]['tax_amount'] = res[tax]['tax_amount'] * -1
        return res

    def _get_query_get_clause(self, data):
        return self.env['account.move.line'].with_context(data['form'].get('used_context', {}))._query_get()

    @api.model
    def _get_report_values(self, docids, data=None):
        if not data.get('form'):
            raise UserError(_("Form content is missing, this report cannot be printed."))

        target_move = data['form'].get('target_move', 'all')
        sort_selection = data['form'].get('sort_selection', 'date')

        res = {}
        for journal in data['form']['journal_ids']:
            res[journal] = self.with_context(data['form'].get('used_context', {})).lines(target_move, journal, sort_selection, data)
        return {
            'doc_ids': data['form']['journal_ids'],
            'doc_model': self.env['account.journal'],
            'data': data,
            'docs': self.env['account.journal'].browse(data['form']['journal_ids']),
            'time': time,
            'lines': res,
            'sum_credit': self._sum_credit,
            'sum_debit': self._sum_debit,
            'get_taxes': self._get_taxes,
            'company_id': self.env['res.company'].browse(
                data['form']['company_id'][0]),
        }
