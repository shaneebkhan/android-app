# -*- coding: utf-8 -*-

from odoo import models, fields, api

class WizardInvite(models.TransientModel):
    _name = 'base_setup.wizard_invite'
    _description = "New Users Invitations"

    new_users = fields.Many2many('res.partner', string="New Users" required=True)
