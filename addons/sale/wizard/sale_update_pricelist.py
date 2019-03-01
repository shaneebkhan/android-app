# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class SaleUpdatePricelist(models.TransientModel):
    _name = 'sale.update.pricelist'
    _description = 'Sale Update Pricelist'

    @api.model
    def _default_sale_id(self):
        return self._context.get('active_id', False)

    sale_id = fields.Many2one('sale.order', string="Sale Order", required=True, default=_default_sale_id)

    def update_pricelist(self):
        self.ensure_one()
        sale_order = self.sale_id
        for line in sale_order.order_line:
            product = line.product_id.with_context(
                partner=sale_order.partner_id,
                quantity=line.product_uom_qty,
                date=sale_order.date_order,
                pricelist=sale_order.pricelist_id.id,
                uom=line.product_uom.id
            )
            line.price_unit = self.env['account.tax']._fix_tax_included_price_company(
                line._get_display_price(product), line.product_id.taxes_id, line.tax_id, line.company_id)
        sale_order.is_change_pricelist = False
        sale_order.message_post(body=_("Updated product price according to pricelist <b>%s<b> ") % sale_order.pricelist_id.display_name)

    def skip_update_pricelist(self):
        self.sale_id.is_change_pricelist = False
