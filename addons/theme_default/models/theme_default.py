from odoo import models

class ThemeDefault(models.AbstractModel):
    _inherit = 'theme.utils'

    def _theme_default_post_copy(self, mod):
        self.disable_view('website_theme_install.customize_modal')
        # Reset all fonts when switching themes
        values = {
            'font-number': 1,
            'headings-font-number': 1,
            'buttons-font-number': 1,
            'navbar-font-number': 1,
        }
        self._make_scss_customization('/website/static/src/scss/options/user_values.scss', values)
