from odoo import api, fields, models
from odoo.exceptions import UserError


class PosPaymentMethod(models.Model):
    _name = "pos.payment.method"
    _description = "Point of Sale Payment Methods"
    _order = "id desc"

    name = fields.Char(string="Name")
    receivable_account_id = fields.Many2one(comodel_name='account.account', string='Receivable Account')
    is_cash_count = fields.Boolean(string='Is cash count?')
    cash_journal_id = fields.Many2one(comodel_name='account.journal', string='Cash Journal', domain=[('type', '=', 'cash')]) # for the creation of cash payment
    is_identify_customer = fields.Boolean(string='Is identify customer?')
    session_ids = fields.Many2many(comodel_name='pos.session', string='Pos Sessions', help='Pos sessions that are using this payment method.')

    @api.multi
    def write(self, vals):
        active_sessions = self.mapped('session_ids').filtered(lambda session: session.state != 'closed')
        if active_sessions:
            raise UserError('Modifying payment methods used in an open session is not allowed.\n'
                            'Open sessions: %s' % (' '.join(active_sessions.mapped('name')),))
        # remove cash_journal_id if is_cash_count
        if vals.get('is_cash_count') and vals.get('cash_journal_id'):
            del vals['cash_journal_id']
        return super(PosPaymentMethod, self).write(vals)
