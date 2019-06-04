from odoo import api, fields, models

class StockMove(models.Model):
    _inherit = 'stock.move'

    pos_order_id = fields.Many2one(comodel_name='pos.order', string="Pos Order")