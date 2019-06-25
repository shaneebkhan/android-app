odoo.define('mail.component.DiscussTests', function (require) {
"use strict";

const {
    afterEach: utilsAfterEach,
    beforeEach: utilsBeforeEach,
    create,
    pause,
} = require('mail.owl.test_utils');

const testUtils = require('web.test_utils');

QUnit.module('mail.owl', {}, function () {
QUnit.module('Discuss', {
    beforeEach() {
        utilsBeforeEach(this);
        this.create = async params => {
            if (this.widget) {
                this.widget.destroy();
            }
            let { widget } = await create({
                ...params,
                autoOpenDiscuss: true,
                data: this.data,
            });
            this.widget = widget;
        };
    },
    afterEach() {
        utilsAfterEach(this);
        if (this.widget) {
            this.widget.destroy();
        }
    }
});

QUnit.test('basic rendering', async function (assert) {
    assert.expect(4);

    await this.create();

    assert.strictEqual(
        document
            .querySelectorAll('.o_mail_component_Discuss__sidebar')
            .length,
        1,
        "should have a sidebar section");
    assert.strictEqual(
        document
            .querySelectorAll('.o_mail_component_Discuss__content')
            .length,
        1,
        "should have content section");
    assert.strictEqual(
        document
            .querySelectorAll('.o_mail_component_Discuss__thread')
            .length,
        1,
        "should have thread section inside content");
    assert.ok(
        document
            .querySelector('.o_mail_component_Discuss__thread')
            .classList
            .contains('o_mail_component_Thread'),
        "thread section should use thread component");
});

QUnit.test('basic rendering: sidebar', async function (assert) {
    assert.expect(19);

    await this.create();

    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_DiscussSidebar__group`)
            .length,
        3,
        "should have 3 groups in sidebar");
    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_DiscussSidebar__groupMailbox`)
            .length,
        1,
        "should have group 'Mailbox' in sidebar");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupMailbox
                .o_mail_component_DiscussSidebar__groupHeader`)
            .length,
        0,
        "mailbox category should not have any header");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupMailbox
                .o_mail_component_DiscussSidebar__item`)
            .length,
        2,
        "should have 2 mailbox items");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupMailbox
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_inbox"]`)
            .length,
        1,
        "should have inbox mailbox item");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupMailbox
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_starred"]`)
            .length,
        1,
        "should have starred mailbox item");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__sidebar
                .o_mail_component_DiscussSidebar__separator`)
            .length,
        1,
        "should have separator (between mailboxes and channels, but that's not tested)");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChannel`)
            .length,
        1,
        "should have group 'Channel' in sidebar");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__groupHeader`)
            .length,
        1,
        "channel category should have a header");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__groupHeader
                .o_mail_component_DiscussSidebar__groupTitle`)
            .length,
        1,
        "should have title in channel header");
    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__groupHeader
                .o_mail_component_DiscussSidebar__groupTitle`)
            .textContent
            .trim(),
        "Channels");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__list`)
            .length,
        1,
        "channel category should list items");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__item`)
            .length,
        0,
        "channel category should have no item by default");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChat`)
            .length,
        1,
        "should have group 'Chat' in sidebar");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChat
                .o_mail_component_DiscussSidebar__groupHeader`)
            .length,
        1,
        "channel category should have a header");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChat
                .o_mail_component_DiscussSidebar__groupHeader
                .o_mail_component_DiscussSidebar__groupTitle`)
            .length,
        1,
        "should have title in chat header");
    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__groupChat
                .o_mail_component_DiscussSidebar__groupHeader
                .o_mail_component_DiscussSidebar__groupTitle`)
            .textContent
            .trim(),
        "Direct Messages");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChat
                .o_mail_component_DiscussSidebar__list`)
            .length,
        1,
        "chat category should list items");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChat
                .o_mail_component_DiscussSidebar__item`)
            .length,
        0,
        "chat category should have no item by default");
});

QUnit.test('sidebar: basic mailbox rendering', async function (assert) {
    assert.expect(6);

    await this.create();

    const inbox = document.querySelector(`
        .o_mail_component_DiscussSidebar__groupMailbox
        .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_inbox"]`);

    assert.strictEqual(
        inbox
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__activeIndicator`)
            .length,
        1,
        "mailbox should have active indicator");
    assert.strictEqual(
        inbox
            .querySelectorAll(`
                :scope
                .o_mail_component_ThreadIcon`)
            .length,
        1,
        "mailbox should have an icon");
    assert.strictEqual(
        inbox
            .querySelectorAll(`
                :scope
                .o_mail_component_ThreadIcon__mailboxInbox`)
            .length,
        1,
        "inbox should have 'inbox' icon");
    assert.strictEqual(
        inbox
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__name`)
            .length,
        1,
        "mailbox should have a name");
    assert.strictEqual(
        inbox
            .querySelector(`
                :scope
                .o_mail_component_DiscussSidebarItem__name`)
            .textContent,
        "Inbox",
        "inbox should have name 'Inbox'");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_inbox"]
                .o_mail_component_DiscussSidebarItem__counter`)
            .length,
        0,
        "should have no counter when equal to 0 (default value)");
});

QUnit.test('sidebar: default active inbox', async function (assert) {
    assert.expect(1);

    await this.create();

    const inbox = document
        .querySelector(`
            .o_mail_component_DiscussSidebar__groupMailbox
            .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_inbox"]`);

    assert.ok(
        inbox
            .querySelector(`
                :scope
                .o_mail_component_DiscussSidebarItem__activeIndicator`)
            .classList
            .contains('o_active'),
        "inbox should be active by default");
});

QUnit.test('sidebar: change item', async function (assert) {
    assert.expect(4);

    await this.create();

    assert.ok(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_inbox"]
                .o_mail_component_DiscussSidebarItem__activeIndicator`)
            .classList
            .contains('o_active'),
        "inbox should be active by default");
    assert.notOk(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_starred"]
                .o_mail_component_DiscussSidebarItem__activeIndicator`)
            .classList
            .contains('o_active'),
        "starred should be inactive by default");

    await testUtils.dom.click(
        document.querySelector(`
            .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_starred"]`));

    assert.notOk(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_inbox"]
                .o_mail_component_DiscussSidebarItem__activeIndicator`)
            .classList
            .contains('o_active'),
        "inbox mailbox should become inactive");
    assert.ok(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_starred"]
                .o_mail_component_DiscussSidebarItem__activeIndicator`)
            .classList
            .contains('o_active'),
        "starred mailbox should become active");
});

