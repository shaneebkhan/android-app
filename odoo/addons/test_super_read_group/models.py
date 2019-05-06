# -*- coding: utf-8 -*-
from odoo import fields, models


class SuperModel(models.Model):
    _name = 'test_super_read_group.super_model'
    _description = 'Group Test Super Read Group'

    other_id = fields.Many2one('test_super_read_group.super_model')
    date = fields.Date()
    datetime = fields.Datetime()
    stage = fields.Selection([
        ('confirmed', 'Confirmed'),
        ('draft', 'Draft'),
        ('canceled', 'Canceled')])
    name = fields.Char()
    super_record = fields.Boolean()

    value = fields.Integer()
