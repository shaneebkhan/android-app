# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


# class User(models.Model):
#     _inherit = "res.users"

#     hr_presence_state = fields.Selection(related='employee_id.hr_presence_state')
#     last_activity = fields.Date(related='employee_id.last_activity')

#     def __init__(self, pool, cr):
#         """ Override of __init__ to add access rights.
#             Access rights are disabled by default, but allowed
#             on some specific fields defined in self.SELF_{READ/WRITE}ABLE_FIELDS.
#         """

#         readable_fields = [
#             'hr_presence_state',
#             'last_activity',
#         ]
#         init_res = super(User, self).__init__(pool, cr)
#         # duplicate list to avoid modifying the original reference
#         type(self).SELF_READABLE_FIELDS = type(self).SELF_READABLE_FIELDS + readable_fields
#         return init_res
