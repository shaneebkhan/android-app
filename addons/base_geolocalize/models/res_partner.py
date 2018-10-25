from odoo import api, fields, models


class ResPartner(models.Model):
    _inherit = "res.partner"

    partner_latitude = fields.Float(string='Geo Latitude', digits=(16, 5))
    partner_longitude = fields.Float(string='Geo Longitude', digits=(16, 5))
    date_localization = fields.Date(string='Geolocation Date')

    @classmethod
    def _geo_localize(cls, street='', zip='', city='', state='', country=''):
        geo_obj = cls.env['base.geocoder']
        search = geo_obj.geo_query_address(street=street, zip=zip, city=city, state=state, country=country)
        result = geo_obj.geo_find(search)
        if result is None:
            search = geo_obj.geo_query_address(city=city, state=state, country=country)
            result = geo_obj.geo_find(search)
        return result

    @api.multi
    def geo_localize(self):
        # We need country names in English below
        for partner in self.with_context(lang='en_US'):
            result = partner._geo_localize(partner.street,
                                           partner.zip,
                                           partner.city,
                                           partner.state_id.name,
                                           partner.country_id.name)

            if result:
                partner.write({
                    'partner_latitude': result[0],
                    'partner_longitude': result[1],
                    'date_localization': fields.Date.context_today(partner)
                })
        return True
