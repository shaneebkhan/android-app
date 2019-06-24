# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import fields, models, _, api
from odoo.exceptions import UserError
from odoo.fields import Datetime

_logger = logging.getLogger(__name__)


class Employee(models.AbstractModel):
    _inherit = 'hr.employee.base'

    email_sent = fields.Boolean(default=False)
    ip_connected = fields.Boolean(default=False)
    manually_set_present = fields.Boolean(default=False)

    # Stored field used to group by in the presence reporting view.
    hr_presence_state_display = fields.Selection([
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('to_define', 'To Define')])

    def _compute_presence_state(self):
        super()._compute_presence_state()
        for employee in self:
            if employee.email_sent or employee.ip_connected or employee.manually_set_present:
                employee.hr_presence_state = 'present'

    @api.model
    def _check_presence(self):
        company = self.env.company
        if not company.hr_presence_last_compute_date or \
                company.hr_presence_last_compute_date.day != Datetime.now().day:
            self.env['hr.employee'].search([
                ('department_id.company_id', '=', company.id)
            ]).write({
                'email_sent': False,
                'ip_connected': False,
                'manually_set_present': False
            })

        employees = self.env['hr.employee'].search([('department_id.company_id', '=', company.id)])

        for employee in employees:
            employee.hr_presence_state_display = employee.hr_presence_state

        # Check on IP
        if self.env['ir.config_parameter'].sudo().get_param('hr_presence.hr_presence_control_ip'):
            ip_list = company.hr_presence_control_ip_list
            ip_list = ip_list.split(',') if ip_list else []
            ip_employees = self.env['hr.employee']
            for employee in employees:
                employee_ips = self.env['res.users.log'].search([
                    ('create_uid', '=', employee.user_id.id),
                    ('ip', '!=', False),
                    ('create_date', '>=', Datetime.to_string(Datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)))]
                ).mapped('ip')
                if any([ip in ip_list for ip in employee_ips]):
                    ip_employees |= employee
            ip_employees.write({'ip_connected': True})
            employees = employees - ip_employees

        # Check on sent emails
        if self.env['ir.config_parameter'].sudo().get_param('hr_presence.hr_presence_control_email'):
            email_employees = self.env['hr.employee']
            threshold = company.hr_presence_control_email_amount
            for employee in employees:
                sent_emails = self.env['mail.message'].search_count([
                    ('author_id', '=', employee.user_id.partner_id.id),
                    ('date', '>=', Datetime.to_string(Datetime.now().replace(hour=0, minute=0, second=0, microsecond=0))),
                    ('date', '<=', Datetime.to_string(Datetime.now()))])
                if sent_emails >= threshold:
                    email_employees |= employee
            email_employees.write({'email_sent': True})
            employees = employees - email_employees

        company.hr_presence_last_compute_date = Datetime.now()

    @api.model
    def _action_open_presence_view(self):
        # Compute the presence/absence for the employees on the same
        # company than the HR/manager. Then opens the kanban view
        # of the employees with an undefined presence/absence

        _logger.info("Employees presence checked by: %s" % self.env.user.name)

        self._check_presence()

        return {
            "type": "ir.actions.act_window",
            "res_model": "hr.employee",
            "views": [[self.env.ref('hr_presence.hr_employee_view_kanban').id, "kanban"], [False, "tree"], [False, "form"]],
            'view_mode': 'kanban,tree,form',
            "domain": [],
            "name": "Employee's Presence to Define",
            "context": {'search_default_group_hr_presence_state': 1},
        }

    def action_set_present(self):
        if not self.env.user.has_group('hr.group_hr_manager'):
            raise UserError(_("You don't have the right to do this. Please contact an Administrator."))
        self.write({'manually_set_present': True})

    def write(self, vals):
        if vals.get('hr_presence_state_display') == 'present':
            vals['manually_set_present'] = True
        return super().write(vals)

    def action_open_leave_request(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "res_model": "hr.leave",
            "views": [[False, "form"]],
            "view_mode": 'form',
            "context": {'default_employee_id': self.id},
        }

    def action_send_sms(self):
        self.ensure_one()
        if not self.env.user.has_group('hr.group_hr_manager'):
            raise UserError(_("You don't have the right to do this. Please contact an Administrator."))
        if not self.mobile_phone:
            raise UserError(_("There is no professional phone for this employee."))
        body = _("""Exception made if there was a mistake of ours, it seems that you are not at your office and there is not request of leaves from you.
Please, take appropriate measures in order to carry out this work absence.
Do not hesitate to contact your manager or the human resource department.""")
        return {
            "type": "ir.actions.act_window",
            "res_model": "sms.send_sms",
            "view_mode": 'form',
            "context": {
                'active_id': self.id,
                'default_message': body,
                'default_recipients': self.mobile_phone,
            },
            "name": "Send SMS",
            "target": "new",
        }

    def action_send_mail(self):
        self.ensure_one()
        if not self.env.user.has_group('hr.group_hr_manager'):
            raise UserError(_("You don't have the right to do this. Please contact an Administrator."))
        if not self.work_email:
            raise UserError(_("There is no professional email address for this employee."))
        template = self.env.ref('hr_presence.mail_template_presence', False)
        compose_form = self.env.ref('mail.email_compose_message_wizard_form', False)
        ctx = dict(
            default_model="hr.employee",
            default_res_id=self.id,
            default_use_template=bool(template),
            default_template_id=template.id,
            default_composition_mode='comment',
            default_is_log=True,
            custom_layout='mail.mail_notification_light',
        )
        return {
            'name': _('Compose Email'),
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'mail.compose.message',
            'views': [(compose_form.id, 'form')],
            'view_id': compose_form.id,
            'target': 'new',
            'context': ctx,
        }
