# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Indian - Accounting (operating units)',
    'version': '1.0',
    'description': """
Indian Accounting: (operating units).
  """,
    'category': 'Localization',
    'depends': [
        'l10n_in',
        'account_voucher',
    ],
    'data': [
        'security/l10n_in_multi_units_security.xml',
        'data/company_data.xml',
        'views/res_users_views.xml',
        'views/res_partner_view.xml',
        'views/res_config_settings_views.xml',
        'views/report_journal.xml',
        'views/account_view.xml',
        'views/account_payment_view.xml',
        'views/account_voucher_view.xml',
        'views/account_invoice_view.xml',
        'report/account_invoice_report_view.xml',
        'wizard/account_report_common_view.xml',
    ],
}
