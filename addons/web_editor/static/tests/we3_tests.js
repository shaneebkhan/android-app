odoo.define('web_editor.we3_tests', function (require) {
"use strict";

var ajax = require('web.ajax');
var FormView = require('web.FormView');
var testUtils = require('web.test_utils');
var weTestUtils = require('web_editor.test_utils');
var Wysiwyg = require('web_editor.wysiwyg');
var AltDialog = require('wysiwyg.widgets.AltDialog');
var CropDialog = require('wysiwyg.widgets.CropImageDialog');


QUnit.module('web_editor', {
    beforeEach: function () {
        this.data = weTestUtils.wysiwygData({
            'note.note': {
                fields: {
                    display_name: {
                        string: "Displayed name",
                        type: "char"
                    },
                    body: {
                        string: "Message",
                        type: "html"
                    },
                },
                records: [{
                    id: 1,
                    display_name: "first record",
                    body: "<p>toto toto toto</p><p>tata</p>",
                }],
            },
        });

        testUtils.mock.patch(ajax, {
            loadAsset: function (xmlId) {
                if (xmlId === 'template.assets') {
                    return Promise.resolve({
                        cssLibs: [],
                        cssContents: ['body {background-color: red;}']
                    });
                }
                if (xmlId === 'template.assets_all_style') {
                    return Promise.resolve({
                        cssLibs: $('link[href]:not([type="image/x-icon"])').map(function () {
                            return $(this).attr('href');
                        }).get(),
                        cssContents: ['body {background-color: red;}']
                    });
                }
                throw 'Wrong template';
            },
        });

        var self = this;
        testUtils.mock.patch(Wysiwyg, {
            init: function () {
                this._super(...arguments);

                this.options = Object.assign({}, this.options, {
                    plugins: Object.assign({}, this.options.plugins, self.testOptions.plugins, {
                        Test: true,
                    }),
                    test: Object.assign({
                        callback: self.testOptions.resolve,
                        auto: true,
                        assert: self.testOptions.assert,
                    }, this.options.test),
                });
            }
        });

        testUtils.mock.patch(AltDialog, {
            init: function () {
                this._super.apply(this, arguments);
                altDialogOpened = this._opened;
            },
            save: function () {
                altDialogSaved = this._super.apply(this, arguments);
                return altDialogSaved;
            },
        });

        testUtils.mock.patch(CropDialog, {
            init: function () {
                var self = this;
                this._super.apply(this, arguments);
                cropDialogOpened = new Promise(function (resolve) {
                    self.opened(function () {
                        var cropper = self.$cropperImage.data('cropper');
                        cropper.clone();
                        $.extend(cropper.image, {
                            naturalWidth: imgWidth,
                            naturalHeight: imgHeight,
                            aspectRatio: imgWidth / imgHeight,
                        });
                        cropper.loaded = true;
                        cropper.build();
                        cropper.render();
                        resolve();
                    });
                });
            },
        });
    },
    afterEach: function () {
        testUtils.mock.unpatch(Wysiwyg);
        testUtils.mock.unpatch(ajax);
        testUtils.mock.unpatch(AltDialog);
        testUtils.mock.unpatch(CropDialog);
    },
}, function () {

    QUnit.module('default rendering & options');

    var testPlugins = {
        TestPopover: false,
        TestRange: false,
        TestArchAndRules: false,
        TestToolbarWand: false,
        TestToolbarFontStyle: false,
        TestToolbarLink: false,
        TestKeyboardUnbreakable: false,
        TestKeyboardTab: false,
        TestKeyboardEnter: false,
        TestKeyboardDelete: false,
        TestKeyboardComplex: false,
        TestKeyboardChar: false,
        TestKeyboardBackspace: false,
    };

    async function createFormAndTest (self) {
        var promise = new Promise((resolve) => self.testOptions.resolve = resolve);

        var form = await testUtils.createView({
            View: FormView,
            model: 'note.note',
            data: self.data,
            arch: '<form><field name="body" widget="html" style="height: 100px"/></form>',
            mockRPC: function (route, args) {
                if (route.indexOf('data:image/png;base64') === 0) {
                    return Promise.resolve();
                }
                if (route.indexOf('youtube') !== -1) {
                    return Promise.resolve();
                }
                if (route.indexOf('/web_editor/static/src/img/') === 0) {
                    return Promise.resolve();
                }
                if (route === '/web_editor/attachment/add_url') {
                    return Promise.resolve({
                        id: 1,
                        public: true,
                        name: 'image',
                        mimetype: 'image/png',
                        checksum: false,
                        url: '/web_editor/static/src/img/transparent.png',
                        image_src: '/web_editor/static/src/img/transparent.png',
                        type: 'url',
                        res_id: 0,
                        res_model: false,
                        access_token: false,
                    });
                }
                return this._super(route, args);
            },
        });
        await promise;
        form.destroy();
        return promise;
    }

    QUnit.test('popover', async function (assert) {
        assert.expect(19);
        this.testOptions = {
            assert: assert,
            plugins: Object.assign({}, testPlugins, {TestPopover: true}),
        };
        await createFormAndTest(this);
    });
    QUnit.test('range', async function (assert) {
        assert.expect(8);
        this.testOptions = {
            assert: assert,
            plugins: Object.assign({}, testPlugins, {TestRange: true}),
        };
        await createFormAndTest(this);
    });
    QUnit.test('rules', async function (assert) {
        assert.expect(43);
        this.testOptions = {
            assert: assert,
            plugins: Object.assign({}, testPlugins, {TestArchAndRules: true}),
        };
        await createFormAndTest(this);
    });
    QUnit.test('toolbar link', async function (assert) {
        assert.expect(17);
        this.testOptions = {
            assert: assert,
            plugins: Object.assign({}, testPlugins, { TestToolbarLink: true }),
        };
        await createFormAndTest(this);
    });
    QUnit.test('toolbar wand', async function (assert) {
        assert.expect(18);
        this.testOptions = {
            assert: assert,
            plugins: Object.assign({}, testPlugins, {TestToolbarWand: true}),
        };
        await createFormAndTest(this);
    });
    QUnit.test('toolbar style', async function (assert) {
        assert.expect(28);
        this.testOptions = {
            assert: assert,
            plugins: Object.assign({}, testPlugins, {TestToolbarFontStyle: true}),
        };
        await createFormAndTest(this);
    });
    QUnit.test('unbreakable', async function (assert) {
        assert.expect(24);
        this.testOptions = {
            assert: assert,
            plugins: Object.assign({}, testPlugins, {TestKeyboardUnbreakable: true}),
        };
        await createFormAndTest(this);
    });
    QUnit.test('keyboard char', async function (assert) {
        assert.expect(34);
        this.testOptions = {
            assert: assert,
            plugins: Object.assign({}, testPlugins, {TestKeyboardChar: true}),
        };
        await createFormAndTest(this);
    });
    QUnit.test('keyboard tab', async function (assert) {
        assert.expect(15);
        this.testOptions = {
            assert: assert,
            plugins: Object.assign({}, testPlugins, {TestKeyboardTab: true}),
        };
        await createFormAndTest(this);
    });
    QUnit.test('keyboard enter', async function (assert) {
        assert.expect(63);
        this.testOptions = {
            assert: assert,
            plugins: Object.assign({}, testPlugins, {TestKeyboardEnter: true}),
        };
        await createFormAndTest(this);
    });
    QUnit.test('keyboard delete', async function (assert) {
        assert.expect(77);
        this.testOptions = {
            assert: assert,
            plugins: Object.assign({}, testPlugins, {TestKeyboardDelete: true}),
        };
        await createFormAndTest(this);
    });
    QUnit.test('keyboard complex dom', async function (assert) {
        assert.expect(21);
        this.testOptions = {
            assert: assert,
            plugins: Object.assign({}, testPlugins, {TestKeyboardComplex: true}),
        };
        await createFormAndTest(this);
    });
    QUnit.test('keyboard backspace', async function (assert) {
        assert.expect(95 - 1);
        this.testOptions = {
            assert: assert,
            plugins: Object.assign({}, testPlugins, {TestKeyboardBackspace: true}),
        };
        await createFormAndTest(this);
    });

    QUnit.module('DropBlock plugins');

    var toolbarDropBlock = [
        'DropBlock',
        'FontStyle',
        'FontSize',
        'ForeColor', 'BgColor',
        'List',
        'Paragraph',
        'TablePicker',
        'LinkCreate',
        'Media',
        'History',
        'CodeView',
        'FullScreen',
        'KeyMap',
        'Test',
    ];

    QUnit.test('range + popover + rules + char + DropBlock', async function (assert) {
        assert.expect(92);

        this.testOptions = {
            assert: assert,
            plugins: Object.assign({}, testPlugins, {
                TestRange: true,
                TestPopover: true,
                TestArchAndRules: true,
                TestKeyboardChar: true,
            }),
            toolbar: toolbarDropBlock,
        };
        await createFormAndTest(this);
    });

    QUnit.test('DropBlock & DropBlockSelector', async function (assert) {
        assert.expect(34);

        this.testOptions = {
            assert: assert,
            plugins: Object.assign({
                DropBlockSelector: true,
            }, testPlugins, {
                TestKeyboardChar: true,
            }),
            toolbar: toolbarDropBlock,
        };
        await createFormAndTest(this);
    });

    QUnit.test('DropBlock & CustomizeBlock', async function (assert) {
        assert.expect(49);

        this.testOptions = {
            assert: assert,
            plugins: Object.assign({
                CustomizeBlock: true,
            }, testPlugins, {
                TestPopover: true,
                TestKeyboardChar: true,
            }),
            toolbar: toolbarDropBlock,
        };
        await createFormAndTest(this);
    });

    QUnit.module('Media');

    QUnit.test('Image', async function (assert) {
        assert.expect(14);
        this.testOptions = {
            assert: assert,
            plugins: Object.assign({}, testPlugins, { TestToolbarMedia: true }),
        };
        await createFormAndTest(this);
    });

});

});