QUnit.test('sidebar: inbox with counter', async function (assert) {
    assert.expect(2);

    Object.assign(this.data.initMessaging, {
        needaction_inbox_counter: 100,
    });

    await this.create();

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_inbox"]
                .o_mail_component_DiscussSidebarItem__counter`)
            .length,
        1,
        "should have a counter when different from 0");
    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_inbox"]
                .o_mail_component_DiscussSidebarItem__counter`)
            .textContent,
        "100",
        "should have counter value");
});

QUnit.test('sidebar: add channel', async function (assert) {
    assert.expect(3);

    await this.create();

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__groupHeaderItemAdd`)
            .length,
        1,
        "should be able to add channel from header");
    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__groupHeaderItemAdd`)
            .title,
        "Add or join a channel");

    await testUtils.dom.click(
        document.querySelector(`
            .o_mail_component_DiscussSidebar__groupChannel
            .o_mail_component_DiscussSidebar__groupHeaderItemAdd`));

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__itemNew`)
            .length,
        1,
        "should have item to add a new channel");
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

    await this.create();

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__item`)
            .length,
        1,
        "should have one channel item");

    let channel = document.querySelector(`
        .o_mail_component_DiscussSidebar__groupChannel
        .o_mail_component_DiscussSidebar__item`);

    assert.strictEqual(
        channel
            .dataset
            .threadLocalId,
        "mail.channel_20",
        "should have channel with ID 20");
    assert.strictEqual(
        channel
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__activeIndicator`)
            .length,
        1,
        "should have active indicator");
    assert.strictEqual(
        channel
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__activeIndicator.o_active`)
            .length,
        0,
        "should not be active by default");
    assert.strictEqual(
        channel
            .querySelectorAll(`
                :scope
                .o_mail_component_ThreadIcon`)
            .length,
        1,
        "should have an icon");
    assert.strictEqual(
        channel
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__name`)
            .length,
        1,
        "should have a name");
    assert.strictEqual(
        channel
            .querySelector(`
                :scope
                .o_mail_component_DiscussSidebarItem__name`)
            .textContent,
        "General",
        "should have name value");
    assert.strictEqual(
        channel
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__commands`)
            .length,
        1,
        "should have commands");
    assert.strictEqual(
        channel
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__command`)
            .length,
        2,
        "should have 2 commands");
    assert.strictEqual(
        channel
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__commandSettings`)
            .length,
        1,
        "should have 'settings' command");
    assert.strictEqual(
        channel
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__commandLeave`)
            .length,
        1,
        "should have 'leave' command");
    assert.strictEqual(
        channel
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__counter`)
            .length,
        0,
        "should have a counter when equals 0 (default value)");

    await testUtils.dom.click(
        document.querySelector(`
            .o_mail_component_DiscussSidebar__groupChannel
            .o_mail_component_DiscussSidebar__item`));

    channel = document.querySelector(`
        .o_mail_component_DiscussSidebar__groupChannel
        .o_mail_component_DiscussSidebar__item`);

    assert.strictEqual(
        channel
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__activeIndicator.o_active`)
            .length,
        1,
        "channel should become active");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__composer`)
            .length,
        1,
        "should have composer section inside thread content (can post message in channel)");
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

    await this.create();

    const channel = document.querySelector(`
        .o_mail_component_DiscussSidebar__groupChannel
        .o_mail_component_DiscussSidebar__item`);

    assert.strictEqual(
        channel
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__counter`)
            .length,
        1,
        "should have a counter when different from 0");
    assert.strictEqual(
        channel
            .querySelector(`
                :scope
                .o_mail_component_DiscussSidebarItem__counter`)
            .textContent,
        "10",
        "should have counter value");
    assert.strictEqual(
        channel
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__command`)
            .length,
        1,
        "should have single command");
    assert.strictEqual(
        channel
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__commandSettings`)
            .length,
        1,
        "should have 'settings' command");
    assert.strictEqual(
        channel
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__commandLeave`)
            .length,
        0,
        "should not have 'leave' command");
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

    await this.create();

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__item`)
            .length,
        2,
        "should have 2 channel items");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_100"]`)
            .length,
        1,
        "should have channel1 (ID 100)");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_101"]`)
            .length,
        1,
        "should have channel2 (ID 101)");

    const channel1 = document.querySelector(`
        .o_mail_component_DiscussSidebar__groupChannel
        .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_100"]`);
    const channel2 = document.querySelector(`
        .o_mail_component_DiscussSidebar__groupChannel
        .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_101"]`);

    assert.strictEqual(
        channel1
            .querySelectorAll(`
                :scope
                .o_mail_component_ThreadIcon__channelPublic`)
            .length,
        1,
        "channel1 (public) has hashtag icon");
    assert.strictEqual(
        channel2
            .querySelectorAll(`
                :scope
                .o_mail_component_ThreadIcon__channelPrivate`)
            .length,
        1,
        "channel2 (private) has lock icon");
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

    await this.create();

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChat
                .o_mail_component_DiscussSidebar__item`)
            .length,
        1,
        "should have one chat item");

    const chat = document.querySelector(`
        .o_mail_component_DiscussSidebar__groupChat
        .o_mail_component_DiscussSidebar__item`);

    assert.strictEqual(
        chat
            .dataset
            .threadLocalId,
        "mail.channel_10",
        "should have chat with ID 20");
    assert.strictEqual(
        chat
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__activeIndicator`)
            .length,
        1,
        "should have active indicator");
    assert.strictEqual(
        chat
            .querySelectorAll(`
                :scope
                .o_mail_component_ThreadIcon`)
            .length,
        1,
        "should have an icon");
    assert.strictEqual(
        chat
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__name`)
            .length,
        1,
        "should have a name");
    assert.strictEqual(
        chat
            .querySelector(`
                :scope
                .o_mail_component_DiscussSidebarItem__name`)
            .textContent,
        "Demo",
        "should have direct partner name as name");
    assert.strictEqual(
        chat
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__commands`)
            .length,
        1,
        "should have commands");
    assert.strictEqual(
        chat
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__command`)
            .length,
        2,
        "should have 2 commands");
    assert.strictEqual(
        chat
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__commandRename`)
            .length,
        1,
        "should have 'rename' command");
    assert.strictEqual(
        chat
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__commandUnpin`)
            .length,
        1,
        "should have 'unpin' command");
    assert.strictEqual(
        chat
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__counter`)
            .length,
        0,
        "should have a counter when equals 0 (default value)");
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

    await this.create();

    const chat = document.querySelector(`
        .o_mail_component_DiscussSidebar__groupChat
        .o_mail_component_DiscussSidebar__item`);

    assert.strictEqual(
        chat
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__counter`)
            .length,
        1,
        "should have a counter when different from 0");
    assert.strictEqual(
        chat
            .querySelector(`
                :scope
                .o_mail_component_DiscussSidebarItem__counter`)
            .textContent,
        "100",
        "should have counter value");
    assert.strictEqual(
        chat
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__command`)
            .length,
        1,
        "should have single command");
    assert.strictEqual(
        chat
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__commandRename`)
            .length,
        1,
        "should have 'rename' command");
    assert.strictEqual(
        chat
            .querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__commandUnpin`)
            .length,
        0,
        "should not have 'unpin' command");
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

    await this.create();

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChat
                .o_mail_component_DiscussSidebar__item`)
            .length,
        3,
        "should have 3 chat items");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__sidebar
                .o_mail_component_DiscussSidebar__groupChat
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_11"]`)
            .length,
        1,
        "should have Partner1 (ID 11)");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__sidebar
                .o_mail_component_DiscussSidebar__groupChat
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_12"]`)
            .length,
        1,
        "should have Partner2 (ID 12)");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__sidebar
                .o_mail_component_DiscussSidebar__groupChat
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_13"]`)
            .length,
        1,
        "should have Partner3 (ID 13)");

    const chat1 = document.querySelector(`
        .o_mail_component_DiscussSidebar__groupChat
        .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_11"]`);
    const chat2 = document.querySelector(`
        .o_mail_component_DiscussSidebar__groupChat
        .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_12"]`);
    const chat3 = document.querySelector(`
        .o_mail_component_DiscussSidebar__groupChat
        .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_13"]`);

    assert.strictEqual(
        chat1
            .querySelectorAll(`
                :scope
                .o_mail_component_ThreadIcon__offline`)
            .length,
        1,
        "chat1 should have offline icon");
    assert.strictEqual(
        chat2
            .querySelectorAll(`
                :scope
                .o_mail_component_ThreadIcon__online`)
            .length,
        1,
        "chat2 should have online icon");
    assert.strictEqual(
        chat3
            .querySelectorAll(`
                :scope
                .o_mail_component_ThreadIcon__away`)
            .length,
        1,
        "chat3 should have away icon");
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

    await this.create();

    const chat = document.querySelector(`
        .o_mail_component_DiscussSidebar__groupChat
        .o_mail_component_DiscussSidebar__item`);
    assert.strictEqual(
        chat
            .querySelector(`
                :scope
                .o_mail_component_DiscussSidebarItem__name`)
            .textContent,
        "Marc",
        "chat should have custom name as name");
});

