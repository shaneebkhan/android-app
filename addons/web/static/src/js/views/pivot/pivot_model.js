odoo.define('web.PivotModel', function (require) {
"use strict";

/**
 * Pivot Model
 *
 * The pivot model keeps an in-memory representation of the pivot table that is
 * displayed on the screen.  The exact layout of this representation is not so
 * simple, because a pivot table is at its core a 2-dimensional object, but
 * with a 'tree' component: some rows/cols can be expanded so we zoom into the
 * structure.
 *
 * However, we need to be able to manipulate the data in a somewhat efficient
 * way, and to transform it into a list of lines to be displayed by the renderer
 *
 * @todo add a full description/specification of the data layout
 */

var AbstractModel = require('web.AbstractModel');
var concurrency = require('web.concurrency');
var core = require('web.core');
var dataComparisonUtils = require('web.dataComparisonUtils');
var mathUtils = require('web.mathUtils');
var session = require('web.session');

var _t = core._t;
var cartesian = mathUtils.cartesian;
var computeVariation = dataComparisonUtils.computeVariation;
var sections = mathUtils.sections;

var PivotModel = AbstractModel.extend({
    /**
     * @override
     * @param {Object} params
     */
    init: function () {
        this._super.apply(this, arguments);
        this.numbering = {};
        this.data = null;
        this._loadDataDropPrevious = new concurrency.DropPrevious();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------


    /**
     * Add a groupBy to rowGroupBys or colGroupBys according to provided type.
     *
     * @param {string} groupBy
     * @param {'row'|'col'} type
     */
    addGroupBy: function (groupBy, type) {
        if (type === 'row') {
            this.data.expandedRowGroupBys.push(groupBy);
        } else {
            this.data.expandedColGroupBys.push(groupBy);
        }
    },
    /**
     * Close the group with id given by groupId. A type must be specified
     * in case groupId is [[], []] (the id of the group 'Total') because this
     * group is present in both colGroupTree and rowGroupTree.
     *
     * @param {Array[]} groupId
     * @param {'row'|'col'} type
     */
    closeGroup: function (groupId, type) {
        var groupBys;
        var expandedGroupBys;
        var group;
        var tree;
        if (type === 'row') {
            groupBys = this.data.rowGroupBys;
            expandedGroupBys = this.data.expandedRowGroupBys;
            tree = this.rowGroupTree;
            group = this._findGroup(this.rowGroupTree, groupId[0]);
        } else {
            groupBys = this.data.colGroupBys;
            expandedGroupBys = this.data.expandedColGroupBys;
            tree = this.colGroupTree;
            group = this._findGroup(this.colGroupTree, groupId[1]);
        }
        group.directSubTrees = {};
        delete group.sortedKeys;
        var newGroupBysLength = this._getTreeHeight(tree) - 1;
        if (newGroupBysLength <= groupBys.length) {
            expandedGroupBys.splice(0);
            groupBys.splice(newGroupBysLength);
        } else {
            expandedGroupBys.splice(newGroupBysLength - groupBys.length);
        }
    },
    /**
     * Reload the view with the current rowGroupBys and colGroupBys
     * This is the easiest way to expand all the groups that are not expanded
     *
     * @returns {Promise}
     */
    expandAll: function () {
        return this._loadData();
    },
    /**
     * Expand a group by using groupBy to split it.
     *
     * @param {Object} group
     * @param {string} groupBy
     * @returns {Promise}
     */
    expandGroup: function (group, groupBy) {
        var leftDivisors;
        var rightDivisors;

        if (group.type === 'row') {
            leftDivisors = [[groupBy]];
            rightDivisors = sections(this._getGroupBys().colGroupBys);
        } else {
            leftDivisors = sections(this._getGroupBys().rowGroupBys);
            rightDivisors = [[groupBy]];
        }
        var divisors = cartesian(leftDivisors, rightDivisors);

        delete group.type;
        return this._subdivideGroup(group, divisors);
    },
    /**
     * Export model data in a form suitable for an easy encoding of the pivot
     * table in excell.
     *
     * @returns {Object}
     */
    exportData: function () {
        var measureCount = this.data.measures.length;
        var originCount = this.data.origins.length;

        var table = this._getTable();

        // process headers
        var headers = table.headers;
        var colGroupHeaderRows;
        var measureRow = [];
        var originRow = [];

        function processHeader(header) {
            var inTotalColumn = header.groupId[1].length === 0;
            return {
                title: header.title,
                width: header.width,
                height: header.height,
                is_bold: !!header.measure && inTotalColumn
            };
        }

        if (originCount > 1) {
            colGroupHeaderRows = headers.slice(0, headers.length - 2);
            measureRow = headers[headers.length - 2].map(processHeader);
            originRow = headers[headers.length - 1].map(processHeader);
        } else {
            colGroupHeaderRows = headers.slice(0, headers.length - 1);
            if (measureCount > 1) {
                measureRow = headers[headers.length - 1].map(processHeader);
            }
        }

        // remove the empty headers on left side
        colGroupHeaderRows[0].splice(0, 1);

        colGroupHeaderRows = colGroupHeaderRows.map(function (headerRow) {
            return headerRow.map(processHeader);
        });

        // process rows
        var tableRows = table.rows.map(function (row) {
            return {
                title: row.title,
                indent: row.indent,
                values: row.subGroupMeasurements.map(function (measurement) {
                    var value = measurement.value;
                    if (value === undefined) {
                        value = "";
                    } else if (measurement.originIndexes.length > 1) {
                        // in that case the value is a variation and a
                        // number between 0 and 1
                        value = value * 100;
                    }
                    return {
                        is_bold: measurement.isBold,
                        value: value,
                    };
                }),
            };
        });

        return {
            col_group_headers: colGroupHeaderRows,
            measure_headers: measureRow,
            origin_headers: originRow,
            rows: tableRows,
            measure_count: measureCount,
            origin_count: originCount,
        };
    },
    /**
     * Swap the pivot columns and the rows. It is a synchronous operation.
     */
    flip: function () {
        // swap the data: the main column and the main row
        var temp = this.rowGroupTree;
        this.rowGroupTree = this.colGroupTree;
        this.colGroupTree = temp;

        // we need to update the record metadata: (expanded) row and col groupBys
        temp = this.data.rowGroupBys;
        this.data.groupedBy = this.data.colGroupBys;
        this.data.rowGroupBys = this.data.colGroupBys;
        this.data.colGroupBys = temp;
        temp = this.data.expandedColGroupBys;
        this.data.expandedColGroupBys = this.data.expandedRowGroupBys;
        this.data.expandedRowGroupBys = temp;

        var self = this;
        function twistKey(key) {
            return JSON.stringify(JSON.parse(key).reverse());
        }

        var measurements = {};
        Object.keys(this.measurements).forEach(function (key) {
            var value = self.measurements[key];
            measurements[twistKey(key)] = value;
        });
        this.measurements = measurements;

        var counts = {};
        Object.keys(this.counts).forEach(function (key) {
            var value = self.counts[key];
            counts[twistKey(key)] = value;
        });
        this.counts = counts;
    },
    /**
     * @override
     *
     * @param {Object} [options]
     * @param {boolean} [options.raw=false]
     * @returns {Object}
     */
    get: function (options) {
        options = options || {};
        var raw = options.raw || false;
        var groupBys = this._getGroupBys();
        var state = {
            colGroupBys: groupBys.colGroupBys,
            context: this.data.context,
            domain: this.data.domain,
            fields: this.fields,
            hasData: this._hasData(),
            measures: this.data.measures,
            origins: this.data.origins,
            rowGroupBys: groupBys.rowGroupBys,
        };
        if (!raw && state.hasData) {
            state.table = this._getTable();
        }
        return state;
    },
    /**
     * Returns the total number of columns of the pivot table.
     *
     * @returns {integer}
     */
    getTableWidth: function () {
        var leafCounts = this._getLeafCounts(this.colGroupTree);
        return leafCounts[JSON.stringify(this.colGroupTree.root.values)] + 2;
    },
    /**
     * @override
     *
     * @param {Object} params
     * @param {boolean} [params.compare=false]
     * @param {Object} params.context
     * @param {Object} params.fields
     * @param {Array[]} [params.comparisonTimeRange=[]]
     * @param {string[]} [params.groupedBy]
     * @param {Array[]} [params.timeRange=[]]
     * @param {string[]} params.colGroupBys
     * @param {Array[]} params.domain
     * @param {string[]} params.measures
     * @param {string[]} params.rowGroupBys
     * @param {string} [params.comparisonTimeRangeDescription=""]
     * @param {string} [params.default_order]
     * @param {string} [params.timeRangeDescription=""]
     * @param {string} params.modelName
     * @returns {Promise}
     */
    load: function (params) {
        this.initialDomain = params.domain;
        this.initialRowGroupBys = params.context.pivot_row_groupby || params.rowGroupBys;
        this.defaultGroupedBy = params.groupedBy;

        this.fields = params.fields;
        this.modelName = params.modelName;
        this.data = {
            expandedRowGroupBys: [],
            expandedColGroupBys: [],
            domain: this.initialDomain,
            timeRange: params.timeRange || [],
            timeRangeDescription: params.timeRangeDescription || "",
            comparisonTimeRange: params.comparisonTimeRange || [],
            comparisonTimeRangeDescription: params.comparisonTimeRangeDescription || "",
            compare: params.compare || false,
            context: _.extend({}, session.user_context, params.context),
            groupedBy: params.context.pivot_row_groupby || params.groupedBy,
            colGroupBys: params.context.pivot_column_groupby || params.colGroupBys,
            measures: this._processMeasures(params.context.pivot_measures) || params.measures,
        };

        this.data.domains = this._getDomains();
        this.data.origins = this._getOrigins();
        this.data.rowGroupBys = !_.isEmpty(this.data.groupedBy) ? this.data.groupedBy : this.initialRowGroupBys;

        var defaultOrder = params.default_order && params.default_order.split(' ');
        if (defaultOrder) {
            this.data.sortedColumn = {
                groupId: [[], []],
                measure: defaultOrder[0],
                order: defaultOrder[1] ? defaultOrder [1] : 'asc',
            };
        }
        return this._loadData();
    },
    /**
     * @override
     *
     * @param {any} handle this parameter is ignored
     * @param {Object} params
     * @param {boolean} [params.compare=false]
     * @param {Object} params.context
     * @param {Array[]} [params.comparisonTimeRange=[]]
     * @param {string[]} [params.groupedBy]
     * @param {Array[]} [params.timeRange=[]]
     * @param {Array[]} params.domain
     * @param {string[]} params.groupBy
     * @param {string[]} params.measures
     * @param {string} [params.comparisonTimeRangeDescription=""]
     * @param {string} [params.timeRangeDescription=""]
     * @returns {Promise}
     */
    reload: function (handle, params) {
        var self = this;
        var oldColGroupBys = this.data.colGroupBys;
        var oldRowGroupBys = this.data.rowGroupBys;
        if ('context' in params) {
            this.data.context = params.context;
            this.data.colGroupBys = params.context.pivot_column_groupby || this.data.colGroupBys;
            this.data.groupedBy = params.context.pivot_row_groupby || this.data.groupedBy;
            this.data.measures = this._processMeasures(params.context.pivot_measures) || this.data.measures;
            this.defaultGroupedBy = this.data.groupedBy.length ? this.data.groupedBy : this.defaultGroupedBy;
            var timeRangeMenuData = params.context.timeRangeMenuData;
            if (timeRangeMenuData) {
                this.data.timeRange = timeRangeMenuData.timeRange || [];
                this.data.timeRangeDescription = timeRangeMenuData.timeRangeDescription || "";
                this.data.comparisonTimeRange = timeRangeMenuData.comparisonTimeRange || [];
                this.data.comparisonTimeRangeDescription = timeRangeMenuData.comparisonTimeRangeDescription || "";
                this.data.compare = this.data.comparisonTimeRange.length > 0;
            } else {
                this.data.timeRange = [];
                this.data.timeRangeDescription = "";
                this.data.comparisonTimeRange = [];
                this.data.comparisonTimeRangeDescription = "";
                this.data.compare = false;
                this.data.context = _.omit(this.data.context, 'timeRangeMenuData');
            }
        }
        if ('domain' in params) {
            this.data.domain = params.domain;
        } else {
            this.data.domain = this.initialDomain;
        }
        if ('groupBy' in params) {
            this.data.groupedBy = params.groupBy.length ? params.groupBy : this.defaultGroupedBy;
        }

        if (!_.isEqual(oldRowGroupBys, self.data.rowGroupBys)) {
            this.data.expandedRowGroupBys = [];
        }
        if (!_.isEqual(oldColGroupBys, self.data.colGroupBys)) {
            this.data.expandedColGroupBys = [];
        }
        this.data.domains = this._getDomains();
        this.data.origins = this._getOrigins();
        this.data.rowGroupBys = !_.isEmpty(this.data.groupedBy) ? this.data.groupedBy : this.initialRowGroupBys;

        if (!this._hasData()) {
            return this._loadData();
        }

        var oldRowGroupTree = this.rowGroupTree;
        var oldColGroupTree = this.colGroupTree;
        return this._loadData().then(function () {
            if (_.isEqual(oldRowGroupBys, self.data.rowGroupBys)) {
                self._pruneTree(self.rowGroupTree, oldRowGroupTree);
            }
            if (_.isEqual(oldColGroupBys, self.data.colGroupBys)) {
                self._pruneTree(self.colGroupTree, oldColGroupTree);
            }
        });
    },
    /**
     * Sort the rows, depending on the values of a given column.  This is an
     * in-memory sort.
     *
     * @param {Object} sortedColumn
     */
    sortRows: function (sortedColumn) {
        var self = this;
        var colGroupValues = sortedColumn.groupId[1];
        sortedColumn.originIndexes = sortedColumn.originIndexes || [0];
        this.data.sortedColumn = sortedColumn;

        var sortFunction = function (tree) {
            return function (subTreeKey) {
                var subTree = tree.directSubTrees[subTreeKey];
                var groupIntersectionId = [subTree.root.values, colGroupValues];
                var value = self._getCellValue(
                    groupIntersectionId,
                    sortedColumn.measure,
                    sortedColumn.originIndexes
                ) || 0;
                return sortedColumn.order === 'asc' ? value : -value;
            };
        };

        this._sortTree(sortFunction, this.rowGroupTree);
    },
    /**
     * Toggle the active state for a given measure, then reload the data
     * if this turns out to be necessary.
     *
     * @param {string} fieldName
     * @returns {Promise}
     */
    toggleMeasure: function (fieldName) {
        var index = this.data.measures.indexOf(fieldName);
        if (index !== -1) {
            this.data.measures.splice(index, 1);
            // in this case, we already have all data in memory, no need to
            // actually reload a lesser amount of information
            return Promise.resolve();
        } else {
            this.data.measures.push(fieldName);
        }
        return this._loadData();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Add labels/values in the provided groupTree. A new leaf is created in
     * the groupTree with a root object corresponding to the group with given
     * labels/values.
     *
     * @private
     * @param {Object} groupTree, either this.rowGroupTree or this.colGroupTree
     * @param {string[]} labels
     * @param {Array} values
     */
    _addGroup: function (groupTree, labels, values) {
        var tree = groupTree;
        // we assume here that the group with value value.slice(value.length - 2) has already been added.
        values.slice(0, values.length - 1).forEach(function (value) {
            var key = JSON.stringify(value);
            tree = tree.directSubTrees[key];
        });
        tree.directSubTrees[JSON.stringify(values[values.length - 1])] = {
            root: {
                labels: labels,
                values: values,
            },
            directSubTrees: {},
        };
    },
    /**
     * Compute what should be used as rowGroupBys by the pivot view
     *
     * @private
     * @returns {string[]}
     */
    _computeRowGroupBys: function () {
        return !_.isEmpty(this.data.groupedBy) ? this.data.groupedBy : this.initialRowGroupBys;
    },
    /**
     * Find a group with given values in the provided groupTree, either
     * this.rowGrouptree or this.colGroupTree.
     *
     * @private
     * @param  {Object} groupTree
     * @param  {Array} values
     * @returns {Object}
     */
    _findGroup: function (groupTree, values) {
        var tree = groupTree;
        values.slice(0, values.length).forEach(function (value) {
            var key = JSON.stringify(value);
            tree = tree.directSubTrees[key];
        });
        return tree;
    },
    /**
     * In case originIndex is an array of length 1, thus a single origin
     * index, returns the given measure for a group determined by the id
     * groupId and the origin index.
     * If originIndexes is an array of length 2, we compute the variation
     * ot the measure values for the groups determined by groupId and the
     * different origin indexes.
     *
     * @private
     * @param  {Array[]} groupId
     * @param  {string} measure
     * @param  {number[]} originIndexes
     * @returns {number}
     */
    _getCellValue: function (groupId, measure, originIndexes) {
        var self = this;
        var key = JSON.stringify(groupId);
        if (!self.measurements[key]) {
            return;
        }
        var values = originIndexes.map(function (originIndex) {
            return self.measurements[key][originIndex][measure];
        });
        if (originIndexes.length > 1) {
            return computeVariation(values[0], values[1]);
        } else {
            return values[0];
        }
    },
    /**
     * Returns the principal domains used by the pivot model to fetch data.
     * The domains represent two main groups of records.
     *
     * @private
     * @returns {Array[][]}
     */
    _getDomains: function () {
        var domains = [this.data.domain.concat(this.data.timeRange)];
        if (this.data.compare) {
            domains.push(this.data.domain.concat(this.data.comparisonTimeRange));
        }
        return domains;
    },
    /**
     * TODO
     * @returns {Object} with keys colGroupBys and rowGroupBys
     */
    _getGroupBys: function () {
        return {
            colGroupBys: this.data.colGroupBys.concat(this.data.expandedColGroupBys),
            rowGroupBys: this.data.rowGroupBys.concat(this.data.expandedRowGroupBys),
        };
    },
    /**
     * Returns a domain representation of a group
     *
     * @private
     * @param  {Object} group
     * @param  {Array} group.colValues
     * @param  {Array} group.rowValues
     * @param  {number} group.originIndex
     * @returns {Array[]}
     */
    _getGroupDomain: function (group) {
        var self = this;
        function constructDomain(fieldName, value) {
            var type = self.fields[fieldName].type;
            if (value && _.contains(['date', 'datetime'], type)) {
                var intervalBounds = value.split('/');
                return ['&', [fieldName, '>=', intervalBounds[0]], [fieldName, '<', intervalBounds[1]]];
            }
            return [[fieldName, '=', value]];
        }
        function domain(values, groupBys) {
            return values.reduce(
                function (acc, value, index) {
                    var fieldName = groupBys[index].split(':')[0];
                    acc = acc.concat(constructDomain(fieldName, value));
                    return acc;
                },
                []
            );
        }
        var groupBys = this._getGroupBys();
        var rowDomain = domain(group.rowValues, groupBys.rowGroupBys);
        var colDomain = domain(group.colValues, groupBys.colGroupBys);
        var originDomain = this.data.domains[group.originIndex];
        return [].concat(rowDomain, colDomain, originDomain);
    },
    /**
     * Returns the group sanitized labels.
     *
     * @private
     * @param  {Object} group
     * @param  {string[]} groupBys
     * @returns {string[]}
     */
    _getGroupLabels: function (group, groupBys) {
        var self = this;
        return groupBys.map(function (groupBy) {
            return self._sanitizeLabel(group[groupBy], groupBy);
        });
    },
    /**
     * Returns a promise that returns the annotated read_group results
     * corresponding to a partition of the given group obtained using the given
     * rowGroupBy and colGroupBy.
     *
     * @private
     * @param  {Object} group
     * @param  {string[]} rowGroupBy
     * @param  {string[]} colGroupBy
     * @returns {Promise}
     */
    _getGroupSubdivision: function (group, rowGroupBy, colGroupBy) {
        var self = this;
        var groupDomain = this._getGroupDomain(group);
        var measures = this.data.measures.reduce(
            function (acc, measure) {
                if (measure === '__count') {
                    acc.push(measure);
                    return acc;
                }
                var type = self.fields[measure].type;
                var groupOperator = self.fields[measure].group_operator;
                if (type === 'many2one') {
                    groupOperator = 'count_distinct';
                }
                if (groupOperator === undefined) {
                    throw new Error("No aggregate function has been provided for the measure '" + measure + "'");
                }
                acc.push(measure + ':' + groupOperator);
                return acc;
            },
            []
        );
        var groupBy = rowGroupBy.concat(colGroupBy);
        return this._rpc({
            model: this.modelName,
            method: 'read_group_raw',
            context: this.data.context,
            domain: groupDomain,
            fields: measures,
            groupBy: groupBy,
            lazy: false,
        }).then(function (subGroups) {
            return {
                group: group,
                subGroups: subGroups,
                rowGroupBy: rowGroupBy,
                colGroupBy: colGroupBy
            };
        });
    },
    /**
     * Returns the group sanitized values.
     *
     * @private
     * @param  {Object} group
     * @param  {string[]} groupBys
     * @returns {Array}
     */
    _getGroupValues: function (group, groupBys) {
        var self = this;
        return groupBys.map(function (groupBy) {
            return self._sanitizeValue(group[groupBy]);
        });
    },
    /**
     * Returns the leaf counts of each group inside the given tree.
     *
     * @private
     * @param {Object} tree
     * @returns {Object} keys are group ids
     */
    _getLeafCounts: function (tree) {
        var self = this;
        var leafCounts = {};
        var leafCount;
        if (_.isEmpty(tree.directSubTrees)) {
            leafCount = 1;
        } else {
            leafCount = _.values(tree.directSubTrees).reduce(
                function (acc, subTree) {
                    var subLeafCounts = self._getLeafCounts(subTree);
                    _.extend(leafCounts, subLeafCounts);
                    return acc + leafCounts[JSON.stringify(subTree.root.values)];
                },
                0
            );
        }

        leafCounts[JSON.stringify(tree.root.values)] = leafCount;
        return leafCounts;
    },
    /**
     * Returns the group sanitized measure values for the measures in
     * fieldNames (that migth contain '__count', not really a fieldName).
     *
     * @private
     * @param  {Object} group
     * @param  {string[]} groupBys
     * @returns {Array}
     */
    _getMeasurements: function (group, fieldNames) {
        return fieldNames.reduce(
            function (measurements, fieldName) {
                var measurement = group[fieldName];
                if (measurement instanceof Array) {
                    // case field is many2one and used as measure and groupBy simultaneously
                    measurement = 1;
                }
                if (measurement instanceof Boolean) {
                    measurement = measurement ? 1 : 0;
                }
                if (!measurement) {
                    measurement = 0;
                }
                measurements[fieldName] = measurement;
                return measurements;
            },
            {}
        );
    },
    /**
     * Returns a description of the measures row of the pivot table
     *
     * @private
     * @param {Object[]} columns for which measure cells must be generated
     * @returns {Object[]}
     */
    _getMeasuresRow: function (columns) {
        var self = this;
        var sortedColumn = this.data.sortedColumn || {};
        var measureRow = [];

        columns.forEach(function (column) {
            self.data.measures.forEach(function (measure) {
                var measureCell = {
                    groupId: column.groupId,
                    height: 1,
                    measure: measure,
                    title: self.fields[measure].string,
                    width: 2 * self.data.origins.length - 1,
                };
                if (sortedColumn.measure === measure &&
                    _.isEqual(sortedColumn.groupId, column.groupId)) {
                    measureCell.order = sortedColumn.order;
                }
                measureRow.push(measureCell);
            });
        });

        return measureRow;
    },
    /**
     * Make sure that the labels of different many2one values are distinguished
     * by numbering them if necessary.
     *
     * @private
     * @param {Array} label
     * @param {string} fieldName
     * @returns {string}
     */
    _getNumberedLabel: function (label, fieldName) {
        var id = label[0];
        var name = label[1];
        this.numbering[fieldName] = this.numbering[fieldName] || {};
        this.numbering[fieldName][name] = this.numbering[fieldName][name] || {};
        var numbers = this.numbering[fieldName][name];
        numbers[id] = numbers[id] || _.size(numbers) + 1;
        return name + (numbers[id] > 1 ? "  (" + numbers[id] + ")" : "");
    },
    /**
     * Returns a description of the origins row of the pivot table
     *
     * @private
     * @param {Object[]} columns for which origin cells must be generated
     * @returns {Object[]}
     */
    _getOriginsRow: function (columns) {
        var self = this;
        var sortedColumn = this.data.sortedColumn || {};
        var originRow = [];

        columns.forEach(function (column) {
            var groupId = column.groupId;
            var measure = column.measure;
            var isSorted = sortedColumn.measure === measure &&
                           _.isEqual(sortedColumn.groupId, groupId);
            var isSortedByOrigin = isSorted && !sortedColumn.originIndexes[1];
            var isSortedByVariation = isSorted && sortedColumn.originIndexes[1];

            self.data.origins.forEach(function (origin, originIndex) {
                var originCell = {
                    groupId: groupId,
                    height: 1,
                    measure: measure,
                    originIndexes: [originIndex],
                    title: origin,
                    width: 1,
                };
                if (isSortedByOrigin && sortedColumn.originIndexes[0] === originIndex) {
                    originCell.order = sortedColumn.order;
                }
                originRow.push(originCell);

                if (originIndex > 0) {
                    var variationCell = {
                        groupId: groupId,
                        height: 1,
                        measure: measure,
                        originIndexes: [originIndex - 1, originIndex],
                        title: _t('Variation'),
                        width: 1,
                    };
                    if (isSortedByVariation && sortedColumn.originIndexes[1] === originIndex) {
                        variationCell.order = sortedColumn.order;
                    }
                    originRow.push(variationCell);
                }

            });
        });

        return originRow;
    },
    /**
     * Create an array with the origin descriptions.
     *
     * @private
     * @returns {string[]}
     */
    _getOrigins: function () {
        var origins = [this.data.timeRangeDescription || ""];
        if (this.data.compare) {
            origins.push(this.data.comparisonTimeRangeDescription);
        }
        return origins;
    },
    /**
     * Returns a description of the pivot table.
     *
     * @private
     * @returns {Object}
     */
    _getTable: function () {
        var headers = this._getTableHeaders();
        return {
            headers: headers,
            rows: this._getTableRows(this.rowGroupTree, headers[headers.length - 1]),
        };
    },
    /**
     * Returns the list of header rows of the pivot table: the col group rows
     * (depending on the col groupbys), the measures row and optionnaly the
     * origins row (if there are more than one origins).
     *
     * @private
     * @returns {Object[]}
     */
    _getTableHeaders: function () {
        var colGroupBys = this._getGroupBys().colGroupBys;
        var height = colGroupBys.length + 1;
        var measureCount = this.data.measures.length;
        var originCount = this.data.origins.length;
        var leafCounts = this._getLeafCounts(this.colGroupTree);
        var headers = [];
        var measureColumns = []; // used to generate the measure cells

        // 1) generate col group rows (total row + one row for each col groupby)
        var colGroupRows = (new Array(height)).fill(0).map(function () {
            return [];
        });
        // blank top left cell
        colGroupRows[0].push({
            height: height + 1 + (originCount > 1 ? 1 : 0), // + measures rows [+ origins row]
            title: "",
            width: 1,
        });
        // col groupby cells with group values
        /**
         * Recursive function that generates the header cells corresponding to
         * the groups of a given tree.
         *
         * @param {Object} tree
         */
        function generateTreeHeaders(tree) {
            var group = tree.root;
            var rowIndex = group.values.length;
            var row = colGroupRows[rowIndex];
            var groupId = [[], group.values];
            var isLeaf = _.isEmpty(tree.directSubTrees);
            var leafCount = leafCounts[JSON.stringify(tree.root.values)];
            var cell = {
                groupId: groupId,
                height: isLeaf ? (colGroupBys.length + 1 - rowIndex) : 1,
                isLeaf: isLeaf,
                title: group.labels[group.labels.length - 1] || _t('Total'),
                width: leafCount * measureCount * (2 * originCount - 1),
            };
            row.push(cell);
            if (isLeaf) {
                measureColumns.push(cell);
            }

            _.values(tree.directSubTrees).forEach(function (subTree) {
                generateTreeHeaders(subTree);
            });
        }
        generateTreeHeaders(this.colGroupTree);
        // blank top right cell for 'Total' group (if there is more that one leaf)
        if (leafCounts[JSON.stringify(this.colGroupTree.root.values)] > 1) {
            var groupId = [[], []];
            var totalTopRightCell = {
                groupId: groupId,
                height: height,
                title: "",
                width: measureCount * (2 * originCount - 1),
            };
            colGroupRows[0].push(totalTopRightCell);
            measureColumns.push(totalTopRightCell);
        }
        headers = headers.concat(colGroupRows);

        // 2) generate measures row
        var measuresRow = this._getMeasuresRow(measureColumns);
        headers.push(measuresRow);

        // 3) generate origins row if more than one origin
        if (originCount > 1) {
            headers.push(this._getOriginsRow(measuresRow));
        }

        return headers;
    },
    /**
     * Returns the list of body rows of the pivot table for a given tree.
     *
     * @private
     * @param {Object} tree
     * @param {Object[]} columns
     * @returns {Object[]}
     */
    _getTableRows: function (tree, columns) {
        var self = this;

        var rows = [];
        var group = tree.root;
        var rowGroupId = [group.values, []];
        var title = group.labels[group.labels.length - 1] || _t('Total');
        var indent = group.labels.length;
        var isLeaf = _.isEmpty(tree.directSubTrees);

        var subGroupMeasurements = columns.map(function (column) {
            var colGroupId = column.groupId;
            var groupIntersectionId = [rowGroupId[0], colGroupId[1]];
            var measure = column.measure;
            var originIndexes = column.originIndexes || [0];

            var value = self._getCellValue(groupIntersectionId, measure, originIndexes);

            var measurement = {
                groupId: groupIntersectionId,
                originIndexes: originIndexes,
                measure: measure,
                value: value,
                isBold: !groupIntersectionId[0].length || !groupIntersectionId[1].length,
            };
            return measurement;
        });

        rows.push({
            title: title,
            groupId: rowGroupId,
            indent: indent,
            isLeaf: isLeaf,
            subGroupMeasurements: subGroupMeasurements
        });

        var subTreeKeys = tree.sortedKeys || Object.keys(tree.directSubTrees);
        subTreeKeys.forEach(function (subTreeKey) {
            var subTree = tree.directSubTrees[subTreeKey];
            rows = rows.concat(self._getTableRows(subTree, columns));
        });

        return rows;
    },
    /**
     * returns the height of a given groupTree
     *
     * @private
     * @param  {Object} tree, a groupTree
     * @returns {number}
     */
    _getTreeHeight: function (tree) {
        var subTreeHeights = _.values(tree.directSubTrees).map(this._getTreeHeight.bind(this));
        return Math.max(0, Math.max.apply(null, subTreeHeights)) + 1;
    },
    /**
     * @private
     * @returns {boolean}
     */
    _hasData: function () {
        return (this.counts[JSON.stringify([[], []])] || []).some(function (count) {
            return count > 0;
        });
    },
    /**
     * Initilize/Reinitialize this.rowGroupTree, colGroupTree, measurements,
     * counts and subdivide the group 'Total' as many times it is necessary.
     * A first subdivision with no groupBy (divisors.slice(0, 1)) is made in
     * order to see if there is data in the intersection of the group 'Total'
     * and the various origins. In case there is none, nonsupplementary rpc
     * will be done (see the code of subdivideGroup).
     * Once the promise resolves, this.rowGroupTree, colGroupTree,
     * measurements, counts are correctly set.
     *
     * @private
     * @return {Promise}
     */
    _loadData: function () {
        var self = this;

        this.rowGroupTree = {root: {labels: [], values: []}, directSubTrees: {}};
        this.colGroupTree = {root: {labels: [], values: []}, directSubTrees: {}};
        this.measurements = {};
        this.counts = {};

        var group = {rowValues: [], colValues: []};
        var groupBys = this._getGroupBys();
        var leftDivisors = sections(groupBys.rowGroupBys);
        var rightDivisors = sections(groupBys.colGroupBys);
        var divisors = cartesian(leftDivisors, rightDivisors);

        return this._subdivideGroup(group, divisors.slice(0, 1)).then(function () {
            return self._subdivideGroup(group, divisors.slice(1));
        });
    },
    /**
     * Extract the information in the read_group results (groupSubdivisions)
     * and develop this.rowGroupTree, colGroupTree, measurements, and counts
     * If a column needs to be sorted, the rowGroupTree corresponding to the
     * group is sorted.
     *
     * @private
     * @param  {Object} group
     * @param  {Object[]} groupSubdivisions
     */
    _prepareData: function (group, groupSubdivisions) {
        var self = this;

        var groupRowValues = group.rowValues;
        var groupRowLabels = [];
        var rowSubTree = this.rowGroupTree;
        var root;
        if (groupRowValues.length) {
            // we should have labels information on hand! regretful!
            rowSubTree = this._findGroup(this.rowGroupTree, groupRowValues);
            root = rowSubTree.root;
            groupRowLabels = root.labels;
        }

        var groupColValues = group.colValues;
        var groupColLabels = [];
        if (groupColValues.length) {
            root = this._findGroup(this.colGroupTree, groupColValues).root;
            groupColLabels = root.labels;
        }

        groupSubdivisions.forEach(function (groupSubdivision) {
            groupSubdivision.subGroups.forEach(function (subGroup) {

                var rowValues = groupRowValues.concat(self._getGroupValues(subGroup, groupSubdivision.rowGroupBy));
                var rowLabels = groupRowLabels.concat(self._getGroupLabels(subGroup, groupSubdivision.rowGroupBy));

                var colValues = groupColValues.concat(self._getGroupValues(subGroup, groupSubdivision.colGroupBy));
                var colLabels = groupColLabels.concat(self._getGroupLabels(subGroup, groupSubdivision.colGroupBy));

                if (!colValues.length && rowValues.length) {
                    self._addGroup(self.rowGroupTree, rowLabels, rowValues);
                }
                if (colValues.length && !rowValues.length) {
                    self._addGroup(self.colGroupTree, colLabels, colValues);
                }

                var key = JSON.stringify([rowValues, colValues]);
                var originIndex = groupSubdivision.group.originIndex;

                if (!(key in self.measurements)) {
                    self.measurements[key] = self.data.origins.map(function () {
                        return self._getMeasurements({}, self.data.measures);
                    });
                }
                self.measurements[key][originIndex] = self._getMeasurements(subGroup, self.data.measures);

                if (!(key in self.counts)) {
                    self.counts[key] = self.data.origins.map(function () {
                        return 0;
                    });
                }
                self.counts[key][originIndex] = subGroup.__count;
            });
        });

        if (this.data.sortedColumn) {
            this.sortRows(this.data.sortedColumn, rowSubTree);
        }
    },
    /**
     * In the preview implementation of the pivot view (a.k.a. version 2),
     * the virtual field used to display the number of records was named
     * __count__, whereas __count is actually the one used in xml. So
     * basically, activating a filter specifying __count as measures crashed.
     * Unfortunately, as __count__ was used in the JS, all filters saved as
     * favorite at that time were saved with __count__, and not __count.
     * So in order the make them still work with the new implementation, we
     * handle both __count__ and __count.
     *
     * This function replaces in the given array of measures occurences of
     * '__count__' by '__count'.
     *
     * @private
     * @param {Array[string] || undefined} measures
     * @returns {Array[string] || undefined}
     */
    _processMeasures: function (measures) {
        if (measures) {
            return _.map(measures, function (measure) {
                return measure === '__count__' ? '__count' : measure;
            });
        }
    },
    /**
     * Make any group in tree a leaf if it was a leaf in oldTree.
     *
     * @private
     * @param {Object} tree
     * @param {Object} oldTree
     */
    _pruneTree: function (tree, oldTree) {
        if (_.isEmpty(oldTree.directSubTrees)) {
            tree.directSubTrees = {};
            delete tree.sortedKeys;
            return;
        }
        var self = this;
        Object.keys(tree.directSubTrees).forEach(function (subTreeKey) {
            var index = Object.keys(oldTree.directSubTrees).indexOf(subTreeKey);
            var subTree = tree.directSubTrees[subTreeKey];
            if (index === -1) {
                subTree.directSubTrees = {};
                delete subTreeKey.sortedKeys;
            } else {
                var oldSubTree = oldTree.directSubTrees[subTreeKey];
                self._pruneTree(subTree, oldSubTree);
            }
        });
    },
    /**
     * Extract from a groupBy value a label.
     *
     * @private
     * @param  {any} value
     * @param  {string} groupBy
     * @returns {string}
     */
    _sanitizeLabel: function (value, groupBy) {
        var fieldName = groupBy.split(':')[0];
        if (value === false) {
            return _t("Undefined");
        }
        if (value instanceof Array) {
            if (_.contains(['date', 'datetime'], this.fields[fieldName].type)) {
                return value[1];
            } else {
                return this._getNumberedLabel(value, fieldName);
            }
        }
        if (fieldName && this.fields[fieldName] && (this.fields[fieldName].type === 'selection')) {
            var selected = _.where(this.fields[fieldName].selection, {0: value})[0];
            return selected ? selected[1] : value;
        }
        return value;
    },
    /**
     * Extract from a groupBy value the raw value of that groupBy (discarding
     * a label if any)
     *
     * @private
     * @param {any} value
     * @returns {any}
     */
    _sanitizeValue: function (value) {
        if (value instanceof Array) {
            return value[0];
        }
        return value;
    },
    /**
     * Get all partitions of a given group using the provided list of divisors
     * and enrich the objects of this.rowGroupTree, colGroupTree,
     * measurements, counts.
     *
     * @private
     * @param {Object} group
     * @param {Array[]} divisors
     * @returns
     */
    _subdivideGroup: function (group, divisors) {
        var self = this;

        var key = JSON.stringify([group.rowValues, group.colValues]);

        var proms = this.data.origins.reduce(
            function (acc, origin, originIndex) {
                // if no information on group content is available, we fetch data.
                // if group is known to be empty for the given origin,
                // we don't need to fetch data fot that origin.
                if (!self.counts[key] || self.counts[key][originIndex] > 0) {
                    var subGroup = {rowValues: group.rowValues, colValues: group.colValues, originIndex: originIndex};
                    divisors.forEach(function (divisor) {
                        acc.push(self._getGroupSubdivision(subGroup, divisor[0], divisor[1]));
                    });
                }
                return acc;
            },
            []
        );
        return this._loadDataDropPrevious.add(Promise.all(proms)).then(function (groupSubdivisions) {
            if (groupSubdivisions.length) {
                self._prepareData(group, groupSubdivisions);
            }
        });
    },
    /**
     * Sort recursively the subTrees of tree using sortFunction.
     * In the end each node of the tree has its direct children sorted
     * according to the criterion reprensented by sortFunction.
     *
     * @private
     * @param  {Function} sortFunction
     * @param  {Object} tree
     */
    _sortTree: function (sortFunction, tree) {
        var self = this;
        tree.sortedKeys = _.sortBy(Object.keys(tree.directSubTrees), sortFunction(tree));
        _.values(tree.directSubTrees).forEach(function (subTree) {
            self._sortTree(sortFunction, subTree);
        });
    },
});

return PivotModel;

});
