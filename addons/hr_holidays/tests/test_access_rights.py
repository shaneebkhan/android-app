# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from dateutil.relativedelta import relativedelta

from odoo import tests
from odoo.addons.hr_holidays.tests.common import TestHrHolidaysBase
from odoo.exceptions import AccessError, UserError
from odoo.tools import mute_logger


@tests.tagged('access_rights', 'post_install', '-at_install')
class TestLeavesRights(TestHrHolidaysBase):
    def setUp(self):
        super(TestLeavesRights, self).setUp()
        self.leave_type = self.env['hr.leave.type'].create({
            'name': 'Unlimited',
            'validation_type': 'hr',
            'allocation_type': 'no',
        })
        self.rd_dept.manager_id = False
        self.hr_dept.manager_id = False
        self.employee_emp.parent_id = False
        self.employee_leave = self.env['hr.leave'].sudo(self.user_employee_id).create({
            'name': 'Test',
            'holiday_status_id': self.leave_type.id,
            'department_id': self.employee_emp.department_id.id,
            'employee_id': self.employee_emp.id,
            'date_from': datetime.now(),
            'date_to': datetime.now() + relativedelta(days=1),
            'number_of_days': 1,
        })

    def request_leave(self, user_id, date_from, number_of_days, values=None):
        values = dict(values or {}, **{
            'date_from': date_from,
            'date_to': date_from + relativedelta(days=number_of_days),
            'number_of_days': number_of_days,
        })
        return self.env['hr.leave'].sudo(user_id).create(values)


@tests.tagged('access_rights', 'access_rights_create')
class TestAccessRightsCreate(TestLeavesRights):
    # base.group_user

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_base_user_create_self(self):
        """ A simple user can create a leave for himself """
        values = {
            'name': 'Hol10',
            'employee_id': self.employee_emp_id,
            'holiday_status_id': self.leave_type.id,
        }
        self.request_leave(self.user_employee_id, datetime.today() + relativedelta(days=5), 1, values)

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_base_user_create_other(self):
        """ A simple user cannot create a leave for someone else """
        values = {
            'name': 'Hol10',
            'employee_id': self.employee_hruser_id,
            'holiday_status_id': self.leave_type.id,
        }
        with self.assertRaises(AccessError):
            self.request_leave(self.user_employee_id, datetime.today() + relativedelta(days=5), 1, values)

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_base_user_create_validate(self):
        """ A simple user cannot create a leave in validate state """
        values = {
            'name': 'Hol10',
            'employee_id': self.employee_emp_id,
            'holiday_status_id': self.leave_type.id,
            'state': 'validate',
        }
        with self.assertRaises(AccessError):
            self.request_leave(self.user_employee_id, datetime.today() + relativedelta(days=5), 1, values)

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_base_user_create_batch(self):
        """ A simple user cannot create a leave in bacth mode (by company, by department, by tag)"""
        values = {
            'name': 'Hol10',
            'holiday_status_id': self.leave_type.id,
            'holiday_type': 'company',
            'mode_company_id': 1,
        }
        with self.assertRaises(AccessError):
            self.request_leave(self.user_employee_id, datetime.today() + relativedelta(days=5), 1, values)

    # hr_holidays.group_hr_holidays_user

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_holidays_user_create_self(self):
        """ A holidays user can create a leave for himself """
        values = {
            'name': 'Hol10',
            'employee_id': self.employee_hruser_id,
            'holiday_status_id': self.leave_type.id,
        }
        self.request_leave(self.user_hruser_id, datetime.today() + relativedelta(days=5), 1, values)

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_holidays_user_create_other(self):
        """ A holidays user can create a leave for someone else """
        values = {
            'name': 'Hol10',
            'employee_id': self.employee_emp_id,
            'holiday_status_id': self.leave_type.id,
        }
        self.request_leave(self.user_hruser_id, datetime.today() + relativedelta(days=5), 1, values)

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_holidays_user_create_validate(self):
        """ A holidays user can create a leave in validate state but not for himself """
        values = {
            'name': 'Hol10',
            'employee_id': self.employee_emp_id,
            'holiday_status_id': self.leave_type.id,
            'state': 'validate',
        }
        self.request_leave(self.user_hruser_id, datetime.today() + relativedelta(days=5), 1, values)
        values.update(employee_id=self.employee_hruser_id)
        with self.assertRaises(AccessError):
            self.request_leave(self.user_hruser_id, datetime.today() + relativedelta(days=5), 1, values)

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_holidays_user_create_batch(self):
        """ A holidays user cannot create a leave in bacth mode (by company, by department, by tag)"""
        values = {
            'name': 'Hol10',
            'holiday_status_id': self.leave_type.id,
            'holiday_type': 'company',
            'mode_company_id': 1,
        }
        with self.assertRaises(AccessError):
            self.request_leave(self.user_hruser_id, datetime.today() + relativedelta(days=5), 1, values)

    # hr_holidays.group_hr_holidays_manager

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_holidays_manager_create_self(self):
        """ A holidays manager can create a leave for himself """
        values = {
            'name': 'Hol10',
            'employee_id': self.employee_hrmanager_id,
            'holiday_status_id': self.leave_type.id,
        }
        self.request_leave(self.user_hrmanager_id, datetime.today() + relativedelta(days=5), 1, values)

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_holidays_manager_create_other(self):
        """ A holidays manager can create a leave for someone else """
        values = {
            'name': 'Hol10',
            'employee_id': self.employee_emp_id,
            'holiday_status_id': self.leave_type.id,
        }
        self.request_leave(self.user_hrmanager_id, datetime.today() + relativedelta(days=5), 1, values)

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_holidays_manager_create_validate(self):
        """ A holidays manager can? create a leave in validate state even for himself """
        values = {
            'name': 'Hol10',
            'employee_id': self.employee_emp_id,
            'holiday_status_id': self.leave_type.id,
            'state': 'validate',
        }
        self.request_leave(self.user_hrmanager_id, datetime.today() + relativedelta(days=5), 1, values)
        values.update(employee_id=self.employee_hruser_id)
        self.request_leave(self.user_hrmanager_id, datetime.today() + relativedelta(days=5), 1, values)

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_holidays_manager_create_batch(self):
        """ A holidays manager can create a leave in bacth mode (by company, by department, by tag)"""
        values = {
            'name': 'Hol10',
            'holiday_status_id': self.leave_type.id,
            'holiday_type': 'company',
            'mode_company_id': 1,
        }
        self.request_leave(self.user_hrmanager_id, datetime.today() + relativedelta(days=5), 1, values)


