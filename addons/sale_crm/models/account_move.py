# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class AccountMove(models.Model):
    _name = "account.move"
    _inherit = ['account.move', 'utm.mixin']
