# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date, timedelta

import requests
# from requests import Request
import werkzeug

from odoo import models, api, service
from odoo.tools.translate import _
from odoo.exceptions import UserError
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT, misc


class IPaymuTransaction(models.Model):
    _name = 'pos_ipaymu.ipaymu_transaction'

    @api.model

    def _get_pos_session(self):
        pos_session = self.env['pos.session'].search([('state', '=', 'opened'), ('user_id', '=', self.env.uid)], limit=1)
        if not pos_session:
            raise UserError(_("No opened point of sale session for user %s found") % self.env.user.name)

        pos_session.login()

        return pos_session

    def _get_pos_ipaymu_config_id(self, config, journal_id):
        journal = config.journal_ids.filtered(lambda r: r.id == journal_id)

        if journal and journal.pos_ipaymu_config_id:
            return journal.pos_ipaymu_config_id
        else:
            raise UserError(_("No IPaymu configuration associated with the journal."))

    def _setup_request(self, data):
        # todo: in master make the client include the pos.session id and use that
        pos_session = self._get_pos_session()

        config = pos_session.config_id
        pos_ipaymu_config = self._get_pos_ipaymu_config_id(config, data['journal_id'])

        data['operator_id'] = pos_session.user_id.login
        data['key'] = pos_ipaymu_config.sudo().merchant_api_key
        data['request'] = 'generate'
        data['memo'] = "Odoo " + service.common.exp_version()['server_version']

    @api.model
    def do_reversal(self, data):
        return self._do_reversal_or_voidsale(data, False)

    @api.model
    def do_voidsale(self, data):
        return self._do_reversal_or_voidsale(data, True)

   