@tests.tagged('access_rights', 'access_rights_read')
class TestAccessRightsRead(TestLeavesRights):
    # base.group_user

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_read_by_user_other(self):
        """ Users should be able to read other people requests except name field """
        other_leave = self.env['hr.leave'].sudo(self.user_hruser).create({
            'name': 'Test',
            'holiday_status_id': self.leave_type.id,
            'department_id': self.employee_hruser.department_id.id,
            'employee_id': self.employee_hruser.id,
            'date_from': datetime.now(),
            'date_to': datetime.now() + relativedelta(days=1),
            'number_of_days': 1,
        })
        res = other_leave.sudo(self.user_employee_id).read(['number_of_days', 'state', 'name'])
        self.assertEqual(
            res[0]['name'], '*****',
            'Private information should have been stripped, received %s instead' % res[0]['name']
        )

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_read_by_user_own(self):
        """ Users should be able to read name field of own requests """
        res = self.employee_leave.read(['name', 'number_of_days', 'state'])
        self.assertEqual(res[0]['name'], 'Test')


@tests.tagged('access_rights', 'access_rights_write')
class TestAccessRightsWrite(TestLeavesRights):
    # base.group_user

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_update_by_user(self):
        """ User may update its leave """
        self.employee_leave.sudo(self.user_employee_id).write({'name': 'Crocodile Dundee is my man'})

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_update_by_user_other(self):
        """ User cannot update other people leaves """
        other_leave = self.env['hr.leave'].sudo(self.user_hruser).create({
            'name': 'Test',
            'holiday_status_id': self.leave_type.id,
            'department_id': self.employee_hruser.department_id.id,
            'employee_id': self.employee_hruser.id,
            'date_from': datetime.now(),
            'date_to': datetime.now() + relativedelta(days=1),
            'number_of_days': 1,
        })
        with self.assertRaises(AccessError):
            other_leave.sudo(self.user_employee_id).write({'name': 'Crocodile Dundee is my man'})

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_messaging_by_user(self):
        """ User may communicate on its own leaves, even if validated """
        self.employee_leave.sudo(self.user_employee_id).message_post(
            body='I haz messaging',
            subtype='mail.mt_comment',
            message_type='comment'
        )

        self.employee_leave.sudo(self.user_hrmanager_id).action_approve()

        self.employee_leave.sudo(self.user_employee_id).message_post(
            body='I still haz messaging',
            subtype='mail.mt_comment',
            message_type='comment'
        )

    # base.group_user

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_to_draft_by_user(self):
        """ User resets its own leaves """
        self.employee_leave.sudo(self.user_employee_id).action_draft()

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_to_draft_by_user_other(self):
        """ User may not reset other leaves """
        other_leave = self.env['hr.leave'].sudo(self.user_hruser_id).create({
            'name': 'Test',
            'holiday_status_id': self.leave_type.id,
            'department_id': self.employee_hruser.department_id.id,
            'employee_id': self.employee_hruser.id,
            'date_from': datetime.now(),
            'date_to': datetime.now() + relativedelta(days=1),
            'number_of_days': 1,
        })
        with self.assertRaises(UserError):
            other_leave.sudo(self.user_employee_id).action_draft()

    # hr_holidays.group_hr_holidays_user

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_to_draft_by_officer(self):
        """ Officer resets its own leaves """
        officer_leave = self.env['hr.leave'].sudo(self.user_hruser_id).create({
            'name': 'Test',
            'holiday_status_id': self.leave_type.id,
            'department_id': self.employee_hruser.department_id.id,
            'employee_id': self.employee_hruser.id,
            'date_from': datetime.now(),
            'date_to': datetime.now() + relativedelta(days=1),
            'number_of_days': 1,
        })
        officer_leave.sudo(self.user_hruser).action_draft()

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_to_draft_by_officer_other(self):
        """ Officer may not reset other leaves """
        with self.assertRaises(UserError):
            self.employee_leave.sudo(self.user_hruser).action_draft()

    # hr_holidays.group_hr_holidays_manager

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_to_draft_by_manager(self):
        """ Manager resets its own leaves """
        manager_leave = self.env['hr.leave'].sudo(self.user_hruser_id).create({
            'name': 'Test',
            'holiday_status_id': self.leave_type.id,
            'department_id': self.employee_hrmanager.department_id.id,
            'employee_id': self.employee_hrmanager.id,
            'date_from': datetime.now(),
            'date_to': datetime.now() + relativedelta(days=1),
            'number_of_days': 1,
        })
        manager_leave.sudo(self.user_hrmanager).action_draft()

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_to_draft_by_manager_other(self):
        """ Manager may reset other leaves """
        self.employee_leave.sudo(self.user_hrmanager).action_draft()

    # ----------------------------------------
    # Validation: one validation, HR
    # ----------------------------------------

    # base.group_user

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_hr_to_validate_by_user(self):
        """ User may not validate any leaves in HR mode """
        with self.assertRaises(UserError):
            self.employee_leave.sudo(self.user_employee_id).action_approve()

        with self.assertRaises(UserError):
            self.employee_leave.sudo(self.user_employee_id).write({'state': 'validate'})

    # hr_holidays.group_hr_holidays_user

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_hr_to_validate_by_holiday_user(self):
        """ Manager can validate leaves in HR mode """
        self.assertEqual(self.employee_leave.state, 'confirm')
        self.employee_leave.sudo(self.user_hrmanager_id).action_approve()
        self.assertEqual(self.employee_leave.state, 'validate')

    # hr_holidays.group_hr_holidays_manager

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_hr_to_validate_by_manager(self):
        """ Manager validate its own leaves """
        manager_leave = self.env['hr.leave'].sudo(self.user_hrmanager_id).create({
            'name': 'Hol manager',
            'holiday_status_id': self.leave_type.id,
            'employee_id': self.employee_hrmanager_id,
            'date_from': (datetime.today() + relativedelta(days=15)),
            'date_to': (datetime.today() + relativedelta(days=16)),
            'number_of_days': 1,
        })
        self.assertEqual(manager_leave.state, 'confirm')
        manager_leave.action_approve()
        self.assertEqual(manager_leave.state, 'validate')

    # ----------------------------------------
    # Validation: one validation, manager
    # ----------------------------------------

    # base.group_user

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_manager_to_validate_by_user(self):
        """ A simple user can validate in manager mode if he is leave_manager_id """
        self.leave_type.write({'validation_type': 'manager'})
        values = {
            'name': 'Hol HrUser',
            'employee_id': self.employee_hruser_id,
            'holiday_status_id': self.leave_type.id,
            'state': 'confirm',
        }
        hr_leave = self.request_leave(self.user_hruser_id, datetime.now() + relativedelta(days=2), 1, values)
        with self.assertRaises(AccessError):
            hr_leave.sudo(self.user_employee_id).action_approve()
        self.employee_hruser.write({'leave_manager_id': self.user_employee_id})
        hr_leave.sudo(self.user_employee_id).action_approve()

    # hr_holidays.group_hr_holidays_user

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_manager_to_validate_by_holiday_user(self):
        """ A holiday user can validate in manager mode """
        self.leave_type.write({'validation_type': 'manager'})
        values = {
            'name': 'Hol HrUser',
            'employee_id': self.employee_emp_id,
            'holiday_status_id': self.leave_type.id,
            'state': 'confirm',
        }
        hr_leave = self.request_leave(self.user_hruser_id, datetime.now() + relativedelta(days=2), 1, values)
        hr_leave.sudo(self.user_hruser_id).action_approve()

    # ----------------------------------------
    # Validation: double
    # ----------------------------------------

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_double_validate(self):
        self.leave_type.write({'validation_type': 'both'})
        values = {
            'name': 'double HrManager',
            'employee_id': self.employee_hrmanager_id,
            'holiday_status_id': self.leave_type.id,
            'state': 'confirm',
        }
        self.employee_hrmanager.leave_manager_id = self.env['res.users'].browse(1)
        hr_leave = self.request_leave(self.user_hruser_id, datetime.now() + relativedelta(days=6), 1, values)
        hr_user_leave = hr_leave.sudo(self.user_hruser_id)
        with self.assertRaises(AccessError):
            hr_user_leave.action_approve()
        with self.assertRaises(AccessError):
            hr_leave.sudo(self.user_employee_id).action_approve()

        self.employee_hrmanager.leave_manager_id = self.user_hruser
        hr_leave.sudo(self.user_hruser_id).action_approve()

        with self.assertRaises(AccessError):
            hr_leave.sudo(self.user_employee_id).action_validate()
        hr_leave.sudo(self.user_hruser_id).action_validate()

    # hr_holidays.group_hr_holidays_manager

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_double_validate_holiday_manager(self):
        self.leave_type.write({'validation_type': 'both'})
        values = {
            'name': 'double HrManager',
            'employee_id': self.employee_emp_id,
            'holiday_status_id': self.leave_type.id,
            'state': 'confirm',
        }
        hr_leave = self.request_leave(self.user_hrmanager_id, datetime.now() + relativedelta(days=4), 1, values).sudo(self.user_hrmanager_id)
        hr_leave.action_approve()
        hr_leave.action_validate()

    # ----------------------------------------
    # State = Refuse
    # ----------------------------------------

    # base.group_user

    # hr_holidays.group_hr_holidays_user

    # TODO Can refuse

    # hr_holidays.group_hr_holidays_manager

    # TODO Can refuse

    # ----------------------------------------
    # State = Cancel
    # ----------------------------------------

    # base.group_user

    # TODO Can Cancel if start_date in the future

    # hr_holidays.group_hr_holidays_user

    # TODO Can Cancel if not in validate

    # hr_holidays.group_hr_holidays_manager

    # TODO Can always cancel with great powers comes great responbilities


