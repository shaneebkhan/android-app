# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http, _
from odoo.http import request
from odoo.exceptions import UserError
from odoo.osv import expression

CATEGORY_SUPPORTED_TYPES = ['many2one']
FILTER_SUPPORTED_TYPES = ['many2one', 'many2many', 'selection']


class KanbanSearchPanel(http.Controller):

    @http.route('/web/kanban/get_search_panel_category', type='json', auth="user")
    def get_search_panel_category(self, model, field_name):
        field = request.env[model]._fields[field_name]
        if field.type not in CATEGORY_SUPPORTED_TYPES:
            raise UserError('Only types {} are supported for {} (found type {})'.format(
                            CATEGORY_SUPPORTED_TYPES, 'category', field.type))

        CoModel = request.env[field.comodel_name]
        fields = ['display_name']
        parent_field = CoModel._fields[CoModel._parent_name]
        if parent_field:
            fields.append(parent_field.name)
        return {
            'parent_field': parent_field.name if parent_field else False,
            'values': CoModel.search_read([], fields)
        }

    @http.route('/web/kanban/get_search_panel_filter', type='json', auth="user")
    def get_search_panel_filter(self, model, field_name, **kwargs):
        comodel_domain = kwargs.get('comodel_domain', [])
        disable_counters = kwargs.get('disable_counters', False)
        group_by = kwargs.get('group_by', False)
        model_domain = expression.AND([
            kwargs.get('search_domain', []),
            kwargs.get('category_domain', []),
            kwargs.get('filter_domain', []),
            [(field_name, '!=', False)]])

        field = request.env[model]._fields[field_name]
        if field.type not in FILTER_SUPPORTED_TYPES:
            raise UserError('Only types {} are supported for {} (found type {})'.format(
                            FILTER_SUPPORTED_TYPES, 'filter', field.type))

        comodel = field.comodel_name
        group_by_field = group_by and request.env[comodel]._fields[group_by]

        field_selection = {}
        if field.type == 'selection':
            desc = request.env[model].fields_get([field_name])[field_name]
            field_selection[field] = dict(desc['selection'])
        if group_by_field and group_by_field.type == 'selection':
            desc = request.env[comodel].fields_get([group_by])[group_by]
            field_selection[group_by_field] = dict(desc['selection'])

        def get_group_id_and_name(group_value):
            if group_by_field.type == 'many2one':
                return group_value
            elif group_by_field.type == 'selection':
                return group_value, field_selection[group_by_field][group_value]
            else:
                return group_value, group_value

        # get counters
        counters = {}
        if not disable_counters and field.type in ['many2one', 'selection']:
            groups = request.env[model].read_group(model_domain, [field_name], [field_name])
            if field.type == 'many2one':
                counters = {group[field_name][0]: group[field_name + '_count'] for group in groups}
            if field.type == 'selection':
                counters = {group[field_name]: group[field_name + '_count'] for group in groups}

        # get filter_values
        filter_values = []
        if field.type in ['many2one', 'many2many']:
            field_names = ['display_name', group_by] if group_by else ['display_name']
            records = request.env[comodel].search_read(comodel_domain, field_names)
            for record in records:
                record_id = record['id']
                value = {
                    'id': record_id,
                    'name': record['display_name'],
                }
                if not disable_counters and field.type == 'many2many':
                    count_domain = expression.AND([[[field_name, 'in', record_id]], model_domain])
                    count = request.env[model].search_count(count_domain)
                else:
                    count = counters.get(record_id, 0)
                value['count'] = count
                if group_by_field:
                    if record[group_by]:
                        value['group_id'], value['group_name'] = get_group_id_and_name(record[group_by])
                    else:
                        value['group_id'] = False
                        value['group_name'] = _("Not Set")
                filter_values.append(value)
        elif field.type == 'selection':
            for option_id in field_selection[field]:
                filter_values.append({
                    'count': counters.get(option_id, 0),
                    'id': option_id,
                    'name': field_selection[field][option_id],
                })

        return filter_values
