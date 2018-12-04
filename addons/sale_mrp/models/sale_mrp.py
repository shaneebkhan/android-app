# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.tools import float_compare


class SaleOrderLine(models.Model):
    _inherit = 'sale.order.line'

    @api.multi
    def _compute_qty_delivered(self):
        super(SaleOrderLine, self)._compute_qty_delivered()
        for order_line in self:
            if order_line.qty_delivered_method == 'stock_move':
                boms = order_line.move_ids.mapped('bom_line_id.bom_id')
                relevant_boms = boms.filtered(lambda b: b.type == 'phantom' and (b.product_id == order_line.product_id or b.product_tmpl_id == order_line.product_id.product_tmpl_id))
                prioritary_bom = min(relevant_boms, key=lambda b: b.sequence, default=self.env['mrp.bom'])
                if prioritary_bom:
                    moves = order_line.move_ids.filtered(lambda m: m.state == 'done' and not m.scrapped)
                    qty_ratios = []
                    order_uom_qty = order_line.product_uom._compute_quantity(order_line.product_uom_qty, prioritary_bom.product_uom_id)
                    boms, bom_sub_lines = prioritary_bom.explode(order_line.product_id, order_uom_qty)
                    for bom_line, bom_line_data in bom_sub_lines:
                        relevant_moves = moves.filtered(lambda m: m.bom_line_id == bom_line)
                        if relevant_moves:
                            qty_needed = bom_line_data['qty'] / bom_line_data['original_qty']
                            qty_uom_needed = bom_line.product_uom_id._compute_quantity(qty_needed, bom_line.product_id.product_tmpl_id.uom_id)
                            qty_uom_processed = 0.0
                            relevant_delivered_moves = relevant_moves.filtered(lambda m: m.location_dest_id.usage == 'customer' and not m.origin_returned_move_id or not (m.origin_returned_move_id and m.to_refund))
                            for move in relevant_delivered_moves:
                                qty_uom_processed += move.product_uom._compute_quantity(move.quantity_done, move.product_tmpl_id.uom_id)
                            relevant_return_moves = relevant_moves.filtered(lambda m: m.location_dest_id.usage != 'customer' and m.to_refund)
                            for move in relevant_return_moves:
                                qty_uom_processed -= move.product_uom._compute_quantity(move.quantity_done, move.product_tmpl_id.uom_id)
                            qty_ratios.append(qty_uom_processed / qty_uom_needed)
                        else:
                            qty_ratios.append(0.0)
                    if qty_ratios:
                        order_line.qty_delivered = min(qty_ratios) // 1
                    else:
                        order_line.qty_delivered = 0.0

    @api.multi
    def _get_bom_component_qty(self, bom):
        bom_quantity = self.product_uom._compute_quantity(1, bom.product_uom_id)
        boms, lines = bom.explode(self.product_id, bom_quantity)
        components = {}
        for line, line_data in lines:
            product = line.product_id.id
            uom = line.product_uom_id
            qty = line.product_qty
            if components.get(product, False):
                if uom.id != components[product]['uom']:
                    from_uom = uom
                    to_uom = self.env['uom.uom'].browse(components[product]['uom'])
                    qty = from_uom._compute_quantity(qty, to_uom)
                components[product]['qty'] += qty
            else:
                # To be in the uom reference of the product
                to_uom = self.env['product.product'].browse(product).uom_id
                if uom.id != to_uom.id:
                    from_uom = uom
                    qty = from_uom._compute_quantity(qty, to_uom)
                components[product] = {'qty': qty, 'uom': to_uom.id}
        return components

    def _get_not_enough_inventory_warning_message(self, product, precision):
        # In case of a kit we have to check the virtual available quanity on each components to know if
        # we have to trigger a warning or not
        res = super(SaleOrderLine, self)._get_not_enough_inventory_warning_message(product, precision)
        bom = self.env['mrp.bom']._bom_find(product=product, bom_type='phantom')
        if bom:
            warehouse_id = self.order_id.warehouse_id
            virtual_available = self._get_components_qty_virtual_available(product, bom, warehouse_id)
            virtual_available_all_wh = 0.0
            virtual_available_by_wh = {}
            for warehouse in self.env['stock.warehouse'].search([]):
                virtual_available_by_wh[warehouse] = self._get_components_qty_virtual_available(self.product_id, bom, warehouse)
                virtual_available_all_wh += virtual_available_by_wh[warehouse]
            # As negative quantities doesn't really make sense in case of kits,
            # we hide them and set them to 0 instead.
            virtual_available = 0 if virtual_available < 0 else virtual_available
            virtual_available_all_wh = 0 if virtual_available_all_wh < 0 else virtual_available_all_wh
            message = _('You plan to sell %s %s of %s but you only have %s %s available in %s warehouse.') % \
                      (self.product_uom_qty, self.product_uom.name, self.product_id.name, virtual_available,
                       product.uom_id.name, self.order_id.warehouse_id.name)
            # We check if some products are available in other warehouses.
            if float_compare(virtual_available, virtual_available_all_wh,  precision_digits=precision) == -1:
                message += _('\nThere are %s %s available across all warehouses.\n\n') % \
                           (virtual_available_all_wh, product.uom_id.name)
                for warehouse in self.env['stock.warehouse'].search([]):
                    if virtual_available_by_wh[warehouse] > 0:
                        message += "%s: %s %s\n" % (warehouse.name, virtual_available_by_wh[warehouse], self.product_id.uom_id.name)
            warning_mess = {
                'title': _('Not enough inventory!'),
                'message': message
            }
            product_qty = self.product_uom._compute_quantity(self.product_uom_qty, self.product_id.uom_id)
            if float_compare(virtual_available, product_qty, precision_digits=precision) == -1:
                return {'warning': warning_mess}
            return {}
        return res

    def _get_components_qty_virtual_available(self, product_id, bom, warehouse_id):
        boms, bom_sub_lines = bom.explode(product_id, self.product_uom_qty)
        qty_ratios = []
        for bs_line in bom_sub_lines:
            bom_line = bs_line[0]
            bom_line_datas = bs_line[1]
            qty_needed = bom_line_datas['qty'] / bom_line_datas['original_qty']
            qty_uom_needed = bom_line.product_uom_id._compute_quantity(qty_needed, bom_line.product_id.product_tmpl_id.uom_id)
            qty_ratios.append(bom_line.product_id.with_context(warehouse=warehouse_id.id).virtual_available / qty_uom_needed)
        if qty_ratios:
            return min(qty_ratios) // 1
        return 0.0

    def _get_qty_procurement(self):
        self.ensure_one()
        # Specific case when we change the qty on a SO for a kit product.
        # We don't try to be too smart and keep a simple approach: we compare the quantity before
        # and after update, and return the difference. We don't take into account what was already
        # sent, or any other exceptional case.
        bom = self.env['mrp.bom']._bom_find(product=self.product_id, bom_type='phantom')
        if bom and 'previous_product_uom_qty' in self.env.context:
            return self.env.context['previous_product_uom_qty'].get(self.id, 0.0)
        return super(SaleOrderLine, self)._get_qty_procurement()


