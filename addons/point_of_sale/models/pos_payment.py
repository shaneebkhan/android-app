from odoo import api, fields, models


class PosPayment(models.Model):
    """ This model will be used to prevent using account.payment for each pos.order.
        The pos.payment for each pos.session will be combined to generate one (or more if multiple types)
        account.payment. This will reduce the number of account.payment, account.move and account.move.line
        that will be created when closing a pos session.
    """

    _name = "pos.payment"
    _description = "Point of Sale Payments"
    _order = "id desc"

    name = fields.Char(readonly=True, copy=False)
    pos_order_id = fields.Many2one(comodel_name='pos.order', string='Pos Order')
    amount = fields.Monetary(string='Payment Amount', required=True, readonly=True, help="Total amount of the payment.")
    # TODO jcb: company currency is not fully correct. Need to confirm this with PO.
    currency_id = fields.Many2one('res.currency', string='Currency', required=True, readonly=True, default=lambda self: self.env.company.currency_id)
    payment_date = fields.Date(string='Payment Date', required=True, readonly=True, copy=False, tracking=True, default=lambda self: fields.Date.today())
    partner_id = fields.Many2one('res.partner', related='pos_order_id.partner_id', string='Customer', tracking=True, readonly=True)
    session_id = fields.Many2one(comodel_name='pos.session', related='pos_order_id.session_id', string='Session', readonly=True, store=True)
    statement_id = fields.Many2one(comodel_name='account.bank.statement', string='Statement', help='Statement where this payment is registered.')
    payment_method_id = fields.Many2one(comodel_name='pos.payment.method', string='Payment Method')
    # status = forced or done
    # transaction_id
