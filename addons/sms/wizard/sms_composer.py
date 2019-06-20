# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from ast import literal_eval

from odoo import api, fields, models, tools, _
from odoo.addons.mail.wizard.mail_compose_message import _reopen
from odoo.exceptions import UserError
from odoo.tools.safe_eval import safe_eval


class SendSMS(models.TransientModel):
    _name = 'sms.composer'
    _description = 'Send SMS Wizard'

    # documents
    composition_mode = fields.Selection([
        ('numbers', 'Send to numbers'),
        ('comment', 'Post on a document'),
        ('mass', 'Send SMS in batch')],
        string='Composition Mode', default='comment', required=True)
    res_model = fields.Char('Document Model Name')
    res_id = fields.Integer('Document ID')
    res_ids = fields.Char('Document IDs')
    use_active_domain = fields.Boolean('Use active domain')
    active_domain = fields.Text('Active domain', readonly=True)
    # options for comment and mass mode
    comment_send_now = fields.Boolean('Send Now')
    comment_batch = fields.Boolean('Post in batch')
    mass_keep_log = fields.Boolean('Keep a note on document')
    # recipients
    partner_ids = fields.Many2many('res.partner')
    numbers = fields.Char('Recipients')
    sanitized_numbers = fields.Char('Sanitized Number', compute='_compute_sanitized_numbers')
    # content
    template_id = fields.Many2one('sms.template', string='Use Template', domain="[('model', '=', res_model)]")
    body = fields.Text('Message', required=True)

    @api.onchange('composition_mode', 'res_model', 'res_id', 'template_id')
    def _onchange_template_id(self):
        if self.template_id and self.composition_mode == 'comment':
            self.body = self.template_id._render_template(self.template_id.body, self.res_model, [self.res_id])[self.res_id]

    @api.depends('numbers')
    def _compute_sanitized_numbers(self):
        if self.numbers:
            sanitized_numbers, invalid, void_count = self.env['sms.api']._sanitize_number_string(self.numbers, None, None)
            if invalid:
                raise UserError(_('Following numbers are not correctly encoded: %s') % repr(invalid))
            self.sanitized_numbers = ','.join(sanitized_numbers)
        else:
            self.sanitized_numbers = False

    def _onchange_partner_ids(self):
        # TODO: check for number
        if self.partner_ids:
            pass

    def _get_composer_values(self, composition_mode, res_model, res_id, partner_ids, body, template_id):
        result = {}
        if composition_mode == 'comment':
            record = self.env[res_model].browse(res_id)
            if not partner_ids and hasattr(record, '_get_default_sms_recipients'):
                result['partner_ids'] = self.env[res_model].browse(res_id)._get_default_sms_recipients().ids
            if not body and template_id:
                template = self.env['sms.template'].browse(template_id)
                result['body'] = template._render_template(template.body, res_model, [res_id])[res_id]
        else:
            if not body and template_id:
                template = self.env['sms.template'].browse(template_id)
                result['body'] = template.body
        return result

    def _get_records(self):
        if not self.res_model:
            return None
        if self.use_active_domain:  # TDE FIXME: clear active_domain (False,[], ..)
            records = self.env[self.res_model].search(safe_eval(self.active_domain))
        elif self.res_id:
            records = self.env[self.res_model].browse(self.res_id)
        else:
            records = self.env[self.res_model].browse(literal_eval(self.res_ids))
        return records

    @api.model
    def default_get(self, fields):
        result = super(SendSMS, self).default_get(fields)
        print('\t\tcomposer default before', result)
        if not result.get('res_model'):
            result['res_model'] = self.env.context.get('active_model')
        if result['composition_mode'] == 'comment' and not result.get('res_id'):
            result['res_id'] = self.env.context.get('active_id')
        if result['composition_mode'] != 'comment':
            if result.get('use_active_domain') and not result.get('active_domain'):
                result['active_domain'] = self.env.context['active_domain']
            elif not result.get('res_ids'):
                result['res_ids'] = repr(self.env.context.get('active_ids'))

        result.update(
            self._get_composer_values(
                result['composition_mode'], result['res_model'], self.env.context.get('active_id'), result.get('partner_ids'),
                result.get('body'), result.get('template_id'))
        )
        print('\t\tcomposer default after', result)
        return result

    def action_send_sms(self):
        records = self._get_records()
        if self.composition_mode == 'numbers':
            return self._action_send_sms_numbers()
        elif self.composition_mode == 'comment':
            if records is not None and issubclass(type(records), self.pool['mail.thread']):
                return self._action_send_sms_comment(records)
            return self._action_send_sms_numbers()
        else:
            return self._action_send_sms_mass(records)

    def _action_send_sms_numbers(self):
        self.env['sms.api']._send_sms_batch([{
            'res_id': 0,
            'number': number,
            'content': self.body,
        } for number in self.sanitized_numbers.split(',')])
        return True

    def _action_send_sms_comment(self, records=None):
        records = records if records is not None else self._get_records()
        subtype_id = self.env['ir.model.data'].xmlid_to_res_id('mail.mt_comment')

        messages = self.env['mail.message']
        for record in records:
            messages |= records._message_sms(
                self.body, partner_ids=self.partner_ids.ids, subtype_id=subtype_id,
                numbers=self.sanitized_numbers.split(',') if self.sanitized_numbers else False)
        return messages

    def _action_send_sms_mass(self, records=None):
        records = records if records is not None else self._get_records()

        sms_create_vals = [{
            'body': self.body,
            'partner_id': partner.id,
            'number': partner.mobile,
            'state': 'outgoing',
        } for record in records
            for partner in record._get_default_sms_recipients()
            if partner
        ]
        sms = self.env['sms.sms'].sudo().create(sms_create_vals)
        return sms

    def _action_send_sms_mass_w_log(self):
        records = self._get_records()
        if records and hasattr(records, '_message_sms'):
            subtype_id = self.env['ir.model.data'].xmlid_to_res_id('mail.mt_note')
            for record in records:
                record._message_sms(self.body, subtype_id=subtype_id, partner_ids=False, numbers=False)
        else:
            self.env['sms.api']._send_sms(self.numbers, self.body)
        return True

    @api.multi
    def save_as_template(self):
        """ hit save as template button: current form value will be a new
            template attached to the current document. """
        for record in self:
            model = self.env['ir.model']._get(record.model or 'mail.message')
            model_name = model.name or ''
            record_name = False
            if record.composition_mode == 'mass_sms':
                active_model = self.env.context.get('active_model')
                model = self.env[active_model]
                records = self._get_records(model)
                recipients = self.env['sms.sms']._get_sms_recipients(active_model, records and records[0].id)
                record_name = recipients and recipients[0]['partner_id'] and recipients[0]['partner_id'].display_name or 'New Template'
            else:
                record_name = record.recipient_ids and record.recipient_ids[0].partner_id and record.recipient_ids[0].partner_id.display_name or 'New Template'
            template_name = "%s: %s" % (model_name, record_name)
            values = {
                'name': template_name,
                'body': record.content or False,
                'model_id': model.id or False,
            }
            template = self.env['sms.template'].create(values)
            # generate the saved template
            record.write({'template_id': template.id})
            record._onchange_template_id()
            return _reopen(self, record.id, record.model, context=self._context)
