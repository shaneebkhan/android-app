odoo.define('mail.wip.systray_messaging_menu_tests', function (require) {
"use strict";

const {
    afterEach: utilsAfterEach,
    beforeEach: utilsBeforeEach,
    createSystrayMessagingMenu,
} = require('mail.wip.test_utils');

const testUtils = require('web.test_utils');

QUnit.module('mail.wip', {}, function () {
QUnit.module('SystrayMessagingMenu', {
    beforeEach() {
        utilsBeforeEach(this);
        this.createMenu = async params => {
            if (this.menu) {
                this.menu.destroy();
            }
            this.menu = await createSystrayMessagingMenu({ ...params, data: this.data });
        };
    },
    afterEach() {
        utilsAfterEach(this);
        if (this.menu) {
            this.menu.destroy();
        }
    }
});

QUnit.test('basic rendering', async function (assert) {
    assert.expect(21);

    await this.createMenu({
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

    await this.createMenu({
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

});
});
