odoo.define('mail.wip.discuss_test', function (require) {
"use strict";

const BusService = require('bus.BusService');

const Discuss = require('mail.wip.old_widget.Discuss');
const StoreService = require('mail.wip.service.Store');

const AbstractStorageService = require('web.AbstractStorageService');
const Class = require('web.Class');
const RamStorage = require('web.RamStorage');
const testUtils = require('web.test_utils');
const Widget = require('web.Widget');

async function pause() {
    await new Promise(resolve => {});
}

const MockMailService = Class.extend({
    bus_service() {
        return BusService.extend({
            _poll() {}, // Do nothing
            isOdooFocused() { return true; },
            updateOption() {},
        });
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
            local_storage: this.local_storage(),
            store: this.store_service(),
        };
    },
});

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
    discuss.on_attach_callback(); // trigger mounting of discuss root
    await testUtils.nextTick(); // render
    return discuss;
}

QUnit.module('mail.wip', {}, function () {
QUnit.module('Discuss', {
    beforeEach() {
        // patch _.debounce and _.throttle to be fast and synchronous
        this.underscoreDebounce = _.debounce;
        this.underscoreThrottle = _.throttle;
        _.debounce = _.identity;
        _.throttle = _.identity;

        this.data = {
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

        this.createDiscuss = async params => {
            if (this.discuss) {
                this.discuss.destroy();
            }
            this.discuss = await createDiscuss({ ...params, data: this.data });
        };
    },
    afterEach() {
        // unpatch _.debounce and _.throttle
        _.debounce = this.underscoreDebounce;
        _.throttle = this.underscoreThrottle;
        if (this.discuss) {
            this.discuss.destroy();
        }
    }
});

QUnit.test('basic rendering', async function (assert) {
    assert.expect(4);

    await this.createDiscuss();

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar').length, 1, "should have a sidebar section");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content').length, 1, "should have content section");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread').length, 1, "should have thread section inside content");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_wip_composer').length, 0, "should have composer section inside content (due to inbox active)");
});

QUnit.test('basic rendering: sidebar', async function (assert) {
    assert.expect(19);

    await this.createDiscuss();

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group').length, 3, "should have 3 groups in sidebar");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_mailbox').length, 1, "should have group 'Mailbox' in sidebar");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_mailbox > .o_header').length, 0, "mailbox category should not have any header");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_mailbox > .o_item').length, 2, "should have 2 mailbox items");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_mailbox > .o_item[data-thread-lid="mail.box_inbox"]').length, 1, "should have inbox mailbox item");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_mailbox > .o_item[data-thread-lid="mail.box_starred"]').length, 1, "should have starred mailbox item");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_separator').length, 1, "should have separator (between mailboxes and channels, but that's not tested)");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel').length, 1, "should have group 'Channel' in sidebar");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_header').length, 1, "channel category should have a header");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_header > .o_title').length, 1, "should have title in channel header");
    assert.strictEqual(document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_header > .o_title').textContent.trim(), "Channels");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list').length, 1, "channel category should list items");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item').length, 0, "channel category should have no item by default");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat').length, 1, "should have group 'Chat' in sidebar");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_header').length, 1, "channel category should have a header");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_header > .o_title').length, 1, "should have title in chat header");
    assert.strictEqual(document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_header > .o_title').textContent.trim(), "Direct Messages");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_list').length, 1, "chat category should list items");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_list > .o_item').length, 0, "chat category should have no item by default");
});

QUnit.test('sidebar: basic mailbox rendering', async function (assert) {
    assert.expect(6);

    await this.createDiscuss();

    const inbox = document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_mailbox > .o_item[data-thread-lid="mail.box_inbox"]');

    assert.strictEqual(inbox.querySelectorAll(':scope > .o_active_indicator').length, 1, "mailbox should have active indicator");
    assert.strictEqual(inbox.querySelectorAll(':scope > .o_wip_thread_icon').length, 1, "mailbox should have an icon");
    assert.strictEqual(inbox.querySelectorAll(':scope > .o_wip_thread_icon > .fa.fa-inbox').length, 1, "inbox should have 'inbox' icon");
    assert.strictEqual(inbox.querySelectorAll(':scope > .o_name').length, 1, "mailbox should have a name");
    assert.strictEqual(inbox.querySelector(':scope > .o_name').textContent, "Inbox", "inbox should have name 'Inbox'");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_inbox"] > .o_counter').length, 0, "should have no counter when equal to 0 (default value)");
});

QUnit.test('sidebar: default active inbox', async function (assert) {
    assert.expect(1);

    await this.createDiscuss();

    const inbox = document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_mailbox > .o_item[data-thread-lid="mail.box_inbox"]');

    assert.strictEqual(inbox.querySelector(':scope > .o_active_indicator').classList.contains('o_active'), true, "inbox should be active by default");
});

QUnit.test('sidebar: change item', async function (assert) {
    assert.expect(4);

    await this.createDiscuss();

    assert.strictEqual(document.querySelector('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_inbox"] > .o_active_indicator').classList.contains('o_active'), true, "inbox should be active by default");
    assert.strictEqual(document.querySelector('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_starred"] > .o_active_indicator').classList.contains('o_active'), false, "starred should be inactive by default");

    await testUtils.dom.click(document.querySelector('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_starred"]'));

    assert.strictEqual(document.querySelector('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_inbox"] > .o_active_indicator').classList.contains('o_active'), false, "inbox mailbox should become inactive");
    assert.strictEqual(document.querySelector('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_starred"] > .o_active_indicator').classList.contains('o_active'), true, "starred mailbox should become active");
});

QUnit.test('sidebar: inbox with counter', async function (assert) {
    assert.expect(2);

    Object.assign(this.data.initMessaging, { needaction_inbox_counter: 100 });

    await this.createDiscuss();

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_inbox"] > .o_counter').length, 1, "should have a counter when different from 0");
    assert.strictEqual(document.querySelector('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_inbox"] > .o_counter').textContent, "100", "should have counter value");
});

