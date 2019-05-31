# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json
from odoo import http
from odoo.http import request

from odoo.addons.sale_product_configurator.controllers.main import ProductConfiguratorController
from odoo.addons.website_sale.controllers.main import WebsiteSale

class WebsiteSaleProductConfiguratorController(ProductConfiguratorController):
    @http.route(['/sale_product_configurator/show_optional_products_website'], type='json', auth="public", methods=['POST'], website=True)
    def show_optional_products_website(self, product_id, variant_values, **kw):
        """Special route to use website logic in get_combination_info override.
        This route is called in JS by appending _website to the base route.
        """
        kw.pop('pricelist_id')
        return self.show_optional_products(product_id, variant_values, request.website.get_current_pricelist(), **kw)

    @http.route(['/sale_product_configurator/optional_product_items_website'], type='json', auth="public", methods=['POST'], website=True)
    def optional_product_items_website(self, product_id, **kw):
        """Special route to use website logic in get_combination_info override.
        This route is called in JS by appending _website to the base route.
        """
        kw.pop('pricelist_id')
        return self.optional_product_items(product_id, request.website.get_current_pricelist(), **kw)



class WebsiteSale(WebsiteSale):
    def _prepare_product_values(self, product, category, search, **kwargs):
        values = super(WebsiteSale, self)._prepare_product_values(product, category, search, **kwargs)

        values['optional_product_ids'] = [p.with_context({'active_id': p.id}) for p in product.optional_product_ids]
        return values

    @http.route(['/shop/cart/update_option'], type='http', auth="public", methods=['POST'], website=True, multilang=False)
    def cart_options_update_json(self, custom_values, goto_shop=None, lang=None, **kwargs):
        """This route is called when submitting the optional product modal."""
        if lang:
            request.website = request.website.with_context(lang=lang)

        order = request.website.sale_get_order(force_create=True)
        if order.state != 'draft':
            request.session['sale_order_id'] = None
            order = request.website.sale_get_order(force_create=True)

        custom_values = json.loads(custom_values)
        if len(custom_values) == 0:
            return str(order.cart_quantity)

        # main product is first optional products the rest
        main_product = custom_values[0]
        optional_products = custom_values[1:]
        optional_product_ids = [p['product_id'] for p in optional_products]

        value = order._cart_update(
            product_id=main_product['product_id'],
            add_qty=main_product['quantity'],
            optional_product_ids=optional_product_ids,
            product_custom_attribute_values=main_product['product_custom_attribute_values'],
            no_variant_attribute_values=main_product['no_variant_attribute_values'],
        )

        # link option with its parent.
        # Parents should always be listed before there options.
        option_parent = {main_product['unique_id']: value['line_id']}
        for option in optional_products:
            parent_unique_id = option['parent_unique_id']
            option_value = order._cart_update(
                product_id=option['product_id'],
                set_qty=option['quantity'],
                linked_line_id=option_parent[parent_unique_id],
                product_custom_attribute_values=option['product_custom_attribute_values'],
                no_variant_attribute_values=option['no_variant_attribute_values'],
            )
            option_parent[option['unique_id']] = option_value['line_id']

        return str(order.cart_quantity)
