# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


class AccountCommonReport(models.TransientModel):
    _inherit = "account.common.report"

    unit_id = fields.Many2one('res.partner', string='Unit')

    @api.onchange('company_id')
    def _onchange_company_id(self):
        res = super(AccountCommonReport, self)._onchange_company_id()
        if self.company_id:
            if self.env.user.has_group('l10n_in_multi_units.group_multi_operating_unit'):
                self.unit_id = self.env.user.unit_id or self.company_id.partner_id
        else:
            self.unit_id = False
        return res

    def _build_contexts(self, data):
        result = super(AccountCommonReport, self)._build_contexts(data)
        result['unit_id'] = data['form']['unit_id'] and data['form']['unit_id'][0] or False
        result['unit_name'] = data['form']['unit_id'] and data['form']['unit_id'][1] or False
        return result

    @api.multi
    def check_report(self, fields=[]):
        self.ensure_one()
        fields.append('unit_id')
        return super(AccountCommonReport, self).check_report(fields)
