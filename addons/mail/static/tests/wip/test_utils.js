odoo.define('mail.wip.test_utils', function (require) {
"use strict";

const BusService = require('bus.BusService');

const Discuss = require('mail.wip.old_widget.Discuss');
const SystrayMessagingMenu = require('mail.wip.old_widget.SystrayMessagingMenu');
const ChatWindowService = require('mail.wip.service.ChatWindowService');
const StoreService = require('mail.wip.service.Store');

const AbstractStorageService = require('web.AbstractStorageService');
const Class = require('web.Class');
const RamStorage = require('web.RamStorage');
const testUtils = require('web.test_utils');
const Widget = require('web.Widget');

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

const MockMailService = Class.extend({
    bus_service() {
        return BusService.extend({
            _poll() {}, // Do nothing
            isOdooFocused() { return true; },
            updateOption() {},
        });
    },
    chat_window() {
        return ChatWindowService;
    },
    local_storage() {
        return AbstractStorageService.extend({
            storage: new RamStorage(),
        });
    },
    store_service() {
        return StoreService;
    },
    getServices() {
        return {
            bus_service: this.bus_service(),
            chat_window: this.chat_window(),
            local_storage: this.local_storage(),
            store: this.store_service(),
        };
    },
});

//------------------------------------------------------------------------------
// Public
//------------------------------------------------------------------------------

/**
 * @param {Object} self qunit test environment
 */
function afterEach(self) {
    // unpatch _.debounce and _.throttle
    _.debounce = self.underscoreDebounce;
    _.throttle = self.underscoreThrottle;
}

function beforeEach(self) {
    // patch _.debounce and _.throttle to be fast and synchronous
    self.underscoreDebounce = _.debounce;
    self.underscoreThrottle = _.throttle;
    _.debounce = _.identity;
    _.throttle = _.identity;

    self.data = {
        initMessaging: {
            channel_slots: {},
            commands: [],
            is_moderator: false,
            mail_failures: [],
            mention_partner_suggestions: [],
            menu_id: false,
            moderation_counter: 0,
            moderation_channel_ids: [],
            needaction_inbox_counter: 0,
            shortcodes: [],
            starred_counter: 0,
        },
        'mail.message': {
            fields: {},
        },
    };
}

/**
 * Create chat window manager, discuss, and systray messaging menu
 *
 * @param {Object} params
 * @param {boolean} [params.autoOpenDiscuss=false]
 * @param {boolean} [params.debug=false]
 * @param {Object} [params.initStoreStateAlteration]
 * @return {Promise}
 */
async function create(params) {
    const Parent = Widget.extend({
        do_push_state: function () {},
    });
    const parent = new Parent();
    params.archs = params.archs || {
        'mail.message,false,search': '<search/>',
    };
    params.services = new MockMailService().getServices();
    const selector = params.debug ? 'body' : '#qunit-fixture';
    let ORIGINAL_STORE_SERVICE_TEST = params.services.store.prototype.TEST;
    Object.assign(params.services.store.prototype.TEST, {
        active: true,
        initStateAlteration: params.initStoreStateAlteration || {
            global: {
                innerHeight: 1080,
                innerWidth: 1920,
            },
            isMobile: false,
        }
    });
    let ORIGINAL_CHAT_WINDOW_SERVICE_TEST = params.services.chat_window.prototype.TEST;
    Object.assign(params.services.chat_window.prototype.TEST, {
        active: true,
        container: selector,
    });
    testUtils.mock.addMockEnvironment(parent, params);
    const discuss = new Discuss(parent, params);
    const menu = new SystrayMessagingMenu(parent, params);
    const widget = new Widget(parent);

    Object.assign(widget, {
        closeDiscuss() {
            discuss.on_detach_callback();
        },
        destroy() {
            params.services.chat_window.prototype.TEST = ORIGINAL_CHAT_WINDOW_SERVICE_TEST;
            params.services.store.prototype.TEST = ORIGINAL_STORE_SERVICE_TEST;
            delete widget.destroy;
            delete window.o_test_store;
            widget.call('chat_window', 'destroy');
            parent.destroy();
        },
        openDiscuss() {
            discuss.on_attach_callback();
        },
    });

    await widget.appendTo($(selector));
    widget.call('chat_window', 'test:web_client_ready'); // trigger mounting of chat window manager
    await menu.appendTo($(selector));
    menu.on_attach_callback(); // trigger mounting of menu component
    await discuss.appendTo($(selector));
    if (params.autoOpenDiscuss) {
        widget.openDiscuss();
    }
    await testUtils.nextTick(); // mounting of chat window manager, discuss, and systray messaging menu
    const store = await widget.call('store', 'get');
    if (params.debug) {
        window.o_test_store = store;
    }
    return { store, widget };
}

async function pause() {
    await new Promise(resolve => {});
}

//------------------------------------------------------------------------------
// Export
//------------------------------------------------------------------------------

return {
    afterEach,
    beforeEach,
    create,
    pause,
};

});
