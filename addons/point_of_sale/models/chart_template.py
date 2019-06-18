# -*- coding: utf-8 -*-
from odoo import api, models, _


class AccountChartTemplate(models.Model):
    _inherit = 'account.chart.template'

    @api.multi
    def _create_bank_journals(self, company, acc_template_ref):
        """ This is a helper function in loading a chart of account.

            The goal of inheriting this function is to, after creation of
            accounts and journals, create default records such as pos
            account receivable, and bank and cash payment methods and set
            them in the payment methods field of the main pos config.
        """
        res = super(AccountChartTemplate, self)._create_bank_journals(company, acc_template_ref)

        cash_journals = res.filtered(lambda journal: journal.type == 'cash')
        if not cash_journals:
            cash_journals = self._create_pos_cash_journal(company)

        pos_receivable_account = self._create_default_pos_receivable_account(company)
        cash_payment_method = self._create_cash_payment_method(pos_receivable_account, cash_journals[0])
        bank_payment_method = self._create_bank_payment_method(pos_receivable_account)

        main_shop = self.env.ref('point_of_sale.pos_config_main', raise_if_not_found=False)
        if main_shop:
            main_shop.write({"payment_method_ids": [(6, 0, [cash_payment_method.id, bank_payment_method.id])]})

        return res

    def _create_default_pos_receivable_account(self, company):
        vals = {
            'name': 'Account Receivable PoS',
            'code': '101210',
            'user_type_id': self.env.ref('account.data_account_type_receivable').id,
            'reconcile': True,
        }
        pos_rec_account = self.env['account.account'].create(vals)
        company.write({'default_pos_receivable_account': pos_rec_account.id})
        return pos_rec_account

    def _create_cash_payment_method(self, receivable_account, cash_journal):
        vals = {
            'name': 'Cash',
            'receivable_account_id': receivable_account.id,
            'is_cash_count': True,
            'cash_journal_id': cash_journal.id,
            'split_transactions': 'combine',
        }
        return self.env['pos.payment.method'].create(vals)

    def _create_bank_payment_method(self, receivable_account):
        vals = {
            'name': 'Bank',
            'receivable_account_id': receivable_account.id,
            'is_cash_count': False,
            'split_transactions': 'combine',
        }
        return self.env['pos.payment.method'].create(vals)

    def _create_pos_cash_journal(self, company):
        return self.env['account.journal'].create({
            'name': _('Cash'),
            'type': 'cash',
            'company_id': company.id,
            'sequence': 10,
        })