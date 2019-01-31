# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Resellers Commissions',
    'category': 'Website',
    'summary': 'Configure resellers commissions on product sale',
    'version': '1.0',
    'description': """
This module allows to configure commissions for the resellers.
    """,
    'depends': ['website_crm_partner_assign', 'purchase', 'sale_management'],
    'data': [
        'data/product_data.xml',
        'security/ir.model.access.csv',
        'views/account_invoice_views.xml',
        'views/res_partner_views.xml',
        'views/sale_order_views.xml',
    ],
    'demo': [],
    'qweb': [],
    'installable': True,
    'auto_install': True,
}
