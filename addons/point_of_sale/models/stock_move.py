from odoo import api, fields, models

class StockMove(models.Model):
    _inherit = 'stock.move'

    pos_order_id = fields.Many2one('pos.order', string="Pos Order")
