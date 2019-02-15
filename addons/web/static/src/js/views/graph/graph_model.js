odoo.define('web.GraphModel', function (require) {
"use strict";

var core = require('web.core');
var _t = core._t;

/**
 * The graph model is responsible for fetching and processing data from the
 * server.  It basically just do a read_group and format/normalize data.
 */
var AbstractModel = require('web.AbstractModel');

return AbstractModel.extend({
    /**
     * @override
     * @param {Widget} parent
     */
    init: function () {
        this._super.apply(this, arguments);
        this.chart = null;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * We defend against outside modifications by extending the chart data. It
     * may be overkill.
     *
     * @returns {Object}
     */
    get: function () {
        return this.chart;
    },
    /**
     * Initial loading.
     *
     * @todo All the work to fall back on the graph_groupbys keys in the context
     * should be done by the graphView I think.
     *
     * @param {Object} params
     * @param {string} params.mode one of 'pie', 'bar', 'line
     * @param {string} params.measure a valid field name
     * @param {string[]} params.groupBys a list of valid field names
     * @param {Object} params.context
     * @param {string[]} params.domain
     * @returns {Deferred} The deferred does not return a handle, we don't need
     *   to keep track of various entities.
     */
    load: function (params) {
        var groupBys = params.context.graph_groupbys || params.groupBys;
        this.initialGroupBys = groupBys;
        this.fields = params.fields;
        this.modelName = params.modelName;
        this.chart = {
            compare: params.compare,
            comparisonTimeRange: params.comparisonTimeRange,
            dataPoints: {},
            comparisonField: params.comparisonField,
            groupedBy: params.groupedBy.length ? params.groupedBy : groupBys,
            measure: params.context.graph_measure || params.measure,
            mode: params.context.graph_mode || params.mode,
            timeRange: params.timeRange,
            domain: params.domain,
            context: params.context,
        };
        return this._loadGraph();
    },
    /**
     * Reload data.  It is similar to the load function. Note that we ignore the
     * handle parameter, we always expect our data to be in this.chart object.
     *
     * @todo This method takes 'groupBy' and load method takes 'groupedBy'. This
     *   is insane.
     *
     * @param {any} handle ignored!
     * @param {Object} params
     * @param {string[]} [params.domain]
     * @param {string[]} [params.groupBy]
     * @param {string} [params.mode] one of 'bar', 'pie', 'line'
     * @param {string} [params.measure] a valid field name
     * @returns {Deferred}
     */
    reload: function (handle, params) {
        if ('context' in params) {
            this.chart.context = params.context;
            this.chart.groupedBy = params.context.graph_groupbys || this.chart.groupedBy;
            this.chart.measure = params.context.graph_measure || this.chart.measure;
            this.chart.mode = params.context.graph_mode || this.chart.mode;
            var timeRangeMenuData = params.context.timeRangeMenuData;
            if (timeRangeMenuData) {
                this.chart.timeRange = timeRangeMenuData.timeRange || [];
                this.chart.comparisonField = timeRangeMenuData.comparisonField || undefined;
                this.chart.comparisonTimeRange = timeRangeMenuData.comparisonTimeRange || [];
                this.chart.compare = this.chart.comparisonTimeRange.length > 0;
            } else {
                this.chart.timeRange = [];
                this.chart.comparisonField = undefined;
                this.chart.comparisonTimeRange = [];
                this.chart.compare = false;
                this.chart = _.omit(this.chart, 'comparisonData');
            }
        }
        if ('domain' in params) {
            this.chart.domain = params.domain;
        }
        if ('groupBy' in params) {
            // this.chart.groupedBy = params.groupBy.length ? params.groupBy : this.initialGroupBys;
            this.chart.groupedBy = params.groupBy;
        }
        if ('measure' in params) {
            this.chart.measure = params.measure;
        }
        if ('mode' in params) {
            this.chart.mode = params.mode;
            return $.when();
        }
        return this._loadGraph();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Fetch and process graph data.  It is basically a read_group with correct
     * fields.  We have to do some light processing to separate date groups
     * in the field list, because they can be defined with an aggregation
     * function, such as my_date:week
     *
     * @returns {Deferred}
     */
    _loadGraph: function () {
        this.chart.dataPoints = {};
        var groupedBy = this.chart.groupedBy;
        var fields = _.map(groupedBy, function (groupBy) {
            return groupBy.split(':')[0];
        });

        if (this.chart.measure !== '__count__') {
            if (this.fields[this.chart.measure].type === 'many2one') {
                fields = fields.concat(this.chart.measure + ":count_distinct");
            }
            else {
                fields = fields.concat(this.chart.measure);
            }
        }

        var context = _.extend({fill_temporal: true}, this.chart.context);
        var defs = [];
        defs.push(this._rpc({
            model: this.modelName,
            method: 'read_group',
            context: context,
            domain: this.chart.domain.concat(this.chart.timeRange),
            fields: fields,
            groupBy: groupedBy,
            lazy: false,
        }).then(this._processData.bind(this, 'data')));

        if (this.chart.compare) {
            defs.push(this._rpc({
                model: this.modelName,
                method: 'read_group',
                context: context,
                domain: this.chart.domain.concat(this.chart.comparisonTimeRange),
                fields: fields,
                groupBy: groupedBy,
                lazy: false,
            }).then(this._processData.bind(this, 'comparisonData')));
        }

        return $.when.apply($, defs);
    },
    /**
     * Since read_group is insane and returns its result on different keys
     * depending of some input, we have to normalize the result.
     * The final chart data is added to this.chart object.
     *
     * @todo This is not good for race conditions.  The processing should get
     *  the object this.chart in argument, or an array or something. We want to
     *  avoid writing on a this.chart object modified by a subsequent read_group
     *
     * @param {String} dataKey
     * @param {any} raw_data result from the read_group
     */
    _processData: function (dataKey, raw_data) {
        var self = this;
        var is_count = this.chart.measure === '__count__';
        var data_pt, labels;

        function getLabels (dataPt) {
            return self.chart.groupedBy.map(function (field) {
                return self._sanitizeValue(dataPt[field], field.split(":")[0]);
            });
        }
        this.chart.dataPoints[dataKey] = [];
        for (var i = 0; i < raw_data.length; i++) {
            data_pt = raw_data[i];
            labels = getLabels(data_pt);
            var count = data_pt.__count || data_pt[this.chart.groupedBy[0]+'_count'] || 0;
            var value = is_count ? count : data_pt[this.chart.measure];
            if (value instanceof Array) {
                // when a many2one field is used as a measure AND as a grouped
                // field, bad things happen.  The server will only return the
                // grouped value and will not aggregate it.  Since there is a
                // nameclash, we are then in the situation where this value is
                // an array.  Fortunately, if we group by a field, then we can
                // say for certain that the group contains exactly one distinct
                // value for that field.
                value = 1;
            }
            this.chart.dataPoints[dataKey].push({
                count: count,
                value: value,
                labels: labels,
                origin: dataKey,
            });
        }
    },
    /**
     * Helper function (for _processData), turns various values in a usable
     * string form, that we can display in the interface.
     *
     * @param {any} value value for the field fieldName received by the read_group rpc
     * @param {string} fieldName
     * @returns {string}
     */
    _sanitizeValue: function (value, fieldName) {
        if (value === false && this.fields[fieldName].type !== 'boolean') {
            return _t("Undefined");
        }
        if (value instanceof Array) return value[1];
        if (fieldName && (this.fields[fieldName].type === 'selection')) {
            var selected = _.where(this.fields[fieldName].selection, {0: value})[0];
            return selected ? selected[1] : value;
        }
        return value;
    },
});

});
