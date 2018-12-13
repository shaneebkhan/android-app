# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Project Expenses',
    'version': '1.0',
    'website': 'https://www.odoo.com/page/project-management',
    'category': 'Project',
    'sequence': 10,
    'summary': 'Expenses on projects',
    'depends': [
        'project',
        'hr_expense',
    ],
    'description': "",
    'data': [
        'security/project_expense_security.xml',
        'views/hr_expense_views.xml',
    ],
    'installable': True,
    'auto_install': True,
    'application': False,
}
