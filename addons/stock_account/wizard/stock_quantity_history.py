# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class StockQuantityHistory(models.TransientModel):
    _inherit = 'stock.quantity.history'

    def open_at_date(self):
        active_model = self.env.context.get('active_model')
        if active_model == 'stock.valuation.layer':
            action = self.env.ref('stock_account.stock_valuation_layer_action').read()[0]
            if self.date.date() != fields.Date.today():
                action['domain'] = [('create_date', '<=', self.date)]
                action['display_name'] = str(self.date)
                return action
            else:
                return action

        return super(StockQuantityHistory, self).open_at_date()