QUnit.test('sidebar: add channel', async function (assert) {
    assert.expect(3);

    await this.createDiscuss();

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_header > .o_add').length, 1, "should be able to add channel from heade");
    assert.strictEqual(document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_header > .o_add').title, "Add or join a channel");

    await testUtils.dom.click(document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_header > .o_add'));

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item.o_add').length, 1, "should have item to add a new channel");
});

QUnit.test('sidebar: basic channel rendering', async function (assert) {
    assert.expect(14);

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 20,
                name: "General",
            }],
        },
    });

    await this.createDiscuss();

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item').length, 1, "should have one channel item");

    let channel = document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item');

    assert.strictEqual(channel.dataset.threadLid, "mail.channel_20", "should have channel with ID 20");
    assert.strictEqual(channel.querySelectorAll(':scope > .o_active_indicator').length, 1, "should have active indicator");
    assert.strictEqual(channel.querySelectorAll(':scope > .o_active_indicator.o_active').length, 0, "should not be active by default");
    assert.strictEqual(channel.querySelectorAll(':scope > .o_wip_thread_icon').length, 1, "should have an icon");
    assert.strictEqual(channel.querySelectorAll(':scope > .o_name').length, 1, "should have a name");
    assert.strictEqual(channel.querySelector(':scope > .o_name').textContent, "General", "should have name value");
    assert.strictEqual(channel.querySelectorAll(':scope > .o_commands').length, 1, "should have commands");
    assert.strictEqual(channel.querySelectorAll(':scope > .o_commands > .o_command').length, 2, "should have 2 commands");
    assert.strictEqual(channel.querySelectorAll(':scope > .o_commands > .o_command.o_settings').length, 1, "should have 'settings' command");
    assert.strictEqual(channel.querySelectorAll(':scope > .o_commands > .o_command.o_leave').length, 1, "should have 'leave' command");
    assert.strictEqual(channel.querySelectorAll(':scope > .o_counter').length, 0, "should have a counter when equals 0 (default value)");

    await testUtils.dom.click(document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item'));

    channel = document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item');

    assert.strictEqual(channel.querySelectorAll(':scope > .o_active_indicator.o_active').length, 1, "channel should become active");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_wip_composer').length, 1, "should have composer section inside content (cam post message in channel)");
});

QUnit.test('sidebar: channel rendering with needaction counter', async function (assert) {
    assert.expect(5);

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 20,
                name: "General",
                message_needaction_counter: 10,
            }],
        },
    });

    await this.createDiscuss();

    const channel = document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item');

    assert.strictEqual(channel.querySelectorAll(':scope > .o_counter').length, 1, "should have a counter when different from 0");
    assert.strictEqual(channel.querySelector(':scope > .o_counter').textContent, "10", "should have counter value");
    assert.strictEqual(channel.querySelectorAll(':scope > .o_commands > .o_command').length, 1, "should have single command");
    assert.strictEqual(channel.querySelectorAll(':scope > .o_commands > .o_command.o_settings').length, 1, "should have 'settings' command");
    assert.strictEqual(channel.querySelectorAll(':scope > .o_commands > .o_command.o_leave').length, 0, "should not have 'leave' command");
});

QUnit.test('sidebar: public/private channel rendering', async function (assert) {
    assert.expect(5);

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 100,
                name: "channel1",
                public: 'public',
            }],
            channel_private_group: [{
                channel_type: "channel",
                id: 101,
                name: "channel2",
                public: 'private',
            }],
        },
    });

    await this.createDiscuss();

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item').length, 2, "should have 2 channel items");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item[data-thread-lid="mail.channel_100"]').length, 1, "should have channel1 (ID 100)");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item[data-thread-lid="mail.channel_101"]').length, 1, "should have channel2 (ID 101)");

    const channel1 = document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item[data-thread-lid="mail.channel_100"]');
    const channel2 = document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item[data-thread-lid="mail.channel_101"]');

    assert.strictEqual(channel1.querySelectorAll(':scope > .o_wip_thread_icon > .fa.fa-hashtag').length, 1, "channel1 (public) has hashtag icon");
    assert.strictEqual(channel2.querySelectorAll(':scope > .o_wip_thread_icon > .fa.fa-lock').length, 1, "channel2 (private) has lock icon");
});

QUnit.test('sidebar: basic chat rendering', async function (assert) {
    assert.expect(11);

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_direct_message: [{
                channel_type: "chat",
                direct_partner: [{
                    id: 7,
                    name: "Demo",
                }],
                id: 10,
            }],
        },
    });

    await this.createDiscuss();

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_list > .o_item').length, 1, "should have one chat item");

    const chat = document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_list > .o_item');

    assert.strictEqual(chat.dataset.threadLid, "mail.channel_10", "should have chat with ID 20");
    assert.strictEqual(chat.querySelectorAll(':scope > .o_active_indicator').length, 1, "should have active indicator");
    assert.strictEqual(chat.querySelectorAll(':scope > .o_wip_thread_icon').length, 1, "should have an icon");
    assert.strictEqual(chat.querySelectorAll(':scope > .o_name').length, 1, "should have a name");
    assert.strictEqual(chat.querySelector(':scope > .o_name').textContent, "Demo", "should have direct partner name as name");
    assert.strictEqual(chat.querySelectorAll(':scope > .o_commands').length, 1, "should have commands");
    assert.strictEqual(chat.querySelectorAll(':scope > .o_commands > .o_command').length, 2, "should have 2 commands");
    assert.strictEqual(chat.querySelectorAll(':scope > .o_commands > .o_command.o_rename').length, 1, "should have 'rename' command");
    assert.strictEqual(chat.querySelectorAll(':scope > .o_commands > .o_command.o_unpin').length, 1, "should have 'unpin' command");
    assert.strictEqual(chat.querySelectorAll(':scope > .o_counter').length, 0, "should have a counter when equals 0 (default value)");
});

QUnit.test('sidebar: chat rendering with unread counter', async function (assert) {
    assert.expect(5);

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_direct_message: [{
                channel_type: "chat",
                direct_partner: [{
                    id: 7,
                    name: "Demo",
                }],
                id: 10,
                message_unread_counter: 100,
            }],
        },
    });

    await this.createDiscuss();

    const chat = document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_list > .o_item');

    assert.strictEqual(chat.querySelectorAll(':scope > .o_counter').length, 1, "should have a counter when different from 0");
    assert.strictEqual(chat.querySelector(':scope > .o_counter').textContent, "100", "should have counter value");
    assert.strictEqual(chat.querySelectorAll(':scope > .o_commands > .o_command').length, 1, "should have single command");
    assert.strictEqual(chat.querySelectorAll(':scope > .o_commands > .o_command.o_rename').length, 1, "should have 'rename' command");
    assert.strictEqual(chat.querySelectorAll(':scope > .o_commands > .o_command.o_unpin').length, 0, "should not have 'unpin' command");
});

QUnit.test('sidebar: chat im_status rendering', async function (assert) {
    assert.expect(7);

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_direct_message: [{
                channel_type: "chat",
                direct_partner: [{
                    id: 1,
                    im_status: 'offline',
                    name: "Partner1",
                }],
                id: 11,
            }, {
                channel_type: "chat",
                direct_partner: [{
                    id: 2,
                    im_status: 'online',
                    name: "Partner2",
                }],
                id: 12,
            }, {
                channel_type: "chat",
                direct_partner: [{
                    id: 3,
                    im_status: 'away',
                    name: "Partner3",
                }],
                id: 13,
            }],
        },
    });

    await this.createDiscuss();

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_list > .o_item').length, 3, "should have 3 chat items");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_list > .o_item[data-thread-lid="mail.channel_11"]').length, 1, "should have Partner1 (ID 11)");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_list > .o_item[data-thread-lid="mail.channel_12"]').length, 1, "should have Partner2 (ID 12)");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_list > .o_item[data-thread-lid="mail.channel_13"]').length, 1, "should have Partner3 (ID 13)");

    const chat1 = document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_list > .o_item[data-thread-lid="mail.channel_11"]');
    const chat2 = document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_list > .o_item[data-thread-lid="mail.channel_12"]');
    const chat3 = document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_list > .o_item[data-thread-lid="mail.channel_13"]');

    assert.strictEqual(chat1.querySelectorAll(':scope > .o_wip_thread_icon > .o_offline').length, 1, "chat1 should have offline icon");
    assert.strictEqual(chat2.querySelectorAll(':scope > .o_wip_thread_icon > .o_online').length, 1, "chat2 should have online icon");
    assert.strictEqual(chat3.querySelectorAll(':scope > .o_wip_thread_icon > .o_away').length, 1, "chat3 should have away icon");
});

