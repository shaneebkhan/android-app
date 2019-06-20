# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, exceptions, fields, models


class SMSRecipient(models.TransientModel):
    _name = 'sms.resend.recipient'
    _description = 'SMS resend object'

    sms_resend_id = fields.Many2one('sms.resend', required=True)
    resend = fields.Boolean(string="Send Again", default=True)
    failure_type = fields.Selection([
        ('sms_number_missing', 'Missing Number'),
        ('sms_number_format', 'Wrong Number Format'),
        ('sms_credit', 'Insufficient Credit'),
        ('sms_server', 'Server Error')])
    partner_id = fields.Many2one('res.partner', 'Partner', ondelete='cascade')
    partner_name = fields.Char()
    partner_number = fields.Char()


class SMSResend(models.TransientModel):
    _name = 'sms.resend'
    _description = 'SMS resend wizard'

    @api.model
    def default_get(self, fields):
        result = super(SMSResend, self).default_get(fields)
        if result.get('mail_message_id'):
            mail_message_id = self.env['mail.message'].browse(result['mail_message_id'])
            result['recipient_ids'] = [(0, 0, {
                'resend': True,
                'partner_id': notif.res_partner_id.id,
                'partner_name': notif.res_partner_id.display_name,
                'partner_number': notif.res_partner_id.mobile,
                'failure_type': notif.failure_type,
            }) for notif in mail_message_id.notification_ids if notif.is_sms and notif.email_status in ('exception', 'bounce')]
        return result

    mail_message_id = fields.Many2one('mail.message', 'Message', readonly=True, required=True)
    recipient_ids = fields.One2many('sms.resend.recipient', 'sms_resend_id', string='Recipients')
    has_cancel = fields.Boolean(compute='_compute_has_cancel')
    has_insufficient_credit = fields.Boolean(compute='_compute_has_insufficient_credit') 

    @api.depends("recipient_ids.failure_type")
    def _compute_has_insufficient_credit(self):
        self.has_insufficient_credit = self.recipient_ids.filtered(lambda p: p.failure_type == 'sms_credit')

    @api.depends("recipient_ids.resend")
    def _compute_has_cancel(self):
        self.has_cancel = self.recipient_ids.filtered(lambda p: not p.resend)

    def _check_access(self):
        if not self.mail_message_id or not self.mail_message_id.model or not self.mail_message_id.res_id:
            raise exceptions.UserError(_('You do not have access to the message and/or related document.'))
        record = self.env[self.mail_message_id.model].browse(self.mail_message_id.res_id)
        record.check_access_rights('read')
        record.check_access_rule('read')

    @api.multi
    def action_resend(self):
        self._check_access()

        notif_to_cancel = self.env['mail.notification'].sudo().search([
            ('mail_message_id', '=', self.mail_message_id.id),
            ('email_status', 'in', ('exception', 'bounce')),
            ('res_partner_id', 'in', [recipient.partner_id.id for recipient in self.recipient_ids if recipient.resend == False])])
        notif_to_cancel.sudo().write({'email_status': 'canceled'})

        partner_to_resend = self.recipient_ids.filtered(lambda line: line.resend).mapped('partner_id')
        if partner_to_resend:
            record = self.env[self.mail_message_id.model].browse(self.mail_message_id.res_id)
            rdata = []
            for pid, cid, active, pshare, ctype, notif, groups in self.env['mail.followers']._get_recipient_data(record, 'sms', False, pids=partner_to_resend.ids):
                if pid and notif == 'sms':
                    rdata.append({'id': pid, 'share': pshare, 'active': active, 'notif': notif, 'groups': groups or [], 'type': 'customer' if pshare else 'user'})
            if rdata:
                record._notify_records_by_sms(self.mail_message_id, rdata, put_in_queue=False)

        self.mail_message_id._notify_sms_update()
        return {'type': 'ir.actions.act_window_close'}

    @api.multi
    def action_cancel(self):
        for wizard in self:
            for notif in wizard.notification_ids:
                notif.filtered(lambda notif: notif.is_sms and notif.email_status in ('exception', 'bounce')).sudo().write({'email_status': 'canceled'})
            wizard.mail_message_id._notify_sms_update()
        return {'type': 'ir.actions.act_window_close'}

    @api.multi
    def action_buy_credits(self):
        url = self.env['iap.account'].get_credits_url(service_name='sms')
        return {
            'type': 'ir.actions.act_url',
            'url': url,
        }
