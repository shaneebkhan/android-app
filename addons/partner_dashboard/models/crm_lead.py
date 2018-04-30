# -*- coding: utf-8 -*-

from odoo import models, api
import json
import base64
from .consts import SIZE_5, SIZE_20, SIZE_50, SIZE_250, SIZE_MORE


class partner_dashboard(models.Model):
    _inherit = 'crm.lead'

    @api.model
    def _refresh_dashboard_data(self):
        self = self.sudo()
        Partner = self.env['res.partner']
        attach = self.env.ref('partner_dashboard.dashboard_partner_stats')

        size_tag_ids = {'< 5': SIZE_5, '5-20': SIZE_20, '20-50': SIZE_50, '50-250': SIZE_250, '> 250': SIZE_MORE, }
        dashboard_stats = []

        for country in self.env['res.country'].search([]):

            # Leads by Company Size by Country
            val_by_country = {'country_id': country.id, 'lead_by_company_size': []}
            for label, tag_id in size_tag_ids.items():
                val_by_country['lead_by_company_size'].append({
                    "label": label,
                    'value': self.search_count([('tag_ids', '=', tag_id), ('country_id', '=', country.id)])
                })

            # Leads / Customers / Partner by country
            val_by_country['country_leads'] = self.search_count([('country_id', '=', country.id)])
            val_by_country['country_customers'] = Partner.search_count([('country_id', '=', country.id), ('grade_id', '=', False)])
            val_by_country['country_partners'] = Partner.search_count([('country_id', '=', country.id), ('grade_id', '!=', False)])

            # Add values to stats
            dashboard_stats.append(val_by_country)

        attach.write({
            "datas": base64.b64encode(json.dumps(dashboard_stats).encode("utf-8"))
        })
