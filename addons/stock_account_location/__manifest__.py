# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'stock_account_location',
    'version': '0.1',
    'summary': '',
    'description': """
Add a "value" field on the quants, usable in the current inventory valuation. This brings the
possibility to get the correct value by locations for standard and AVCO products and get an
estimation of the value by locations for FIFO products.
    """,
    'depends': ['stock_account'],
    'category': 'Hidden',
    'sequence': 16,
    'data': [
        'views/stock_quant_views.xml',
    ],
    'test': [
    ],
    'installable': True,
    'auto_install': True,
}
