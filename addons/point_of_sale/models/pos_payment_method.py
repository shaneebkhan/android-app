from odoo import api, fields, models
from odoo.exceptions import UserError


class PosPaymentMethod(models.Model):
    _name = "pos.payment.method"
    _description = "Point of Sale Payment Methods"
    _order = "id desc"

    def _default_pos_receivable_account(self):
        return self.env.company.get_default_pos_receivable_account()

    name = fields.Char(string="Name", required=True)
    receivable_account_id = fields.Many2one(comodel_name='account.account',
        string='Intermediary Account',
        required=True,
        domain=[('reconcile', '=', True), ('user_type_id.type', '=', 'receivable')],
        default=_default_pos_receivable_account,
        help='Account used as counterpart of the income account in the accounting entry representing the pos sales.')
    is_cash_count = fields.Boolean(string='Cash')
    cash_journal_id = fields.Many2one(comodel_name='account.journal',
        string='Cash Journal',
        domain=[('type', '=', 'cash')],
        help='The payment method is of type cash. A cash statement will be automatically generated.')
    split_transactions = fields.Selection(
        [('combine', 'One journal item for all transactions'),
         ('split', 'One journal item per transaction'),
        ], string='Split Transactions', default='combine',
        help='Determine whether payment made with this method will generate separate receivable journal item.')
    session_ids = fields.Many2many(comodel_name='pos.session', string='Pos Sessions', help='Pos sessions that are using this payment method.')

    @api.multi
    def write(self, vals):
        active_sessions = self.mapped('session_ids').filtered(lambda session: session.state != 'closed')
        if active_sessions:
            raise UserError('Modifying payment methods used in an open session is not allowed.\n'
                            'Open sessions: %s' % (' '.join(active_sessions.mapped('name')),))
        # set cash_journal_id to False if is_cash_count is changed to False
        if not vals.get('is_cash_count', True):
            vals['cash_journal_id'] = False
        return super(PosPaymentMethod, self).write(vals)
