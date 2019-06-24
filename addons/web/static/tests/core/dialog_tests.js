odoo.define('web.dialog_tests', function (require) {
"use strict";

var Dialog = require('web.Dialog');
var testUtils = require('web.test_utils');
var Widget = require('web.Widget');

var ESCAPE_KEY = $.Event("keyup", { which: 27 });

function createEmptyParent(debug) {
    var widget = new Widget();

    testUtils.mock.addMockEnvironment(widget, {
        debug: debug || false,
    });
    return widget;
}

QUnit.module('core', {}, function () {

    QUnit.module('Dialog');

    QUnit.test("Closing custom dialog without using buttons calls force close callback", async function (assert) {
        assert.expect(3);

        var testPromise = testUtils.makeTestPromiseWithAssert(assert, 'custom callback');
        var parent = createEmptyParent();
        new Dialog(parent, {
            $content: $('<main/>'),
            onForceClose: testPromise.reject,
        }).open();

        assert.verifySteps([]);

        await testUtils.nextTick();
        await testUtils.dom.triggerEvents($('.modal[role="dialog"]'), [ESCAPE_KEY]);

        testPromise.catch(() => {
            assert.verifySteps(['ko custom callback']);
        });

        parent.destroy();
    });

    QUnit.test("Closing confirm dialog without using buttons calls cancel callback", async function (assert) {
        assert.expect(3);

        var testPromise = testUtils.makeTestPromiseWithAssert(assert, 'confirm callback');
        var parent = createEmptyParent();
        var options = {
            confirm_callback: testPromise.resolve,
            cancel_callback: testPromise.reject,
        };
        Dialog.confirm(parent, "", options);

        assert.verifySteps([]);
        
        await testUtils.nextTick();
        await testUtils.dom.triggerEvents($('.modal[role="dialog"]'), [ESCAPE_KEY]);

        testPromise.catch(() => {
            assert.verifySteps(['ko confirm callback']);
        });

        parent.destroy();
    });

    QUnit.test("Closing alert dialog without using buttons calls confirm callback", async function (assert) {
        assert.expect(3);

        var testPromise = testUtils.makeTestPromiseWithAssert(assert, 'alert callback');
        var parent = createEmptyParent();
        var options = {
            confirm_callback: testPromise.resolve,
        };
        Dialog.alert(parent, "", options);

        assert.verifySteps([]);

        await testUtils.nextTick();
        await testUtils.dom.triggerEvents($('.modal[role="dialog"]'), [ESCAPE_KEY]);

        testPromise.then(() => {
            assert.verifySteps(['ok alert callback']);
        });

        parent.destroy();
    });
});

});
