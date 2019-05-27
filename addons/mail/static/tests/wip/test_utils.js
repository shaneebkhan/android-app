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
    chat_window_service() {
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
            chat_window_service: this.chat_window_service(),
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
 * Create asynchronously chat window manager widget.
 *
 * @param {Object} params
 * @return {Promise}
 */
async function createChatWindowManager(params) {
    const Parent = Widget.extend({
        do_push_state: function () {},
    });
    const parent = new Parent();
    params.services = new MockMailService().getServices();
    const selector = params.debug ? 'body' : '#qunit-fixture';
    const {
        CONTAINER: ORIGINAL_CONTAINER,
        MODE: ORIGINAL_MODE,
    } = params.services.chat_window_service.prototype;
    Object.assign(params.services.chat_window_service.prototype, {
        CONTAINER: selector,
        MODE: 'demo',
    });
    testUtils.mock.addMockEnvironment(parent, params);
    const widget = new Widget(parent);

    widget.destroy = function () {
        Object.assign(params.services.chat_window_service.prototype, {
            CONTAINER: ORIGINAL_CONTAINER,
            MODE: ORIGINAL_MODE,
        });
        delete widget.destroy;
        widget.call('chat_window_service', 'destroy');
        parent.destroy();
    };

    await widget.appendTo($(selector));
    widget.call('chat_window_service', 'demo:web_client_ready');
    await testUtils.nextTick(); // mounting of chat window manager
    return widget;
}

/**
 * Create asynchronously a discuss widget.
 *
 * @param {Object} params
 * @return {Promise} resolved with the discuss widget
 */
async function createDiscuss(params) {
    const Parent = Widget.extend({
        do_push_state: function () {},
    });
    const parent = new Parent();
    params.archs = params.archs || {
        'mail.message,false,search': '<search/>',
    };
    params.services = new MockMailService().getServices();
    testUtils.mock.addMockEnvironment(parent, params);
    const discuss = new Discuss(parent, params);
    const selector = params.debug ? 'body' : '#qunit-fixture';

    // override 'destroy' of discuss so that it calls 'destroy' on the parent
    // instead, which is the parent of discuss and the mockServer.
    discuss.destroy = function () {
        // remove the override to properly destroy discuss and its children
        // when it will be called the second time (by its parent)
        delete discuss.destroy;
        parent.destroy();
    };

    await discuss.appendTo($(selector));
    discuss.on_attach_callback(); // trigger mounting of discuss component
    await testUtils.nextTick(); // render
    return discuss;
}

/**
 * Create asynchronously a systray messaging menu widget.
 *
 * @param {Object} params
 * @return {Promise} resolved with the systray messaging menu widget
 */
async function createSystrayMessagingMenu(params) {
    const Parent = Widget.extend({
        do_push_state: function () {},
    });
    const parent = new Parent();
    params.services = new MockMailService().getServices();
    testUtils.mock.addMockEnvironment(parent, params);
    const menu = new SystrayMessagingMenu(parent, params);
    const selector = params.debug ? 'body' : '#qunit-fixture';

    // override 'destroy' of systray messaging menu so that it calls 'destroy'
    // on the parent instead, which is the parent of the menu and the mockServer.
    menu.destroy = function () {
        // remove the override to properly destroy menu and its children
        // when it will be called the second time (by its parent)
        delete menu.destroy;
        parent.destroy();
    };

    await menu.appendTo($(selector));
    menu.on_attach_callback(); // trigger mounting of menu component
    await testUtils.nextTick(); // render
    return menu;
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
    createChatWindowManager,
    createDiscuss,
    createSystrayMessagingMenu,
    pause,
};

});
