# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResPartnerCommission(models.Model):
    _name = 'res.partner.commission'
    _description = 'Reseller commissions'

    grade_id = fields.Many2one('res.partner.grade', 'Grade', required=True)
    rate = fields.Float('Commission Rate', required=True)
    product_ids = fields.Many2many('product.template', required=True)


class ResPartnerGrade(models.Model):
    _inherit = 'res.partner.grade'

    commission_ids = fields.One2many('res.partner.commission', 'grade_id', string="Commissions")
