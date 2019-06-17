# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from dateutil.relativedelta import relativedelta

from odoo import api, fields, models


class HrWorkEnrty(models.Model):
    _name = 'hr.work.entry'
    _description = 'HR Work Entry'
    _order = 'display_warning desc,state,date_start'

    name = fields.Char(required=True)
    active = fields.Boolean(default=True)
    employee_id = fields.Many2one('hr.employee', required=True, domain=[('contract_ids.state', 'in', ('open', 'pending'))])
    date_start = fields.Datetime(required=True, string='From')
    date_stop = fields.Datetime(string='To')
    duration = fields.Float(compute='_compute_duration', inverse='_inverse_duration', store=True, string="Period")
    work_entry_type_id = fields.Many2one('hr.work.entry.type')
    color = fields.Integer(related='work_entry_type_id.color', readonly=True)
    state = fields.Selection([
        ('draft', 'Draft'),
        ('confirmed', 'Confirmed'),
        ('validated', 'Validated'),
        ('cancelled', 'Cancelled')
    ], default='draft')
    display_warning = fields.Boolean(string="Error")
    company_id = fields.Many2one('res.company', string='Company', readonly=True, required=True,
        default=lambda self: self.env.company)

    _sql_constraints = [
        ('_work_entry_has_end', 'check (date_stop IS NOT NULL)', 'Work entry must end. Please define an end date or a duration.'),
        ('_work_entry_start_before_end', 'check (date_stop > date_start)', 'Starting time should be before end time.')
    ]

    @api.onchange('duration')
    def _onchange_duration(self):
        self._inverse_duration()

    @api.depends('date_stop', 'date_start')
    def _compute_duration(self):
        for work_entry in self:
            work_entry.duration = work_entry._get_duration(work_entry.date_start, work_entry.date_stop)

    def _inverse_duration(self):
        for work_entry in self:
            if work_entry.date_start and work_entry.duration:
                work_entry.date_stop = work_entry.date_start + relativedelta(hours=work_entry.duration)

    @api.multi
    def action_validate(self):
        work_entries = self.filtered(lambda work_entry: work_entry.state != 'validated')
        work_entries.write({'display_warning': False})
        if not work_entries._check_if_error():
            work_entries.write({'state': 'validated'})
            return True
        return False


class HrWorkEntryType(models.Model):
    _name = 'hr.work.entry.type'
    _description = 'HR Work Entry Type'

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    color = fields.Integer(default=0)
    sequence = fields.Integer(default=25)
    active = fields.Boolean(
        'Active', default=True,
        help="If the active field is set to false, it will allow you to hide the work entry type without removing it.")
    is_leave = fields.Boolean(default=False, string="Time Off")
    is_unforeseen = fields.Boolean(default=False, string="Unforeseen Absence")
    round_days = fields.Selection([('NO', 'No Rounding'), ('HALF', 'Half Day'), ('FULL', 'Day')], string="Rounding", required=True, default='NO')
    round_days_type = fields.Selection([('HALF-UP', 'Closest'), ('UP', 'Up'), ('DOWN', 'Down')], string="Round Type", required=True, default='DOWN')

    _sql_constraints = [
        ('unique_work_entry_code', 'UNIQUE(code)', 'The same code cannot be associated to multiple work entry types.'),
        ('is_unforeseen_is_leave', 'check (is_unforeseen = FALSE OR (is_leave = TRUE and is_unforeseen = TRUE))', 'A unforeseen absence must be a leave.')
    ]


class Contacts(models.Model):
    """ Personnal calendar filter """

    _name = 'hr.user.work.entry.employee'
    _description = 'Work Entries Employees'

    user_id = fields.Many2one('res.users', 'Me', required=True, default=lambda self: self.env.user)
    employee_id = fields.Many2one('hr.employee', 'Employee', required=True)
    active = fields.Boolean('Active', default=True)

    _sql_constraints = [
        ('user_id_employee_id_unique', 'UNIQUE(user_id,employee_id)', 'You cannot have twice the same employee.')
    ]
