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
    amount = fields.Monetary(string='Amount', required=True, currency_field='currency_id', readonly=True, help="Total amount of the payment.")
    currency_id = fields.Many2one('res.currency', string='Currency', related='pos_order_id.currency_id', readonly=True)
    currency_rate = fields.Float(string='Conversion Rate', related='pos_order_id.currency_rate', help='Conversion rate from company currency to order currency.')
    payment_date = fields.Date(string='Date', required=True, readonly=True, copy=False, tracking=True, default=lambda self: fields.Date.today())
    partner_id = fields.Many2one('res.partner', related='pos_order_id.partner_id', string='Customer', tracking=True, readonly=True)
    session_id = fields.Many2one(comodel_name='pos.session', related='pos_order_id.session_id', string='Session', readonly=True, store=True)
    statement_id = fields.Many2one(comodel_name='account.bank.statement', string='Statement', help='Statement where this payment is registered.')
    payment_method_id = fields.Many2one(comodel_name='pos.payment.method', string='Payment Method')
    # status = forced or done
    # transaction_id
