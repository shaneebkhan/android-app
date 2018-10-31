odoo.define('web.searchViewParameters', function (require) {
"use strict";

var core = require('web.core');
var _lt = core._lt;

// for FiltersMenu
var DEFAULT_PERIOD = 'this_month';
var PERIOD_OPTIONS = [
    {description: _lt('Last 7 Days'), optionId: 'last_7_days', groupId: 1},
    {description: _lt('Last 30 Days'), optionId: 'last_30_days', groupId: 1},
    {description: _lt('Last 365 Days'), optionId: 'last_365_days', groupId: 1},
    {description: _lt('Today'), optionId: 'today', groupId: 2},
    {description: _lt('This Week'), optionId: 'this_week', groupId: 2},
    {description: _lt('This Month'), optionId: 'this_month', groupId: 2},
    {description: _lt('This Quarter'), optionId: 'this_quarter', groupId: 2},
    {description: _lt('This Year'), optionId: 'this_year', groupId: 2},
    {description: _lt('Yesterday'), optionId: 'yesterday', groupId: 3},
    {description: _lt('Last Week'), optionId: 'last_week', groupId: 3},
    {description: _lt('Last Month'), optionId: 'last_month', groupId: 3},
    {description: _lt('Last Quarter'), optionId: 'last_quarter', groupId: 3},
    {description: _lt('Last Year'), optionId: 'last_year', groupId: 3},
];

// for GroupBy menu
var GROUPABLE_TYPES = ['many2one', 'char', 'boolean', 'selection', 'date', 'datetime'];
var DEFAULT_INTERVAL = 'month';
var INTERVAL_OPTIONS = [
        {description: 'Day', optionId: 'day', groupId: 1},
        {description: 'Week', optionId: 'week', groupId: 1},
        {description: 'Month', optionId: 'month', groupId: 1},
        {description: 'Quarter', optionId: 'quarter', groupId: 1},
        {description: 'Year', optionId: 'year', groupId: 1},
    ];

// for TimeRangeMenu
var DEFAULT_TIMERANGE = DEFAULT_PERIOD;
var DEFAULT_COMPARISON_TIME_RANGE = 'previous_period';
var TIME_RANGE_OPTIONS = PERIOD_OPTIONS;
var COMPARISON_TIME_RANGE_OPTIONS = [
    {description: _lt('Previous Period'), optionId: 'previous_period'},
    {description: _lt('Previous Year'), optionId: 'previous_year'}
];

return {
    DEFAULT_PERIOD: DEFAULT_PERIOD,
    DEFAULT_INTERVAL: DEFAULT_INTERVAL,
    DEFAULT_TIMERANGE: DEFAULT_TIMERANGE,
    DEFAULT_COMPARISON_TIME_RANGE: DEFAULT_COMPARISON_TIME_RANGE,
    TIME_RANGE_OPTIONS: TIME_RANGE_OPTIONS,
    COMPARISON_TIME_RANGE_OPTIONS: COMPARISON_TIME_RANGE_OPTIONS,
    GROUPABLE_TYPES: GROUPABLE_TYPES,
    PERIOD_OPTIONS: PERIOD_OPTIONS,
    INTERVAL_OPTIONS: INTERVAL_OPTIONS,
};

});