QUnit.test('sidebar: rename chat', async function (assert) {
    assert.expect(8);

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

    await this.create({
        mockRPC(route, args) {
            if (args.method === 'channel_set_custom_name') {
                return Promise.resolve();
            }
            return this._super.apply(this, arguments);
        },
    });

    const chat = document.querySelector(`
        .o_mail_component_DiscussSidebar__groupChat
        .o_mail_component_DiscussSidebar__item`);

    assert.strictEqual(
        chat
            .querySelector(`
                :scope
                .o_mail_component_DiscussSidebarItem__name`)
            .textContent,
        "Marc",
        "chat should have custom name as name");
    assert.notOk(
        chat
            .querySelector(`
                :scope
                .o_mail_component_DiscussSidebarItem__name`)
            .classList
            .contains('o_editable'),
        "chat name should not be editable");

    await testUtils.dom.click(
        chat.querySelector(`
            :scope
            .o_mail_component_DiscussSidebarItem__commandRename`),
        { allowInvisible: true });

    assert.ok(
        chat
            .querySelector(`
                :scope
                .o_mail_component_DiscussSidebarItem__name`)
            .classList
            .contains('o_editable'),
        "chat should have editable name");
    assert.strictEqual(
        chat.
            querySelectorAll(`
                :scope
                .o_mail_component_DiscussSidebarItem__nameInput`)
            .length,
        1,
        "chat should have editable name input");
    assert.strictEqual(
        chat
            .querySelector(`
                :scope
                .o_mail_component_DiscussSidebarItem__nameInput`)
            .value,
        "Marc",
        "editable name input should have custom chat name as value by default");
    assert.strictEqual(
        chat
            .querySelector(`
                :scope
                .o_mail_component_DiscussSidebarItem__nameInput`)
            .placeholder,
        "Marc Demo",
        "editable name input should have partner name as placeholder");

    chat
        .querySelector(`
            :scope
            .o_mail_component_DiscussSidebarItem__nameInput`)
        .value = "Demo";
    const kevt = new window.KeyboardEvent('keydown', { key: "Enter" });
    chat
        .querySelector(`
            :scope
            .o_mail_component_DiscussSidebarItem__nameInput`)
        .dispatchEvent(kevt);
    await testUtils.nextTick(); // re-render

    assert.notOk(
        chat
            .querySelector(`
                :scope
                .o_mail_component_DiscussSidebarItem__name`)
            .classList
            .contains('o_editable'),
        "chat should no longer show editable name");
    assert.strictEqual(
        chat
            .querySelector(`
                :scope
                .o_mail_component_DiscussSidebarItem__name`)
            .textContent,
        "Demo",
        "chat should have renamed name as name");
});

QUnit.test('default thread rendering', async function (assert) {
    assert.expect(2);

    await this.create();

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__noMessage`)
            .length,
        1,
        "should have empty thread");
    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__noMessage`)
            .textContent
            .trim(),
        "There are no messages in this conversation.");
});

