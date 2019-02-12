odoo.define('mail.wip.systray_messaging_menu_tests', function (require) {
"use strict";

const {
    afterEach: utilsAfterEach,
    beforeEach: utilsBeforeEach,
    create,
} = require('mail.wip.test_utils');

const testUtils = require('web.test_utils');

QUnit.module('mail.wip', {}, function () {
QUnit.module('SystrayMessagingMenu', {
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

QUnit.test('basic rendering', async function (assert) {
    assert.expect(21);

    await this.create({
        mockRPC(route, args) {
            if (args.method === 'channel_fetch_preview') {
                return Promise.resolve([]);
            }
            return this._super.apply(this, arguments);
        },
    });

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu').length, 1, "should have systray messaging menu");
    assert.notOk(document.querySelector('.o_mail_wip_systray_messaging_menu').classList.contains('show'), "should not mark systray messaging menu item as shown by default");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > a').length, 1, "should have clickable element on systray messaging menu");
    assert.notOk(document.querySelector('.o_mail_wip_systray_messaging_menu > a').classList.contains('show'), "should not mark systray messaging menu clickable item as shown by default");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > a > i').length, 1, "should have icon on clickable element in systray messaging menu");
    assert.ok(document.querySelector('.o_mail_wip_systray_messaging_menu > a > i').classList.contains('fa-comments-o'), "should have 'comments' icon on clickable element in systray messaging menu");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu').length, 0, "should not display any systray messaging menu dropdown by default");

    document.querySelector('.o_mail_wip_systray_messaging_menu > a').click();
    await testUtils.nextTick(); // re-render

    assert.ok(document.querySelector('.o_mail_wip_systray_messaging_menu').classList.contains('show'), "should mark systray messaging menu item as shown");
    assert.ok(document.querySelector('.o_mail_wip_systray_messaging_menu > a').classList.contains('show'), "should mark systray messaging menu clickable item as shown");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu').length, 1, "should display systray messaging menu dropdown after click");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header').length, 1, "should have dropdown menu header");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter').length, 3, "should have 3 buttons to filter items in the header");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="all"]').length, 1, "1 filter should be 'All'");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="chat"]').length, 1, "1 filter should be 'Chat'");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="channel"]').length, 1, "1 filter should be 'Channels'");
    assert.ok(document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="all"]').classList.contains('o_active'), "'all' filter should be active");
    assert.notOk(document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="chat"]').classList.contains('o_active'), "'chat' filter should not be active");
    assert.notOk(document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="channel"]').classList.contains('o_active'), "'channel' filter should not be active");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_new_message').length, 1, "should have button to make a new message");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list').length, 1, "should display thread preview list");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_no_conversation').length, 1, "should display no conversation in thread preview list");
});

QUnit.test('switch tab', async function (assert) {
    assert.expect(15);

    await this.create({
        mockRPC(route, args) {
            if (args.method === 'channel_fetch_preview') {
                return Promise.resolve([]);
            }
            return this._super.apply(this, arguments);
        },
    });

    document.querySelector('.o_mail_wip_systray_messaging_menu > a').click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="all"]').length, 1, "1 filter should be 'All'");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="chat"]').length, 1, "1 filter should be 'Chat'");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="channel"]').length, 1, "1 filter should be 'Channels'");
    assert.ok(document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="all"]').classList.contains('o_active'), "'all' filter should be active");
    assert.notOk(document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="chat"]').classList.contains('o_active'), "'chat' filter should not be active");
    assert.notOk(document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="channel"]').classList.contains('o_active'), "'channel' filter should not be active");

    document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="chat"]').click();
    await testUtils.nextTick(); // re-render

    assert.notOk(document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="all"]').classList.contains('o_active'), "'all' filter should become inactive");
    assert.ok(document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="chat"]').classList.contains('o_active'), "'chat' filter should not become active");
    assert.notOk(document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="channel"]').classList.contains('o_active'), "'channel' filter should stay inactive");

    document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="channel"]').click();
    await testUtils.nextTick(); // re-render

    assert.notOk(document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="all"]').classList.contains('o_active'), "'all' filter should stay active");
    assert.notOk(document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="chat"]').classList.contains('o_active'), "'chat' filter should become inactive");
    assert.ok(document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="channel"]').classList.contains('o_active'), "'channel' filter should become active");

    document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="all"]').click();
    await testUtils.nextTick(); // re-render

    assert.ok(document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="all"]').classList.contains('o_active'), "'all' filter should become active");
    assert.notOk(document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="chat"]').classList.contains('o_active'), "'chat' filter should stay inactive");
    assert.notOk(document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="channel"]').classList.contains('o_active'), "'channel' filter should become inactive");
});

