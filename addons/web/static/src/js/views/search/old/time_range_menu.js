odoo.define('web.OldTimeRangeMenu', function (require) {
"use strict";

var config = require('web.config');
var core = require('web.core');
var Domain = require('web.Domain');
var oldTimeRangeMenuOptions = require('web.oldTimeRangeMenuOptions');
var Widget = require('web.Widget');

var _t = core._t;
var ComparisonOptions = oldTimeRangeMenuOptions.ComparisonOptions;
var PeriodOptions = oldTimeRangeMenuOptions.PeriodOptions;

var OldTimeRangeMenu = Widget.extend({
    template: 'web.OldTimeRangeMenu',
    events: {
        'click .o_apply_range': '_onApplyButtonClick',
        'click .o_comparison_checkbox': '_onCheckBoxClick',
    },

    /**
     * override
     * @param {Widget} parent
     * @param {Object} fields
     * @param {Object} configuration
     *
     */
    init: function(parent, fields, configuration) {
        var self = this;
        this.isMobile = config.device.isMobile;
        this.symbol = this.isMobile ? 'fa fa-chevron-right float-right mt4' : 'caret';
        this._super(parent);
        this.dateFields = [];
        _.each(fields, function (field, name) {
            if (field.sortable && _.contains(['date', 'datetime'], field.type)) {
                self.dateFields.push(_.extend({}, field, {
                    name: name,
                }));
            }
        });
        this.periodOptions = PeriodOptions;
        this.periodGroups = PeriodOptions.reduce(
            function (acc, option) {
                if (!_.contains(acc, option.groupId)) {
                    acc.push(option.groupId);
                }
                return acc;
            },
            []
        );

        this.COMPARISON_TIME_RANGE_OPTIONS = ComparisonOptions;

        // Following steps determine initial configuration
        this.isActive = false;
        this.timeRangeId = undefined;
        this.comparisonIsSelected = false;
        this.comparisonTimeRangeId = undefined;
        this.dateField = {};
        if (configuration && configuration.field && configuration.range) {
            this.isActive = true;
            var dateField = _.findWhere(this.dateFields, {name: configuration.field});
            this.dateField = {
                name: dateField.name,
                description: dateField.string,
                type: dateField.type,
            };
            this.timeRangeId = configuration.range;
            if (configuration.comparison_range) {
                this.comparisonIsSelected = true;
                this.comparisonTimeRangeId = configuration.comparison_range;
            }
        }
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    deactivate: function () {
        this.isActive = false;
        this.comparisonIsSelected = false;
        this.renderElement();
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onApplyButtonClick: function () {
        this.isActive = true;
        var dateFieldName = this.$('.o_date_field_selector').val();
        this.timeRangeId = this.$('.o_time_range_selector').val();
        if (this.comparisonIsSelected) {
            this.comparisonTimeRangeId = this.$('.o_comparison_time_range_selector').val();
        }
        this.dateField = {
            name: dateFieldName,
            type: _.findWhere(this.dateFields, {name: dateFieldName}).type,
            description: _.findWhere(this.dateFields, {name: dateFieldName}).string,
        };

        this.renderElement();
        this.trigger_up('time_range_modified');
    },
    /**
     * @private
     *
     * @param {JQueryEvent} ev
     */
    _onCheckBoxClick: function (ev) {
        ev.stopPropagation();
        this.comparisonIsSelected = this.$('.o_comparison_checkbox').prop('checked');
        this.$('.o_comparison_time_range_selector').toggleClass('o_hidden');
        this.$el.addClass('open');
    }
});

return OldTimeRangeMenu;

});
