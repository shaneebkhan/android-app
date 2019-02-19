# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from odoo import api, fields, models, _
from odoo.tools.float_utils import float_compare, float_is_zero


class StockValuationLayer(models.Model):
    """Stock Valuation Layer"""

    _name = 'stock.valuation.layer'
    _description = 'Stock Valuation Layer'
    _order = 'create_date, id'

    _rec_name = 'product_id'

    company_id = fields.Many2one('res.company', 'Company', default=lambda self: self.env.user.company_id, required=True)
    product_id = fields.Many2one('product.product', 'Product', required=True)
    quantity = fields.Float('Quantity', digits=0, help='Quantity')
    uom_id = fields.Many2one(related='product_id.uom_id', readonly=True, required=True)
    currency_id = fields.Many2one('res.currency', 'Currency', related='company_id.currency_id', required=True)
    unit_cost = fields.Monetary('Unit Value')
    value = fields.Float('Total Value', digits=0)
    remaining_qty = fields.Float(digits=0)
    description = fields.Text('Description')
    stock_move_id = fields.Many2one('stock.move', 'Stock Move')
    account_move_id = fields.Many2one('account.move', 'Journal Entry')


class StockMove(models.Model):
    """Stock Move"""

    _inherit = 'stock.move'

    stock_valuation_layer_ids = fields.One2many('stock.valuation.layer', 'stock_move_id')

    @api.model
    def _get_valued_types(self):
        """Returns a list of `valued_type` as strings. During `action_done`, we'll call
        `_is_[valued_type]'. If the result of this method is truthy, we'll consider the move to be
        valued.

        :returns: a list of `valued_type`
        :rtype: list
        """
        return ['in', 'out', 'dropshipped', 'dropshipped_returned']

    def _get_in_move_lines(self):
        """ Returns the `stock.move.line` records of `self` considered as incoming. It is done thanks
        to the `_should_be_valued` method of their source and destionation location as well as their
        owner.

        :returns: a subset of `self` containing the incoming records
        :rtype: recordset
        """
        self.ensure_one()
        res = self.env['stock.move.line']
        for move_line in self.move_line_ids:
            if move_line.owner_id and move_line.owner_id != move_line.company_id.partner_id:
                continue
            if not move_line.location_id._should_be_valued() and move_line.location_dest_id._should_be_valued():
                res |= move_line
        return res

    def _is_in(self):
        """Check if the move should be considered as entering the company so that the cost method
        will be able to apply the correct logic.

        :returns: True if the move is entering the company else False
        :rtype: bool
        """
        self.ensure_one()
        if self._get_in_move_lines():
            return True
        return False

    def _get_out_move_lines(self):
        """ Returns the `stock.move.line` records of `self` considered as outgoing. It is done thanks
        to the `_should_be_valued` method of their source and destionation location as well as their
        owner.

        :returns: a subset of `self` containing the outgoing records
        :rtype: recordset
        """
        res = self.env['stock.move.line']
        for move_line in self.move_line_ids:
            if move_line.owner_id and move_line.owner_id != move_line.company_id.partner_id:
                continue
            if move_line.location_id._should_be_valued() and not move_line.location_dest_id._should_be_valued():
                res |= move_line
        return res

    def _is_out(self):
        """Check if the move should be considered as leaving the company so that the cost method
        will be able to apply the correct logic.

        :returns: True if the move is leaving the company else False
        :rtype: bool
        """
        self.ensure_one()
        if self._get_out_move_lines():
            return True
        return False

    def _is_dropshipped(self):
        """Check if the move should be considered as a dropshipping move so that the cost method
        will be able to apply the correct logic.

        :returns: True if the move is a dropshipping one else False
        :rtype: bool
        """
        self.ensure_one()
        return self.location_id.usage == 'supplier' and self.location_dest_id.usage == 'customer'

    def _is_dropshipped_returned(self):
        """Check if the move should be considered as a returned dropshipping move so that the cost
        method will be able to apply the correct logic.

        :returns: True if the move is a returned dropshipping one else False
        :rtype: bool
        """
        self.ensure_one()
        return self.location_id.usage == 'customer' and self.location_dest_id.usage == 'supplier'

    def _prepare_common_svl_vals(self):
        """When a `stock.valuation.layer` is created from a `stock.move`, we can prepare a dict of
        common vals.

        :returns: the common values when creating a `stock.valuation.layer` from a `stock.move`
        :rtype: dict
        """
        self.ensure_one()
        return {
            'stock_move_id': self.id,
            'company_id': self.company_id.id,
            'product_id': self.product_id.id,
            'description': self.name,
        }

    def _create_in_svl(self, forced_quantity=None):
        """Create a `stock.valuation.layer` from `self`.

        :param forced_quantity: under some circunstances, the quantity to value is different than
            the initial demand of the move (Default value = None)
        """
        svl_vals_list = []
        for move in self:
            valued_move_lines = move._get_in_move_lines()
            valued_quantity = 0
            for valued_move_line in valued_move_lines:
                valued_quantity += valued_move_line.product_uom_id._compute_quantity(valued_move_line.qty_done, move.product_id.uom_id)

            unit_cost = move._get_price_unit()
            # It may be negative (decrease an out move)
            if unit_cost < 0:
                unit_cost = unit_cost * -1
            if move.product_id.cost_method == 'standard':
                unit_cost = move.product_id.standard_price

            svl_vals = move.product_id._svl_in_prepare_vals(forced_quantity or valued_quantity, unit_cost)
            svl_vals.update(move._prepare_common_svl_vals())
            svl_vals_list.append(svl_vals)
        self.env['stock.valuation.layer'].create(svl_vals_list)

    def _create_out_svl(self, forced_quantity=None):
        """Create a `stock.valuation.layer` from `self`.

        :param forced_quantity: under some circunstances, the quantity to value is different than
            the initial demand of the move (Default value = None)
        """
        svl_vals_list = []
        updated_standard_price = {}
        for move in self:
            valued_move_lines = move._get_out_move_lines()
            valued_quantity = 0
            for valued_move_line in valued_move_lines:
                valued_quantity += valued_move_line.product_uom_id._compute_quantity(valued_move_line.qty_done, move.product_id.uom_id)
            svl_vals, new_standard_price_product = move.product_id._svl_out_prepare_vals(forced_quantity or valued_quantity)
            updated_standard_price[move.product_id] = new_standard_price_product
            svl_vals.update(move._prepare_common_svl_vals())
            svl_vals_list.append(svl_vals)

        # Update the standard price if needed
        for product, standard_price in updated_standard_price.items():
            if standard_price is None:
                continue
            product.write({'standard_price': standard_price})
        self.env['stock.valuation.layer'].create(svl_vals_list)

    def _create_dropshipped_svl(self, forced_quantity=None):
        """Create a `stock.valuation.layer` from `self`.

        :param forced_quantity: under some circunstances, the quantity to value is different than
            the initial demand of the move (Default value = None)
        """
        svl_vals_list = []
        for move in self:
            valued_move_lines = move.move_line_ids
            valued_quantity = 0
            for valued_move_line in valued_move_lines:
                valued_quantity += valued_move_line.product_uom_id._compute_quantity(valued_move_line.qty_done, move.product_id.uom_id)

            unit_cost = move._get_price_unit()
            if move.product_id.cost_method == 'standard':
                unit_cost = move.product_id.standard_price

            quantity = forced_quantity or valued_quantity

            common_vals = dict(move._prepare_common_svl_vals(), remaining_qty=0)

            # create the in
            in_vals = {
                'unit_cost': unit_cost,
                'value': unit_cost * quantity,
                'quantity': quantity,
            }
            in_vals.update(common_vals)
            svl_vals_list.append(in_vals)

            # create the out

            out_vals = {
                'unit_cost': unit_cost,
                'value': unit_cost * quantity * -1,
                'quantity': quantity * -1,
            }
            out_vals.update(common_vals)
            svl_vals_list.append(out_vals)
        self.env['stock.valuation.layer'].create(svl_vals_list)

    def _create_dropshipped_returned_svl(self, forced_quantity=None):
        """Create a `stock.valuation.layer` from `self`.

        :param forced_quantity: under some circunstances, the quantity to value is different than
            the initial demand of the move (Default value = None)
        """
        svl_vals_list = []
        for move in self:
            vals = move._prepare_common_svl_vals()
            svl_vals_list.append(vals)
        self.env['stock.valuation.layer'].create(svl_vals_list)

    def _product_price_update_before_done(self, forced_qty=None):
        """Computation of the AVCO.

        :param forced_quantity: under some circunstances, the quantity to value is different than
            the initial demand of the move (Default value = None)
        """
        tmpl_dict = defaultdict(lambda: 0.0)
        std_price_update = {}

        for move in self:
            if not(move._is_in() and move.product_id.cost_method == 'average'):
                continue

            product_tot_qty_available = move.product_id.quantity_svl + tmpl_dict[move.product_id.id]
            rounding = move.product_id.uom_id.rounding

            qty_done = move.product_uom._compute_quantity(move.quantity_done, move.product_id.uom_id)
            if float_is_zero(product_tot_qty_available, precision_rounding=rounding):
                new_std_price = move._get_price_unit()
            elif float_is_zero(product_tot_qty_available + move.product_qty, precision_rounding=rounding) or \
                    float_is_zero(product_tot_qty_available + qty_done, precision_rounding=rounding):
                new_std_price = move._get_price_unit()
            else:
                # Get the standard price
                amount_unit = std_price_update.get((move.company_id.id, move.product_id.id)) or move.product_id.standard_price
                qty = forced_qty or qty_done
                new_std_price = ((amount_unit * product_tot_qty_available) + (move._get_price_unit() * qty)) / (product_tot_qty_available + qty)

            tmpl_dict[move.product_id.id] += qty_done
            # Write the standard price, as SUPERUSER_ID because a warehouse manager may not have the right to write on products
            move.product_id.with_context(force_company=move.company_id.id).sudo().write({'standard_price': new_std_price})
            std_price_update[move.company_id.id, move.product_id.id] = new_std_price

    def _action_done(self, cancel_backorder=False):
        """Override to handle the creation of `stock.valuation.layer` records for valued moves, the
        computation of the AVCO and the run of the vacuum.
        """
        # Init a dict that will group the moves by valuation type, according to `move._is_valued_type`.
        valued_moves = {valued_type: self.env['stock.move'] for valued_type in self._get_valued_types()}
        for move in self:
            for valued_type in self._get_valued_types():
                if getattr(move, '_is_%s' % valued_type)():
                    valued_moves[valued_type] |= move
                    continue

        # AVCO application
        valued_moves['in']._product_price_update_before_done()

        res = super(StockMove, self)._action_done(cancel_backorder=cancel_backorder)

        # Create the valuation layers in batch by calling `moves._create_valued_type_svl`.
        for valued_type in self._get_valued_types():
            todo_valued_moves = valued_moves[valued_type]
            if todo_valued_moves:
                getattr(todo_valued_moves, '_create_%s_svl' % valued_type)()
                continue

        # For every in move, run the vacuum for the linked product.
        products_to_vacuum = valued_moves['in'].mapped('product_id')
        for product_to_vacuum in products_to_vacuum:
            product_to_vacuum._run_vacuum()

        return res


