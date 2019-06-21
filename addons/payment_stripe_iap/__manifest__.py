# -*- coding: utf-8 -*-

{
    'name': 'Connect Stripe Account',
    'category': 'Hidden',
    'summary': 'Payment Acquirer: Stripe Connect Implementation',
    'version': '1.0',
    'description': """Create a stripe standard account""",
    'depends': ['iap'],
    'data': [
        'security/ir.model.access.csv',
        'views/stripe_connect_views.xml',
    ],
    'installable': True,
}
