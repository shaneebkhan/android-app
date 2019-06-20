# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Indian - Purchase Report(GST)',
    'version': '1.0',
    'description': """GST Purchase Report""",
    'category': 'Accounting',
    'depends': [
        'l10n_in',
        'l10n_in_multi_units',
        'purchase',
    ],
    'data': [
        'views/report_purchase_order.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': True,
}
