# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Indian - Point of Sale',
    'version': '1.0',
    'description': """GST Point of Sale""",
    'category': 'Localization',
    'depends': [
        'l10n_in',
        'point_of_sale',
        'l10n_in_multi_units',
    ],
    'data': [
        'data/product_demo.xml',
        'views/pos_order_view.xml',
        'views/pos_config_view.xml',
    ],
    'auto_install': True,
}
