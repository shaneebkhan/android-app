# coding: utf-8
import logging
from odoo import api, models

_logger = logging.getLogger(__name__)


class BaseModel(models.AbstractModel):
    _inherit = 'base'

    THEME_PREFIX = 'theme_'

    @api.multi
    def write(self, vals):
        if 'install_module' in self._context and self._context['install_module'].startswith('theme_'):
            if 'website_id' in self._fields and 'website_id' not in vals:
                vals['website_id'] = self._context['website_id']

                if not vals['website_id']:
                    _logger.error(('You cannot install/update theme without website_id in context'))
                    return False

        return super(BaseModel, self).write(vals)

    @api.model
    def create(self, vals):
        if 'install_module' in self._context and self._context['install_module'].startswith('theme_'):
            if 'website_id' in self._fields and 'website_id' not in vals:
                #import ipdb; ipdb.set_trace()
                vals['website_id'] = self._context['website_id']

                if not vals['website_id']:
                    _logger.error(('You cannot install/update theme without website_id in context'))
                    return False

        return super(BaseModel, self).create(vals)
    # @api.model
    # def create(self, vals):
    #     currently_updating = self._context.get('install_module', '')
    #     if currently_updating.startswith('theme_') and 'website_id' not in vals:
    #         current_website = self._context.get('website_id')
    #         if not current_website:
    #             current_website = self.env['website'].get_current_website().id
    #             print(">> ir_ui_view current_website FORCED %s" % current_website)
    #         vals['website_id'] = current_website
    #     return super(View, self).create(vals)

    # @api.model
    # def _get_inheriting_views_arch_website(self, view_id):
    #     res = self.env['website'].get_current_website()

    #     # In certain cases view validation as done by
    #     # _validate_module_views will fail. When attempting to load
    #     # inherited view CHILD:
    #     #
    #     # PARENT (theme_common)
    #     #   ^
    #     #   |
    #     # CHILD  (other_theme)
    #     #
    #     # During the view validation no website_id will be in context
    #     # so the view will fail to apply, since PARENT won't be
    #     # selected by the inheriting view arch domain.
    #     #
    #     # This is not a problem however, CHILD will never be loaded on
    #     # a website where CHILD is not installed. To simulate this,
    #     # return a website which has the theme containing CHILD
    #     # installed.
    #     if res:
    #         return res
    #     else:
    #         view_theme = self.browse(view_id).theme_id
    #         if view_theme:
    #             return self.env['website'].search([('theme_ids', 'in', view_theme.id)], limit=1)
    #         else:
    #             return self.env['website']
