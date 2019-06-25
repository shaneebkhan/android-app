odoo.define('mail.component.ChatWindowManagerTests', function (require) {
"use strict";

const {
    afterEach: utilsAfterEach,
    beforeEach: utilsBeforeEach,
    create,
    pause,
} = require('mail.owl.test_utils');

const testUtils = require('web.test_utils');

QUnit.module('mail.owl', {}, function () {
QUnit.module('ChatWindowManager', {
    beforeEach() {
        utilsBeforeEach(this);
        this.create = async params => {
            if (this.widget) {
                this.widget.destroy();
            }
            let { widget } = await create({ ...params, data: this.data });
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

QUnit.test('initial mount', async function (assert) {
    assert.expect(1);

    await this.create();

    assert.strictEqual(
        document
            .querySelectorAll('.o_mail_component_ChatWindowManager')
            .length,
        1,
        "should have chat window manager");
});

QUnit.test('chat window new message: basic rendering', async function (assert) {
    assert.expect(10);

    await this.create({
        mockRPC(route, args) {
            if (args.method === 'channel_fetch_preview') {
                return Promise.resolve([]);
            }
            return this._super.apply(this, arguments);
        },
    });

    document
        .querySelector(`
            .o_mail_component_SystrayMessagingMenu__toggler`)
        .click();
    await testUtils.nextTick(); // re-render
    document
        .querySelector(`.o_mail_component_SystrayMessagingMenu__newMessage`)
        .click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_ChatWindow`)
            .length,
        1,
        "should have open a chat window");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ChatWindow
                .o_mail_component_ChatWindowHeader`)
            .length,
        1,
        "should have a header");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ChatWindow
                .o_mail_component_ChatWindowHeader
                .o_mail_component_ChatWindowHeader__name`)
            .length,
        1,
        "should have name part in header");
    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_ChatWindow
                .o_mail_component_ChatWindowHeader
                .o_mail_component_ChatWindowHeader__name`)
            .textContent,
        "New message",
        "should display 'new message' in the header");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ChatWindow
                .o_mail_component_ChatWindowHeader
                .o_mail_component_ChatWindowHeader__commands`)
            .length,
        1,
        "should have commands in header");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ChatWindow
                .o_mail_component_ChatWindowHeader
                .o_mail_component_ChatWindowHeader__commandClose`)
            .length,
        1,
        "should have command to close chat window");
    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_ChatWindow__newMessageForm`)
            .length,
        1,
        "should have a new message chat window container");
    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_ChatWindow__newMessageFormLabel`)
            .length,
        1,
        "should have a part in selection with label");
    assert.strictEqual(
        document
            .querySelector(`.o_mail_component_ChatWindow__newMessageFormLabel`)
            .textContent
            .trim(),
        "To:",
        "should have label 'To:' in selection");
    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_ChatWindow__newMessageFormInput`)
            .length,
        1,
        "should have an input in selection");
});

QUnit.test('chat window new message: focused on open', async function (assert) {
    assert.expect(2);

    await this.create({
        mockRPC(route, args) {
            if (args.method === 'channel_fetch_preview') {
                return Promise.resolve([]);
            }
            return this._super.apply(this, arguments);
        },
    });

    document
        .querySelector(`
            .o_mail_component_SystrayMessagingMenu__toggler`)
        .click();
    await testUtils.nextTick(); // re-render

    document
        .querySelector(`.o_mail_component_SystrayMessagingMenu__newMessage`)
        .click();
    await testUtils.nextTick(); // re-render

    assert.ok(
        document
            .querySelector(`.o_mail_component_ChatWindow`)
            .classList
            .contains('o_focused'),
        "chat window should be focused");
    assert.ok(
        document.activeElement,
        document.querySelector(`.o_mail_component_ChatWindow__newMessageFormInput`),
        "chat window focused = selection input focused");
});

QUnit.test('chat window new message: close', async function (assert) {
    assert.expect(1);

    await this.create({
        mockRPC(route, args) {
            if (args.method === 'channel_fetch_preview') {
                return Promise.resolve([]);
            }
            return this._super.apply(this, arguments);
        },
    });

    document
        .querySelector(`
            .o_mail_component_SystrayMessagingMenu__toggler`)
        .click();
    await testUtils.nextTick(); // re-render

    document
        .querySelector(`.o_mail_component_SystrayMessagingMenu__newMessage`)
        .click();
    await testUtils.nextTick(); // re-render

    document
        .querySelector(`
            .o_mail_component_ChatWindow
            .o_mail_component_ChatWindowHeader
            .o_mail_component_ChatWindowHeader__commandClose`)
        .click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_ChatWindow`)
            .length,
        0,
        "chat window should be closed");
});