QUnit.test('sidebar: chat custom name', async function (assert) {
    assert.expect(1);

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_direct_message: [{
                channel_type: "chat",
                custom_channel_name: "Marc",
                direct_partner: [{
                    id: 7,
                    name: "Marc Demo",
                }],
                id: 10,
            }],
        },
    });

    await this.createDiscuss();

    const chat = document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_list > .o_item');
    assert.strictEqual(chat.querySelector(':scope > .o_name').textContent, "Marc", "chat should have custom name as name");
});

QUnit.test('sidebar: rename chat', async function (assert) {
    assert.expect(9);

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_direct_message: [{
                custom_channel_name: "Marc",
                channel_type: "chat",
                direct_partner: [{
                    id: 7,
                    name: "Marc Demo",
                }],
                id: 10,
            }],
        },
    });

    await this.createDiscuss({
        mockRPC(route, args) {
            if (args.method === 'channel_set_custom_name') {
                return Promise.resolve();
            }
            return this._super.apply(this, arguments);
        },
    });

    const chat = document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_list > .o_item');

    assert.strictEqual(chat.querySelector(':scope > .o_name').textContent, "Marc", "chat should have custom name as name");

    await testUtils.dom.click(chat.querySelector(':scope > .o_commands > .o_command.o_rename'), { allowInvisible: true });

    assert.strictEqual(chat.querySelectorAll(':scope > .o_name').length, 0, "chat should no longer show name");
    assert.strictEqual(chat.querySelectorAll(':scope > .o_editable_name').length, 1, "chat should have editable name");
    assert.strictEqual(chat.querySelectorAll(':scope > .o_editable_name > input').length, 1, "chat should have editable name input");
    assert.strictEqual(chat.querySelector(':scope > .o_editable_name > input').value, "Marc", "editable name input should have custom chat name as value by default");
    assert.strictEqual(chat.querySelector(':scope > .o_editable_name > input').placeholder, "Marc Demo", "editable name input should have partner name as placeholder");

    chat.querySelector(':scope > .o_editable_name > input').value = "Demo";
    const kevt = new window.KeyboardEvent('keydown', { key: "Enter" });
    chat.querySelector(':scope > .o_editable_name > input').dispatchEvent(kevt);
    await testUtils.nextTick(); // re-render

    assert.strictEqual(chat.querySelectorAll(':scope > .o_editable_name').length, 0, "chat should no longer show editable name");
    assert.strictEqual(chat.querySelectorAll(':scope > .o_name').length, 1, "chat should show name again");
    assert.strictEqual(chat.querySelector(':scope > .o_name').textContent, "Demo", "chat should have renamed name as name");
});

QUnit.test('default thread rendering', async function (assert) {
    assert.expect(2);

    await this.createDiscuss();

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_empty').length, 1, "should have empty thread");
    assert.strictEqual(document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_empty').textContent.trim(), "There are no messages in this conversation.");
});

QUnit.test('initially load messages from inbox', async function (assert) {
    assert.expect(3);

    await this.createDiscuss({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                assert.strictEqual(args.kwargs.limit, 30, "should fetch up to 30 messages");
                assert.strictEqual(args.args.length, 1, "should have a single item in args");
                assert.deepEqual(args.args[0], [["needaction", "=", true]], "should fetch needaction messages");
            }
            return this._super.apply(this, arguments);
        },
    });
});

QUnit.test('default select thread in discuss params', async function (assert) {
    assert.expect(1);

    await this.createDiscuss({
        params: { default_active_id: 'mail.box_starred' },
    });

    assert.strictEqual(document.querySelector('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_starred"] > .o_active_indicator').classList.contains('o_active'), true, "starred mailbox should become active");
});

QUnit.test('auto-select thread in discuss context', async function (assert) {
    assert.expect(1);

    await this.createDiscuss({
        context: { active_id: 'mail.box_starred' },
    });

    assert.strictEqual(document.querySelector('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_starred"] > .o_active_indicator').classList.contains('o_active'), true, "starred mailbox should become active");
});

QUnit.test('load single message from channel initially', async function (assert) {
    assert.expect(8);

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 20,
                name: "General",
            }],
        },
    });

    await this.createDiscuss({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                assert.strictEqual(args.kwargs.limit, 30, "should fetch up to 30 messages");
                assert.strictEqual(args.args.length, 1, "should have a single item in args");
                assert.deepEqual(args.args[0], [["channel_ids", "in", [20]]], "should fetch messages from channel");
                return Promise.resolve([{
                    author_id: [11, "Demo"],
                    body: "<p>body</p>",
                    channel_ids: [20],
                    date: "2019-04-20 10:00:00",
                    id: 100,
                    message_type: 'comment',
                    model: 'mail.channel',
                    record_name: 'General',
                    res_id: 20,
                }]);
            }
            return this._super.apply(this, arguments);
        },
        params: { default_active_id: 'mail.channel_20' },
    });

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list').length, 1, "should have list of messages");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_separator.o_date').length, 1, "should have a single date separator"); // to check: may be client timezone dependent
    assert.strictEqual(document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_separator.o_date > .o_label').textContent, "April 20, 2019", "should display date day of messages");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message').length, 1, "should have a single message");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_100"]').length, 1, "should have message with ID 100");
});