class ProductTemplate(models.Model):
    """ """
    _inherit = 'product.template'

    def write(self, vals):
        """

        :param vals: 

        """
        if 'categ_id' in vals:
            new_cost_method = self.env['product.category'].browse(vals['categ_id']).property_cost_method

            impacted_product_ids = []
            impacted_products = self.env['product.product']
            products_orig_quantity_svl = {}

            # get the impacted products
            for product_template in self:
                if product_template.cost_method != new_cost_method:
                    products = self.env['product.product'].search_read([
                        ('type', '=', 'product'),
                        ('product_tmpl_id', '=', product_template.id),
                    ], ['quantity_svl'])
                    for product in products:
                        impacted_product_ids.append(product['id'])
                        products_orig_quantity_svl[product['id']] = product['quantity_svl']
            impacted_products |= self.env['product.product'].browse(impacted_product_ids)

            # empty out the stock for the impacted products
            empty_stock_svl_list = []
            new_standard_price = None
            for product in impacted_products:
                if float_is_zero(product.quantity_svl, precision_rounding=product.uom_id.rounding):
                    # FIXME: if the quantity to value is 0, we could create an empty layer to track the change
                    continue
                svl_vals, new_standard_price = product._svl_out_prepare_vals(product.quantity_svl)
                empty_stock_svl_list.append(svl_vals)
            self.env['stock.valuation.layer'].create(empty_stock_svl_list)
            # FIXME: set new std price

            # call super to apply the cost method change
            res = super(ProductTemplate, self).write(vals)

            # refill the stock for the impacted products
            refill_stock_svl_list = []
            for product in impacted_products:
                quantity_svl = products_orig_quantity_svl[product.id]
                if quantity_svl:
                    refill_stock_svl_list.append(product._svl_in_prepare_vals(quantity_svl, product.standard_price))
            self.env['stock.valuation.layer'].create(refill_stock_svl_list)
            return res
        return super(ProductTemplate, self).write(vals)


