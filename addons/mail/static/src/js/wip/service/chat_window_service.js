odoo.define('mail.wip.service.ChatWindowService', function (require) {
"use strict";

const StoreMixin = require('mail.wip.old_widget.StoreMixin');
const ChatWindowManager = require('mail.wip.widget.ChatWindowManager');

const AbstractService = require('web.AbstractService');
const core = require('web.core');
const session = require('web.session');

const _t = core._t;

const ChatWindowService =  AbstractService.extend(StoreMixin, {
    DEBUG: true,
    dependencies: ['store'],
    init() {
        this._super.apply(this, arguments);
        this._webClientReady = false;
        if (this.DEBUG) {
            window.chat_window_service = this;
        }
    },
    /**
     * @override {web.AbstractService}
     */
    start() {
        this._super.apply(this, arguments);
        core.bus.on('web_client_ready', this, async () => {
            await this._mount();
            this._webClientReady = true;
        });
        core.bus.on('hide_home_menu', this, async () => {
            if (!this._webClientReady) {
                return;
            }
            if (document.querySelector('.o_wip_chat_window_manager')) {
                return;
            }
            await this._mount();
        });
        core.bus.on('show_home_menu', this, async () => {
            if (!this._webClientReady) {
                return;
            }
            if (document.querySelector('.o_wip_chat_window_manager')) {
                return;
            }
            await this._mount();
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    async _mount() {
        await this.awaitStore();
        if (this.component) {
            this.component.destroy();
            this.component = undefined;
        }
        const env = {
            _t,
            qweb: core.qwebOwl,
            session,
            store: this.store,
            call: (...args) => this.call(...args),
            do_action: (...args) => this.do_action(...args),
            rpc: (...args) => this._rpc(...args),
        };
        this.component = new ChatWindowManager(env);
        this.component.mount(document.querySelector('body'));
    },
});

core.serviceRegistry.add('chat_window', ChatWindowService);

return ChatWindowService;

});