QUnit.test('basic rendering of message', async function (assert) {
    assert.expect(13);

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 20,
                name: "General",
            }],
        },
    });

    await this.createDiscuss({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                return Promise.resolve([{
                    author_id: [11, "Demo"],
                    body: "<p>body</p>",
                    channel_ids: [20],
                    date: "2019-04-20 10:00:00",
                    id: 100,
                    message_type: 'comment',
                    model: 'mail.channel',
                    record_name: 'General',
                    res_id: 20,
                }]);
            }
            return this._super.apply(this, arguments);
        },
        params: { default_active_id: 'mail.channel_20' },
    });

    const message = document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_100"]');

    assert.strictEqual(message.querySelectorAll(':scope > .o_sidebar').length, 1, "should have message sidebar of message");
    assert.strictEqual(message.querySelectorAll(':scope > .o_sidebar > img').length, 1, "should have image in sidebar of message");
    assert.strictEqual(message.querySelector(':scope > .o_sidebar > img').dataset.src, "/web/image/res.partner/11/image_small", "should have url of message in img sidebar");
    assert.strictEqual(message.querySelectorAll(':scope > .o_core').length, 1, "should have core part of message");
    assert.strictEqual(message.querySelectorAll(':scope > .o_core > .o_header').length, 1, "should have header in core part of message");
    assert.strictEqual(message.querySelectorAll(':scope > .o_core > .o_header > .o_author_name').length, 1, "should have author name in header of message");
    assert.strictEqual(message.querySelector(':scope > .o_core > .o_header > .o_author_name').textContent, "Demo", "should have textually author name in header of message");
    assert.strictEqual(message.querySelectorAll(':scope > .o_core > .o_header > .o_date').length, 1, "should have date in header of message");
    assert.strictEqual(message.querySelectorAll(':scope > .o_core > .o_header > .o_commands').length, 1, "should have commands in header of message");
    assert.strictEqual(message.querySelectorAll(':scope > .o_core > .o_header > .o_commands > .o_command').length, 1, "should have a single in header of message");
    assert.strictEqual(message.querySelectorAll(':scope > .o_core > .o_header > .o_commands > .o_command.o_star').length, 1, "should have command to star message");
    assert.strictEqual(message.querySelectorAll(':scope > .o_core > .o_content').length, 1, "should have content in core part of message");
    assert.strictEqual(message.querySelector(':scope > .o_core > .o_content').innerHTML.trim(), "<p>body</p>", "should have body of message in content part of message");
});

QUnit.test('basic rendering of squashed message', async function (assert) {
    // messages are squashed when "close", e.g. less than 1 minute has elapsed
    // from messages of same author and same thread. Note that this should
    // be working in non-mailboxes
    assert.expect(12);

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 20,
                name: "General",
            }],
        },
    });

    await this.createDiscuss({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                return Promise.resolve([{
                    author_id: [11, "Demo"],
                    body: "<p>body1</p>",
                    channel_ids: [20],
                    date: "2019-04-20 10:00:00",
                    id: 100,
                    message_type: 'comment',
                    model: 'mail.channel',
                    record_name: 'General',
                    res_id: 20,
                }, {
                    author_id: [11, "Demo"],
                    body: "<p>body2</p>",
                    channel_ids: [20],
                    date: "2019-04-20 10:00:30",
                    id: 101,
                    message_type: 'comment',
                    model: 'mail.channel',
                    record_name: 'General',
                    res_id: 20,
                }]);
            }
            return this._super.apply(this, arguments);
        },
        params: { default_active_id: 'mail.channel_20' },
    });

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message').length, 2, "should have 2 messages");

    const message1 = document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_100"]');
    const message2 = document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_101"]');

    assert.notOk(message1.classList.contains('o_squashed'), "message 1 should not be squashed");
    assert.notOk(message1.querySelector(':scope > .o_sidebar').classList.contains('o_squashed'), "message 1 should not have squashed sidebar");
    assert.ok(message2.classList.contains('o_squashed'), "message 2 should be squashed");
    assert.ok(message2.querySelector(':scope > .o_sidebar').classList.contains('o_squashed'), "message 2 should not have squashed sidebar");
    assert.strictEqual(message2.querySelectorAll(':scope > .o_sidebar > .o_date').length, 1, "message 2 should have date in sidebar");
    assert.strictEqual(message2.querySelectorAll(':scope > .o_sidebar > .o_commands').length, 1, "message 2 should have some commands in sidebar");
    assert.strictEqual(message2.querySelectorAll(':scope > .o_sidebar > .o_commands > .o_command').length, 1, "message 2 should have star command in sidebar");
    assert.strictEqual(message2.querySelectorAll(':scope > .o_core').length, 1, "message 2 should have core part");
    assert.strictEqual(message2.querySelectorAll(':scope > .o_core > .o_header').length, 0, "message 2 should have a header in core part");
    assert.strictEqual(message2.querySelectorAll(':scope > .o_core > .o_content').length, 1, "message 2 should have some content in core part");
    assert.strictEqual(message2.querySelector(':scope > .o_core > .o_content').innerHTML.trim(), "<p>body2</p>", "message 2 should have body in content part");
});

QUnit.test('inbox messages are never squashed', async function (assert) {
    assert.expect(3);

    await this.createDiscuss({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                // fetching messages from inbox
                return Promise.resolve([{
                    author_id: [11, "Demo"],
                    body: "<p>body1</p>",
                    channel_ids: [20],
                    date: "2019-04-20 10:00:00",
                    id: 100,
                    message_type: 'comment',
                    model: 'mail.channel',
                    needaction: true,
                    needaction_partner_ids: [3],
                    record_name: 'General',
                    res_id: 20,
                }, {
                    author_id: [11, "Demo"],
                    body: "<p>body2</p>",
                    channel_ids: [20],
                    date: "2019-04-20 10:00:30",
                    id: 101,
                    message_type: 'comment',
                    model: 'mail.channel',
                    needaction: true,
                    needaction_partner_ids: [3],
                    record_name: 'General',
                    res_id: 20,
                }]);
            }
            return this._super.apply(this, arguments);
        },
        session: { partner_id: 3 },
    });

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message').length, 2, "should have 2 messages");

    const message1 = document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_100"]');
    const message2 = document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_101"]');

    assert.notOk(message1.classList.contains('o_squashed'), "message 1 should not be squashed");
    assert.notOk(message2.classList.contains('o_squashed'), "message 2 should not be squashed");
});

QUnit.test('load all messages from channel initially, less than fetch limit (29 < 30)', async function (assert) {
    assert.expect(5);

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 20,
                name: "General",
            }],
        },
    });

    await this.createDiscuss({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                assert.strictEqual(args.kwargs.limit, 30, "should fetch up to 30 messages");
                return new Promise(resolve => {
                    let messagesData = [];
                    // 29 messages
                    for (let i = 28; i >= 0; i--) {
                        messagesData.push({
                            author_id: [10+i, `User${i}`],
                            body: `<p>body${i}</p>`,
                            channel_ids: [20],
                            date: "2019-04-20 10:00:00",
                            id: 100+i,
                            message_type: 'comment',
                            model: 'mail.channel',
                            record_name: 'General',
                            res_id: 20,
                        });
                    }
                    resolve(messagesData);
                });
            }
            return this._super.apply(this, arguments);
        },
        params: {
            default_active_id: 'mail.channel_20',
        },
    });

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_separator.o_date').length, 1, "should have a single date separator"); // to check: may be client timezone dependent
    assert.strictEqual(document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_separator.o_date > .o_label').textContent, "April 20, 2019", "should display date day of messages");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message').length, 29, "should have 29 messages");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_load_more').length, 0, "should not have load more link");
});