class ProductProduct(models.Model):
    """Product Product"""
    _inherit = 'product.product'

    value_svl = fields.Float(compute='_compute_value_svl')
    quantity_svl = fields.Float(compute='_compute_value_svl')
    stock_valuation_layer_ids = fields.One2many('stock.valuation.layer', 'product_id')

    @api.depends('stock_valuation_layer_ids')
    def _compute_value_svl(self):
        """Compute `value_svl` and `quantity_svl`."""
        groups = self.env['stock.valuation.layer'].read_group([
            ('product_id', 'in', self.ids),
            ('company_id', '=', self.env.user.company_id.id)
        ], ['value:sum', 'quantity:sum'], ['product_id'])
        for group in groups:
            product = self.browse(group['product_id'][0])
            product.value_svl = group['value']
            product.quantity_svl = group['quantity']

    # -------------------------------------------------------------------------
    # CRUD
    # -------------------------------------------------------------------------
    def write(self, vals):
        """Override to handle the change of standard price."""
        if 'standard_price' in vals:
            self._change_standard_price(vals['standard_price'])
        return super(ProductProduct, self).write(vals)

    # -------------------------------------------------------------------------
    # SVL creation helpers
    # -------------------------------------------------------------------------
    def _svl_in_prepare_vals(self, quantity, unit_cost):
        """Prepare the values for a stock valuation layer created by a receipt.

        :param quantity: the quantity to value, expressed in `self.uom_id`
        :param unit_cost: the unit cost to value `quantity`
        :return: values to use in a call to create
        :rtype: dict
        """
        self.ensure_one()
        vals = {
            'product_id': self.id,
            'value': unit_cost * quantity,
            'unit_cost': unit_cost,
            'quantity': quantity,
        }
        if self.cost_method in ('fifo', 'average'):
            vals['remaining_qty'] = quantity
        return vals

    def _svl_out_prepare_vals(self, quantity):
        """Prepare the values for a stock valuation layer created by a delivery.

        :param quantity: the quantity to value, expressed in `self.uom_id`
        :param unit_cost: the unit cost to value `quantity`
        :returns: dict of valus to create valuation layer, new standard price or None
        :rtype: tuple
        """
        self.ensure_one()
        vals = {
            'product_id' : self.id,
            'value': - 1 * quantity * self.standard_price,
            'unit_cost': self.standard_price,
            'quantity': -1 * quantity,
        }
        unit_cost = None
        if self.cost_method in ('fifo', 'average'):
            value, unit_cost, remaining_qty, new_standard_price = self._run_fifo(quantity)
            unit_cost = unit_cost * -1  # FIXME sle: seriously
            if self.cost_method == 'fifo':
                vals['value'] = value
                vals['unit_cost'] = unit_cost
                vals['remaining_qty'] = remaining_qty
            elif self.cost_method == 'average':
                vals['remaining_qty'] = remaining_qty
            unit_cost = unit_cost * -1

        if self.cost_method == 'average':
            unit_cost = None
        if self.cost_method == 'fifo':
            unit_cost = new_standard_price
        return vals, unit_cost

    # -------------------------------------------------------------------------
    # Standard helpers
    # -------------------------------------------------------------------------
    def _change_standard_price(self, new_price):
        """Helper to create the stock valuation layer for an update of standard price.

        :param new_price: 
        """
        # FIXME sle: what about de wizard + compute price from bom
        # FIXME sle: batch me
        company_id = self.env.user.company_id
        for product in self:
            if product.cost_method != 'standard':
                continue
            if float_compare(product.quantity_svl, 0, precision_rounding=product.uom_id.rounding) == 0:
                continue
            diff = new_price - product.standard_price
            if company_id.currency_id.is_zero(diff):
                continue

            value = company_id.currency_id.round(product.quantity_svl * diff)

            vals = {
                'company_id': company_id.id,
                'product_id': product.id,
                'description': _('Product value manually modified (from %s to %s)') % (product.standard_price, new_price),
                'value': value,
                'quantity': 0,
            }
            self.env['stock.valuation.layer'].create(vals)

    # -------------------------------------------------------------------------
    # FIFO helpers
    # -------------------------------------------------------------------------
    def _run_vacuum(self):
        """Some valuation layers were created with an estimated price and they need to be fixed at
        some point. They are identifiable by their negative `remaining_qty`.
        """
        # FIXME sle: what about dropship?!
        # FIXME sle: we could change the logic here. as we apply the vacuum at each reception, maybe
        #            we don't have to loop over all.

        for problematic_svl in self._get_svl_to_vacuum():
            domain = [
                ('product_id', '=', self.id),
                ('value', '>', 0),
                ('remaining_qty', '>', 0),
                '|',
                    ('create_date', '>', problematic_svl.create_date),
                    '&',
                        ('create_date', '=', problematic_svl.create_date),
                        ('id', '>', problematic_svl.id)
            ]
            candidates = self.env['stock.valuation.layer'].search(domain)
            if not candidates:
                continue
            qty_to_take_on_candidates = abs(problematic_svl.remaining_qty)
            qty_taken_on_candidates = 0
            tmp_value = 0
            for candidate in candidates:
                if candidate.remaining_qty <= qty_to_take_on_candidates:
                    qty_taken_on_candidate = candidate.remaining_qty
                else:
                    qty_taken_on_candidate = qty_to_take_on_candidates
                qty_taken_on_candidates += qty_taken_on_candidate

                value_taken_on_candidate = qty_taken_on_candidate * candidate.unit_cost
                candidate_vals = {
                    'remaining_qty': candidate.remaining_qty - qty_taken_on_candidate,
                }
                candidate.write(candidate_vals)

                qty_to_take_on_candidates -= qty_taken_on_candidate
                tmp_value += value_taken_on_candidate
                if qty_to_take_on_candidates == 0:
                    break

            # When working with `price_unit`, beware that out move are negative.
            remaining_value_before_vacuum = problematic_svl.unit_cost * problematic_svl.remaining_qty  * -1  # FIXME sle: why?
            new_remaining_qty = problematic_svl.remaining_qty + qty_taken_on_candidates

            corrected_value = remaining_value_before_vacuum - tmp_value
            problematic_svl.write({
                'remaining_qty': new_remaining_qty,
            })

            vals = {
                'product_id': self.id,
                'value': corrected_value,
                'unit_cost': 0,
                'quantity': 0,
                'remaining_qty': 0,
                'description': 'vacuum',
            }
            self.env['stock.valuation.layer'].create(vals)

    def _get_fifo_candidates_in(self):
        """

        :returns:
        :rtype: recordset
        """
        self.ensure_one()
        return self.env['stock.valuation.layer'].search([
            ('product_id', '=', self.id),
            ('remaining_qty', '>', 0),
        ])

    def _get_svl_to_vacuum(self):
        """

        :returns:
        :rtype: recordset
        """
        self.ensure_one()
        return self.env['stock.valuation.layer'].search([
            ('product_id', '=', self.id),
            ('remaining_qty', '<', 0),
        ])

    def _run_fifo(self, quantity):
        """

        Note that the write on th candidates IN happened.

        :param quantity: 
        :returns: the value, unit_cost, remaining_qty and new standard price
        :rtype: tuple
        """
        self.ensure_one()
        value = 0
        unit_cost = 0
        remaining_qty = 0

        # Find back incoming stock moves (called candidates here) to value this move.
        qty_to_take_on_candidates = abs(quantity)
        candidates = self._get_fifo_candidates_in()
        new_standard_price = 0
        tmp_value = 0  # to accumulate the value taken on the candidates
        for candidate in candidates:
            new_standard_price = candidate.unit_cost
            if candidate.remaining_qty <= qty_to_take_on_candidates:
                qty_taken_on_candidate = candidate.remaining_qty
            else:
                qty_taken_on_candidate = qty_to_take_on_candidates

            #  # As applying a landed cost do not update the unit price, naivelly doing
            #  # something like qty_taken_on_candidate * candidate.price_unit won't make
            #  # the additional value brought by the landed cost go away.
            #  candidate_price_unit = candidate.remaining_value / candidate.remaining_qty
            candidate_price_unit = candidate.unit_cost
            value_taken_on_candidate = qty_taken_on_candidate * candidate_price_unit
            candidate_vals = {
                'remaining_qty': candidate.remaining_qty - qty_taken_on_candidate,
            }
            candidate.write(candidate_vals)

            qty_to_take_on_candidates -= qty_taken_on_candidate
            tmp_value += value_taken_on_candidate
            if qty_to_take_on_candidates == 0:
                break

        # If there's still quantity to value but we're out of candidates, we fall in the
        # negative stock use case. We chose to value the out move at the price of the
        # last out and a correction entry will be made once `_fifo_vacuum` is called.
        if qty_to_take_on_candidates == 0:
            value = tmp_value * -1
            unit_cost = tmp_value / quantity
        elif qty_to_take_on_candidates > 0:
            last_fifo_price = new_standard_price or self.standard_price
            negative_stock_value = last_fifo_price * -qty_to_take_on_candidates
            tmp_value += abs(negative_stock_value)

            value = tmp_value * -1
            # FIXME: in the original code we move.remaining_qty? why
            remaining_qty = -qty_to_take_on_candidates
            unit_cost = -1 * last_fifo_price
        return value, unit_cost, remaining_qty, new_standard_price


