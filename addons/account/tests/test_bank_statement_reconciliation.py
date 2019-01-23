from odoo.addons.account.tests.account_test_classes import AccountingTestCase
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestBankStatementReconciliation(AccountingTestCase):

    def setUp(self):
        super(TestBankStatementReconciliation, self).setUp()
        self.bs_model = self.env['account.bank.statement']
        self.bsl_model = self.env['account.bank.statement.line']
        self.reconciliation_widget = self.env['account.reconciliation.widget']
        self.partner = self.env['res.partner'].create({'name': 'test'})

    def test_reconciliation_proposition(self):
        rcv_mv_line = self.create_invoice(100)
        st_line = self.create_statement_line(100)

        # exact amount match
        rec_prop = self.reconciliation_widget.get_bank_statement_line_data(st_line.ids)['lines']
        prop = rec_prop[0]['reconciliation_proposition']

        self.assertEqual(len(prop), 1)
        self.assertEqual(prop[0]['id'], rcv_mv_line.id)

    def test_full_reconcile(self):
        self._reconcile_invoice_with_statement(False)

    def test_post_at_bank_rec_full_reconcile(self):
        """ Test the full reconciliation of a bank statement directly with an invoice.
        """
        self._reconcile_invoice_with_statement(True)

    def _reconcile_invoice_with_statement(self, post_at_bank_rec):
        """ Tests the reconciliation of an invoice with a bank statement, using
        the provided 'post at bank reconciliation' value for the bank journal
        where to generate the statement.
        """
        self.bs_model.with_context(journal_type='bank')._default_journal().post_at_bank_reconciliation = post_at_bank_rec
        rcv_mv_line = self.create_invoice(100)
        st_line = self.create_statement_line(100)
        # reconcile
        st_line.process_reconciliation(counterpart_aml_dicts=[{
            'move_line': rcv_mv_line,
            'credit': 100,
            'debit': 0,
            'name': rcv_mv_line.name,
        }])

        # check everything went as expected
        self.assertTrue(st_line.journal_entry_ids)
        counterpart_mv_line = None
        for l in st_line.journal_entry_ids:
            if l.account_id.user_type_id.type == 'receivable':
                counterpart_mv_line = l
                break
        self.assertIsNotNone(counterpart_mv_line)
        self.assertTrue(rcv_mv_line.reconciled)
        self.assertTrue(counterpart_mv_line.reconciled)
        self.assertEqual(counterpart_mv_line.matched_credit_ids, rcv_mv_line.matched_debit_ids)
        self.assertEqual(rcv_mv_line.move_id.invoice_payment_state, 'paid', "The related invoice's state should now be 'paid'")

    def test_reconcile_with_write_off(self):
        pass

    def create_invoice(self, amount):
        """ Return the move line that gets to be reconciled (the one in the receivable account) """
        move = self.env['account.move'].create({
            'type': 'out_invoice',
            'partner_id': self.partner.id,
            'type': 'out_invoice',
            'invoice_line_ids': [(0, 0, {
                'quantity': 1,
                'price_unit': amount,
                'name': 'test invoice',
            })],
        })
        move.post()
        return move.line_ids.filtered(lambda line: line._is_invoice_payment_term_line())

    def create_statement_line(self, st_line_amount):
        journal = self.bs_model.with_context(journal_type='bank')._default_journal()
        #journal = self.env.ref('l10n_be.bank_journal')
        bank_stmt = self.bs_model.create({'journal_id': journal.id})

        bank_stmt_line = self.bsl_model.create({
            'name': '_',
            'statement_id': bank_stmt.id,
            'partner_id': self.partner.id,
            'amount': st_line_amount,
            })

        return bank_stmt_line
