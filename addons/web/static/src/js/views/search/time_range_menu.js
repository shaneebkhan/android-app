odoo.define('web.TimeRangeMenu', function (require) {
"use strict";

var config = require('web.config');
// var core = require('web.core');
// var Domain = require('web.Domain');
// var oldTimeRangeMenuOptions = require('web.oldTimeRangeMenuOptions');
var Widget = require('web.Widget');
var searchViewParameters = require('web.searchViewParameters');

var DEFAULT_CONFIGURATION = searchViewParameters.DEFAULT_CONFIGURATION;
var PERIOD_OPTIONS = searchViewParameters.PERIOD_OPTIONS;
var COMPARISON_TIME_RANGE_OPTIONS = searchViewParameters.COMPARISON_TIME_RANGE_OPTIONS;

// var _t = core._t;
// var ComparisonOptions = oldTimeRangeMenuOptions.ComparisonOptions;
// var PeriodOptions = oldTimeRangeMenuOptions.PeriodOptions;

var TimeRangeMenu = Widget.extend({
    template: 'web.TimeRangeMenu',
    events: {
        'click .o_apply_range': '_onApplyButtonClick',
        'click .o_comparison_checkbox': '_onCheckBoxClick',
    },

    /**
     * override
     * @param {Widget} parent
     * @param {Object[]} timeRanges
     *
     */
    init: function(parent, timeRanges) {
        this._super.apply(this, arguments);
        // determine header style
        this.isMobile = config.device.isMobile;
        this.symbol = this.isMobile ? 'fa fa-chevron-right float-right mt4' : 'caret';
        // fixed parameters
        this.periodOptions = PERIOD_OPTIONS;
        this.comparisonTimeRangeOptions = COMPARISON_TIME_RANGE_OPTIONS;
        this.periodGroups = _.uniq(PERIOD_OPTIONS.map(function (option) {
            return option.groupId;
        }));
        // variable parameters
        this.timeRanges = timeRanges;
        this.configuration = DEFAULT_CONFIGURATION;
        // compte this.configuration
        this._configure();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    update: function (timeRanges) {
        this.timeRanges = timeRanges;
        this._configure();
        this.renderElement();
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _configure: function () {
        this.configuration = this.timeRanges.find(function (timeRange) {
            return timeRange.isActive;
        }) || this.configuration;
        this.configuration.comparisonIsSelected = !!this.configuration.comparisonTimeRangeId;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onApplyButtonClick: function () {
        var id = this.$('.o_date_field_selector').val();
        var timeRangeId = this.$('.o_time_range_selector').val();
        var comparisonTimeRangeId = false;
        if (this.configuration.comparisonIsSelected) {
            comparisonTimeRangeId = this.$('.o_comparison_time_range_selector').val();
        }
        this.trigger_up('activate_time_range', {
            id: id,
            timeRangeId: timeRangeId,
            comparisonTimeRangeId: comparisonTimeRangeId
        });
    },
    /**
     * @private
     *
     * @param {JQueryEvent} ev
     */
    _onCheckBoxClick: function (ev) {
        ev.stopPropagation();
        this.configuration.comparisonIsSelected = this.$('.o_comparison_checkbox').prop('checked');
        this.$('.o_comparison_time_range_selector').toggleClass('o_hidden');
        this.$el.addClass('open');
    }
});

return TimeRangeMenu;

});