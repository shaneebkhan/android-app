# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.tools import float_compare


class AccountInvoice(models.Model):
    _inherit = 'account.invoice'

    reseller_id = fields.Many2one('res.partner', 'Reseller', help='This field is used to track the reseller in order to generate commisions')
    commission_purchase_order_line_id = fields.Many2one('purchase.order.line', 'Reseller Purchase Order line')
    commission_rate = fields.Float('Commission Rate', default=0,
        help="Overrides all the commissions for this invoice, if set to 0 the commission_rate will be used")

    @api.model
    def _prepare_refund(self, invoice, date_invoice=None, date=None, description=None, journal_id=None):
        res = super(AccountInvoice, self)._prepare_refund(invoice, date_invoice=date_invoice, date=date, description=description, journal_id=journal_id)
        res.update({
            'reseller_id': invoice.reseller_id.id,
            'commission_purchase_order_line_id': invoice.commission_purchase_order_line_id.id,
            'commission_rate': invoice.commission_rate,
        })
        return res

    def _make_commissions(self):
        """
            Adds a line to a purchase order for reseller_id containing the due commissions for the invoice
            The line is only added the first time we call this method (called on reconcile)
        """
        self.ensure_one()

        if not self.reseller_id or self.commission_purchase_order_line_id:
            return

        total = 0
        for commission in self.reseller_id.grade_id.commission_ids:
            lines = self.invoice_line_ids.filtered(lambda line: line.product_id.product_tmpl_id.id in commission.product_ids.ids)
            commission_rate = self.commission_rate if self.commission_rate > 0 else commission.rate
            total += sum(line.price_subtotal * commission_rate  / 100 for line in lines)

        if total:
            # Find the purchase order corresponding to the current reseller or create a new one
            purchase_order = self.env['purchase.order'].search([('partner_id', '=', self.reseller_id.id), ('state', '=', 'draft')], limit=1)
            if not purchase_order:
                purchase_order = self.env['purchase.order'].create({
                    'name': _('Purchase order for %s') % self.reseller_id.display_name,
                    'partner_id': self.reseller_id.id,
                })

            purchase_line = self.env['purchase.order.line'].create({
                'name': '%s %s' % (self.display_name, self.partner_id.display_name),
                'product_id': self.env.ref('website_crm_partner_assign_commission.product_commission').id,
                'product_qty': 1,
                'price_unit': total,
                'product_uom': self.env.ref('uom.product_uom_unit').id,
                'date_planned': fields.Datetime.now(),
                'order_id': purchase_order.id,
            })

            self.commission_purchase_order_line_id = purchase_line


class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    def reconcile(self, writeoff_acc_id=False, writeoff_journal_id=False):
        res = super(AccountMoveLine, self).reconcile(writeoff_acc_id=writeoff_acc_id, writeoff_journal_id=writeoff_journal_id)

        if any(line.invoice_id for line in self):
            # We check if any move_line is fully reconciled
            account_move_ids = [l.move_id.id for l in self if float_compare(l.move_id.matched_percentage, 1, precision_digits=5) == 0]

            if account_move_ids:
                move_lines = self.filtered('invoice_id')
                is_refund = any(move_line.invoice_id.type in ['in_refund', 'out_refund'] for move_line in move_lines)

                for move_line in move_lines:
                    if is_refund:
                        commission_purchase_order_line = move_line.invoice_id.commission_purchase_order_line_id
                        commission_purchase_order_line.order_id.write({
                            'order_line': [(0, 0, {
                                'name': '%s %s' % ('Refund for ', commission_purchase_order_line.name),
                                'product_id': self.env.ref('website_crm_partner_assign_commission.product_commission').id,
                                'product_qty': 1,
                                'price_unit': -commission_purchase_order_line.price_unit,
                                'product_uom': self.env.ref('uom.product_uom_unit').id,
                                'date_planned': fields.Datetime.now(),
                            })]
                        })
                    else:
                        move_line.invoice_id._make_commissions()

        return res