class TestMultiCompany(TestHrHolidaysBase):

    def setUp(self):
        super(TestMultiCompany, self).setUp()
        self.new_company = self.env['res.company'].create({
            'name': 'Crocodile Dundee Company',
        })
        self.leave_type = self.env['hr.leave.type'].create({
            'name': 'Unlimited - Company New',
            'company_id': self.new_company.id,
            'validation_type': 'hr',
            'allocation_type': 'no',
        })
        self.rd_dept.manager_id = False
        self.hr_dept.manager_id = False

        self.employee_leave = self.env['hr.leave'].create({
            'name': 'Test',
            'holiday_status_id': self.leave_type.id,
            'department_id': self.employee_emp.department_id.id,
            'employee_id': self.employee_emp.id,
            'date_from': datetime.now(),
            'date_to': datetime.now() + relativedelta(days=1),
            'number_of_days': 1,
        })

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_access_other_company_user(self):
        employee_leave = self.employee_leave.sudo(self.user_employee)

        with self.assertRaises(AccessError):
            employee_leave.name

        with self.assertRaises(AccessError):
            employee_leave.action_approve()

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_access_other_company_officer(self):
        employee_leave_hruser = self.employee_leave.sudo(self.user_hruser)

        with self.assertRaises(AccessError):
            employee_leave_hruser.name

        with self.assertRaises(AccessError):
            employee_leave_hruser.action_approve()

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_access_other_company_manager(self):
        employee_leave_hrmanager = self.employee_leave.sudo(self.user_hrmanager)

        with self.assertRaises(AccessError):
            employee_leave_hrmanager.name

        with self.assertRaises(AccessError):
            employee_leave_hrmanager.action_approve()

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_access_no_company_user(self):
        self.leave_type.write({'company_id': False})
        employee_leave = self.employee_leave.sudo(self.user_employee)

        employee_leave.name
        with self.assertRaises(UserError):
            employee_leave.action_approve()
        self.assertEqual(employee_leave.state, 'confirm')

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_access_no_company_officer(self):
        self.leave_type.write({'company_id': False})
        employee_leave_hruser = self.employee_leave.sudo(self.user_hruser)

        employee_leave_hruser.name
        employee_leave_hruser.action_approve()
        self.assertEqual(employee_leave_hruser.state, 'validate')

    @mute_logger('odoo.models.unlink', 'odoo.addons.mail.models.mail_mail')
    def test_leave_access_no_company_manager(self):
        self.leave_type.write({'company_id': False})
        employee_leave_hrmanager = self.employee_leave.sudo(self.user_hrmanager)

        employee_leave_hrmanager.name
        employee_leave_hrmanager.action_approve()
        self.assertEqual(employee_leave_hrmanager.state, 'validate')
