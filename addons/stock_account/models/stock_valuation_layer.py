# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class StockValuationLayer(models.Model):
    _name = 'stock.valuation.layer'
    _description = 'Stock Valuation Layer'
    _order = 'create_date, id'

    # TODO sle: remove stock move <-> account move link
    # TODO: constraint product_id not consu?
    # TODO: maybe get the values form the move here to prevent owner stuff?
    # TODO: what if 0 value?
    # TODO: company_id of account moves? force_company? wee because the company of the journal is used

    def _default_company(self):
        return self.env['res.company']._company_default_get('stock.valuation.layer')

    company_id = fields.Many2one('res.company', 'Company', default=_default_company, required=True)
    product_id = fields.Many2one('product.product', 'Product', required=True)
    quantity = fields.Float('Quantity', digits=0, help='Quantity')
    uom_id = fields.Many2one(related='product_id.uom_id', readonly=True)
    unit_cost = fields.Float()
    value = fields.Float()
    remaining_qty = fields.Float()
    description = fields.Text('Description')  # TODO: 'Revaluation of %s (negative inventory)' % ref
    stock_valuation_layer_ids = fields.Many2many(
        'stock.valuation.layer',
        'stock_valuation_layer_rel',
        'stock_valuation_layer_left',
        'stock_valuation_layer_right'
    )
    stock_move_id = fields.Many2one('stock.move')

    @api.model_create_multi
    def create(self, vals_list):
        svls = super(StockValuationLayer, self).create(vals_list)
        for svl in svls:
            if svl.product_id.valuation == 'real_time':
                svl._create_account_move()
        return svls

    # -------------------------------------------------------------------------
    # Account move and account move lines creation
    # -------------------------------------------------------------------------
    def _prepare_account_move_lines(self, debit_account_id, credit_account_id):
        # TODO: purchase and amount_currency?
        self.ensure_one()
        partner_id = self.stock_move_id and self.stock_move_id.picking_id and self.stock_move_id.picking_id.partner_id or False
        if partner_id:
            partner_id = self.env['res.partner']._find_accounting_partner(partner_id).id

        debit_value = credit_value = self.company_id.currency_id.round(self.value)

        res = {}
        res['debit_line_vals'] = {
            'name': self.description,
            'product_id': self.product_id.id,
            'quantity': self.quantity,
            'product_uom_id': self.uom_id.id,
            'ref': self.description,
            'partner_id': partner_id,
            'debit': debit_value if debit_value > 0 else 0,
            'credit': -debit_value if debit_value < 0 else 0,
            'account_id': debit_account_id,
        }
        res['credit_line_vals'] = {
            'name': self.description,
            'product_id': self.product_id.id,
            'quantity': self.quantity,
            'product_uom_id': self.uom_id.id,
            'ref': self.description,
            'partner_id': partner_id,
            'credit': credit_value if credit_value > 0 else 0,
            'debit': -credit_value if credit_value < 0 else 0,
            'account_id': credit_account_id,
        }
        return res

    def _create_account_move(self):
        for svl in self:
            journal_id, acc_src, acc_dest, acc_valuation = self._get_accounts_from_stock_move(self.stock_move_id)
            line_ids_vals = [(0, 0, line_vals) for line_vals in svl._prepare_account_move_lines(acc_src, acc_valuation).values()]
            values = {
                'journal_id': journal_id,
                'line_ids': line_ids_vals,
                'date': fields.Date.context_today(self),  # TODO: force_periode_date and inv adj?
                'ref': svl.description,
            }
            if svl.stock_move_id:
                values['stock_move_id'] = svl.stock_move_id.id
            account_move = self.env['account.move'].sudo().create(values)
            account_move.post()

    # -------------------------------------------------------------------------
    # Stock move helpers
    # -------------------------------------------------------------------------
    def _account_entry_move(self):
        """ Accounting Valuation Entries """
        self.ensure_one()
        if self.product_id.type != 'product':
            # no stock valuation for consumable products
            return False
        if self.restrict_partner_id:
            # if the move isn't owned by the company, we don't make any valuation
            return False

        location_from = self.location_id
        location_to = self.location_dest_id
        company_from = self._is_out() and self.mapped('move_line_ids.location_id.company_id') or False
        company_to = self._is_in() and self.mapped('move_line_ids.location_dest_id.company_id') or False

        # Create Journal Entry for products arriving in the company; in case of routes making the link between several
        # warehouse of the same company, the transit location belongs to this company, so we don't need to create accounting entries
        if self._is_in():
            journal_id, acc_src, acc_dest, acc_valuation = self._get_accounting_data_for_valuation()
            if location_from and location_from.usage == 'customer':  # goods returned from customer
                self.with_context(force_company=company_to.id)._create_account_move_line(acc_dest, acc_valuation, journal_id)
            else:
                self.with_context(force_company=company_to.id)._create_account_move_line(acc_src, acc_valuation, journal_id)

        # Create Journal Entry for products leaving the company
        if self._is_out():
            journal_id, acc_src, acc_dest, acc_valuation = self._get_accounting_data_for_valuation()
            if location_to and location_to.usage == 'supplier':  # goods returned to supplier
                self.with_context(force_company=company_from.id)._create_account_move_line(acc_valuation, acc_src, journal_id)
            else:
                self.with_context(force_company=company_from.id)._create_account_move_line(acc_valuation, acc_dest, journal_id)

        if self.company_id.anglo_saxon_accounting:
            # Creates an account entry from stock_input to stock_output on a dropship move. https://github.com/odoo/odoo/issues/12687
            journal_id, acc_src, acc_dest, acc_valuation = self._get_accounting_data_for_valuation()
            if self._is_dropshipped():
                self.with_context(force_company=self.company_id.id)._create_account_move_line(acc_src, acc_dest, journal_id)
            elif self._is_dropshipped_returned():
                self.with_context(force_company=self.company_id.id)._create_account_move_line(acc_dest, acc_src, journal_id)

        # FIXME sle: we'll need ot adapt this part later on
        if self.company_id.anglo_saxon_accounting:
            #eventually reconcile together the invoice and valuation accounting entries on the stock interim accounts
            self._get_related_invoices()._anglo_saxon_reconcile_valuation(product=self.product_id)

    # -------------------------------------------------------------------------
    # Stock move
    # -------------------------------------------------------------------------
    @api.model
    def _get_accounts_from_stock_move(self, stock_move):
        """ Return the accounts and journal to use in order to create an account move for a cost
        layer associated to a stock move. It'll call `get_product_accounts` to get the accounts
        and journal, then handle the case where specific accounts are set on the `location_id` or
        `location_dest_id` of the stock move.
        """
        # TODO: move the check and user erros to a m
        stock_move.ensure_one()
        accounts_data = self.product_id.product_tmpl_id.get_product_accounts()

        if stock_move.location_id.valuation_out_account_id:
            acc_src = stock_move.location_id.valuation_out_account_id.id
        else:
            acc_src = accounts_data['stock_input'].id

        if stock_move.location_dest_id.valuation_in_account_id:
            acc_dest = stock_move.location_dest_id.valuation_in_account_id.id
        else:
            acc_dest = accounts_data['stock_output'].id

        acc_valuation = accounts_data.get('stock_valuation', False)
        if acc_valuation:
            acc_valuation = acc_valuation.id
        if not accounts_data.get('stock_journal', False):
            raise UserError(_('You don\'t have any stock journal defined on your product category, check if you have installed a chart of accounts.'))
        if not acc_src:
            raise UserError(_('Cannot find a stock input account for the product %s. You must define one on the product category, or on the location, before processing this operation.') % (self.product_id.display_name))
        if not acc_dest:
            raise UserError(_('Cannot find a stock output account for the product %s. You must define one on the product category, or on the location, before processing this operation.') % (self.product_id.display_name))
        if not acc_valuation:
            raise UserError(_('You don\'t have any stock valuation account defined on your product category. You must define one before processing this operation.'))
        journal_id = accounts_data['stock_journal'].id
        return journal_id, acc_src, acc_dest, acc_valuation

    # -------------------------------------------------------------------------
    # FIFO/AVCO vacuum
    # -------------------------------------------------------------------------
