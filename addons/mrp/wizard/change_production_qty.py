# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.addons import decimal_precision as dp
from odoo.exceptions import UserError
from odoo.tools import float_is_zero, float_round


class ChangeProductionQty(models.TransientModel):
    _name = 'change.production.qty'
    _description = 'Change Production Qty'

    mo_id = fields.Many2one('mrp.production', 'Manufacturing Order', required=True)
    product_qty = fields.Float(
        'Quantity To Produce',
        digits=dp.get_precision('Product Unit of Measure'), required=True)

    @api.model
    def default_get(self, fields):
        res = super(ChangeProductionQty, self).default_get(fields)
        if 'mo_id' in fields and not res.get('mo_id') and self._context.get('active_model') == 'mrp.production' and self._context.get('active_id'):
            res['mo_id'] = self._context['active_id']
        if 'product_qty' in fields and not res.get('product_qty') and res.get('mo_id'):
            res['product_qty'] = self.env['mrp.production'].browse(res['mo_id']).product_qty
        return res

    @api.multi
    def change_prod_qty(self):
        precision = self.env['decimal.precision'].precision_get('Product Unit of Measure')
        for wizard in self:
            production = wizard.mo_id
            raw_moves = production.move_raw_ids

            # Get the quantity already produced while taking care of ignoring the byproducts. If
            # the new quantity to produce is lower than the quantity already produced, raise.
            produced = sum(production.move_finished_ids.filtered(lambda m: m.product_id == production.product_id).mapped('quantity_done'))
            if wizard.product_qty < produced: # FIXME sle: use float compare
                format_qty = '%.{precision}f'.format(precision=precision)
                raise UserError(_("You have already processed %s. Please input a quantity higher than %s ") % (format_qty % produced, format_qty % produced))

            # Update `product_qty` on the MO.
            old_production_qty = production.product_qty
            production.write({'product_qty': wizard.product_qty})
            qty_difference = production.product_qty - old_production_qty  # FIXME sle: it may be negative?

            # Update the raw move, take care of creating a new one if it is/ they are done or
            # cancelled. Afterwards, try to reserve them.
            if self.env.context.get('debug'):
                import pudb; pudb.set_trace()
            for bom_line_id in raw_moves.mapped('bom_line_id'):
                raw_move_orig = raw_moves.filtered(lambda m: m.bom_line_id == bom_line_id)[0]
                qty_to_add = raw_move_orig.unit_factor * qty_difference
                if raw_move_orig.state not in ['done', 'cancel']:
                    raw_move_orig.write({'product_uom_qty': raw_move_orig.product_uom_qty + qty_to_add})
                else:
                    defaults = {
                        'product_uom_qty': qty_to_add,
                        'production_id': production.id,
                    }
                    raw_move_orig.copy(default=defaults)._action_confirm()
            production.move_raw_ids.filtered(lambda m: m.state not in ['done', 'cancel'])._action_assign()

            # Update the finished move, take care of creating a new one if it is/they are done or
            # cancelled.
            finished_move = production.move_finished_ids.filtered(lambda m: m.product_id.id == production.product_id.id and m.state not in ['done', 'cancel'])
            if finished_move:
                finished_move.write({'product_uom_qty': finished_move.product_uom_qty + qty_difference})
            else:
                # FIXME sle: don't call this method if qty_difference is negative
                production._generate_finished_moves(product_qty=qty_difference)
        return {}

#            done_moves = production.move_finished_ids.filtered(lambda x: x.state == 'done' and x.product_id == production.product_id)
#            qty_produced = production.product_id.uom_id._compute_quantity(sum(done_moves.mapped('product_qty')), production.product_uom_id)
#            factor = production.product_uom_id._compute_quantity(production.product_qty - qty_produced, production.bom_id.product_uom_id) / production.bom_id.product_qty
#            boms, lines = production.bom_id.explode(production.product_id, factor, picking_type=production.bom_id.picking_type_id)
#            documents = {}
#            for line, line_data in lines:
#                move, old_qty, new_qty = production._update_raw_move(line, line_data)
#                iterate_key = production._get_document_iterate_key(move)
#                if iterate_key:
#                    document = self.env['stock.picking']._log_activity_get_documents({move: (new_qty, old_qty)}, iterate_key, 'UP')
#                    for key, value in document.items():
#                        if documents.get(key):
#                            documents[key] += [value]
#                        else:
#                            documents[key] = [value]
#            production._log_manufacture_exception(documents)
#            operation_bom_qty = {}
#            for bom, bom_data in boms:
#                for operation in bom.routing_id.operation_ids:
#                    operation_bom_qty[operation.id] = bom_data['qty']
#            finished_moves_modification = self._update_product_to_produce(production, production.product_qty - qty_produced, old_production_qty)
#            production._log_downside_manufactured_quantity(finished_moves_modification)
#
#
#            # Workorder handling
#            for wo in production.workorder_ids:
#                operation = wo.operation_id
#                if operation_bom_qty.get(operation.id):
#                    cycle_number = float_round(operation_bom_qty[operation.id] / operation.workcenter_id.capacity, precision_digits=0, rounding_method='UP')
#                    wo.duration_expected = (operation.workcenter_id.time_start +
#                                 operation.workcenter_id.time_stop +
#                                 cycle_number * operation.time_cycle * 100.0 / operation.workcenter_id.time_efficiency)
#                quantity = wo.qty_production - wo.qty_produced
#                if production.product_id.tracking == 'serial':
#                    quantity = 1.0 if not float_is_zero(quantity, precision_digits=precision) else 0.0
#                else:
#                    quantity = quantity if (quantity > 0) else 0
#                if float_is_zero(quantity, precision_digits=precision):
#                    wo.final_lot_id = False
#                    wo.active_move_line_ids.unlink()
#                wo.qty_producing = quantity
#                if wo.qty_produced < wo.qty_production and wo.state == 'done':
#                    wo.state = 'progress'
#                if wo.qty_produced == wo.qty_production and wo.state == 'progress':
#                    wo.state = 'done'
#                # assign moves; last operation receive all unassigned moves
#                # TODO: following could be put in a function as it is similar as code in _workorders_create
#                # TODO: only needed when creating new moves
#                moves_raw = production.move_raw_ids.filtered(lambda move: move.operation_id == operation and move.state not in ('done', 'cancel'))
#                if wo == production.workorder_ids[-1]:
#                    moves_raw |= production.move_raw_ids.filtered(lambda move: not move.operation_id)
#                moves_finished = production.move_finished_ids.filtered(lambda move: move.operation_id == operation) #TODO: code does nothing, unless maybe by_products?
#                moves_raw.mapped('move_line_ids').write({'workorder_id': wo.id})
#                (moves_finished + moves_raw).write({'workorder_id': wo.id})
#                if quantity > 0 and wo.move_raw_ids.filtered(lambda x: x.product_id.tracking != 'none') and not wo.active_move_line_ids:
#                    wo._generate_lot_ids()
#        return {}