class AccountInvoiceLine(models.Model):
    # TDE FIXME: what is this code ??
    _inherit = "account.invoice.line"

    def _get_anglo_saxon_price_unit(self):
        price_unit = super(AccountInvoiceLine, self)._get_anglo_saxon_price_unit()
        # in case of anglo saxon with a product configured as invoiced based on delivery, with perpetual
        # valuation and real price costing method, we must find the real price for the cost of good sold
        if self.product_id.invoice_policy == "delivery":
            for s_line in self.sale_line_ids:
                # qtys already invoiced
                qty_done = sum([x.uom_id._compute_quantity(x.quantity, x.product_id.uom_id) for x in s_line.invoice_lines if x.invoice_id.state in ('open', 'in_payment', 'paid')])
                quantity = self.uom_id._compute_quantity(self.quantity, self.product_id.uom_id)
                # Put moves in fixed order by date executed
                moves = s_line.move_ids.sorted(lambda x: x.date)
                # Go through all the moves and do nothing until you get to qty_done
                # Beyond qty_done we need to calculate the average of the price_unit
                # on the moves we encounter.
                bom = s_line.product_id.product_tmpl_id.bom_ids and s_line.product_id.product_tmpl_id.bom_ids[0]
                if bom.type == 'phantom':
                    average_price_unit = 0
                    components = s_line._get_bom_component_qty(bom)
                    for product_id in components:
                        factor = components[product_id]['qty']
                        prod_moves = [m for m in moves if m.product_id.id == product_id]
                        prod_qty_done = factor * qty_done
                        prod_quantity = factor * quantity
                        average_price_unit += factor * self._compute_average_price(prod_qty_done, prod_quantity, prod_moves)
                    price_unit = average_price_unit or price_unit
                    price_unit = self.product_id.uom_id._compute_price(price_unit, self.uom_id)
        return price_unit
