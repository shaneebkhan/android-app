(function () {
    'use strict';

    var TestToolbarMedia = class extends we3.AbstractPlugin {
        static get autoInstall() {
            return ['Test', 'TestToolbar', 'Text'];
        }

        constructor() {
            super(...arguments);
            this.dependencies = ['Test', 'TestToolbar'];

            // range collapsed: ◆
            // range start: ▶
            // range end: ◀

            var self = this;
            var _clickMedia = async function (callbackInit) {
                var $btnLink = $('we3-toolbar we3-button[name="image-dialog"]');
                await self.dependencies.Test.triggerNativeEvents($btnLink[0], ['mousedown', 'click']);
                await callbackInit();
            };
            var _editInput = async function (selector, value) {
                var $input = $(selector).first();
                $input.val(value);
                return self.dependencies.Test.triggerNativeEvents($input[0], ['input']);
            };
            var _uploadAndInsertImg = async function (url) {
                await _editInput('we3-modal input[name="url"]', url);
                await self.dependencies.Test.triggerNativeEvents($('we3-modal we3-button[data-method="_onURLButtonClick"]')[0], ['mousedown', 'click']);
                return self.dependencies.Test.triggerNativeEvents($('we3-modal we3-footer we3-button.we3-primary')[0], ['mousedown', 'click']);
            };

            this.toolbarTests = [
            {
                name: "Click ADD AN IMAGE URL in empty p: p -> img in p",
                async: true,
                content: '<p>◆</p>',
                do: async function (assert, testName) {
                    await _clickMedia(async function() {
                        await _uploadAndInsertImg('https://www.odoo.com/logo.png');
                        assert.strictEqual($('we3-popover[name="Image"]').css('display'), 'flex', testName + ' (popover)');
                    });
                },
                test: '<p>▶<img title="https://www.odoo.com/logo.png" alt="https://www.odoo.com/logo.png" src="https://www.odoo.com/logo.png" class="img-fluid o_image o_we_custom_image"/>◀</p>',
            },
            {
                name: "add an image in a table",
                async: true,
                content: '<section><div class="container"><div class="row"><div class="col-lg-6">' +
                    '<table class="table table-bordered">' +
                    '    <tbody>' +
                    '        <tr>' +
                    '            <td>' +
                    '                aaa' +
                    '            </td>' +
                    '            <td>' +
                    '                bb◆b' +
                    '            </td>' +
                    '            <td>' +
                    '                ccc' +
                    '            </td>' +
                    '        </tr>' +
                    '    </tbody>' +
                    '</table>' +
                    '</div></div></div></section>',
                do: async function () {
                    await _clickMedia(async function () {
                        await _uploadAndInsertImg('https://www.odoo.com/logo.png');
                    });
                },
                test: '<section><div class="container"><div class="row"><div class="col-lg-6">' +
                        '<table class="table table-bordered">' +
                            '<tbody>' +
                                '<tr>' +
                                    '<td>' +
                                        'aaa' +
                                    '</td>' +
                                    '<td>' +
                                        'bb<img title="https://www.odoo.com/logo.png" alt="https://www.odoo.com/logo.png" src="https://www.odoo.com/logo.png" class="img-fluid o_image o_we_custom_image"/>◆b' +
                                    '</td>' +
                                    '<td>' +
                                        'ccc' +
                                    '</td>' +
                                '</tr>' +
                            '</tbody>' +
                        '</table>' +
                        '</div></div></div></section>',
            },
            // BR IS NOT REMOVED AND IS ALWAYS PUT FIRST ?
            // {
            //     name: "add an image in an empty table",
            //     async: true,
            //     content: '<section><div class="container"><div class="row"><div class="col-lg-6">' +
            //         '<table class="table table-bordered">' +
            //         '    <tbody>' +
            //         '        <tr>' +
            //         '            <td>' +
            //         '                <br/>' +
            //         '            </td>' +
            //         '            <td>' +
            //         '                ◆<br/>' +
            //         '            </td>' +
            //         '            <td>' +
            //         '                <br/>' +
            //         '            </td>' +
            //         '        </tr>' +
            //         '    </tbody>' +
            //         '</table>' +
            //         '</div></div></div></section>',
            //     do: async function () {
            //         await _clickMedia(async function () {
            //             await _uploadAndInsertImg('https://www.odoo.com/logo.png');
            //         });
            //     },
            //     test: '<section><div class="container"><div class="row"><div class="col-lg-6">' +
            //             '<table class="table table-bordered">' +
            //                 '<tbody>' +
            //                     '<tr>' +
            //                         '<td>' +
            //                             '<br/>' +
            //                         '</td>' +
            //                         '<td>' +
            //                             '▶<img title="https://www.odoo.com/logo.png" alt="https://www.odoo.com/logo.png" src="https://www.odoo.com/logo.png" class="img-fluid o_image o_we_custom_image"/>◀<br/>' +
            //                         '</td>' +
            //                         '<td>' +
            //                             '<br/>' +
            //                         '</td>' +
            //                     '</tr>' +
            //                 '</tbody>' +
            //             '</table>' +
            //             '</div></div></div></section>',
            // },
            /* IMAGE POPOVER */
            {
                name: "Click PADDING XL in popover after adding image in empty p",
                async: true,
                content: '<p>◆</p>',
                do: async function () {
                    await _clickMedia(async function () {
                        await _uploadAndInsertImg('https://www.odoo.com/logo.png');
                        await self.dependencies.Test.triggerNativeEvents($('we3-popover[name="Image"] we3-toggler[title="Padding"]')[0], ['mousedown', 'click']);
                        await self.dependencies.Test.triggerNativeEvents($('we3-popover[name="Image"] we3-button[name="padding-xl"]')[0], ['mousedown', 'click']);
                    });
                },
                test: '<p>▶<img title="https://www.odoo.com/logo.png" alt="https://www.odoo.com/logo.png" src="https://www.odoo.com/logo.png" class="img-fluid o_image o_we_custom_image padding-xl"/>◀</p>',
            },
            {
                name: "Click IMAGE SIZE 25% in popover after adding image in empty p",
                async: true,
                content: '<p>◆</p>',
                do: async function () {
                    await _clickMedia(async function () {
                        await _uploadAndInsertImg('https://www.odoo.com/logo.png');
                        await self.dependencies.Test.triggerNativeEvents($('we3-popover[name="Image"] we3-button[name="size-25"]')[0], ['mousedown', 'click']);
                    });
                },
                test: '<p>▶<img title="https://www.odoo.com/logo.png" alt="https://www.odoo.com/logo.png" src="https://www.odoo.com/logo.png" class="img-fluid o_image o_we_custom_image" style="width:25%"/>◀</p>',
            },
            {
                name: "Click FLOAT RIGHT in popover after adding image in empty p",
                async: true,
                content: '<p>◆</p>',
                do: async function () {
                    await _clickMedia(async function () {
                        await _uploadAndInsertImg('https://www.odoo.com/logo.png');
                        await self.dependencies.Test.triggerNativeEvents($('we3-popover[name="Image"] we3-button[name="align-right"]')[0], ['mousedown', 'click']);
                    });
                },
                test: '<p>▶<img title="https://www.odoo.com/logo.png" alt="https://www.odoo.com/logo.png" src="https://www.odoo.com/logo.png" class="img-fluid o_image o_we_custom_image pull-right"/>◀</p>',
            },
            {
                name: "Click FLOAT CENTER then FLOAT LEFT in popover after adding image in empty p",
                async: true,
                content: '<p>◆</p>',
                do: async function () {
                    await _clickMedia(async function () {
                        await _uploadAndInsertImg('https://www.odoo.com/logo.png');
                        await self.dependencies.Test.triggerNativeEvents($('we3-popover[name="Image"] we3-button[name="align-center"]')[0], ['mousedown', 'click']);
                        await self.dependencies.Test.triggerNativeEvents($('we3-popover[name="Image"] we3-button[name="align-left"]')[0], ['mousedown', 'click']);
                    });
                },
                test: '<p>▶<img title="https://www.odoo.com/logo.png" alt="https://www.odoo.com/logo.png" src="https://www.odoo.com/logo.png" class="img-fluid o_image o_we_custom_image pull-left"/>◀</p>',
            },
            {
                name: "Click SHAPE ROUNDED in popover after adding image in empty p",
                async: true,
                content: '<p>◆</p>',
                do: async function () {
                    await _clickMedia(async function () {
                        await _uploadAndInsertImg('https://www.odoo.com/logo.png');
                        await self.dependencies.Test.triggerNativeEvents($('we3-popover[name="Image"] we3-button[name="rounded-circle"]')[0], ['mousedown', 'click']);
                    });
                },
                test: '<p>▶<img title="https://www.odoo.com/logo.png" alt="https://www.odoo.com/logo.png" src="https://www.odoo.com/logo.png" class="img-fluid o_image o_we_custom_image rounded-circle"/>◀</p>',
            },
            // Remove picture
            {
                name: "Click REMOVE in popover after adding image in empty p",
                async: true,
                content: '<p>◆</p>',
                do: async function () {
                    await _clickMedia(async function () {
                        await _uploadAndInsertImg('https://www.odoo.com/logo.png');
                        await self.dependencies.Test.triggerNativeEvents($('we3-popover[name="Image"] we3-button[name="image-remove"]')[0], ['mousedown', 'click']);
                    });
                },
                test: '<p>◆</p>',
            },
            // NOT IMPLEMENTED YET
            // Describe picture
            // {
            //     name: "Click DESCRIPTION in popover after adding image in empty p",
            //     async: true,
            //     content: '<p>◆</p>',
            //     do: async function () {
            //         await _clickMedia(async function () {
            //             await _uploadAndInsertImg('https://www.odoo.com/logo.png');
            //             await self.dependencies.Test.triggerNativeEvents($('we3-popover[name="Image"] we3-button[data-method="alt"]')[0], ['mousedown', 'click']);
            //             $('we3-modal input#alt').val('Description');
            //             $('we3-modal input#title').val('Title');
            //             await self.dependencies.Test.triggerNativeEvents($('we3-modal we3-footer we3-button.we3-primary')[0], ['mousedown', 'click']);
            //         });
            //     },
            //     test: '<p>▶<img title="Title" alt="Description" src="https://www.odoo.com/logo.png" class="img-fluid o_we_custom_image">◀</p>',
            // },
            ];
        }

        start() {
            this.dependencies.Test.add(this);
            return super.start();
        }

        test(assert) {
            var wysiwyg = document.getElementsByTagName('we3-editor')[0];
            this.foreColorDropdown = wysiwyg.querySelector('we3-dropdown[name="Color"]');
            this.foreColorToggler = this.foreColorDropdown.querySelector('we3-toggler');
            return this.dependencies.TestToolbar.test(assert, this.toolbarTests);
        }
    };

    we3.addPlugin('TestToolbarMedia', TestToolbarMedia);

})();