QUnit.test('chat window new message: fold', async function (assert) {
    assert.expect(3);

    await this.create({
        mockRPC(route, args) {
            if (args.method === 'channel_fetch_preview') {
                return Promise.resolve([]);
            }
            return this._super.apply(this, arguments);
        },
    });

    document
        .querySelector(`
            .o_mail_component_SystrayMessagingMenu__toggler`)
        .click();
    await testUtils.nextTick(); // re-render

    document
        .querySelector(`.o_mail_component_SystrayMessagingMenu__newMessage`)
        .click();
    await testUtils.nextTick(); // re-render

    assert.notOk(
        document
            .querySelector(`.o_mail_component_ChatWindow`)
            .classList
            .contains('o_folded'),
        "chat window should not be folded by default");

    document
        .querySelector(`
            .o_mail_component_ChatWindow
            .o_mail_component_ChatWindowHeader`)
        .click();
    await testUtils.nextTick(); // re-render

    assert.ok(
        document
            .querySelector(`
                .o_mail_component_ChatWindow`)
            .classList
            .contains('o_folded'),
        "chat window should become folded");

    document
        .querySelector(`
            .o_mail_component_ChatWindow
            .o_mail_component_ChatWindowHeader`)
        .click();
    await testUtils.nextTick(); // re-render

    assert.notOk(
        document
            .querySelector(`
                .o_mail_component_ChatWindow`)
            .classList
            .contains('o_folded'),
        "chat window should become unfolded");
});

QUnit.test('chat window: basic rendering', async function (assert) {
    assert.expect(11);

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
            if (args.method === 'channel_fetch_preview') {
                return Promise.resolve([{
                    id: 20,
                    last_message: {
                        author_id: [7, "Demo"],
                        body: "<p>test</p>",
                        channel_ids: [20],
                        id: 100,
                        message_type: 'comment',
                        model: 'mail.channel',
                        res_id: 20,
                    },
                }]);
            }
            return this._super.apply(this, arguments);
        },
    });

    document
        .querySelector(`
            .o_mail_component_SystrayMessagingMenu__toggler`)
        .click();
    await testUtils.nextTick(); // re-render
    document
        .querySelector(`
            .o_mail_component_SystrayMessagingMenu__dropdownMenu
            .o_mail_component_ThreadPreviewList__preview`)
        .click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_ChatWindow`)
            .length,
        1,
        "should have open a chat window");
    assert.strictEqual(
        document
            .querySelector(`.o_mail_component_ChatWindow`)
            .dataset
            .threadLocalId,
        'mail.channel_20',
        "should have open a chat window of channel");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ChatWindow
                .o_mail_component_ChatWindowHeader`)
            .length,
        1,
        "should have header part");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ChatWindow
                .o_mail_component_ChatWindowHeader
                .o_mail_component_ThreadIcon`)
            .length,
        1,
        "should have thread icon in header part");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ChatWindow
                .o_mail_component_ChatWindowHeader
                .o_mail_component_ChatWindowHeader__name`)
            .length,
        1,
        "should have thread name in header part");
    assert.strictEqual(
        document
            .querySelector(`
                .o_mail_component_ChatWindow
                .o_mail_component_ChatWindowHeader
                .o_mail_component_ChatWindowHeader__name`)
            .textContent,
        "General",
        "should have correct thread name in header part");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ChatWindow
                .o_mail_component_ChatWindowHeader
                .o_mail_component_ChatWindowHeader__commands`)
            .length,
        1,
        "should have commands in header part");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ChatWindow
                .o_mail_component_ChatWindowHeader
                .o_mail_component_ChatWindowHeader__commandExpand`)
            .length,
        1,
        "should have command to expand thread in discuss");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ChatWindow
                .o_mail_component_ChatWindowHeader
                .o_mail_component_ChatWindowHeader__commandClose`)
            .length,
        1,
        "should have command to close chat window");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ChatWindow__thread`)
            .length,
        1,
        "should have part to display thread content inside chat window");
    assert.ok(
        document
            .querySelector(`
                .o_mail_component_ChatWindow__thread`)
            .classList
            .contains('o_mail_component_Thread'),
        "thread part should use component thread");
});

