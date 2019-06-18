# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models



class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'
    

    iap_account_url = fields.Char('IAP Account Url', readonly=True)
    

    @api.model
    def get_values(self):
        res = super(ResConfigSettings, self).get_values()
        res.update (
            iap_account_url = self.env['iap.account'].get_account_url()
            
        )
        return res
    



        





    