QUnit.test('load more messages from channel', async function (assert) {
    assert.expect(8);

    let step = 0;

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 20,
                name: "General",
            }],
        },
    });

    await this.createDiscuss({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                step++;
                if (step === 1) {
                    // fetching messages from channel (initial load)
                    assert.strictEqual(args.kwargs.limit, 30, "should fetch up to 30 messages");
                    return new Promise(resolve => {
                        let messagesData = [];
                        // 30 messages
                        for (let i = 39; i >= 10; i--) {
                            messagesData.push({
                                author_id: [10+i, `User${i}`],
                                body: `<p>body${i}</p>`,
                                channel_ids: [20],
                                date: "2019-04-20 10:00:00",
                                id: 100+i,
                                message_type: 'comment',
                                model: 'mail.channel',
                                record_name: 'General',
                                res_id: 20,
                            });
                        }
                        resolve(messagesData);
                    });
                }
                if (step === 2) {
                    // fetching more messages from channel (load more)
                    assert.strictEqual(args.kwargs.limit, 30, "should fetch up to 30 messages");
                    return new Promise(resolve => {
                        let messagesData = [];
                        // 10 messages
                        for (let i = 9; i >= 0; i--) {
                            messagesData.push({
                                author_id: [10+i, `User${i}`],
                                body: `<p>body${i}</p>`,
                                channel_ids: [20],
                                date: "2019-04-20 10:00:00",
                                id: 100+i,
                                message_type: 'comment',
                                model: 'mail.channel',
                                record_name: 'General',
                                res_id: 20,
                            });
                        }
                        resolve(messagesData);
                    });
                }
            }
            return this._super.apply(this, arguments);
        },
        params: {
            default_active_id: 'mail.channel_20',
        },
    });

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_separator.o_date').length, 1, "should have a single date separator"); // to check: may be client timezone dependent
    assert.strictEqual(document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_separator.o_date > .o_label').textContent, "April 20, 2019", "should display date day of messages");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message').length, 30, "should have 30 messages");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_load_more').length, 1, "should have load more link");

    document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_load_more').click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message').length, 40, "should have 40 messages");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_load_more').length, 0, "should not longer have load more link (all messages loaded)");
});

QUnit.test('auto-scroll to bottom of thread', async function (assert) {
    assert.expect(2);

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 20,
                name: "General",
            }],
        },
    });

    await this.createDiscuss({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                return new Promise(resolve => {
                    let messagesData = [];
                    // 25 messages
                    for (let i = 1; i <= 25; i++) {
                        messagesData.push({
                            author_id: [10+i, `User${i}`],
                            body: `<p>body${i}</p>`,
                            channel_ids: [20],
                            date: "2019-04-20 10:00:00",
                            id: 100+i,
                            message_type: 'comment',
                            model: 'mail.channel',
                            record_name: 'General',
                            res_id: 20,
                        });
                    }
                    resolve(messagesData);
                });
            }
            return this._super.apply(this, arguments);
        },
        params: {
            default_active_id: 'mail.channel_20',
        },
    });

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message').length, 25, "should have 25 messages");

    const messageList= document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list');

    assert.strictEqual(messageList.scrollTop + messageList.clientHeight, messageList.scrollHeight, "should have scrolled to bottom of thread");
});

QUnit.test('load more messages from channel (auto-load on scroll)', async function (assert) {
    assert.expect(3);

    let step = 0;

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 20,
                name: "General",
            }],
        },
    });

    await this.createDiscuss({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                step++;
                if (step === 1) {
                    // fetching messages from channel (initial load)
                    return new Promise(resolve => {
                        let messagesData = [];
                        // 30 messages
                        for (let i = 39; i >= 10; i--) {
                            messagesData.push({
                                author_id: [10+i, `User${i}`],
                                body: `<p>body${i}</p>`,
                                channel_ids: [20],
                                date: "2019-04-20 10:00:00",
                                id: 100+i,
                                message_type: 'comment',
                                model: 'mail.channel',
                                record_name: 'General',
                                res_id: 20,
                            });
                        }
                        resolve(messagesData);
                    });
                }
                if (step === 2) {
                    // fetching more messages from channel (load more)
                    return new Promise(resolve => {
                        let messagesData = [];
                        // 10 messages
                        for (let i = 9; i >= 0; i--) {
                            messagesData.push({
                                author_id: [10+i, `User${i}`],
                                body: `<p>body${i}</p>`,
                                channel_ids: [20],
                                date: "2019-04-20 10:00:00",
                                id: 100+i,
                                message_type: 'comment',
                                model: 'mail.channel',
                                record_name: 'General',
                                res_id: 20,
                            });
                        }
                        resolve(messagesData);
                    });
                }
            }
            return this._super.apply(this, arguments);
        },
        params: {
            default_active_id: 'mail.channel_20',
        },
    });

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message').length, 30, "should have 30 messages");

    const scrollProm = testUtils.makeTestPromise();
    document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list').addEventListener('scroll', () => scrollProm.resolve(), null, { once: true });
    document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list').scrollTop = 0;
    await scrollProm; // scroll time
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message').length, 40, "should have 40 messages");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_load_more').length, 0, "should not longer have load more link (all messages loaded)");
});

QUnit.test('new messages indicator', async function (assert) {
    // this test requires several messages so that the last message is not
    // visible. This is necessary in order to display 'new messages' and not
    // remove from DOM right away from seeing last message.
    assert.expect(5);

    let step = 0;

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 20,
                message_unread_counter: 0,
                name: "General",
                seen_message_id: 125,
            }],
        },
    });

    await this.createDiscuss({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                step++;
                if (step === 1) {
                    // fetching messages from channel (initial load)
                    return new Promise(resolve => {
                        let messagesData = [];
                        // 25 messages
                        for (let i = 1; i <= 25; i++) {
                            messagesData.push({
                                author_id: [10+i, `User${i}`],
                                body: `<p>body${i}</p>`,
                                channel_ids: [20],
                                date: "2019-04-20 10:00:00",
                                id: 100+i,
                                message_type: 'comment',
                                model: 'mail.channel',
                                record_name: 'General',
                                res_id: 20,
                            });
                        }
                        resolve(messagesData);
                    });
                }
                if (step === 2) {
                    throw new Error("should not fetch more messages");
                }
            }
            return this._super.apply(this, arguments);
        },
        params: { default_active_id: 'mail.channel_20' },
    });

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message').length, 25, "should have 25 messages");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_new_messages').length, 0, "should not display 'new messages' indicator");

    const scrollProm = testUtils.makeTestPromise();
    document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list').addEventListener('scroll', () => scrollProm.resolve(), null, { once: true });
    document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list').scrollTop = 0;
    await scrollProm; // scroll time
    // simulate receiving a new message
    const data = {
        author_id: [36, "User26"],
        body: "<p>boddy26</p>",
        channel_ids: [20],
        date: "2019-04-20 10:00:00",
        id: 126,
        message_type: 'comment',
        model: 'mail.channel',
        record_name: 'General',
        res_id: 20,
    };
    const notifications = [ [['my-db', 'mail.channel', 20], data] ];
    this.discuss.call('bus_service', 'trigger', 'notification', notifications);
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message').length, 26, "should have 26 messages");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_new_messages').length, 1, "should display 'new messages' indicator");

    // scroll to bottom
    const scrollProm2 = testUtils.makeTestPromise();
    document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list').addEventListener('scroll', () => scrollProm2.resolve(), null, { once: true });
    document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list').scrollTop =
        document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list').scrollHeight;
    await scrollProm2; // scroll time
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_new_messages').length, 0, "should no longer display 'new messages' indicator (message seen)");
});

