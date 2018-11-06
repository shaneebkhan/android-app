odoo.define('web.GroupByMenu', function (require) {
"use strict";

var config = require('web.config');
var core = require('web.core');
var DropdownMenu = require('web.DropdownMenu');
var searchViewParameters = require('web.searchViewParameters');

var QWeb = core.qweb;
var _t = core._t;

var DEFAULT_INTERVAL =searchViewParameters.DEFAULT_INTERVAL;
var GROUPABLE_TYPES = searchViewParameters.GROUPABLE_TYPES;

var GroupByMenu = DropdownMenu.extend({
    events: _.extend({}, DropdownMenu.prototype.events,
    {
        'click .o_add_custom_group': '_onAddCustomGroupClick',
        'click button.o_apply_group': '_onButtonApplyClick',
        'click .o_group_selector': '_onGroupSelectorClick',
    }),
    /**
     * @override
     * @param {Widget} parent
     * @param {Object[]} groupbys list of groupbys (type IGroupBy below)
     *   interface IGroupBy {
     *      itemId: string; unique id associated with the groupby
     *      fieldName: string; field name without interval!
     *      description: string; label printed on screen
     *      groupId: string;
     *      isActive: boolean; determines if the groupby is considered active
     *      hasOptions: boolean; true when the groupBy has fieldType 'date' or 'datetime' (optional)
     *      options: array of objects with 'optionId' and 'description' keys; (optional)
     *      defaultOptionId: string refers to an optionId that should be activated by default
     *      currentOptionId: string refers to an optionId that is activated if item is active (optional)
     *   }
     * @param {Object} fields 'field_get' of a model: mapping from field name
     * to an object with its properties
     * @param {Object} options
     * @param {string} options.headerStyle conditions the style of the main button
     */
    init: function (parent, groupbys, fields, options) {
        var self = this;
        this._super(parent, groupbys);
        this.fields = fields;
        // determines when the 'Add custom groupby' submenu is open
        this.generatorMenuIsOpen = false;
        // determines list of options used by groupbys of type 'date'
        this.groupableFields = [];
        _.each(fields, function (field, name) {
            if (field.sortable && _.contains(GROUPABLE_TYPES, field.type)) {
                self.groupableFields.push(_.extend({}, field, {
                    name: name,
                }));
            }
        });
        this.groupableFields = _.sortBy(this.groupableFields, 'string');
        // determines the list of field names that can be added to the menu
        // via the 'Add Custom Groupby' menu
        this.presentedFields = this.groupableFields.filter(function (field) {
            var groupByFields = _.pluck(groupbys, 'fieldName');
            return !_.contains(groupByFields, field.name);
        });

        // determines where the filter menu is displayed and partly its style
        this.isMobile = config.device.isMobile;

        this.dropdownCategory = 'groupby';
        this.dropdownTitle = _t('Group By');
        this.dropdownIcon = 'fa fa-bars';
        this.dropdownSymbol = this.isMobile ? 'fa fa-chevron-right float-right mt4' : false;
        // the default style of the groupby menu can be changed here using the options key 'headerStyle'
        if (options && options.headerStyle === 'primary') {
            this.dropdownStyle = {
                el: {class: 'btn-group o_group_by_menu o_dropdown', attrs: {'role': 'group'}},
                mainButton: {class: 'btn btn-primary dropdown-toggle'},
            };
        }
    },

    // /**
    //  * render the template used to add a new custom groupby and append it
    //  * to the basic dropdown menu
    //  *
    //  * @private
    //  */
    start: function () {
        this.$menu = this.$('.o_dropdown_menu');
        this.$menu.addClass('o_group_by_menu');
        var $generatorMenu = QWeb.render('GroupByMenuGenerator', {widget: this});
        this.$menu.append($generatorMenu);
        this.$addCustomGroup = this.$menu.find('.o_add_custom_group');
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * method called via the 'Add Custom Groupby' menu to create
     * a new groupby and add it (activated) to the menu
     * In case the field is of type date, it is activated using
     * the option determined by the parameter 'DEFAULT_INTERVAL'
     *
     * @private
     * @param {string} fieldName
     */
    _addGroupby: function (fieldName) {
        var field = this.presentedFields.find(function (field) {
            return field.name === fieldName;
        });
        var groupNumber =  1 + this.items.reduce(
            function (max, filter) {
                return Math.max(max, filter.groupNumber);
            },
            0
        );
        var groupBy = {
            type: 'groupBy',
            description: field.string,
            fieldName: fieldName,
            fieldType: field.type,
            groupNumber: groupNumber,
        };
        if (_.contains(['date', 'datetime'], field.type)) {
            groupBy.hasOptions = true;
            groupBy.options = searchViewParameters.INTERVAL_OPTIONS;
            groupBy.defaultOptionId = DEFAULT_INTERVAL;
            groupBy.currentOptionId = false;
        }
        var fieldIndex = this.presentedFields.indexOf(field);
        this.presentedFields.splice(fieldIndex, 1);
        this._renderGeneratorMenu();
        this._renderMenuItems();
        this.trigger_up('new_groupBy', {groupBy: groupBy});
    },
    /**
     * @private
     */
    _renderGeneratorMenu: function () {
        this.$el.find('.o_generator_menu').remove();
        var $generatorMenu = QWeb.render('GroupByMenuGenerator', {widget: this});
        this.$menu.append($generatorMenu);
        this.$addCustomGroup = this.$menu.find('.o_add_custom_group');
        this.$groupSelector = this.$menu.find('.o_group_selector');
    },
    /**
     * @private
     */
    _toggleCustomGroupMenu: function () {
        this.generatorMenuIsOpen = !this.generatorMenuIsOpen;
        this._renderGeneratorMenu();
        if (this.generatorMenuIsOpen) {
            this.$groupSelector.focus();
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * toggle the 'Add Custom Group'
     *
     * @private
     * @param {MouseEvent} event
     */
    _onAddCustomGroupClick: function (event) {
        event.preventDefault();
        event.stopPropagation();
        this._toggleCustomGroupMenu();
    },
    /*
     * override
     *
     * @private
     * @param {jQueryEvent} event
     */
    _onBootstrapClose: function () {
        this._super.apply(this, arguments);
        this.generatorMenuIsOpen = false;
        this._renderGeneratorMenu();
    },
    /**
     * @private
     * @param {MouseEvent} event
     */
    _onButtonApplyClick: function (event) {
        event.stopPropagation();
        var fieldName = this.$groupSelector.val();
        this._addGroupby(fieldName);
        this._toggleCustomGroupMenu();
    },
    /**
     * @private
     * @param {MouseEvent} event
     */
    _onGroupSelectorClick: function (event) {
        event.stopPropagation();
    },
});

return GroupByMenu;

});