QUnit.test('initially load messages from inbox', async function (assert) {
    assert.expect(3);

    await this.create({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                assert.strictEqual(
                    args.kwargs.limit,
                    30,
                    "should fetch up to 30 messages");
                assert.strictEqual(
                    args.args.length,
                    1,
                    "should have a single item in args");
                assert.deepEqual(
                    args.args[0],
                    [["needaction", "=", true]],
                    "should fetch needaction messages");
            }
            return this._super.apply(this, arguments);
        },
    });
});

QUnit.test('default select thread in discuss params', async function (assert) {
    assert.expect(1);

    await this.create({
        params: { default_active_id: 'mail.box_starred' },
    });

    assert.ok(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_starred"]
                .o_mail_component_DiscussSidebarItem__activeIndicator`)
            .classList
            .contains('o_active'),
        "starred mailbox should become active");
});

QUnit.test('auto-select thread in discuss context', async function (assert) {
    assert.expect(1);

    await this.create({
        context: { active_id: 'mail.box_starred' },
    });

    assert.ok(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_starred"]
                .o_mail_component_DiscussSidebarItem__activeIndicator`)
            .classList
            .contains('o_active'),
        "starred mailbox should become active");
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

    await this.create({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                assert.strictEqual(
                    args.kwargs.limit,
                    30,
                    "should fetch up to 30 messages");
                assert.strictEqual(
                    args.args.length,
                    1,
                    "should have a single item in args");
                assert.deepEqual(
                    args.args[0],
                    [["channel_ids", "in", [20]]],
                    "should fetch messages from channel");
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

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList`)
            .length,
        1,
        "should have list of messages");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__separatorDate`)
            .length,
        1,
        "should have a single date separator"); // to check: may be client timezone dependent
    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__separatorLabelDate`)
            .textContent,
        "April 20, 2019",
        "should display date day of messages");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        1,
        "should have a single message");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message[data-message-local-id="mail.message_100"]`)
            .length,
        1,
        "should have message with ID 100");
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

    await this.create({
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

    const message = document.querySelector(`
        .o_mail_component_Discuss__thread
        .o_mail_component_Thread__messageList
        .o_mail_component_MessageList__message[data-message-local-id="mail.message_100"]`);

    assert.strictEqual(
            message
                .querySelectorAll(`
                    :scope
                    .o_mail_component_Message__sidebar`)
                .length,
            1,
            "should have message sidebar of message");
    assert.strictEqual(
        message
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__authorAvatar`)
            .length,
        1,
        "should have author avatar in sidebar of message");
    assert.strictEqual(
        message
            .querySelector(`
                :scope
                .o_mail_component_Message__authorAvatar`)
            .dataset
            .src,
        "/web/image/res.partner/11/image_small",
        "should have url of message in author avatar sidebar");
    assert.strictEqual(
        message
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__core`)
            .length,
        1,
        "should have core part of message");
    assert.strictEqual(
        message
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__header`)
            .length,
        1,
        "should have header in core part of message");
    assert.strictEqual(
        message
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__authorName`)
            .length,
        1,
        "should have author name in header of message");
    assert.strictEqual(
        message
            .querySelector(`
                :scope
                .o_mail_component_Message__authorName`)
            .textContent,
        "Demo",
        "should have textually author name in header of message");
    assert.strictEqual(
        message
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__header
                .o_mail_component_Message__date`)
            .length,
        1,
        "should have date in header of message");
    assert.strictEqual(
        message
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__header
                .o_mail_component_Message__commands`)
            .length,
        1,
        "should have commands in header of message");
    assert.strictEqual(
        message
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__header
                .o_mail_component_Message__command`)
            .length,
        1,
        "should have a single command in header of message");
    assert.strictEqual(
        message
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__commandStar`)
            .length,
        1,
        "should have command to star message");
    assert.strictEqual(
        message
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__content`)
            .length,
        1,
        "should have content in core part of message");
    assert.strictEqual(
        message
            .querySelector(`
                :scope
                .o_mail_component_Message__content`)
            .innerHTML
            .trim(),
        "<p>body</p>",
        "should have body of message in content part of message");
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

    await this.create({
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

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        2,
        "should have 2 messages");

    const message1 = document.querySelector(`
        .o_mail_component_Discuss__thread
        .o_mail_component_Thread__messageList
        .o_mail_component_MessageList__message[data-message-local-id="mail.message_100"]`);
    const message2 = document.querySelector(`
        .o_mail_component_Discuss__thread
        .o_mail_component_Thread__messageList
        .o_mail_component_MessageList__message[data-message-local-id="mail.message_101"]`);

    assert.notOk(
        message1
            .classList
            .contains('o_squashed'),
        "message 1 should not be squashed");
    assert.notOk(
        message1
            .querySelector(`
                :scope
                .o_mail_component_Message__sidebar`)
            .classList
            .contains('o_squashed'),
        "message 1 should not have squashed sidebar");
    assert.ok(
        message2
            .classList
            .contains('o_squashed'),
        "message 2 should be squashed");
    assert.ok(
        message2
            .querySelector(`
                :scope
                .o_mail_component_Message__sidebar`)
            .classList
            .contains('o_squashed'),
        "message 2 should not have squashed sidebar");
    assert.strictEqual(
        message2
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__sidebar
                .o_mail_component_Message__date`)
            .length,
        1,
        "message 2 should have date in sidebar");
    assert.strictEqual(
        message2
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__sidebar
                .o_mail_component_Message__commands`)
            .length,
        1,
        "message 2 should have some commands in sidebar");
    assert.strictEqual(
        message2
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__sidebar
                .o_mail_component_Message__commandStar`)
            .length,
        1,
        "message 2 should have star command in sidebar");
    assert.strictEqual(
        message2
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__core`)
            .length,
        1,
        "message 2 should have core part");
    assert.strictEqual(
        message2
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__header`)
            .length,
        0,
        "message 2 should have a header in core part");
    assert.strictEqual(
        message2
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__content`)
            .length,
        1,
        "message 2 should have some content in core part");
    assert.strictEqual(
        message2
            .querySelector(`
                :scope
                .o_mail_component_Message__content`)
            .innerHTML
            .trim(),
        "<p>body2</p>",
        "message 2 should have body in content part");
});

QUnit.test('inbox messages are never squashed', async function (assert) {
    assert.expect(3);

    await this.create({
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

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        2,
        "should have 2 messages");

    const message1 = document.querySelector(`
        .o_mail_component_Discuss__thread
        .o_mail_component_Thread__messageList
        .o_mail_component_MessageList__message[data-message-local-id="mail.message_100"]`);
    const message2 = document.querySelector(`
        .o_mail_component_Discuss__thread
        .o_mail_component_Thread__messageList
        .o_mail_component_MessageList__message[data-message-local-id="mail.message_101"]`);

    assert.notOk(
        message1
            .classList
            .contains('o_squashed'),
        "message 1 should not be squashed");
    assert.notOk(
        message2
            .classList
            .contains('o_squashed'),
        "message 2 should not be squashed");
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

    await this.create({
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

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__separatorDate`)
            .length,
        1,
        "should have a single date separator"); // to check: may be client timezone dependent
    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__separatorLabelDate`)
            .textContent,
        "April 20, 2019",
        "should display date day of messages");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        29,
        "should have 29 messages");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__loadMore`)
            .length,
        0,
        "should not have load more link");
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

    await this.create({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                step++;
                if (step === 1) {
                    // fetching messages from channel (initial load)
                    assert.strictEqual(
                        args.kwargs.limit,
                        30,
                        "should fetch up to 30 messages");
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
                    assert.strictEqual(
                        args.kwargs.limit,
                        30,
                        "should fetch up to 30 messages");
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

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__separatorDate`)
            .length,
        1,
        "should have a single date separator"); // to check: may be client timezone dependent
    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__separatorLabelDate`)
            .textContent,
        "April 20, 2019",
        "should display date day of messages");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        30,
        "should have 30 messages");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__loadMore`)
            .length,
        1,
        "should have load more link");

    document
        .querySelector(`
            .o_mail_component_Discuss__thread
            .o_mail_component_Thread__messageList
            .o_mail_component_MessageList__loadMore`)
        .click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        40,
        "should have 40 messages");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__loadMore`)
            .length,
        0,
        "should not longer have load more link (all messages loaded)");
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

    await this.create({
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

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        25,
        "should have 25 messages");

    const messageList= document.querySelector(`
        .o_mail_component_Discuss__thread
        .o_mail_component_Thread__messageList`);

    assert.strictEqual(
        messageList.scrollTop + messageList.clientHeight,
        messageList.scrollHeight,
        "should have scrolled to bottom of thread");
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

    await this.create({
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

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        30,
        "should have 30 messages");

    const scrollProm = testUtils.makeTestPromise();
    document
        .querySelector(`
            .o_mail_component_Discuss__thread
            .o_mail_component_Thread__messageList`)
        .addEventListener(
            'scroll',
            () => scrollProm.resolve(),
            false,
            { once: true });
    document
        .querySelector(`
            .o_mail_component_Discuss__thread
            .o_mail_component_Thread__messageList`)
        .scrollTop = 0;
    await scrollProm; // scroll time
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        40,
        "should have 40 messages");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Dsiscuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__loadMore`)
            .length,
        0,
        "should not longer have load more link (all messages loaded)");
});

QUnit.test('new messages separator', async function (assert) {
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

    await this.create({
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

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        25,
        "should have 25 messages");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__separatorNewMessages`)
            .length,
        0,
        "should not display 'new messages' separator");

    const scrollProm = testUtils.makeTestPromise();
    document
        .querySelector(`
            .o_mail_component_Discuss__thread
            .o_mail_component_Thread__messageList`)
        .addEventListener(
            'scroll',
            () => scrollProm.resolve(),
            false,
            { once: true });
    document
        .querySelector(`
            .o_mail_component_Discuss__thread
            .o_mail_component_Thread__messageList`)
        .scrollTop = 0;
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
    this.widget.call('bus_service', 'trigger', 'notification', notifications);
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        26,
        "should have 26 messages");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__separatorNewMessages`)
            .length,
        1,
        "should display 'new messages' separator");

    // scroll to bottom
    const scrollProm2 = testUtils.makeTestPromise();
    document
        .querySelector(`
            .o_mail_component_Discuss__thread
            .o_mail_component_Thread__messageList`)
        .addEventListener(
            'scroll',
            () => scrollProm2.resolve(),
            false,
            { once: true });
    document
        .querySelector(`
            .o_mail_component_Discuss__thread
            .o_mail_component_Thread__messageList`)
        .scrollTop =
    document
        .querySelector(`
            .o_mail_component_Discuss__thread
            .o_mail_component_Thread__messageList`)
        .scrollHeight;
    await scrollProm2; // scroll time
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__separatorNewMessages`)
            .length,
        0,
        "should no longer display 'new messages' separator (message seen)");
});

