odoo.define('mail.wip.chat_window_manager_tests', function (require) {
"use strict";

const {
    afterEach: utilsAfterEach,
    beforeEach: utilsBeforeEach,
    createChatWindowManager,
} = require('mail.wip.test_utils');

// const testUtils = require('web.test_utils');

/**
 * Consider integration with systray messaging menu
 */
QUnit.module('mail.wip', {}, function () {
QUnit.module('ChatWindowManager', {
    beforeEach() {
        utilsBeforeEach(this);
        this.createChatWindowManager = async params => {
            if (this.widget) {
                this.widget.destroy();
            }
            this.widget = await createChatWindowManager({ ...params, data: this.data });
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

    await this.createChatWindowManager();

    assert.strictEqual(document.querySelectorAll('.o_wip_chat_window_manager').length, 1, "should have chat window manager");
});

});
});
