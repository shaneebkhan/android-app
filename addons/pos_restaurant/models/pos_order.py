# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class PosOrder(models.Model):
    _inherit = 'pos.order'

    table_id = fields.Many2one('restaurant.table', string='Table', help='The table where this order was served')
    customer_count = fields.Integer(string='Guests', help='The amount of customers that have been served by this order.')
    tip_amount = fields.Float(string='Tip Amount', compute='_compute_tip_amount', inverse='_set_tip_amount', help='The total amount tipped, this is computed using the configured tip product. This is the amount that will be captured when the session is closed.')
    is_tipped = fields.Boolean(string='Is Tipped', compute='_compute_is_tipped', help='Whether or not an order has been processed in the tipping interface.')
    is_tippable = fields.Boolean(string='Is Tippable', compute='_compute_is_tippable', help='Whether or not an order\'s tip can be changed.')

    table_name = fields.Char(related='table_id.name', help='Used to easily load this in the POS.')
    partner_name = fields.Char(related='partner_id.name', help='Used to easily load this in the POS.')

    def _compute_tip_amount(self):
        for order in self:
            tip_product = order.config_id.tip_product_id
            lines = order.lines.filtered(lambda line: line.product_id == tip_product)
            order.tip_amount = sum(lines.mapped('price_subtotal_incl'))

    def _set_tip_amount(self):
        for order in self:
            tip_product = order.config_id.tip_product_id
            tip_line = order.lines.filtered(lambda line: line.product_id == tip_product)
            tip_line = tip_line[0] if tip_line else False

            if not tip_line:
                tip_line = self.env['pos.order.line'].create({
                    'name': 'Tip',
                    'product_id': tip_product.id,
                    'price_unit': order.tip_amount,
                    'price_subtotal': 0,  # will be calculated by _compute_amount_line_all
                    'price_subtotal_incl': 0,  # will be calculated by _compute_amount_line_all
                    'tax_ids': [(6, 0, [tip_product.taxes_id.id])] if tip_product.taxes_id else []
                })
                order.lines |= tip_line

            tip_line.qty = 1
            tip_line.price_unit = order.tip_amount

            new_amounts = tip_line._compute_amount_line_all()
            tip_line.write({
                'price_subtotal_incl': new_amounts['price_subtotal_incl'],
                'price_subtotal': new_amounts['price_subtotal']
            })

            order._onchange_amount_all()

            if not order.test_paid():
                order.state = 'draft'

    @api.depends('config_id.tip_product_id', 'lines')
    def _compute_is_tipped(self):
        for order in self:
            tip_product = order.config_id.tip_product_id
            order.is_tipped = any(order.lines.filtered(lambda line: line.product_id == tip_product))

    @api.depends('statement_ids')
    def _compute_is_tippable(self):
        for order in self:
            order.is_tippable = any(journal_type != 'cash' for journal_type in order.statement_ids.mapped('journal_id.type'))
            print('order is {}'.format(order.is_tippable))

    @api.model
    def _order_fields(self, ui_order):
        order_fields = super(PosOrder, self)._order_fields(ui_order)
        order_fields['table_id'] = ui_order.get('table_id', False)
        order_fields['customer_count'] = ui_order.get('customer_count', 0)
        return order_fields

    @api.model
    def set_tip(self, pos_reference, new_tip):
        order = self.search([('pos_reference', 'like', pos_reference)], limit=1)
        if not order:
            raise ValidationError(_('Reference %s does not exist.') % pos_reference)

        order.tip_amount = new_tip
        return True
