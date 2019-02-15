odoo.define('web.GraphRenderer', function (require) {
"use strict";

/**
 * The graph renderer turns the data from the graph model into a nice looking
 * svg chart.  This code uses the nvd3 library.
 *
 * Note that we use a custom build for the nvd3, with only the model we actually
 * use.
 */

var AbstractRenderer = require('web.AbstractRenderer');
var config = require('web.config');
var core = require('web.core');
var field_utils = require('web.field_utils');
var dataComparisonUtils = require('web.dataComparisonUtils');

var _t = core._t;
var qweb = core.qweb;
var dateQuotient = dataComparisonUtils.dateQuotient;

var CHART_TYPES = ['pie', 'bar', 'line'];

// hide top legend when too many items for device size
var MAX_LEGEND_LENGTH = 25 * (Math.max(1, config.device.size_class));

return AbstractRenderer.extend({
    className: "o_graph_renderer",
    /**
     * @override
     * @param {Widget} parent
     * @param {Object} state
     * @param {Object} params
     * @param {boolean} params.stacked
     */
    init: function (parent, state, params) {
        this._super.apply(this, arguments);
        this.fields = params.fields || {};
        this.isComparison = !!state.dataPoints.comparisonData;
        this.isEmbedded = params.isEmbedded;
        this.stacked = this.isComparison ? false : params.stacked;
        this.title = params.title || '';
    },
    /**
     * @override
     */
    destroy: function () {
        nv.utils.offWindowResize(this.to_remove);
        this._super();
    },
    /**
     * The graph view uses the nv(d3) lib to render the graph. This lib requires
     * that the rendering is done directly into the DOM (so that it can correctly
     * compute positions). However, the views are always rendered in fragments,
     * and appended to the DOM once ready (to prevent them from flickering). We
     * here use the on_attach_callback hook, called when the widget is attached
     * to the DOM, to perform the rendering. This ensures that the rendering is
     * always done in the DOM.
     *
     * @override
     */
    on_attach_callback: function () {
        this._super.apply(this, arguments);
        this.isInDOM = true;
        this._render();
    },
    /**
     * @override
     */
    on_detach_callback: function () {
        this._super.apply(this, arguments);
        this.isInDOM = false;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     * @param {Object} state
     * @param {Object} params
     */
    updateState: function (state, params) {
        this.isComparison = !!state.dataPoints.comparisonData;
        this.stacked = this.isComparison ? false : params.stacked;
        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Render the chart.
     *
     * Note that This method is synchronous, but the actual rendering is done
     * asynchronously.  The reason for that is that nvd3/d3 needs to be in the
     * DOM to correctly render itself.  So, we trick Odoo by returning
     * immediately, then we render the chart when the widget is in the DOM.
     *
     * @override
     * @private
     * @returns {Deferred} The _super deferred is actually resolved immediately
     */
    _render: function () {
        if (this.to_remove) {
            nv.utils.offWindowResize(this.to_remove);
        }
        if (!_.contains(CHART_TYPES, this.state.mode)) {
            this.$el.empty();
            this.trigger_up('warning', {
                title: _t('Invalid mode for chart'),
                message: _t('Cannot render chart with mode : ') + this.state.mode
            });
        } else if (!this.state.dataPoints.data.length &&  this.state.mode !== 'pie') {
            this.$el.empty();
            this.$el.append(qweb.render('GraphView.error', {
                title: _t("No data to display"),
                description: _t("Try to add some records, or make sure that " +
                    "there is no active filter in the search bar."),
            }));
        } else if (this.isInDOM) {
            // only render the graph if the widget is already in the DOM (this
            // happens typically after an update), otherwise, it will be
            // rendered when the widget will be attached to the DOM (see
            // 'on_attach_callback')
            this._renderGraph();
        }
        return this._super.apply(this, arguments);
    },

    _prepareDataSets: function (dataPoints) {
        var measure = this.fields[this.state.measure].string;

        var comparisonField = this.state.comparisonField;
        var groupBys = this.state.groupedBy.map(function (gb) {
            return gb.split(":")[0];
        });
        var specialIndex = groupBys.indexOf(comparisonField);
        var quotient;
        if (specialIndex !== -1) {
            var comparisonFieldValues = {};
            dataPoints.forEach(function (dataPt) {
                if (!(dataPt.origin in comparisonFieldValues)) {
                    comparisonFieldValues[dataPt.origin] = [];
                }
                comparisonFieldValues[dataPt.origin].push(dataPt.labels[specialIndex]);
            });
            comparisonFieldValues.data = _.uniq(comparisonFieldValues.data);
            comparisonFieldValues.comparisonData = _.uniq(comparisonFieldValues.comparisonData);
            var interval = this.state.groupedBy[specialIndex].split(":")[1] || 'month';
            quotient = dateQuotient(comparisonFieldValues.data, comparisonFieldValues.comparisonData, interval);
        }

        // proj is the product function (id, ..., quotient, ... id)
        var proj = function (labels, origin) {
            return labels.map(function (label, index) {
                if (index === specialIndex) {
                    var key = origin === 'data'? 0 : 1;
                    return quotient(key)(label);
                }
                return label;
            });
        };

        function x(dataPt) {
            // first groupBy or measure
            return proj(dataPt.labels, dataPt.origin).slice(0, 1).join("/") || measure;
        }
        function y(dataPt) {
            return dataPt.value;
        }
        function z(dataPt) {
            // second to last groupBys or measure
            var z = proj(dataPt.labels, dataPt.origin).slice(1).join("/") || measure;
            if (dataPt.origin === 'comparisonData') {
                z = '(comparison period) ' + z;
            }
            return z;
        }

        // dataPoints --> points separated into different groups
        var graphs = {};
        var groupOrigins = {};
        dataPoints.forEach(function (dataPt) {
            var groupLabel = z(dataPt);
            if (!(groupLabel in graphs)) {
                graphs[groupLabel] = {};
                // dataPoints with same groupLabel are from same origin
                groupOrigins[groupLabel] = dataPt.origin;
            }
            graphs[groupLabel][x(dataPt)] = y(dataPt);
        });

        // get x image of dataPoints set
        var xRange = _.uniq(dataPoints.map(x));
        var complete = specialIndex !== 0;

        // Each group is completed to have points over each x in xrange
        // and transformed into a single datum for nvd3 (TO DO: replace nvd3 by chart.js)
        var data = Object.keys(graphs).map(function (groupLabel) {
            var points = xRange.reduce(
                function (acc, x) {
                    if (graphs[groupLabel][x] !== undefined || complete) {
                        acc.push({
                            x: x,
                            y: graphs[groupLabel][x] || 0
                        });
                    }
                    return acc;
                },
                []
            );
            return {
                key: groupLabel,
                values: points
            };
        });

        return {
            data: data,
            ticksLabels: xRange,
            groupOrigins: groupOrigins,
        };
    },

    /**
     * Helper function to set up data properly for the multiBarChart model in
     * nvd3.
     *
     * @returns {nvd3 chart}
     */
    _renderBarChart: function () {
        var self = this;

        // prepare data for bar chart
        var dataPoints = _.flatten(_.values(this.state.dataPoints));
        dataPoints = dataPoints.filter(function (dataPt) {
            return dataPt.count > 0;
        });

        // put data in a format for nvd3
        var dataProcessed = this._prepareDataSets(dataPoints);
        var data = dataProcessed.data;
        var groupOrigins = dataProcessed.groupOrigins;

        // style data
        if (this.state.groupedBy.length === 1 && this.isComparison) {
            data.forEach(function (group) {
                if (groupOrigins[group.key] === 'comparisonData') {
                    group.color = '#ff7f0e';
                }
            });
        }

        // nvd3 specific
        var $svgContainer = $('<div/>', {class: 'o_graph_svg_container'});
        this.$el.append($svgContainer);
        var svg = d3.select($svgContainer[0]).append('svg');
        svg.datum(data);

        svg.transition().duration(0);

        var chart = nv.models.multiBarChart();
        chart.options({
          margin: {left: 80, bottom: 100, top: 80, right: 0},
          delay: 100,
          transition: 10,
          controlLabels: {
            'grouped': _t('Grouped'),
            'stacked': _t('Stacked'),
          },
          showLegend: _.size(data) <= MAX_LEGEND_LENGTH,
          showXAxis: true,
          showYAxis: true,
          rightAlignYAxis: false,
          stacked: this.stacked,
          reduceXTicks: false,
          rotateLabels: -20,
          showControls: (this.state.groupedBy.length > 1)
        });
        chart.yAxis.tickFormat(function (d) {
            var measure_field = self.fields[self.measure];
            return field_utils.format.float(d, {
                digits: measure_field && measure_field.digits || [69, 2],
            });
        });

        chart(svg);
        return chart;
    },
    /**
     * Helper function to set up data properly for the pieChart model in
     * nvd3.
     *
     * returns undefined in the case of an non-embedded pie chart with no data.
     * (all zero data included)
     *.
     * @returns {nvd3 chart|undefined}
     */
    _renderPieChart: function (dataKey) {
        var data = [];
        var all_negative = true;
        var some_negative = false;
        var all_zero = true;

        var dataPoints = this.state.dataPoints[dataKey].filter(function (dataPt) {
            return dataPt.count > 0;
        });
        dataPoints.forEach(function (datapt) {
            all_negative = all_negative && (datapt.value < 0);
            some_negative = some_negative || (datapt.value < 0);
            all_zero = all_zero && (datapt.value === 0);
        });
        if (some_negative && !all_negative) {
            this.$el.append(qweb.render('GraphView.error', {
                title: _t("Invalid data"),
                description: _t("Pie chart cannot mix positive and negative numbers. " +
                    "Try to change your domain to only display positive results"),
            }));
            return;
        }
        if (all_zero) {
            if (this.isEmbedded || this.isComparison) {
                // add fake data to display an empty pie chart
                data = [{
                    x : "No data" ,
                    y : 1
                }];
            } else {
                this.$el.append(qweb.render('GraphView.error', {
                    title: _t("Invalid data"),
                    description: _t("Pie chart cannot display all zero numbers.. " +
                        "Try to change your domain to display positive results"),
                }));
                return;
            }
        } else {
            if (this.state.groupedBy.length) {
                data = dataPoints.map(function (datapt) {
                    return {
                        x: datapt.labels.join("/"),
                        y: datapt.value,
                    };
                });
            }
        }

        var $svgContainer = $('<div/>', {class: 'o_graph_svg_container'});
        this.$el.append($svgContainer);
        var svg = d3.select($svgContainer[0]).append('svg');
        svg.datum(data);

        svg.transition().duration(100);

        var color;
        var legend_right = config.device.size_class > config.device.SIZES.VSM;
        if (all_zero) {
            color = (['lightgrey']);
            svg.append("text")
                .attr("text-anchor", "middle")
                .attr("x", "50%")
                .attr("y", "50%")
                .text(_t("No data to display"));
        } else {
            color = d3.scale.category10().range();
        }

        var chart = nv.models.pieChart().labelType('percent');
        chart.options({
          delay: 250,
          showLegend: !all_zero && (legend_right || _.size(data) <= MAX_LEGEND_LENGTH),
          legendPosition: legend_right ? 'right' : 'top',
          transition: 100,
          color: color,
          showLabels: all_zero ? false: true,
        });

        chart(svg);
        return chart;
    },
    /**
     * Helper function to set up data properly for the line model in
     * nvd3.
     *
     * @returns {nvd3 chart}
     */
    _renderLineChart: function () {
        var self = this;

        // remove some data points
        // TO DO: chose best type for this.state.dataPoints!!!
        var dataPoints = _.mapObject(this.state.dataPoints, function (dataPts, dataKey) {
            return dataPts.filter(function (dataPt) {
                return dataPt.labels[0] !== _t("Undefined");
            });
        });
        dataPoints = _.flatten(_.values(dataPoints));

        var dataProcessed = this._prepareDataSets(dataPoints);
        var data = dataProcessed.data;
        var ticksLabels = dataProcessed.ticksLabels;
        var groupOrigins = dataProcessed.groupOrigins;

        // style data
        if (this.state.groupedBy.length === 1 && this.isComparison) {
            data.forEach(function (group) {
                if (groupOrigins[group.key] === 'comparisonData') {
                    group.color = '#ff7f0e';
                } else {
                    group.area = true;
                }
            });
        }
        data.forEach(function (group) {
            group.values = group.values.map(function (value) {
                return {
                    x: ticksLabels.indexOf(value.x),
                    y: value.y
                };
            });
        });

        // nvd3 specific
        var $svgContainer = $('<div/>', {class: 'o_graph_svg_container'});
        this.$el.append($svgContainer);
        var svg = d3.select($svgContainer[0]).append('svg');
        svg.datum(data);

        svg.transition().duration(0);

        var chart = nv.models.lineChart();
        chart.options({
          margin: {left: 0, bottom: 20, top: 0, right: 0},
          useInteractiveGuideline: true,
          showLegend: _.size(data) <= MAX_LEGEND_LENGTH,
          showXAxis: true,
          showYAxis: true,
          stacked: true,
        });
        chart.forceY([0]);
        chart.xAxis
            .tickFormat(function (d) {
                return ticksLabels[d];
            });
        chart.yAxis
            .showMaxMin(false)
            .tickFormat(function (d) {
                return field_utils.format.float(d, {
                    digits : self.fields[self.state.measure] && self.fields[self.state.measure].digits || [69, 2],
                });
            });
        chart.yAxis.tickPadding(5);
        chart.yAxis.orient("right");

        chart(svg);

        // Bigger line (stroke-width 1.5 is hardcoded in nv.d3)
        $svgContainer.find('.nvd3 .nv-groups g.nv-group').css('stroke-width', '2px');

        // Delete first and last label because there is no enough space because
        // of the tiny margins.
        if (ticksLabels.length > 3) {
            $svgContainer.find('svg .nv-x g.nv-axisMaxMin-x > text').hide();
        }

        return chart;
    },
    /**
     * Renders the graph according to its type. This function must be called
     * when the renderer is in the DOM (for nvd3 to render the graph correctly).
     *
     * @private
     */
    _renderGraph: function () {
        var self = this;

        this.$el.empty();

        function chartResize (chart){
            if (chart && chart.tooltip.chartContainer) {
                self.to_remove = chart.update;
                nv.utils.onWindowResize(chart.update);
                chart.tooltip.chartContainer(self.$('.o_graph_svg_container').last()[0]);
            }
        }
        var chart = this['_render' + _.str.capitalize(this.state.mode) + 'Chart']('data');

        if (chart) {
            chart.dispatch.on('renderEnd', function () {
                // FIXME: When 'orient' is right for Y axis, horizontal lines aren't displayed correctly
                $('.nv-y .tick > line').attr('x2', function (i, value) {
                    return Math.abs(value);
                });
            });
            chartResize(chart);
        }

        if (this.state.mode === 'pie' && this.isComparison) {
            // Render graph title
            var timeRangeMenuData = this.state.context.timeRangeMenuData;
            var chartTitle = this.title + ' (' + timeRangeMenuData.timeRangeDescription + ')';
            this.$('.o_graph_svg_container').last().prepend($('<label/>', {
                text: chartTitle,
            }));

            // Instantiate comparison graph
            var comparisonChart = this['_render' + _.str.capitalize(this.state.mode) + 'Chart']('comparisonData');
            // Render comparison graph title
            var comparisonChartTitle = this.title + ' (' + timeRangeMenuData.comparisonTimeRangeDescription + ')';
            this.$('.o_graph_svg_container').last().prepend($('<label/>', {
                text: comparisonChartTitle,
            }));
            chartResize(comparisonChart);
            if (chart) {
                chart.update();
            }
        } else if (this.title) {
            this.$('.o_graph_svg_container').last().prepend($('<label/>', {
                text: this.title,
            }));
        }
    },
});

});
