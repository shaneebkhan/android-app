# -*- coding: utf-8 -*-
from odoo import http

# class WebsitePrivacy(http.Controller):
#     @http.route('/website_privacy/website_privacy/', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/website_privacy/website_privacy/objects/', auth='public')
#     def list(self, **kw):
#         return http.request.render('website_privacy.listing', {
#             'root': '/website_privacy/website_privacy',
#             'objects': http.request.env['website_privacy.website_privacy'].search([]),
#         })

#     @http.route('/website_privacy/website_privacy/objects/<model("website_privacy.website_privacy"):obj>/', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('website_privacy.object', {
#             'object': obj
#         })