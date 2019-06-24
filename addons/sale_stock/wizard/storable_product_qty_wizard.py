from odoo import api, models, fields


class StockProductQuantityWizard(models.TransientModel):
    _name = 'sale.order.line.wizard'
    _description = "Sale Order Quantity Wizard"

    @api.model
    def default_get(self, fields):
        result = super(StockProductQuantityWizard, self).default_get(fields)
        sale_order_line = self.env['sale.order.line'].browse(self.env.context.get('active_id'))
        product_id = sale_order_line.with_context(warehouse_id=sale_order_line.order_id.warehouse_id).product_id
        result['on_hand_at_date'] = sale_order_line.qty_at_date
        result['on_hand'] = product_id.qty_available
        result['product_uom_id'] = sale_order_line.product_uom.id
        return result

    on_hand_at_date = fields.Float('On Hand At Delivery Date')
    on_hand = fields.Float('Available On Hand')
    product_uom_id = fields.Many2one('uom.uom', 'Unit of Measure', required=True, readonly=True)

    def action_open_forcasted(self):
        pass