QUnit.skip('restore thread scroll position', async function (assert) {
    // issue with refs...
    assert.expect(4);

    let step = 0;

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 1,
                name: "channel1",
            }, {
                channel_type: "channel",
                id: 2,
                name: "channel2",
            }],
        },
    });

    await this.createDiscuss({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                step++;
                if (step === 1) {
                    // fetching messages from channel1 (initial load)
                    return new Promise(resolve => {
                        let messagesData = [];
                        // 25 messages
                        for (let i = 1; i <= 25; i++) {
                            messagesData.push({
                                author_id: [10+i, `User${i}`],
                                body: `<p>body${i}</p>`,
                                channel_ids: [1],
                                date: "2019-04-20 10:00:00",
                                id: 100+i,
                                message_type: 'comment',
                                model: 'mail.channel',
                                record_name: 'channel1',
                                res_id: 1,
                            });
                        }
                        resolve(messagesData);
                    });
                }
                if (step === 2) {
                    // fetching messages from channel2 (initial load)
                    return new Promise(resolve => {
                        let messagesData = [];
                        // 25 messages
                        for (let i = 1; i <= 25; i++) {
                            messagesData.push({
                                author_id: [10+i, `User${i}`],
                                body: `<p>body${i}</p>`,
                                channel_ids: [2],
                                date: "2019-04-20 10:00:00",
                                id: 200+i,
                                message_type: 'comment',
                                model: 'mail.channel',
                                record_name: 'channel2',
                                res_id: 2,
                            });
                        }
                        resolve(messagesData);
                    });
                }
            }
            return this._super.apply(this, arguments);
        },
        params: { default_active_id: 'mail.channel_1' },
    });

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message').length, 25, "should have 25 messages");

    // scroll to top of channel1
    const scrollProm = testUtils.makeTestPromise();
    document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list').addEventListener('scroll', () => scrollProm.resolve(), null, { once: true });
    document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list').scrollTop = 0;
    await scrollProm; // scroll time

    assert.strictEqual(document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list').scrollTop, 0, "should have scrolled to top of thread");

    // select channel2
    await testUtils.dom.click(document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item[data-thread-lid="mail.channel_2"]'));
    await testUtils.nextTick(); // re-render

    // select channel1
    await testUtils.dom.click(document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item[data-thread-lid="mail.channel_1"]'));
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list').scrollTop, 0, "should have recovered scroll position of channel1 (scroll to top)");

    // select channel2
    await testUtils.dom.click(document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item[data-thread-lid="mail.channel_2"]'));
    await testUtils.nextTick(); // re-render

    const messageList = document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list');

    assert.strictEqual(messageList.scrollTop + messageList.clientHeight, messageList.scrollHeight, "should have recovered scroll position of channel2 (scroll to bottom)");
});

QUnit.test('message origin redirect to channel', async function (assert) {
    assert.expect(15);

    let step = 0;

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 1,
                name: "channel1",
            }, {
                channel_type: "channel",
                id: 2,
                name: "channel2",
            }],
        },
    });

    let messagesData = [{
        author_id: [10, "User1"],
        body: `<p>message1</p>`,
        channel_ids: [1, 2],
        date: "2019-04-20 10:00:00",
        id: 100,
        message_type: 'comment',
        model: 'mail.channel',
        record_name: "channel1",
        res_id: 1,
    }, {
        author_id: [11, "User2"],
        body: `<p>message2</p>`,
        channel_ids: [1, 2],
        date: "2019-04-20 10:00:00",
        id: 101,
        message_type: 'comment',
        model: 'mail.channel',
        record_name: "channel2",
        res_id: 2,
    }];

    await this.createDiscuss({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                step++;
                if (step === 1) {
                    // fetching messages from channel1 (initial load)
                    return Promise.resolve(messagesData);
                }
                if (step === 2) {
                    // fetching messages from channel2 (initial load)
                    return Promise.resolve(messagesData);
                }
            }
            return this._super.apply(this, arguments);
        },
        params: { default_active_id: 'mail.channel_1' },
    });

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message').length, 2, "should have 2 messages");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_100"]').length, 1, "should have message1 (ID 100)");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_101"]').length, 1, "should have message2 (ID 101)");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_100"] > .o_core > .o_header > .o_origin').length, 0, "message1 should not have origin part in channel1 (same origin as channel)");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_101"] > .o_core > .o_header > .o_origin').length, 1, "message2 should have origin part (origin is channel2 !== channel1)");
    assert.strictEqual(document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_101"] > .o_core > .o_header > .o_origin').textContent.trim(), "(from #channel2)", "message2 should display name of origin channel");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_101"] > .o_core > .o_header > .o_origin > a').length, 1, "message2 should have link to redirect to origin");

    // click on origin link of message2 (= channel2)
    document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_101"] > .o_core > .o_header > .o_origin > a').click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item[data-thread-lid="mail.channel_2"] > .o_active_indicator').classList.contains('o_active'), true, "channel2 should be active channel on redirect from discuss app");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message').length, 2, "should have 2 messages");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_100"]').length, 1, "should have message1 (ID 100)");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_101"]').length, 1, "should have message2 (ID 101)");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_100"] > .o_core > .o_header > .o_origin').length, 1, "message1 should have origin part (origin is channel1 !== channel2)");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_101"] > .o_core > .o_header > .o_origin').length, 0, "message2 should not have origin part in channel2 (same origin as current channel)");
    assert.strictEqual(document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_100"] > .o_core > .o_header > .o_origin').textContent.trim(), "(from #channel1)", "message1 should display name of origin channel");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_100"] > .o_core > .o_header > .o_origin > a').length, 1, "message1 should have link to redirect to origin");
});

