odoo.define('web.view_dialogs_tests', function (require) {
"use strict";

var dialogs = require('web.view_dialogs');
var ListController = require('web.ListController');
var testUtils = require('web.test_utils');
var Widget = require('web.Widget');
var FormView = require('web.FormView');

var createView = testUtils.createView;

QUnit.module('Views', {
    beforeEach: function () {
        this.data = {
            partner: {
                fields: {
                    display_name: { string: "Displayed name", type: "char" },
                    foo: {string: "Foo", type: 'char'},
                    bar: {string: "Bar", type: "boolean"},
                    instrument: {string: 'Instruments', type: 'many2one', relation: 'instrument'},
                },
                records: [
                    {id: 1, foo: 'blip', display_name: 'blipblip', bar: true},
                    {id: 2, foo: 'ta tata ta ta', display_name: 'macgyver', bar: false},
                    {id: 3, foo: 'piou piou', display_name: "Jack O'Neill", bar: true},
                ],
            },
            instrument: {
                fields: {
                    name: {string: "name", type: "char"},
                    badassery: {string: 'level', type: 'many2many', relation: 'badassery', domain: [['level', '=', 'Awsome']]},
                    sub_instrument: {string: 'Instruments', type: 'many2one', relation: 'instrument'},
                },
            },

            badassery: {
                fields: {
                    level: {string: 'level', type: "char"},
                },
                records: [
                    {id: 1, level: 'Awsome'},
                ],
            },

            product: {
                fields : {
                    name: {string: "name", type: "char" },
                    partner : {string: 'Doors', type: 'one2many', relation: 'partner'},
                },
                records: [
                    {id: 1, name: 'The end'},
                ],
            },
        };
    },
}, function () {

    QUnit.module('view_dialogs');

    function createParent(params) {
        var widget = new Widget();

        testUtils.mock.addMockEnvironment(widget, params);
        return widget;
    }

    QUnit.test('formviewdialog buttons in footer are positioned properly', async function (assert) {
        assert.expect(2);

        var parent = createParent({
            data: this.data,
            archs: {
                'partner,false,form':
                    '<form string="Partner">' +
                        '<sheet>' +
                            '<group><field name="foo"/></group>' +
                            '<footer><button string="Custom Button" type="object" class="btn-primary"/></footer>' +
                        '</sheet>' +
                    '</form>',
            },
        });

        new dialogs.FormViewDialog(parent, {
            res_model: 'partner',
            res_id: 1,
        }).open();
        await testUtils.nextTick();

        assert.notOk($('.modal-body button').length,
            "should not have any button in body");
        assert.strictEqual($('.modal-footer button').length, 1,
            "should have only one button in footer");
        parent.destroy();
    });

    QUnit.test('formviewdialog buttons in footer are not duplicated', async function (assert) {
        assert.expect(2);
        this.data.partner.fields.poney_ids = {string: "Poneys", type: "one2many", relation: 'partner'};
        this.data.partner.records[0].poney_ids = [];

        var parent = createParent({
            data: this.data,
            archs: {
                'partner,false,form':
                    '<form string="Partner">' +
                            '<field name="poney_ids"><tree editable="top"><field name="display_name"/></tree></field>' +
                            '<footer><button string="Custom Button" type="object" class="btn-primary"/></footer>' +
                    '</form>',
            },
        });

        new dialogs.FormViewDialog(parent, {
            res_model: 'partner',
            res_id: 1,
        }).open();
        await testUtils.nextTick();

        assert.strictEqual($('.modal button.btn-primary').length, 1,
            "should have 1 buttons in modal");

        await testUtils.dom.click($('.o_field_x2many_list_row_add a'));
        await testUtils.fields.triggerKeydown($('input.o_input'), 'escape');

        assert.strictEqual($('.modal button.btn-primary').length, 1,
            "should still have 1 buttons in modal");
        parent.destroy();
    });

    QUnit.test('SelectCreateDialog use domain, group_by and search default', async function (assert) {
        assert.expect(3);

        var search = 0;
        var parent = createParent({
            data: this.data,
            archs: {
                'partner,false,list':
                    '<tree string="Partner">' +
                        '<field name="display_name"/>' +
                        '<field name="foo"/>' +
                    '</tree>',
                'partner,false,search':
                    '<search>' +
                        '<field name="foo" filter_domain="[(\'display_name\',\'ilike\',self), (\'foo\',\'ilike\',self)]"/>' +
                        '<group expand="0" string="Group By">' +
                            '<filter name="groupby_bar" context="{\'group_by\' : \'bar\'}"/>' +
                        '</group>' +
                    '</search>',
            },
            mockRPC: function (route, args) {
                if (args.method === 'web_read_group') {
                    assert.deepEqual(args.kwargs, {
                        context: {},
                        domain: [["display_name", "like", "a"], "&", ["display_name", "ilike", "piou"], ["foo", "ilike", "piou"]],
                        fields: ["display_name", "foo", "bar"],
                        groupby: ["bar"],
                        orderby: '',
                        lazy: true,
                        limit: 80,
                    }, "should search with the complete domain (domain + search), and group by 'bar'");
                }
                if (search === 0 && route === '/web/dataset/search_read') {
                    search++;
                    assert.deepEqual(args, {
                        context: {'bin_size': true},  // not part of the test, may change
                        domain: [["display_name", "like", "a"], "&", ["display_name", "ilike", "piou"], ["foo", "ilike", "piou"]],
                        fields: ["display_name", "foo"],
                        model: "partner",
                        limit: 80,
                        sort: ""
                    }, "should search with the complete domain (domain + search)");
                } else if (search === 1 && route === '/web/dataset/search_read') {
                    assert.deepEqual(args, {
                        context: {'bin_size': true},  // not part of the test, may change
                        domain: [["display_name", "like", "a"]],
                        fields: ["display_name", "foo"],
                        model: "partner",
                        limit: 80,
                        sort: ""
                    }, "should search with the domain");
                }

                return this._super.apply(this, arguments);
            },
        });

        var dialog;
        new dialogs.SelectCreateDialog(parent, {
            no_create: true,
            readonly: true,
            res_model: 'partner',
            domain: [['display_name', 'like', 'a']],
            context: {
                search_default_groupby_bar: true,
                search_default_foo: 'piou',
            },
        }).open().then(function (result) {
            dialog = result;
        });
        await testUtils.nextTick();

        await testUtils.dom.click(dialog.$('.o_searchview_facet:contains(groupby_bar) .o_facet_remove'));
        await testUtils.dom.click(dialog.$('.o_searchview_facet .o_facet_remove'));

        parent.destroy();
    });

    QUnit.test('SelectCreateDialog correctly evaluates domains', async function (assert) {
        assert.expect(1);

        var parent = createParent({
            data: this.data,
            archs: {
                'partner,false,list':
                    '<tree string="Partner">' +
                        '<field name="display_name"/>' +
                        '<field name="foo"/>' +
                    '</tree>',
                'partner,false,search':
                    '<search>' +
                        '<field name="foo"/>' +
                    '</search>',
            },
            mockRPC: function (route, args) {
                if (route === '/web/dataset/search_read') {
                    assert.deepEqual(args.domain, [['id', '=', 2]],
                        "should have correctly evaluated the domain");
                }
                return this._super.apply(this, arguments);
            },
            session: {
                user_context: {uid: 2},
            },
        });

        new dialogs.SelectCreateDialog(parent, {
            no_create: true,
            readonly: true,
            res_model: 'partner',
            domain: "[['id', '=', uid]]",
        }).open();
        await testUtils.nextTick();

        parent.destroy();
    });

    QUnit.test('SelectCreateDialog list view in readonly', async function (assert) {
        assert.expect(1);

        var parent = createParent({
            data: this.data,
            archs: {
                'partner,false,list':
                    '<tree string="Partner" editable="bottom">' +
                        '<field name="display_name"/>' +
                        '<field name="foo"/>' +
                    '</tree>',
                'partner,false,search':
                    '<search/>'
            },
        });

        var dialog;
        new dialogs.SelectCreateDialog(parent, {
            res_model: 'partner',
        }).open().then(function (result) {
            dialog = result;
        });
        await testUtils.nextTick();

        // click on the first row to see if the list is editable
        await testUtils.dom.click(dialog.$('.o_list_view tbody tr:first td:not(.o_list_record_selector):first'));

        assert.equal(dialog.$('.o_list_view tbody tr:first td:not(.o_list_record_selector):first input').length, 0,
            "list view should not be editable in a SelectCreateDialog");

        parent.destroy();
    });

    QUnit.test('SelectCreateDialog cascade x2many in create mode', async function (assert) {
        assert.expect(5);

        var form = await createView({
            View: FormView,
            model: 'product',
            data: this.data,
            arch: '<form>' +
                     '<field name="name"/>' +
                     '<field name="partner" widget="one2many" >' +
                        '<tree editable="top">' +
                            '<field name="display_name"/>' +
                            '<field name="instrument"/>' +
                        '</tree>' +
                    '</field>' +
                  '</form>',
            res_id: 1,
            archs: {
                'partner,false,form': '<form>' +
                                           '<field name="name"/>' +
                                           '<field name="instrument" widget="one2many" mode="tree"/>' +
                                        '</form>',

                'instrument,false,form': '<form>'+
                                            '<field name="name"/>'+
                                            '<field name="badassery">' +
                                                '<tree>'+
                                                    '<field name="level"/>'+
                                                '</tree>' +
                                            '</field>' +
                                        '</form>',

                'badassery,false,list': '<tree>'+
                                                '<field name="level"/>'+
                                            '</tree>',

                'badassery,false,search': '<search>'+
                                                '<field name="level"/>'+
                                            '</search>',
            },

            mockRPC: function(route, args) {
                if (route === '/web/dataset/call_kw/partner/get_formview_id') {
                    return Promise.resolve(false);
                }
                if (route === '/web/dataset/call_kw/instrument/get_formview_id') {
                    return Promise.resolve(false);
                }
                if (route === '/web/dataset/call_kw/instrument/create') {
                    assert.deepEqual(args.args, [{badassery: [[6, false, [1]]], name: false}],
                        'The method create should have been called with the right arguments');
                    return Promise.resolve(false);
                }
                return this._super(route, args);
            },
        });

        await testUtils.form.clickEdit(form);
        await testUtils.dom.click(form.$('.o_field_x2many_list_row_add a'));
        await testUtils.dom.click(form.$('.o_field_widget .o_field_many2one[name=instrument] input'));
        await testUtils.dom.click($('ul.ui-autocomplete.ui-front.ui-menu.ui-widget.ui-widget-content li.o_m2o_dropdown_option').first());

        var $modal = $('.modal-lg');

        assert.equal($modal.length, 1,
            'There should be one modal');

        await testUtils.dom.click($modal.find('.o_field_x2many_list_row_add a'));

        var $modals = $('.modal-lg');

        assert.equal($modals.length, 2,
            'There should be two modals');

        var $second_modal = $modals.not($modal);
        await testUtils.dom.click($second_modal.find('.o_list_table.table.table-sm.table-striped.o_list_table_ungrouped .o_data_row input[type=checkbox]'));

        await testUtils.dom.click($second_modal.find('.o_select_button'));

        $modal = $('.modal-lg');

        assert.equal($modal.length, 1,
            'There should be one modal');

        assert.equal($modal.find('.o_data_cell').text(), 'Awsome',
            'There should be one item in the list of the modal');

        await testUtils.dom.click($modal.find('.btn.btn-primary'));

        form.destroy();
    });

    QUnit.test('Form dialog and subview with _view_ref contexts', async function (assert) {
        assert.expect(2);

        this.data.instrument.records = [{id: 1, name: 'Tromblon', badassery: [1]}];
        this.data.partner.records[0].instrument = 1;

        var form = await createView({
            View: FormView,
            model: 'partner',
            data: this.data,
            arch: '<form>' +
                     '<field name="name"/>' +
                     '<field name="instrument" context="{\'tree_view_ref\': \'some_tree_view\'}"/>' +
                  '</form>',
            res_id: 1,
            archs: {
                'instrument,false,form': '<form>'+
                                            '<field name="name"/>'+
                                            '<field name="badassery" context="{\'tree_view_ref\': \'some_other_tree_view\'}"/>' +
                                        '</form>',

                'badassery,false,list': '<tree>'+
                                                '<field name="level"/>'+
                                            '</tree>',
            },
            viewOptions: {
                mode: 'edit',
            },

            mockRPC: function(route, args) {
                if (args.method === 'get_formview_id') {
                    return Promise.resolve(false);
                }
                return this._super(route, args);
            },

            interceptsPropagate: {
                load_views: function (ev) {
                    var evaluatedContext = ev.data.context;
                    if (ev.data.modelName === 'instrument') {
                        assert.deepEqual(evaluatedContext, {tree_view_ref: 'some_tree_view'},
                            'The correct _view_ref should have been sent to the server, first time');
                    }
                    if (ev.data.modelName === 'badassery') {
                        assert.deepEqual(evaluatedContext, {tree_view_ref: 'some_other_tree_view'},
                            'The correct _view_ref should have been sent to the server for the subview');
                    }
                },
            },
        });

        await testUtils.dom.click(form.$('.o_field_widget[name="instrument"] button.o_external_button'));
        form.destroy();
    });

    QUnit.test('SelectCreateDialog: save current search', async function (assert) {
        assert.expect(4);

        testUtils.mock.patch(ListController, {
            getOwnedQueryParams: function () {
                return {
                    context: {
                        shouldBeInFilterContext: true,
                    },
                };
            },
        });

        var parent = createParent({
            data: this.data,
            archs: {
                'partner,false,list':
                    '<tree>' +
                        '<field name="display_name"/>' +
                    '</tree>',
                'partner,false,search':
                    '<search>' +
                       '<filter name="bar" help="Bar" domain="[(\'bar\', \'=\', True)]"/>' +
                    '</search>',

            },
            intercepts: {
                create_filter: function (event) {
                    var filter = event.data.filter;
                    assert.deepEqual(filter.domain, `[("bar", "=", True)]`,
                        "should save the correct domain");
                    assert.deepEqual(filter.context, {shouldBeInFilterContext: true},
                        "should save the correct context");
                },
            },
        });

        var dialog;
        new dialogs.SelectCreateDialog(parent, {
            context: {shouldNotBeInFilterContext: false},
            res_model: 'partner',
        }).open().then(function (result) {
            dialog = result;
        });
        await testUtils.nextTick();

        assert.containsN(dialog, '.o_data_row', 3, "should contain 3 records");

        // filter on bar
        await testUtils.dom.click(dialog.$('.o_dropdown_toggler_btn:contains(Filters)'));
        await testUtils.dom.click(dialog.$('.o_filters_menu a:contains(Bar)'));

        assert.containsN(dialog, '.o_data_row', 2, "should contain 2 records");

        // save filter
        await testUtils.dom.click(dialog.$('.o_dropdown_toggler_btn:contains(Favorites)'));
        await testUtils.dom.click(dialog.$('.o_add_favorite'));
        await testUtils.fields.editInput(dialog.$('.o_favorite_name input[type=text]'), 'some name'); // name the filter
        await testUtils.dom.click(dialog.$('.o_save_favorite button'));

        testUtils.mock.unpatch(ListController);
        parent.destroy();
    });

    QUnit.test('propagate can_create onto the search popup o2m', async function (assert) {
        assert.expect(3);

        this.data.instrument.records = [
            {id: 1, name: 'Tromblon1'},
            {id: 2, name: 'Tromblon2'},
            {id: 3, name: 'Tromblon3'},
            {id: 4, name: 'Tromblon4'},
            {id: 5, name: 'Tromblon5'},
            {id: 6, name: 'Tromblon6'},
            {id: 7, name: 'Tromblon7'},
            {id: 8, name: 'Tromblon8'},
        ];

        var form = await createView({
            View: FormView,
            model: 'partner',
            data: this.data,
            arch: '<form>' +
                     '<field name="name"/>' +
                     '<field name="instrument" can_create="false"/>' +
                  '</form>',
            res_id: 1,
            archs: {
                'instrument,false,list': '<tree>'+
                                                '<field name="name"/>'+
                                            '</tree>',
                'instrument,false,search': '<search>'+
                                                '<field name="name"/>'+
                                            '</search>',
            },
            viewOptions: {
                mode: 'edit',
            },

            mockRPC: function(route, args) {
                if (args.method === 'get_formview_id') {
                    return Promise.resolve(false);
                }
                return this._super(route, args);
            },
        });

        await testUtils.dom.click(form.$('.o_field_widget[name="instrument"] .o_input'));

        assert.notOk($('.ui-autocomplete a:contains(Create and Edit)').length,
            'Create and edit not present in dropdown');

        await testUtils.dom.triggerEvents($('.ui-autocomplete a:contains(Search More)'),
            ['mouseenter', 'click']);

        var $modal = $('.modal-dialog.modal-lg');

        assert.strictEqual($modal.length, 1, 'Modal present');

        assert.strictEqual($modal.find('.modal-footer button').text(), "Cancel",
            'Only the cancel button is present in modal');

        form.destroy();
    });

    QUnit.module('SearchPanel')

    QUnit.test('SearchPanel is not instanciated in a dialog', async function (assert) {
        assert.expect(2);

        this.data.instrument.records = [
            {id: 1, name: 'Tromblon1'},
            {id: 2, name: 'Tromblon2'},
            {id: 3, name: 'Tromblon3'},
            {id: 4, name: 'Tromblon4'},
            {id: 5, name: 'Tromblon5'},
            {id: 6, name: 'Tromblon6'},
            {id: 7, name: 'Tromblon7'},
            {id: 8, name: 'Tromblon8'},
        ];

        var form = await createView({
            View: FormView,
            model: 'partner',
            data: this.data,
            arch: '<form>' +
                     '<field name="name"/>' +
                     '<field name="instrument" />' +
                  '</form>',
            res_id: 1,
            archs: {
                'instrument,false,list': '<tree>'+
                                                '<field name="name"/>'+
                                            '</tree>',
                'instrument,false,search': '<search>'+
                                                '<field name="name"/>'+
                                                '<searchpanel>' +
                                                    '<field name="sub_instrument" />' +
                                                '</searchpanel>' +
                                            '</search>',
            },
            viewOptions: {
                mode: 'edit',
            },

        });

        await testUtils.dom.click(form.$('.o_field_widget[name="instrument"] .o_input'));

        await testUtils.dom.triggerEvents($('.ui-autocomplete a:contains(Search More)'),
            ['mouseenter', 'click']);

        var $modal = $('.modal-dialog.modal-lg');

        assert.strictEqual($modal.length, 1, 'Modal present');

        assert.notOk($modal.find('.o_search_panel').length, 'SearchPanel is not instanciated while in modal');

        form.destroy();
    });
});

});
