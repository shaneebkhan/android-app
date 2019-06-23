odoo.define('mail.widget.SystrayMessagingMenu', function (require) {
"use strict";

const SystrayMessagingMenuOwl = require('mail.component.SystrayMessagingMenu');
const EnvMixin = require('mail.widget.EnvMixin');

const SystrayMenu = require('web.SystrayMenu');
const Widget = require('web.Widget');

/**
 * Odoo Widget, necessary to instanciate a root Owl widget.
 */
const SystrayMessagingMenu = Widget.extend(EnvMixin, {
    DEBUG: true,
    template: 'mail.widget.SystrayMessagingMenu',
    init() {
        this._super.apply(this, arguments);
        this.component = undefined;

        if (this.DEBUG) {
            window.old_systray_messaging_menu = this;
        }
    },
    /**
     * @override {web.Widget}
     */
    willStart() {
        return Promise.all([
            this._super.apply(this, arguments),
            this.getEnv()
        ]);
    },
    /**
     * @override {web.Widget}
     */
    destroy() {
        if (this.component) {
            this.component.destroy();
        }
        this._super.apply(this, arguments);
    },
    async on_attach_callback() {
        this.component = new SystrayMessagingMenuOwl(this.env);
        await this.component.mount(this.$el[0]);
        // unwrap
        this.el.parentNode.insertBefore(this.component.el, this.el);
        this.el.parentNode.removeChild(this.el);
    },
});

// Systray menu items display order matches order in the list
// lower index comes first, and display is from right to left.
// For messagin menu, it should come before activity menu, if any
// otherwise, it is the next systray item.
const activityMenuIndex = SystrayMenu.Items.findIndex(SystrayMenuItem =>
    SystrayMenuItem.prototype.name === 'activity_menu');
if (activityMenuIndex > 0) {
    SystrayMenu.Items.splice(activityMenuIndex, 0, SystrayMessagingMenu);
} else {
    SystrayMenu.Items.push(SystrayMessagingMenu);
}

return SystrayMessagingMenu;

});