QUnit.test('restore thread scroll position', async function (assert) {
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

    await this.create({
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

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        25,
        "should have 25 messages");

    // scroll to top of channel1
    const scrollProm = testUtils.makeTestPromise();
    document
        .querySelector(`
            .o_mail_component_Discuss__thread
            .o_mail_component_Thread__messageList`)
        .addEventListener(
            'scroll',
            () => scrollProm.resolve(),
            false,
            { once: true });
    document
        .querySelector(`
            .o_mail_component_Discuss__thread
            .o_mail_component_Thread__messageList`)
        .scrollTop = 0;
    await scrollProm; // scroll time

    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList`)
            .scrollTop,
        0,
        "should have scrolled to top of thread");

    // select channel2
    await testUtils.dom.click(
        document.querySelector(`
            .o_mail_component_DiscussSidebar__groupChannel
            .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_2"]`));
    await testUtils.nextTick(); // re-render

    // select channel1
    await testUtils.dom.click(
        document.querySelector(`
            .o_mail_component_DiscussSidebar__groupChannel
            .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_1"]`));
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList`)
            .scrollTop,
        0,
        "should have recovered scroll position of channel1 (scroll to top)");

    // select channel2
    await testUtils.dom.click(
        document.querySelector(`
            .o_mail_component_DiscussSidebar__groupChannel
            .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_2"]`));
    await testUtils.nextTick(); // re-render

    const messageList = document.querySelector(`
        .o_mail_component_Discuss__thread
        .o_mail_component_Thread__messageList`);

    assert.strictEqual(
        messageList.scrollTop + messageList.clientHeight,
        messageList.scrollHeight,
        "should have recovered scroll position of channel2 (scroll to bottom)");
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

    await this.create({
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

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        2,
        "should have 2 messages");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message[data-message-local-id="mail.message_100"]`)
            .length,
        1,
        "should have message1 (ID 100)");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message[data-message-local-id="mail.message_101"]`)
            .length,
        1,
        "should have message2 (ID 101)");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message[data-message-local-id="mail.message_100"]
                .o_mail_component_Message__header
                .o_mail_component_Message__originThread`)
            .length,
        0,
        "message1 should not have origin part in channel1 (same origin as channel)");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message[data-message-local-id="mail.message_101"]
                .o_mail_component_Message__header
                .o_mail_component_Message__originThread`)
            .length,
        1,
        "message2 should have origin part (origin is channel2 !== channel1)");
    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message[data-message-local-id="mail.message_101"]
                .o_mail_component_Message__header
                .o_mail_component_Message__originThread`)
            .textContent
            .trim(),
        "(from #channel2)",
        "message2 should display name of origin channel");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message[data-message-local-id="mail.message_101"]
                .o_mail_component_Message__header
                .o_mail_component_Message__originThreadLink`)
            .length,
        1,
        "message2 should have link to redirect to origin");

    // click on origin link of message2 (= channel2)
    document
        .querySelector(`
            .o_mail_component_Discuss__thread
            .o_mail_component_Thread__messageList
            .o_mail_component_MessageList__message[data-message-local-id="mail.message_101"]
            .o_mail_component_Message__header
            .o_mail_component_Message__originThreadLink`)
        .click();
    await testUtils.nextTick(); // re-render

    assert.ok(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_2"]
                .o_mail_component_DiscussSidebarItem__activeIndicator`)
            .classList
            .contains('o_active'),
        "channel2 should be active channel on redirect from discuss app");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        2,
        "should have 2 messages");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message[data-message-local-id="mail.message_100"]`)
            .length,
        1,
        "should have message1 (ID 100)");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message[data-message-local-id="mail.message_101"]`)
            .length,
        1,
        "should have message2 (ID 101)");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message[data-message-local-id="mail.message_100"]
                .o_mail_component_Message__header
                .o_mail_component_Message__originThread`)
            .length,
        1,
        "message1 should have origin thread part (= channel1 !== channel2)");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message[data-message-local-id="mail.message_101"]
                .o_mail_component_Message__header
                .o_mail_component_Message__originThread`)
            .length,
        0,
        "message2 should not have origin thread part in channel2 (same as current channel)");
    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message[data-message-local-id="mail.message_100"]
                .o_mail_component_Message__header
                .o_mail_component_Message__originThread`)
            .textContent
            .trim(),
        "(from #channel1)",
        "message1 should display name of origin channel");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message[data-message-local-id="mail.message_100"]
                .o_mail_component_Message__header
                .o_mail_component_Message__originThreadLink`)
            .length,
        1,
        "message1 should have link to redirect to origin channel");
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

    await this.create({
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
            if (args.model === 'res.users' && args.method === 'search') {
                return Promise.resolve([2]);
            }
            return this._super.apply(this, arguments);
        },
        params: { default_active_id: 'mail.channel_1' },
        session: { partner_id: 3 },
    });

    assert.ok(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_1"]
                .o_mail_component_DiscussSidebarItem__activeIndicator`)
            .classList
            .contains('o_active'),
        "channel 'General' should be active");
    assert.notOk(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__groupChat
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_10"]
                .o_mail_component_DiscussSidebarItem__activeIndicator`)
            .classList
            .contains('o_active'),
        "DM 'Demo' should not be active");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__thread
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        2,
        "should have 2 messages");

    const msg1 = document.querySelector(`
        .o_mail_component_Discuss__thread
        .o_mail_component_Thread__messageList
        .o_mail_component_MessageList__message[data-message-local-id="mail.message_100"]`);
    const msg2 = document.querySelector(`
        .o_mail_component_Discuss__thread
        .o_mail_component_Thread__messageList
        .o_mail_component_MessageList__message[data-message-local-id="mail.message_101"]`);

    assert.strictEqual(
        msg1
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__authorAvatar`)
            .length,
        1,
        "message1 should have author image");
    assert.ok(
        msg1
            .querySelector(`
                :scope
                .o_mail_component_Message__authorAvatar`)
            .classList
            .contains('o_redirect'),
        "message1 should have redirect to author");
    assert.strictEqual(
        msg2
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__authorAvatar`)
            .length,
        1,
        "message2 should have author image");
    assert.notOk(
        msg2
            .querySelector(`
                :scope
                .o_mail_component_Message__authorAvatar`)
            .classList
            .contains('o_redirect'),
        "message2 should not have redirect to author (self-author)");

    await testUtils.dom.click(
        msg1.querySelector(`
            :scope
            .o_mail_component_Message__authorAvatar`));
    await testUtils.nextTick(); // re-render

    assert.notOk(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_1"]
                .o_mail_component_DiscussSidebarItem__activeIndicator`)
            .classList
            .contains('o_active'),
        "channel 'General' should become inactive after author redirection");
    assert.ok(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__groupChat
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_10"]
                .o_mail_component_DiscussSidebarItem__activeIndicator`)
            .classList
            .contains('o_active'),
        "chat 'Demo' should become active after author redirection");
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

    await this.create();

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__item`)
            .length,
        20,
        "should have 20 channel items");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss__sidebar
                input.o_mail_component_DiscussSidebar__quickSearch`)
            .length,
        1,
        "should have quick search in sidebar");

    const quickSearch = document.querySelector(`
        .o_mail_component_Discuss__sidebar
        input.o_mail_component_DiscussSidebar__quickSearch`);

    quickSearch.value = "1";
    const kevt1 = new window.KeyboardEvent('input');
    quickSearch.dispatchEvent(kevt1);
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__item`)
            .length,
        11,
        "should have filtered to 11 channel items");

    quickSearch.value = "12";
    const kevt2 = new window.KeyboardEvent('input');
    quickSearch.dispatchEvent(kevt2);
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__item`)
            .length,
        1,
        "should have filtered to a single channel item");
    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__item`)
            .dataset
            .threadLocalId,
        'mail.channel_12',
        "should have filtered to a single channel item with ID 12");

    quickSearch.value = "123";
    const kevt3 = new window.KeyboardEvent('input');
    quickSearch.dispatchEvent(kevt3);
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__groupChannel
                .o_mail_component_DiscussSidebar__item`)
            .length,
        0,
        "should have filtered to no channel item");
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

    await this.create();

    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_widget_Discuss
                > .o_cp_controller
                > .o_control_panel
                > .breadcrumb`)
            .textContent,
        "Inbox",
        "display inbox in the breadcrumb");
    const markAllReadButton = document.querySelector(`.o_mail_widget_Discuss__controlPanelButtonMarkAllRead`);
    assert.isVisible(
        markAllReadButton,
        "should have visible button 'Mark all read' in the control panel of inbox");
    assert.ok(
        markAllReadButton.disabled,
        "should have disabled button 'Mark all read' in the control panel of inbox (no messages)");

    await testUtils.dom.click(
        document.querySelector(`
            .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_starred"]`));

    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_widget_Discuss
                > .o_cp_controller
                > .o_control_panel
                > .breadcrumb`)
            .textContent,
        "Starred",
        "display starred in the breadcrumb");
    const unstarAllButton = document.querySelector(`.o_mail_widget_Discuss__controlPanelButtonUnstarAll`);
    assert.isVisible(
        unstarAllButton,
        "should have visible button 'Unstar all' in the control panel of starred");
    assert.ok(
        unstarAllButton.disabled,
        "should have disabled button 'Unstar all' in the control panel of starred (no messages)");

    await testUtils.dom.click(
        document.querySelector(`
            .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_20"]`));

    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_widget_Discuss
                > .o_cp_controller
                > .o_control_panel
                > .breadcrumb`)
            .textContent,
        "#General",
        "display general in the breadcrumb");
    const inviteButton = document.querySelector(`.o_mail_widget_Discuss__controlPanelButtonInvite`);
    assert.isVisible(
        inviteButton,
        "should have visible button 'Invite' in the control panel of channel");
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

    await this.create({
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
                self.widget.call('bus_service', 'trigger', 'notification', notifications);
                return Promise.resolve();

            }
            return this._super.apply(this, arguments);
        },
        session: { partner_id: 3 },
    });

    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_inbox"]
                .o_mail_component_DiscussSidebarItem__counter`)
            .textContent,
        "2",
        "inbox should have counter of 2");
    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_20"]
                .o_mail_component_DiscussSidebarItem__counter`)
            .textContent,
        "2",
        "channel should have counter of 2");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        2,
        "should have 2 messages in inbox");
    let markAllReadButton = document.querySelector(`.o_mail_widget_Discuss__controlPanelButtonMarkAllRead`);
    assert.notOk(
        markAllReadButton.disabled,
        "should have enabled button 'Mark all read' in the control panel of inbox (has messages)");

    markAllReadButton.click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_inbox"]
                .o_mail_component_DiscussSidebarItem__counter`)
            .length,
        0,
        "inbox should display no counter (= 0)");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.channel_20"]
                .o_mail_component_DiscussSidebarItem__counter`)
            .length,
        0,
        "channel should display no counter (= 0)");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        0,
        "should have no message in inbox");
    markAllReadButton = document.querySelector(`.o_mail_widget_Discuss__controlPanelButtonMarkAllRead`);
    assert.ok(
        markAllReadButton.disabled,
        "should have disabled button 'Mark all read' in the control panel of inbox (no messages)");
});

QUnit.test('starred: unstar all', async function (assert) {
    assert.expect(6);

    const self = this;

    Object.assign(this.data.initMessaging, { starred_counter: 2 });

    await this.create({
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
                self.widget.call('bus_service', 'trigger', 'notification', notifications);
                return Promise.resolve();

            }
            return this._super.apply(this, arguments);
        },
        params: { default_active_id: 'mail.box_starred' },
        session: { partner_id: 3 },
    });

    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_starred"]
                .o_mail_component_DiscussSidebarItem__counter`)
            .textContent,
        "2",
        "starred should have counter of 2");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        2,
        "should have 2 messages in starred");
    let unstarAllButton = document.querySelector(`.o_mail_widget_Discuss__controlPanelButtonUnstarAll`);
    assert.notOk(
        unstarAllButton.disabled,
        "should have enabled button 'Unstar all' in the control panel of starred (has messages)");

    unstarAllButton.click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_starred"]
                .o_mail_component_DiscussSidebarItem__counter`)
            .length,
        0,
        "starred should display no counter (= 0)");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        0,
        "should have no message in starred");
    unstarAllButton = document.querySelector(`.o_mail_widget_Discuss__controlPanelButtonUnstarAll`);
    assert.ok(
        unstarAllButton.disabled,
        "should have disabled button 'Unstar all' in the control panel of starred (no messages)");
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

    await this.create({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                return Promise.resolve([messageData]);
            }
            if (args.method === 'toggle_message_starred') {
                assert.step('rpc:toggle_message_starred');
                assert.strictEqual(
                    args.args[0][0],
                    100,
                    "should have message ID in args");
                // simulate toggle_star notification
                messageData.starred = !messageData.starred;
                const data = {
                    message_ids: [100],
                    starred: messageData.starred,
                    type: 'toggle_star',
                };
                const notifications = [ [['my-db', 'res.partner'], data] ];
                self.widget.call('bus_service', 'trigger', 'notification', notifications);
                return Promise.resolve();
            }
            return this._super.apply(this, arguments);
        },
        params: { default_active_id: 'mail.channel_20' },
    });

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_starred"]
                .o_mail_component_DiscussSidebarItem__counter`)
            .length,
        0,
        "starred should display no counter (= 0)");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        1,
        "should have 1 message in channel");
    let message = document.querySelector(`
        .o_mail_component_Discuss
        .o_mail_component_Thread__messageList
        .o_mail_component_MessageList__message`);
    assert.notOk(
        message
            .classList
            .contains('o_starred'),
        "message should not be starred");
    assert.strictEqual(
        message
            .querySelectorAll(`
                :scope
                .o_mail_component_Message__commandStar`)
            .length,
        1,
        "message should have star command");

    message
        .querySelector(`
            :scope
            .o_mail_component_Message__commandStar`)
        .click();
    await testUtils.nextTick(); // re-render

    assert.verifySteps(['rpc:toggle_message_starred']);
    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_starred"]
                .o_mail_component_DiscussSidebarItem__counter`)
            .textContent,
        "1",
        "starred should display a counter of 1");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        1,
        "should have kept 1 message in channel");
    message = document.querySelector(`
        .o_mail_component_Discuss
        .o_mail_component_Thread__messageList
        .o_mail_component_MessageList__message`);
    assert.ok(
        message
            .classList
            .contains('o_starred'),
        "message should be starred");

    message
        .querySelector(`
            :scope
            .o_mail_component_Message__commandStar`)
        .click();
    await testUtils.nextTick(); // re-render

    assert.verifySteps(['rpc:toggle_message_starred']);
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_DiscussSidebar__item[data-thread-local-id="mail.box_starred"]
                .o_mail_component_DiscussSidebarItem__counter`)
            .length,
        0,
        "starred should no longer display a counter (= 0)");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_Discuss
                .o_mail_component_Thread__messageList
                .o_mail_component_MessageList__message`)
            .length,
        1,
        "should still have 1 message in channel");
    message = document.querySelector(`
        .o_mail_component_Discuss
        .o_mail_component_Thread__messageList
        .o_mail_component_MessageList__message`);
    assert.notOk(
        message
            .classList
            .contains('o_starred'),
        "message should no longer be starred");
});

QUnit.test('composer text input: basic rendering', async function (assert) {
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

    await this.create({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                return Promise.resolve([]);
            }
            return this._super.apply(this, arguments);
        },
        params: { default_active_id: 'mail.channel_20' },
    });

    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_Composer`)
            .length,
        1,
        "should have composer in discuss thread");
    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_Composer__textInput`)
            .length,
        1,
        "should have text input inside discuss thread composer");
    assert.ok(
        document
            .querySelector(`.o_mail_component_Composer__textInput`)
            .classList
            .contains('o_mail_component_ComposerTextInput'),
        "should composer text input of composer be a ComposerTextInput component");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ComposerTextInput
                > .note-editor`)
            .length,
        1,
        "should have note editor inside composer text input");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ComposerTextInput
                > .note-editor
                > .note-editing-area`)
            .length,
        1,
        "should have note editing area inside note editor of composer text input");
    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_ComposerTextInput
                > .note-editor
                > .note-editing-area`)
            .textContent,
        "Write something...",
        "should have placeholder in note editing area of composer text input");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ComposerTextInput
                > .note-editor
                > .note-editing-area
                > .note-editable`)
            .length,
        1,
        "should have note editable inside note editing area of composer text input");
    assert.ok(
        document
            .querySelector(`
                .o_mail_component_ComposerTextInput
                > .note-editor
                > .note-editing-area
                > .note-editable`)
            .isContentEditable,
        "should have note editable as an HTML editor");
});

QUnit.test('post a simple message', async function (assert) {
    assert.expect(16);

    var self = this;

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 20,
                name: "General",
            }],
        },
    });

    let messagesData = [];

    await this.create({
        mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                return Promise.resolve(messagesData);
            }
            if (args.method === 'message_post') {
                assert.step('message_post');
                assert.strictEqual(
                    args.args[0],
                    20,
                    "should post message to channel ID 20");
                assert.strictEqual(
                    args.kwargs.body,
                    "<p>Test</p>",
                    "should post with provided content in composer input");
                assert.strictEqual(
                    args.kwargs.message_type,
                    "comment",
                    "should set message type as 'comment'"
                );
                assert.strictEqual(
                    args.kwargs.subtype,
                    "mail.mt_comment",
                    "should set subtype as 'comment'"
                );
                // simulate receiving a new message
                const data = {
                    author_id: [3, "Myself"],
                    body: args.kwargs.body,
                    channel_ids: [20],
                    date: "2019-04-20 11:00:00",
                    id: 101,
                    message_type: args.kwargs.message_type,
                    model: 'mail.channel',
                    subtype: args.kwargs.subtype,
                    record_name: 'General',
                    res_id: 20,
                };
                const notifications = [
                    [
                        ['my-db', 'mail.channel', 20],
                        data
                    ]
                ];
                messagesData.push(data);
                self.widget.call('bus_service', 'trigger', 'notification', notifications);
                return Promise.resolve();
            }
            return this._super.apply(this, arguments);
        },
        params: { default_active_id: 'mail.channel_20' },
        session: { partner_id: 3 },
    });

    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_Thread__noMessage`)
            .length,
        1,
        "should display thread with no message initially");
    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_Message`)
            .length,
        0,
        "should display no message initially");

    const editable = document.querySelector(`
        .o_mail_component_ComposerTextInput
        .note-editable`);

    assert.strictEqual(
        editable.innerHTML,
        "",
        "should have empty content initially");

    // insert some HTML in editable
    editable.focus();
    document.execCommand('insertHTML', false, '<p>Test</p>');

    assert.strictEqual(
        editable.innerHTML,
        "<p>Test</p>",
        "should have inserted HTML in editable");
    assert.strictEqual(
        editable.textContent,
        "Test",
        "should have inserted text in editable");

    editable.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));

    assert.verifySteps(['message_post']);

    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        editable.innerHTML,
        "",
        "should have no content in composer input after posting message");

    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_Message`)
            .length,
        1,
        "should display a message after posting message");

    const message = document.querySelector(`.o_mail_component_Message`);

    assert.strictEqual(
        message.dataset.messageLocalId,
        'mail.message_101',
        "new message in thread should be linked to newly created message from message post");
    assert.strictEqual(
        message
            .querySelector(`
                :scope
                .o_mail_component_Message__authorName`)
            .textContent,
        "Myself",
        "new message in thread should be from myself");
    assert.strictEqual(
        message
            .querySelector(`
                :scope
                .o_mail_component_Message__content`)
            .innerHTML,
        "<p>Test</p>",
        "new message in thread should have content typed from composer text input");
});

});
});
