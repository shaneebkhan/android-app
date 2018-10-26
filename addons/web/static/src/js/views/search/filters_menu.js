odoo.define('web.FiltersMenu', function (require) {
"use strict";

var config = require('web.config');
var core = require('web.core');
var Domain = require('web.Domain');
var DropdownMenu = require('web.DropdownMenu');
var search_filters = require('web.search_filters');
var time = require('web.time');

var QWeb = core.qweb;
var _t = core._t;

var FiltersMenu = DropdownMenu.extend({
    custom_events: {
        remove_proposition: '_onRemoveProposition',
        confirm_proposition: '_onConfirmProposition',
    },
    events: _.extend({}, DropdownMenu.prototype.events, {
        'click .o_add_custom_filter': '_onAddCustomFilterClick',
        'click .o_add_condition': '_onAddCondition',
        'click .o_apply_filter': '_onApplyClick',
    }),

    init: function (parent, filters, fields) {
        this._super(parent, filters);

        // determines where the filter menu is displayed and its style
        this.isMobile = config.device.isMobile;
        // determines when the 'Add custom filter' submenu is open
        this.generatorMenuIsOpen = false;
        this.propositions = [];
        this.fields = _.pick(fields, function (field, name) {
            return field.selectable !== false && name !== 'id';
        });
        this.fields.id = {string: 'ID', type: 'id', searchable: true};
        this.dropdownCategory = 'filter';
        this.dropdownTitle = _t('Filters');
        this.dropdownIcon = 'fa fa-filter';
        this.dropdownSymbol = this.isMobile ?
                                'fa fa-chevron-right float-right mt4' :
                                false;
        this.dropdownStyle.mainButton.class = 'o_filters_menu_button ' +
                                                this.dropdownStyle.mainButton.class;
    },

    /**
     * render the template used to add a new custom filter and append it
     * to the basic dropdown menu
     *
     * @private
     */
    start: function () {
        this.$menu = this.$('.o_dropdown_menu');
        this.$menu.addClass('o_filters_menu');
        var generatorMenu = QWeb.render('FiltersMenuGenerator', {widget: this});
        this.$menu.append(generatorMenu);
        this.$addCustomFilter = this.$menu.find('.o_add_custom_filter');
        this.$addFilterMenu = this.$menu.find('.o_add_filter_menu');
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Add a proposition inside the custom filter edition menu
     *
     * @private
     * @returns {$.Deferred}
     */
    _appendProposition: function () {
        // make modern sear_filters code!!! It works but...
        var prop = new search_filters.ExtendedSearchProposition(this, this.fields);
        this.propositions.push(prop);
        this.$('.o_apply_filter').prop('disabled', false);
        return prop.insertBefore(this.$addFilterMenu);
    },
    /**
     * Confirm a filter proposition, creates it and add it to the menu
     *
     * @private
     */
    _commitSearch: function () {
        var filters = _.invoke(this.propositions, 'get_filter').map(function (preFilter) {
            return {
                type: 'filter',
                description: preFilter.attrs.string,
                domain: Domain.prototype.arrayToString(preFilter.attrs.domain)
            };
        });
        // TO DO intercepts 'new_filters' and decide what to do whith filters
        //  rewrite web.search_filters?
        this.trigger_up('new_filters', {filters: filters});
        _.invoke(this.propositions, 'destroy');
        this.propositions = [];
        this._toggleCustomFilterMenu();
    },
    /**
     * override
     *
     * @private
     */
    _renderMenuItems: function () {
        var self= this;
        this._super.apply(this, arguments);
        // the following code adds tooltip on date options in order
        // to alert the user of the meaning of intervals
        var $options = this.$('.o_item_option');
        $options.each(function () {
            var $option = $(this);
            $option.tooltip({
                delay: { show: 500, hide: 0 },
                title: function () {
                    var itemId = $option.attr('data-item_id');
                    var optionId = $option.attr('data-option_id');
                    var fieldName = _.findWhere(self.items, {id: itemId}).fieldName;
                    var domain = Domain.prototype.constructDomain(fieldName, optionId, 'date', true);
                    var evaluatedDomain = Domain.prototype.stringToArray(domain);
                    var dateFormat = time.getLangDateFormat();
                    var dateStart = moment(evaluatedDomain[1][2], "YYYY-MM-DD", 'en').format(dateFormat);
                    var dateEnd = moment(evaluatedDomain[2][2], "YYYY-MM-DD", 'en').format(dateFormat);
                    if (optionId === 'today' || optionId === 'yesterday') {
                        return dateStart;
                    }
                    return _.str.sprintf(_t('From %s To %s'), dateStart, dateEnd);
                }
            });
        });
    },
    /**
     * Hide and display the submenu which allows adding custom filters
     *
     * @private
     */
    _toggleCustomFilterMenu: function () {
        var self = this;
        this.generatorMenuIsOpen = !this.generatorMenuIsOpen;
        var def;
        if (this.generatorMenuIsOpen && !this.propositions.length) {
            def = this._appendProposition();
        }
        if (!this.generatorMenuIsOpen) {
            _.invoke(this.propositions, 'destroy');
            this.propositions = [];
        }
        $.when(def).then(function () {
            self.$addCustomFilter
                .toggleClass('o_closed_menu', !self.generatorMenuIsOpen)
                .toggleClass('o_open_menu', self.generatorMenuIsOpen);
            self.$('.o_add_filter_menu').toggle();
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------
    /**
     * @private
     * @param {MouseEvent} event
     */
    _onAddCondition: function (event) {
        this._appendProposition();
    },
    /**
     * @private
     * @param {MouseEvent} event
     */
    _onAddCustomFilterClick: function (event) {
        event.preventDefault();
        event.stopPropagation();
        this._toggleCustomFilterMenu();
    },
    /**
     * @private
     * @param {MouseEvent} event
     */
    _onApplyClick: function (event) {
        event.stopPropagation();
        this._commitSearch();
    },
    /**
     * @private
     * @param {OdooEvent} event
     */
    _onConfirmProposition: function (event) {
        event.stopPropagation();
        this._commitSearch();
    },
    /**
     * @private
     * @param {OdooEvent} event
     */
    _onRemoveProposition: function (event) {
        event.stopPropagation();
        this.propositions = _.without(this.propositions, event.target);
        if (!this.propositions.length) {
            this.$('.o_apply_filter').prop('disabled', true);
        }
        event.target.destroy();
    },
});

return FiltersMenu;

});