QUnit.test('redirect to author (open chat)', async function (assert) {
    assert.expect(9);

    let step = 0;

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 1,
                name: "General",
            }],
            channel_direct_message: [{
                channel_type: "chat",
                direct_partner: [{
                    id: 7,
                    name: "Demo",
                }],
                id: 10,
            }],
        },
    });

    await this.createDiscuss({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                step++;
                if (step === 1) {
                    // fetching messages from General (initial load)
                    return Promise.resolve([{
                        author_id: [7, "Demo"],
                        body: `<p>message1</p>`,
                        channel_ids: [1],
                        date: "2019-04-20 10:00:00",
                        id: 100,
                        message_type: 'comment',
                        model: 'mail.channel',
                        record_name: "General",
                        res_id: 1,
                    }, {
                        author_id: [3, "Me"],
                        body: `<p>message2</p>`,
                        channel_ids: [1],
                        date: "2019-04-20 10:00:00",
                        id: 101,
                        message_type: 'comment',
                        model: 'mail.channel',
                        record_name: "General",
                        res_id: 1,
                    }]);
                }
                if (step === 2) {
                    // fetching messages from DM (initial load)
                    return Promise.resolve([]);
                }
            }
            return this._super.apply(this, arguments);
        },
        params: { default_active_id: 'mail.channel_1' },
        session: { partner_id: 3 },
    });

    assert.ok(document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item[data-thread-lid="mail.channel_1"] > .o_active_indicator').classList.contains('o_active'), "channel 'General' should be active");
    assert.notOk(document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_list > .o_item[data-thread-lid="mail.channel_10"] > .o_active_indicator').classList.contains('o_active'), "DM 'Demo' should not be active");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message').length, 2, "should have 2 messages");

    const msg1 = document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_100"]');
    const msg2 = document.querySelector('.o_mail_wip_discuss > .o_content > .o_thread > .o_message_list > .o_message[data-message-lid="mail.message_101"]');

    assert.strictEqual(msg1.querySelectorAll(':scope > .o_sidebar > img').length, 1, "message1 should have author image");
    assert.ok(msg1.querySelector(':scope > .o_sidebar > img').classList.contains('o_redirect'), "message1 should have redirect to author");
    assert.strictEqual(msg2.querySelectorAll(':scope > .o_sidebar > img').length, 1, "message2 should have author image");
    assert.notOk(msg2.querySelector(':scope > .o_sidebar > img').classList.contains('o_redirect'), "message2 should not have redirect to author (self-author)");

    await testUtils.dom.click(msg1.querySelector(':scope > .o_sidebar > img'));
    await testUtils.nextTick(); // re-render

    assert.notOk(document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item[data-thread-lid="mail.channel_1"] > .o_active_indicator').classList.contains('o_active'), "channel 'General' should become inactive after author redirection");
    assert.ok(document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_chat > .o_list > .o_item[data-thread-lid="mail.channel_10"] > .o_active_indicator').classList.contains('o_active'), "chat 'Demo' should become active after author redirection");
});

QUnit.test('sidebar quick search', async function (assert) {
    // feature enables at 20 or more channels
    assert.expect(6);

    let channelsData = [];
    for (let id = 1; id <= 20; id++) {
        channelsData.push({
            channel_type: "channel",
            id,
            name: `channel${id}`,
        });
    }

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: channelsData,
        },
    });

    await this.createDiscuss();

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item').length, 20, "should have 20 channel items");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > input.o_quick_search').length, 1, "should have quick search in sidebar");

    const quickSearch = document.querySelector('.o_mail_wip_discuss > .o_sidebar > input.o_quick_search');

    quickSearch.value = "1";
    const kevt1 = new window.KeyboardEvent('input');
    quickSearch.dispatchEvent(kevt1);
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item').length, 11, "should have filtered to 11 channel items");

    quickSearch.value = "12";
    const kevt2 = new window.KeyboardEvent('input');
    quickSearch.dispatchEvent(kevt2);
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item').length, 1, "should have filtered to a single channel item");
    assert.strictEqual(document.querySelector('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item').dataset.threadLid, 'mail.channel_12', "should have filtered to a single channel item with ID 12");

    quickSearch.value = "123";
    const kevt3 = new window.KeyboardEvent('input');
    quickSearch.dispatchEvent(kevt3);
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss > .o_sidebar > .o_group.o_channel > .o_list > .o_item').length, 0, "should have filtered to no channel item");
});

QUnit.test('basic control panel rendering', async function (assert) {
    assert.expect(8);

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 20,
                name: "General",
            }],
        },
    });

    await this.createDiscuss();

    assert.strictEqual(document.querySelector('.o_mail_wip_old_discuss > .o_cp_controller > .o_control_panel > .breadcrumb').textContent, "Inbox", "display inbox in the breadcrumb");
    const markAllReadButton = document.querySelector('.o_mail_wip_old_discuss > .o_cp_controller > .o_control_panel > .o_cp_left > .o_cp_buttons > div > button.o_mark_all_read');
    assert.isVisible(markAllReadButton, "should have visible button 'Mark all read' in the control panel of inbox");
    assert.ok(markAllReadButton.disabled, "should have disabled button 'Mark all read' in the control panel of inbox (no messages)");

    await testUtils.dom.click(document.querySelector('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_starred"]'));

    assert.strictEqual(document.querySelector('.o_mail_wip_old_discuss > .o_cp_controller > .o_control_panel > .breadcrumb').textContent, "Starred", "display starred in the breadcrumb");
    const unstarAllButton = document.querySelector('.o_mail_wip_old_discuss > .o_cp_controller > .o_control_panel > .o_cp_left > .o_cp_buttons > div > button.o_unstar_all');
    assert.isVisible(unstarAllButton, "should have visible button 'Unstar all' in the control panel of starred");
    assert.ok(unstarAllButton.disabled, "should have disabled button 'Unstar all' in the control panel of starred (no messages)");

    await testUtils.dom.click(document.querySelector('.o_mail_wip_discuss .o_item[data-thread-lid="mail.channel_20"]'));

    assert.strictEqual(document.querySelector('.o_mail_wip_old_discuss > .o_cp_controller > .o_control_panel > .breadcrumb').textContent, "#General", "display general in the breadcrumb");
    const inviteButton = document.querySelector('.o_mail_wip_old_discuss > .o_cp_controller > .o_control_panel > .o_cp_left > .o_cp_buttons > div > button.o_invite');
    assert.isVisible(inviteButton, "should have visible button 'Invite' in the control panel of channel");
});