QUnit.test('open 2 different chat windows: enough screen width', async function (assert) {
    /**
     * computation uses following info:
     * ([mocked] global width: @see `mail.component.test_utils:create()` method)
     * (others: @see store mutation `_computeChatWindows`)
     *
     * - chat window width: 325px
     * - start/end/between gap width: 10px/10px/5px
     * - hidden menu width: 200px
     * - global width: 1920px
     *
     * Enough space for 2 visible chat windows:
     *  10 + 325 + 5 + 325 + 10 = 670 < 1920
     */
    assert.expect(8);

    Object.assign(this.data.initMessaging, {
        channel_slots: {
            channel_channel: [{
                channel_type: "channel",
                id: 20,
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
            if (args.method === 'channel_fetch_preview') {
                return Promise.resolve([{
                    id: 20,
                    last_message: {
                        author_id: [7, "Demo"],
                        body: "<p>test</p>",
                        channel_ids: [20],
                        id: 100,
                        message_type: 'comment',
                        model: 'mail.channel',
                        res_id: 20,
                    },
                }, {
                    id: 10,
                    last_message: {
                        author_id: [7, "Demo"],
                        body: "<p>test2</p>",
                        channel_ids: [10],
                        id: 101,
                        message_type: 'comment',
                        model: 'mail.channel',
                        res_id: 10,
                    },
                }]);
            }
            return this._super.apply(this, arguments);
        },
    });

    document
        .querySelector(`
            .o_mail_component_SystrayMessagingMenu__toggler`)
        .click();
    await testUtils.nextTick(); // re-render
    document
        .querySelector(`
            .o_mail_component_SystrayMessagingMenu__dropdownMenu
            .o_mail_component_ThreadPreviewList
            .o_mail_component_ThreadPreview[data-thread-local-id="mail.channel_10"]`)
        .click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ChatWindow`)
            .length,
        1,
        "should have open a chat window");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ChatWindow[data-thread-local-id="mail.channel_10"]`)
            .length,
        1,
        "chat window of chat should be open");
    assert.ok(
        document
            .querySelector(`
                .o_mail_component_ChatWindow[data-thread-local-id="mail.channel_10"]`)
            .classList
            .contains('o_focused'),
        "chat window of chat should have focus");

    document
        .querySelector(`
            .o_mail_component_SystrayMessagingMenu__toggler`)
        .click();
    await testUtils.nextTick(); // re-render
    document
        .querySelector(`
            .o_mail_component_SystrayMessagingMenu__dropdownMenu
            .o_mail_component_ThreadPreviewList
            .o_mail_component_ThreadPreview[data-thread-local-id="mail.channel_20"]`)
        .click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ChatWindow`)
            .length,
        2,
        "should have open a new chat window");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ChatWindow[data-thread-local-id="mail.channel_20"]`)
            .length,
        1,
        "chat window of channel should be open");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_mail_component_ChatWindow[data-thread-local-id="mail.channel_10"]`)
            .length,
        1,
        "chat window of chat should still be open");
    assert.ok(
        document
            .querySelector(`
                .o_mail_component_ChatWindow[data-thread-local-id="mail.channel_20"]`)
            .classList
            .contains('o_focused'),
        "chat window of channel should have focus");
    assert.notOk(
        document
            .querySelector(`
                .o_mail_component_ChatWindow[data-thread-local-id="mail.channel_10"]`)
            .classList
            .contains('o_focused'),
        "chat window of chat should no longer have focus");
});

QUnit.test('open 3 different chat windows: not enough screen width', async function (assert) {
    /**
     * computation uses following info:
     * ([mocked] global width: 900px @see initStoreStateAlteration param passed
     *   to `mail.component.test_utils:create()` method)
     * (others: @see store mutation `_computeChatWindows`)
     *
     * - chat window width: 325px
     * - start/end/between gap width: 10px/10px/5px
     * - hidden menu width: 200px
     * - global width: 1080px
     *
     * Enough space for 2 visible chat windows, and one hidden chat window:
     * 3 visible chat windows:
     *  10 + 325 + 5 + 325 + 5 + 325 + 10 = 1000 < 900
     * 2 visible chat windows + hidden menu:
     *  10 + 325 + 5 + 325 + 10 + 200 + 5 = 875 < 900
     */
    assert.expect(9);

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
            }, {
                channel_type: "channel",
                id: 3,
                name: "channel3",
            }],
        },
    });

    await this.create({
        initStoreStateAlteration: {
            global: {
                innerHeight: 900,
                innerWidth: 900,
            },
            isMobile: false,
        },
        mockRPC(route, args) {
            if (args.method === 'channel_fetch_preview') {
                return Promise.resolve([]);
            }
            return this._super.apply(this, arguments);
        },
    });

    // open, from systray menu, chat windows of channels with ID 1, 2, then 3
    document
        .querySelector(`
            .o_mail_component_SystrayMessagingMenu__toggler`)
        .click();
    await testUtils.nextTick(); // re-render
    document
        .querySelector(`
            .o_mail_component_SystrayMessagingMenu__dropdownMenu
            .o_mail_component_ThreadPreviewList
            .o_mail_component_ThreadPreview[data-thread-local-id="mail.channel_1"]`)
        .click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_ChatWindow`)
            .length,
        1,
        "should have open 1 visible chat window");
    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_ChatWindowManager__hiddenMenu`)
            .length,
        0,
        "should not have hidden menu");

    document
        .querySelector(`
            .o_mail_component_SystrayMessagingMenu__toggler`)
        .click();
    await testUtils.nextTick(); // re-render
    document
        .querySelector(`
            .o_mail_component_SystrayMessagingMenu__dropdownMenu
            .o_mail_component_ThreadPreviewList
            .o_mail_component_ThreadPreview[data-thread-local-id="mail.channel_2"]`)
        .click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_ChatWindow`)
            .length,
        2,
        "should have open 2 visible chat windows");
    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_ChatWindowManager__hiddenMenu`)
            .length,
        0,
        "should not have hidden menu");

    document
        .querySelector(`
            .o_mail_component_SystrayMessagingMenu__toggler`)
        .click();
    await testUtils.nextTick(); // re-render
    document
        .querySelector(`
            .o_mail_component_SystrayMessagingMenu__dropdownMenu
            .o_mail_component_ThreadPreviewList
            .o_mail_component_ThreadPreview[data-thread-local-id="mail.channel_3"]`)
        .click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_ChatWindow`)
            .length,
        2,
        "should have open 2 visible chat windows");
    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_ChatWindowManager__hiddenMenu`)
            .length,
        1,
        "should have hidden menu");
    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_ChatWindow[data-thread-local-id="mail.channel_1"]`)
            .length,
        1,
        "chat window of channel 1 should be open");
    assert.strictEqual(
        document
            .querySelectorAll(`.o_mail_component_ChatWindow[data-thread-local-id="mail.channel_3"]`)
            .length,
        1,
        "chat window of channel 3 should be open");
    assert.ok(
        document
            .querySelector(`.o_mail_component_ChatWindow[data-thread-local-id="mail.channel_3"]`)
            .classList
            .contains('o_focused'),
        "chat window of channel 3 should have focus");
});

});
});