QUnit.test('new message', async function (assert) {
    assert.expect(3);

    await this.create({
        mockRPC(route, args) {
            if (args.method === 'channel_fetch_preview') {
                return Promise.resolve([]);
            }
            return this._super.apply(this, arguments);
        },
    });

    document.querySelector('.o_mail_wip_systray_messaging_menu > a').click();
    await testUtils.nextTick(); // re-render

    document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_new_message').click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_chat_window_manager > .o_chat_window').length, 1, "should have open a chat window");
    assert.ok(document.querySelector('.o_mail_wip_chat_window_manager > .o_chat_window').classList.contains('o_new_message'), "chat window should be for new message");
    assert.ok(document.querySelector('.o_mail_wip_chat_window_manager > .o_chat_window').classList.contains('o_focused'), "chat window should be focused");
});

QUnit.test('no new message when discuss is open', async function (assert) {
    assert.expect(3);

    await this.create({
        autoOpenDiscuss: true,
        mockRPC(route, args) {
            if (args.method === 'channel_fetch_preview') {
                return Promise.resolve([]);
            }
            return this._super.apply(this, arguments);
        },
    });

    document.querySelector('.o_mail_wip_systray_messaging_menu > a').click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_new_message').length, 0, "should not have 'new message' when discuss is open");

    this.widget.closeDiscuss();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_new_message').length, 1, "should have 'new message' when discuss is closed");

    this.widget.openDiscuss();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_new_message').length, 0, "should not have 'new message' when discuss is open again");
});

QUnit.test('channel preview: basic rendering', async function (assert) {
    assert.expect(9);

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
                        record_name: "General",
                        res_id: 20,
                    },
                }]);
            }
            return this._super.apply(this, arguments);
        },
    });

    document.querySelector('.o_mail_wip_systray_messaging_menu > a').click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview').length, 1, "should have one preview");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview > .o_sidebar').length, 1, "preview should have a sidebar");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview > .o_content').length, 1, "preview should have some content");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview > .o_content > .o_header').length, 1, "preview should have header in content");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview > .o_content > .o_header > .o_name').length, 1, "preview should have name in header of content");
    assert.strictEqual(document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview > .o_content > .o_header > .o_name').textContent, "General", "preview should have name of channel");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview > .o_content > .o_core').length, 1, "preview should have core in content");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview > .o_content > .o_core > .o_inline_text').length, 1, "preview should have inline text in core of content");
    assert.strictEqual(document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview > .o_content > .o_core > .o_inline_text').textContent.trim(), "Demo: test", "preview should have message content as inline text of core content");
});

QUnit.test('filtered previews', async function (assert) {
    assert.expect(12);

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

    document.querySelector('.o_mail_wip_systray_messaging_menu > a').click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview').length, 2, "should have 2 previews");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview[data-thread-local-id="mail.channel_10"]').length, 1, "should have preview of chat");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview[data-thread-local-id="mail.channel_20"]').length, 1, "should have preview of channel");

    document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="chat"]').click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview').length, 1, "should have one preview");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview[data-thread-local-id="mail.channel_10"]').length, 1, "should have preview of chat");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview[data-thread-local-id="mail.channel_20"]').length, 0, "should not have preview of channel");

    document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="channel"]').click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview').length, 1, "should have one preview");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview[data-thread-local-id="mail.channel_10"]').length, 0, "should not have preview of chat");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview[data-thread-local-id="mail.channel_20"]').length, 1, "should have preview of channel");

    document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_header > .o_filter[data-filter="all"]').click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview').length, 2, "should have 2 previews");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview[data-thread-local-id="mail.channel_10"]').length, 1, "should have preview of chat");
    assert.strictEqual(document.querySelectorAll('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview[data-thread-local-id="mail.channel_20"]').length, 1, "should have preview of channel");
});

QUnit.test('open chat window from preview', async function (assert) {
    assert.expect(1);

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
                return Promise.resolve([]);
            }
            return this._super.apply(this, arguments);
        },
    });

    document.querySelector('.o_mail_wip_systray_messaging_menu > a').click();
    await testUtils.nextTick(); // re-render
    document.querySelector('.o_mail_wip_systray_messaging_menu > .dropdown-menu > .o_mail_wip_thread_preview_list > .o_preview').click();
    await testUtils.nextTick(); // re-render

    assert.strictEqual(document.querySelectorAll('.o_mail_wip_chat_window_manager > .o_chat_window').length, 1, "should have open a chat window");
});

});
});
