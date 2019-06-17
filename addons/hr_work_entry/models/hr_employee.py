# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class HrEmployee(models.Model):
    _inherit = 'hr.employee'
    _description = 'Employee'

    def has_non_validated_work_entries(self, date_from, date_to):
        return bool(self.env['hr.work.entry'].search_count([
            ('employee_id', 'in', self.ids),
            ('date_start', '<=', date_to),
            ('date_stop', '>=', date_from),
            ('state', 'in', ['draft', 'confirmed'])
        ]))
