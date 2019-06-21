from odoo import api, models, fields


class StockProductQuantityWizard(models.TransientModel):
    _name = 'sale.order.line.wizard'
    _description = "Sale Order Quantity Wizard"

    @api.model
    def default_get(self, fields):
        result = super(StockProductQuantityWizard, self).default_get(fields)
        sale_order_line = self.env['sale.order.line'].browse(self.env.context.get('active_id'))
        if sale_order_line.order_id.picking_ids:
            delivery_date = max(sale_order_line.order_id.picking_ids.mapped('scheduled_date'))
        else:
            delivery_date = sale_order_line.order_id.confirmation_date
        product_id = sale_order_line.with_context(from_date=delivery_date, warehouse_id=sale_order_line.order_id.warehouse_id).product_id
        result['on_hand_at_date'] = product_id.virtual_available
        result['on_hand'] = product_id.qty_available
        result['product_uom_id'] = sale_order_line.product_uom_id.id
        return result

    on_hand_at_date = fields.Float('On Hand At Delivery Date')
    on_hand = fields.Float('Available On Hand')
    product_uom_id = fields.Many2one('uom.uom', 'Unit of Measure', required=True, readonly=True)

    def _action_open_forcasted(self):
        pass