class ProductCategory(models.Model):
    """Product Category"""
    _inherit = 'product.category'

    def write(self, vals):
        """Override to handle the change of `property_cost_method`."""
        if 'property_cost_method' in vals:
            new_cost_method = vals.get('property_cost_method')

            impacted_product_ids = []
            impacted_products = self.env['product.product']
            products_orig_quantity_svl = {}

            # get the impacted products
            for product_category in self:
                if product_category.property_cost_method != new_cost_method:
                    products = self.env['product.product'].search_read([
                        ('type', '=', 'product'),
                        ('categ_id', '=', product_category.id),
                    ], ['quantity_svl'])
                    for product in products:
                        impacted_product_ids.append(product['id'])
                        products_orig_quantity_svl[product['id']] = product['quantity_svl']
            impacted_products |= self.env['product.product'].browse(impacted_product_ids)

            # empty out the stock for the impacted products
            updated_standard_price = {}
            empty_stock_svl_list = []
            for product in impacted_products:
                # FIXME sle: why not use products_orig_quantity_svl here?
                if float_is_zero(product.quantity_svl, precision_rounding=product.uom_id.rounding):
                    # FIXME: create an empty layer to track the change
                    continue

                svsl_vals, std_price = product._svl_out_prepare_vals(product.quantity_svl)
                updated_standard_price[product] = std_price
                empty_stock_svl_list.append(svsl_vals)
            self.env['stock.valuation.layer'].create(empty_stock_svl_list)
            for product, standard_price in updated_standard_price.items():
                if standard_price is None:
                    continue
                product.write({'standard_price': standard_price})

            # call super to apply the cost method change
            res = super(ProductCategory, self).write(vals)

            # refill the stock for the impacted products
            refill_stock_svl_list = []
            for product in impacted_products:
                quantity_svl = products_orig_quantity_svl[product.id]
                if quantity_svl:
                    refill_stock_svl_list.append(product._svl_in_prepare_vals(quantity_svl, product.standard_price))
                    # FIXME sle: an in can also update the standard price
            self.env['stock.valuation.layer'].create(refill_stock_svl_list)
            return res
        return super(ProductCategory, self).write(vals)

