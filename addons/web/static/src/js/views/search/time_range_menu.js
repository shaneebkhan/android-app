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
        this.configuration = null;
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

    // /**
    //  * Generates a :js:class:`~instance.web.search.Facet` descriptor from a
    //  * filter descriptor
    //  *
    //  * @returns {Object}
    //  */
    // facetFor: function () {
    //     var fieldDescription;
    //     var timeRange = "[]";
    //     var timeRangeDescription;
    //     var comparisonTimeRange = "[]";
    //     var comparisonTimeRangeDescription;

    //     if (this.isActive) {
    //         fieldDescription = this.dateField.description;
    //         if (this.timeRangeId !== 'custom') {
    //             timeRange = Domain.prototype.constructDomain(
    //                 this.dateField.name,
    //                 this.timeRangeId,
    //                 this.dateField.type
    //             );
    //             timeRangeDescription = _.findWhere(
    //                 this.periodOptions,
    //                 {optionId: this.timeRangeId}
    //             ).description;
    //         }
    //         if (this.comparisonIsSelected) {
    //             comparisonTimeRange = Domain.prototype.constructDomain(
    //                 this.dateField.name,
    //                 this.timeRangeId,
    //                 this.dateField.type,
    //                 null,
    //                 this.comparisonTimeRangeId
    //             );
    //             comparisonTimeRangeDescription = _.findWhere(
    //                 this.COMPARISON_TIME_RANGE_OPTIONS,
    //                 {optionId: this.comparisonTimeRangeId}
    //             ).description;
    //         }
    //     }

    //     return {
    //         cat: 'timeRangeCategory',
    //         category: _t("Time Range"),
    //         icon: 'fa fa-calendar',
    //         field: {
    //             get_context: function (facet, noDomainEvaluation) {
    //                 if (!noDomainEvaluation) {
    //                         timeRange = Domain.prototype.stringToArray(timeRange);
    //                         comparisonTimeRange = Domain.prototype.stringToArray(comparisonTimeRange);
    //                 }
    //                 return {
    //                     timeRangeMenuData: {
    //                         timeRange: timeRange,
    //                         timeRangeDescription: timeRangeDescription,
    //                         comparisonTimeRange: comparisonTimeRange,
    //                         comparisonTimeRangeDescription: comparisonTimeRangeDescription,
    //                     }
    //                 };
    //             },
    //             get_groupby: function () {},
    //             get_domain: function () {}
    //         },
    //         isRange: true,
    //         values: [{
    //             label: fieldDescription + ': ' + timeRangeDescription +
    //                 (
    //                     comparisonTimeRangeDescription ?
    //                         (' / ' + comparisonTimeRangeDescription) :
    //                         ''
    //                 ),
    //             value: null,
    //         }],
    //     };
    // },
    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _configure: function () {
        this.configuration = this.timeRanges.find(function (timeRange) {
            return timeRange.isActive;
        }) || DEFAULT_CONFIGURATION;
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