odoo.define('web.search_groupby_menu_tests', function (require) {
"use strict";

var GroupByMenu = require('web.GroupByMenu');
var testUtils = require('web.test_utils');
var searchViewParameters = require('web.searchViewParameters');



function createGroupByMenu(groupBys, fields, params) {
    params = params || {};
    var target = params.debug ? document.body :  $('#qunit-fixture');
    var menu = new GroupByMenu(null, groupBys, fields);
    testUtils.addMockEnvironment(menu, params);
    menu.appendTo(target);
    return menu;
}

QUnit.module('GroupByMenu', {
    beforeEach: function () {
        this.groupBys = [
            {
                description: 'some group by',
                groupNumber: 1,
                isActive: false,
            },
        ];
        this.fields = {
            fieldName: {sortable: true, string: 'Super Date', type: 'date'}
        };
    },
}, function () {

    QUnit.test('simple rendering with no filter and no field', function (assert) {
        assert.expect(1);

        var groupByMenu = createGroupByMenu([], {});
        // open groupBy menu
        groupByMenu.$('button:first').click();
        assert.strictEqual(groupByMenu.$('.dropdown-divider, .dropdown-item, .dropdown-item-text').length, 0,
            'should have 0 element');

        groupByMenu.destroy();
    });

    QUnit.test('simple rendering', function (assert) {
        assert.expect(2);

        var groupByMenu = createGroupByMenu(this.groupBys, this.fields, {debug: true});
        // open groupBy menu
        groupByMenu.$('button:first').click();
        assert.strictEqual(groupByMenu.$('.dropdown-divider, .dropdown-item').length, 4,
            'should have 2 elements');
        assert.strictEqual(groupByMenu.$('.o_menu_item').text().trim(), 'some group by',
            'should have proper filter name');

        groupByMenu.destroy();
    });

    QUnit.test('simple rendering with no filter but fields', function (assert) {
        assert.expect(1);

        var groupByMenu = createGroupByMenu(
            [],
            {fieldName: {sortable: true, string: 'Super Date', type: 'date'}}
            );
        // open groupBy menu
        groupByMenu.$('button:first').click();
        assert.strictEqual(groupByMenu.$('.dropdown-divider, .dropdown-item, .dropdown-item-text').length, 1,
            'should have 1 element');

        groupByMenu.destroy();
    });

    QUnit.test('click on add custom group toggle group selector', function (assert) {
        assert.expect(2);

        var groupByMenu = createGroupByMenu([],
            {fieldName: {sortable: true, string: 'Super Date', type: 'date'}}
        );
        groupByMenu.$('button:first').click();
        var selector = groupByMenu.$('select.o_group_selector');
        assert.ok(!selector.is(":visible"), 'should be invisible');
        groupByMenu.$('.o_add_custom_group').click();
        selector = groupByMenu.$('select.o_group_selector');
        assert.ok(selector.is(":visible"), 'should be visible');

        groupByMenu.destroy();
    });

    QUnit.test('select a groupBy of no date type in Add Custom Group menu add properly that groupBy to menu', function (assert) {
        assert.expect(7);

        var groupByMenu = createGroupByMenu(
            [],
            {
                fieldName: {sortable: true, name: 'candlelight', string: 'Candlelight', type: 'boolean'},
            },
            {
                intercepts: {
                    new_groupBy: function (ev) {
                        assert.strictEqual(ev.data.groupBy.description, 'Candlelight');
                        assert.strictEqual(ev.data.groupBy.fieldName, 'fieldName');
                        assert.strictEqual(ev.data.groupBy.fieldType, 'boolean');
                        assert.strictEqual(ev.data.groupBy.type, 'groupBy');
                        groupByMenu.update([{
                            description: 'Candlelight',
                            groupNumber: 1,
                            isActive: true,
                        }]);
                    },
                },
            }
        );
        // open groupBy menu
        groupByMenu.$('button:first').click();
        // open Add Custom Group submenu
        groupByMenu.$('.o_add_custom_group').click();
        // select fieldName
        assert.strictEqual(groupByMenu.$('select').val(), 'fieldName',
            'the select value should be "fieldName"');
        // create new groupBy
        groupByMenu.$('button.o_apply_group').click();
        assert.strictEqual(groupByMenu.$('.o_menu_item > .dropdown-item.selected').length, 1,
            'there should be a groupby selected');
        assert.strictEqual(groupByMenu.$('.o_menu_item > .o_submenu_switcher').length, 0,
            'there should be no options available');

        groupByMenu.destroy();
    });

    QUnit.test('select a groupBy of date type in Add Custom Group menu add properly that groupBy to menu', function (assert) {
        assert.expect(13);

        var groupByMenu = createGroupByMenu(
            [],
            this.fields,
            {
                intercepts: {
                    new_groupBy: function (ev) {
                        var groupBy = ev.data.groupBy;
                        assert.strictEqual(groupBy.description, 'Super Date');
                        assert.strictEqual(groupBy.fieldName, 'fieldName');
                        assert.strictEqual(groupBy.fieldType, 'date');
                        assert.strictEqual(groupBy.type, 'groupBy');
                        assert.strictEqual(groupBy.hasOptions, true);
                        assert.strictEqual(groupBy.options, searchViewParameters.INTERVAL_OPTIONS);
                        assert.strictEqual(groupBy.defaultOptionId, searchViewParameters.DEFAULT_INTERVAL);
                        assert.strictEqual(groupBy.currentOptionId, false);
                        groupByMenu.update([{
                            description: 'Super Date',
                            groupNumber: 1,
                            isActive: true,
                            hasOptions: true,
                            options: searchViewParameters.INTERVAL_OPTIONS,
                            currentOptionId: searchViewParameters.DEFAULT_INTERVAL,
                        }]);
                    },
                },
            }
        );
        // open groupBy menu
        groupByMenu.$('button:first').click();
        // open Add Custom Group submenu
        groupByMenu.$('.o_add_custom_group').click();
        // select fieldName
        assert.strictEqual(groupByMenu.$('select').val(), 'fieldName',
            'the select value should be "fieldName"');
        // create new groupBy of type date
        groupByMenu.$('button.o_apply_group').click();
        assert.strictEqual(groupByMenu.$('.o_menu_item > .dropdown-item.selected').length, 1,
            'there should be a groupby selected');
        assert.strictEqual(groupByMenu.$('.o_menu_item .o_submenu_switcher').length, 1,
            'there should be options available');
        // open options submenu
        groupByMenu.$('.o_menu_item .o_submenu_switcher').click();
        assert.strictEqual(groupByMenu.$('.o_item_option').length, 5,
            'there should be five options available');
        assert.strictEqual(groupByMenu.$('.o_add_custom_group').length, 0,
            'there should be no more a Add Custome Group submenu');

        groupByMenu.destroy();
    });
});
});
