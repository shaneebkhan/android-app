# -*- coding: utf-8 -*-
from odoo import api, models, _
from odoo.exceptions import UserError

class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    @api.multi
    def unlink(self):
        confs = self.env['pos.session'].search([
            ('state','!=','closed'),
            ('config_id.module_pos_hr', '=', True),
            '|',
                ('config_id.employee_ids', '=', False),
                ('config_id.employee_ids', 'in', self.ids),
        ]).mapped('config_id')
        if confs:
            employees_to_restrict = confs.mapped('employee_ids') & self
            if not employees_to_restrict:
                # not a config with specific employee but one with no employee set on it
                employees_to_restrict = self

            error_msg = _("You cannot delete an employee that may be used in an active PoS session, close the session(s) first: \n")
            for employee in employees_to_restrict:
                configs = [config for config in confs if not config.employee_ids or employee in config.employee_ids]

                error_msg += _("Employee: %s - PoS Config(s): %s \n") % (employee.name, ', '.join(config.name for config in configs))

            raise UserError(error_msg)
        return super(HrEmployee, self).unlink()