QUnit.test('inbox: mark all messages as read', async function (assert) {
    assert.expect(8);

    const self = this;

    Object.assign(this.data.initMessaging, {
        needaction_inbox_counter: 2,
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 20,
                message_needaction_counter: 2,
                name: "General",
            }],
        },
    });

    await this.createDiscuss({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                return Promise.resolve([{
                    author_id: [7, "Demo"],
                    body: `<p>message1</p>`,
                    channel_ids: [20],
                    date: "2019-04-20 10:00:00",
                    id: 100,
                    message_type: 'comment',
                    model: 'mail.channel',
                    needaction: true,
                    needaction_partner_ids: [3],
                    record_name: "General",
                    res_id: 20,
                }, {
                    author_id: [8, "Other"],
                    body: `<p>message2</p>`,
                    channel_ids: [20],
                    date: "2019-04-20 10:00:00",
                    id: 101,
                    message_type: 'comment',
                    model: 'mail.channel',
                    needaction: true,
                    needaction_partner_ids: [3],
                    record_name: "General",
                    res_id: 20,
                }]);
            }
            if (args.method === 'mark_all_as_read') {
                // simulate mark as read notification
                const data = {
                    message_ids: [100, 101],
                    type: 'mark_as_read',
                };
                const notifications = [ [['my-db', 'res.partner'], data] ];
                self.discuss.call('bus_service', 'trigger', 'notification', notifications);
                return Promise.resolve();

            }
            return this._super.apply(this, arguments);
        },
        session: { partner_id: 3 },
    });

    assert.strictEqual(document.querySelector('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_inbox"] > .o_counter').textContent, "2", "inbox should have counter of 2");
    assert.strictEqual(document.querySelector('.o_mail_wip_discuss .o_item[data-thread-lid="mail.channel_20"] > .o_counter').textContent, "2", "channel should have counter of 2");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss .o_message_list > .o_message').length, 2, "should have 2 messages in inbox");
    let markAllReadButton = document.querySelector('.o_mail_wip_old_discuss > .o_cp_controller > .o_control_panel > .o_cp_left > .o_cp_buttons > div > button.o_mark_all_read');
    assert.notOk(markAllReadButton.disabled, "should have enabled button 'Mark all read' in the control panel of inbox (has messages)");

    markAllReadButton.click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_inbox"] > .o_counter').length, 0, "inbox should display no counter (= 0)");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss .o_item[data-thread-lid="mail.channel_20"] > .o_counter').length, 0, "channel should display no counter (= 0)");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss .o_message_list > .o_message').length, 0, "should have no message in inbox");
    markAllReadButton = document.querySelector('.o_mail_wip_old_discuss > .o_cp_controller > .o_control_panel > .o_cp_left > .o_cp_buttons > div > button.o_mark_all_read');
    assert.ok(markAllReadButton.disabled, "should have disabled button 'Mark all read' in the control panel of inbox (no messages)");
});

QUnit.test('starred: unstar all', async function (assert) {
    assert.expect(6);

    const self = this;

    Object.assign(this.data.initMessaging, { starred_counter: 2 });

    await this.createDiscuss({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                return Promise.resolve([{
                    author_id: [7, "Demo"],
                    body: `<p>message1</p>`,
                    channel_ids: [20],
                    date: "2019-04-20 10:00:00",
                    id: 100,
                    message_type: 'comment',
                    model: 'mail.channel',
                    record_name: "General",
                    res_id: 20,
                    starred: true,
                    starred_partner_ids: [3],
                }, {
                    author_id: [8, "Other"],
                    body: `<p>message2</p>`,
                    channel_ids: [20],
                    date: "2019-04-20 10:00:00",
                    id: 101,
                    message_type: 'comment',
                    model: 'mail.channel',
                    record_name: "General",
                    res_id: 20,
                    starred: true,
                    starred_partner_ids: [3],
                }]);
            }
            if (args.method === 'unstar_all') {
                // simulate toggle_star notification
                const data = {
                    message_ids: [100, 101],
                    starred: false,
                    type: 'toggle_star',
                };
                const notifications = [ [['my-db', 'res.partner'], data] ];
                self.discuss.call('bus_service', 'trigger', 'notification', notifications);
                return Promise.resolve();

            }
            return this._super.apply(this, arguments);
        },
        params: { default_active_id: 'mail.box_starred' },
        session: { partner_id: 3 },
    });

    assert.strictEqual(document.querySelector('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_starred"] > .o_counter').textContent, "2", "starred should have counter of 2");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss .o_message_list > .o_message').length, 2, "should have 2 messages in starred");
    let unstarAllButton = document.querySelector('.o_mail_wip_old_discuss > .o_cp_controller > .o_control_panel > .o_cp_left > .o_cp_buttons > div > button.o_unstar_all');
    assert.notOk(unstarAllButton.disabled, "should have enabled button 'Unstar all' in the control panel of starred (has messages)");

    unstarAllButton.click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_starred"] > .o_counter').length, 0, "starred should display no counter (= 0)");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss .o_message_list > .o_message').length, 0, "should have no message in starred");
    unstarAllButton = document.querySelector('.o_mail_wip_old_discuss > .o_cp_controller > .o_control_panel > .o_cp_left > .o_cp_buttons > div > button.o_unstar_all');
    assert.ok(unstarAllButton.disabled, "should have disabled button 'Unstar all' in the control panel of starred (no messages)");
});

QUnit.test('toggle_star message', async function (assert) {
    assert.expect(16);

    const self = this;

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 20,
                name: "General",
            }],
        },
    });

    let messageData = {
        author_id: [11, "Demo"],
        body: "<p>body</p>",
        channel_ids: [20],
        date: "2019-04-20 10:00:00",
        id: 100,
        message_type: 'comment',
        model: 'mail.channel',
        record_name: 'General',
        res_id: 20,
        starred: false,
        starred_partner_ids: [],
    };

    await this.createDiscuss({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                return Promise.resolve([messageData]);
            }
            if (args.method === 'toggle_message_starred') {
                assert.step('rpc:toggle_message_starred');
                assert.strictEqual(args.args[0][0], 100, "should have message ID in args");
                // simulate toggle_star notification
                messageData.starred = !messageData.starred;
                const data = {
                    message_ids: [100],
                    starred: messageData.starred,
                    type: 'toggle_star',
                };
                const notifications = [ [['my-db', 'res.partner'], data] ];
                self.discuss.call('bus_service', 'trigger', 'notification', notifications);
                return Promise.resolve();
            }
            return this._super.apply(this, arguments);
        },
        params: { default_active_id: 'mail.channel_20' },
    });

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_starred"] > .o_counter').length, 0, "starred should display no counter (= 0)");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss .o_message_list > .o_message').length, 1, "should have 1 message in channel");
    let message = document.querySelector('.o_mail_wip_discuss .o_message_list > .o_message');
    assert.notOk(message.classList.contains('o_starred'), "message should not be starred");
    assert.strictEqual(message.querySelectorAll(':scope .o_command.o_star').length, 1, "message should have star command");

    message.querySelector(':scope .o_command.o_star').click();
    await testUtils.nextTick(); // re-render

    assert.verifySteps(['rpc:toggle_message_starred']);
    assert.strictEqual(document.querySelector('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_starred"] > .o_counter').textContent, "1", "starred should display a counter of 1");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss .o_message_list > .o_message').length, 1, "should have kept 1 message in channel");
    message = document.querySelector('.o_mail_wip_discuss .o_message_list > .o_message');
    assert.ok(message.classList.contains('o_starred'), "message should be starred");

    message.querySelector(':scope .o_command.o_star').click();
    await testUtils.nextTick(); // re-render

    assert.verifySteps(['rpc:toggle_message_starred']);
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss .o_item[data-thread-lid="mail.box_starred"] > .o_counter').length, 0, "starred should no longer display a counter (= 0)");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_discuss .o_message_list > .o_message').length, 1, "should still have 1 message in channel");
    message = document.querySelector('.o_mail_wip_discuss .o_message_list > .o_message');
    assert.notOk(message.classList.contains('o_starred'), "message should no longer be starred");
});

});
});
