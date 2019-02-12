odoo.define('mail.wip.old_widget.SystrayMessagingMenu', function (require) {
"use strict";

const StoreMixin = require('mail.wip.old_widget.StoreMixin');
const SystrayMessagingMenuOwl = require('mail.wip.widget.SystrayMessagingMenu');

const core = require('web.core');
const session = require('web.session');
const SystrayMenu = require('web.SystrayMenu');
const Widget = require('web.Widget');

const _t = core._t;

/**
 * Odoo Widget, necessary to instanciate a root Owl widget.
 */
const SystrayMessagingMenu = Widget.extend(StoreMixin, {
    DEBUG: true,
    template: 'mail.wip.old_widget.SystrayMessagingMenu',
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
            this.awaitStore()
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
        const env = {
            qweb: core.qwebOwl,
            session,
            store: this.store,
            call: (...args) => this.call(...args),
            do_action: (...args) => this.do_action(...args),
            rpc: (...args) => this._rpc(...args),
            _t,
        };
        this.component = new SystrayMessagingMenuOwl(env);
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
