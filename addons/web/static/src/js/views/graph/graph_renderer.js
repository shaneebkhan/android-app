odoo.define('web.GraphRenderer', function (require) {
    "use strict";

    /**
     * The graph renderer turns the data from the graph model into a nice looking
     * canvas chart.  This code uses the Chart.js library.
     */

    var AbstractRenderer = require('web.AbstractRenderer');
    var config = require('web.config');
    var core = require('web.core');
    var dataComparisonUtils = require('web.dataComparisonUtils');
    var fieldUtils = require('web.field_utils');

    var _t = core._t;
    var DateClasses = dataComparisonUtils.DateClasses;
    var qweb = core.qweb;

    var CHART_TYPES = ['pie', 'bar', 'line'];

    var COLORS = ["#1f77b4", "#ff7f0e", "#aec7e8", "#ffbb78", "#2ca02c", "#98df8a", "#d62728",
        "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "#c49c94", "#e377c2", "#f7b6d2",
        "#7f7f7f", "#c7c7c7", "#bcbd22", "#dbdb8d", "#17becf", "#9edae5"];
    var COLOR_NB = COLORS.length;
    function hexToRGBA(hex, opacity) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        var rgb = result.slice(1, 4).map(function (n) {
            return parseInt(n, 16);
        }).join(',');
        return 'rgba(' + rgb + ',' + opacity + ')';
    }

    // used to format values in tooltips and yAxes.
    var FORMAT_OPTIONS = {
        // allow to decide if utils.human_number should be used
        humanReadable: function (value) {
            return Math.abs(value) >= 1000;
        },
        // with the choices below, 1236 is represented by 1.24k
        minDigits: 1,
        decimals: 2,
        // avoid comma separators for thousands in numbers when human_number is used
        formatterCallback: function (str) {
            return str;
        },
    };

    var NO_DATA = [_t('No data')];
    NO_DATA.isNoData = true;

    // hide top legend when too many items for device size
    var MAX_LEGEND_LENGTH = 4 * (Math.max(1, config.device.size_class));

    return AbstractRenderer.extend({
        className: "o_graph_renderer",
        /**
         * @override
         * @param {Widget} parent
         * @param {Object} state
         * @param {Object} params
         * @param {boolean} [params.isEmbedded]
         * @param {Object} [params.fields]
         * @param {string} [params.title]
         */
        init: function (parent, state, params) {
            this._super.apply(this, arguments);
            this.isEmbedded = params.isEmbedded || false;
            this.title = params.title || '';
            this.fields = params.fields || {};
            this.chart = null;
            this.chartId = _.uniqueId('chart');
            this.isStackable = null;
        },
        /**
         * @override
         */
        updateState: function () {
            return this._super.apply(this, arguments);
        },
        /**
         * TO DO: apparently, a canevas used by Chart.js to draw a chart does
         * not need to be in the dom. We could avoid the use of on_attach_callback
         * and on_detach_callback.
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
        // Private
        //--------------------------------------------------------------------------

        /**
         * Filter out some dataPoints because they would lead to bad graphics.
         * The filtering is done with respect to the graph view mode.
         * Note that the method does not alter this.state.dataPoints, since we
         * want to be able to change of mode without fetching data again:
         * we simply present the same data in a different way.
         *
         * @private
         * @returns {Object[]}
         */
        _filterDataPoints: function () {
            var dataPoints = [];
            if (_.contains(['bar', 'pie'], this.state.mode)) {
                dataPoints = this.state.dataPoints.filter(function (dataPt) {
                    return dataPt.count > 0;
                });
            } else if (this.state.mode === 'line') {
                var counts = 0;
                this.state.dataPoints.forEach(function (dataPt) {
                    if (dataPt.labels[0] !== _t("Undefined")) {
                        dataPoints.push(dataPt);
                    }
                    counts += dataPt.count;
                });
                // data points with zero count might have been created on purpose
                // we only remove them if there are no data point with positive count
                if (counts === 0) {
                    dataPoints = [];
                }
            }
            return dataPoints;
        },
        /**
         * Used to avoid too long legend items
         *
         * @private
         * @param {string} label
         * @returns {string} shortened version of the input label
         */
        _shortenLabel: function (label) {
            // string returned could be 'wrong' if a groupby value contain a '/'!
            var groups = label.split("/");
            var shortLabel = groups.slice(0, 3).join("/");
            if (shortLabel.length > 30) {
                shortLabel = shortLabel.slice(0, 30) + '...';
            } else if (groups.length > 3) {
                shortLabel = shortLabel + '/...';
            }
            return shortLabel;
        },
        /**
         * Used to format correctly the values in tooltips and yAxes
         *
         * @private
         * @param {number} value
         * @returns {string} The value formatted using fieldUtils.format.float
         */
        _formatValue: function (value) {
            var measureField = this.fields[this.state.measure];
            var formatter = fieldUtils.format.float;
            var formatedValue = formatter(value, measureField, FORMAT_OPTIONS);
            return formatedValue;
        },
        /**
         * Used any time we need a new color in our charts.
         *
         * @private
         * @param {number} index
         * @returns {string} a color in HEX format
         */
        _getColor: function (index) {
            return COLORS[index % COLOR_NB];
        },
        /**
         * Determines the initial section of the labels array
         * over a dataset has to be completed. The section only depends
         * on the datasets origins.
         *
         * @private
         * @param {number} originIndex
         * @param {number} defaultLength
         * @returns {number}
         */
        _getDatasetDataLength: function (originIndex, defaultLength) {
            if (_.contains(['bar', 'line'], this.state.mode) && this.state.comparisonFieldIndex === 0) {
                return this.dateClasses.dateSets[originIndex].length;
            }
            return defaultLength;
        },
        /**
         * Determines to which dataset belong the data point
         *
         * @private
         * @param {Object} dataPt
         * @returns {string}
         */
        _getDatasetLabel: function (dataPt) {
            if (_.contains(['bar', 'line'], this.state.mode)) {
                // ([origin] + second to last groupBys) or measure
                var datasetLabel = dataPt.labels.slice(1).join("/");
                if (this.state.origins.length > 1) {
                    datasetLabel = this.state.origins[dataPt.originIndex] +
                        (datasetLabel ? ('/' + datasetLabel) : '');
                }
                datasetLabel = datasetLabel || this.fields[this.state.measure].string;
                return datasetLabel;
            }
            return this.state.origins[dataPt.originIndex];
        },
        /**
         * Returns a DateClasses instance used to manage equivalence of dates.
         *
         * @private
         * @param {Object[]} dataPoints
         * @returns {DateClasses}
         */
        _getDateClasses: function (dataPoints) {
            var self = this;
            var dateSets = this.state.origins.map(function () {
                return [];
            });
            dataPoints.forEach(function (dataPt) {
                dateSets[dataPt.originIndex].push(dataPt.labels[self.state.comparisonFieldIndex]);
            });
            dateSets = dateSets.map(function (dateSet) {
                return _.uniq(dateSet);
            });
            return new DateClasses(dateSets);
        },
        /**
         * Determines over which label is the data point
         *
         * @private
         * @param {Object} dataPt
         * @returns {Array}
         */
        _getLabel: function (dataPt) {
            var i = this.state.comparisonFieldIndex;
            if (_.contains(['bar', 'line'], this.state.mode)) {
                if (i === 0) {
                    return [this.dateClasses.dateClass(dataPt.originIndex, dataPt.labels[i])];
                } else {
                    return dataPt.labels.slice(0, 1);
                }
            } else if (i >= 0) {
                return Array.prototype.concat.apply([], [
                    dataPt.labels.slice(0, i),
                    this.dateClasses.dateClass(dataPt.originIndex, dataPt.labels[i]),
                    dataPt.labels.slice(i + 1)
                ]);
            } else {
                return dataPt.labels;
            }
        },
        /**
         * @private
         * Leaving legend element handler.
         * If there's a tooltip in the DOM it'll be removed
         */
        _LeaveLegendTootip: function () {
            var tooltipEl = document.getElementById('chartjs-tooltip-legend');
            if (tooltipEl) {
                tooltipEl.remove();
            }
        },
        /**
         * If the name has been shortened this function will create a a tooltip that displays the full text.
         * @private
         * @param {MouseEvent} e
         * @param {Object} legendItem see chartjs documentation: https://www.chartjs.org/docs/latest/configuration/legend.html
         */
        _CreateLegendTooltip: function (e, legendItem) {
            var tooltipEl = document.getElementById('chartjs-tooltip-legend');
            if (legendItem.text === legendItem.textFull) {
                return;
            }
            var chartAreaLeft = this.chart.chartArea.left;
            var chartAreaRight = this.chart.chartArea.right;
            if (!tooltipEl) {
                tooltipEl = document.createElement('div');
                tooltipEl.id = "chartjs-tooltip-legend";
                tooltipEl.classList.add("o_tooltip_legend");
                tooltipEl.style.maxWidth = chartAreaRight - chartAreaLeft - 50 + 'px';
                this.el.appendChild(tooltipEl);
                tooltipEl.innerHTML = "";
                tooltipEl.innerHTML = legendItem.textFull;
                tooltipEl.style.top = e.y - 140 + 'px';
                tooltipEl.style.left = chartAreaRight - tooltipEl.clientWidth + 'px';
            }
        },
        /**
         * Returns the options used to generate the chart legend.
         *
         * @private
         * @param {number} datasetsCount
         * @returns {Object}
         */
        _getLegendOptions: function (datasetsCount) {
            var legendOptions = {
                display: datasetsCount <= MAX_LEGEND_LENGTH,
                position: config.device.size_class > config.device.SIZES.VSM ? 'right' : 'top',
                onHover: this._CreateLegendTooltip.bind(this),
                onLeave: this._LeaveLegendTootip.bind(this),
            };
            var self = this;
            if (_.contains(['bar', 'line'], this.state.mode)) {
                var referenceColor;
                if (this.state.mode === 'bar') {
                    referenceColor = 'backgroundColor';
                } else {
                    referenceColor = 'borderColor';
                }
                legendOptions.labels = {
                    generateLabels: function (chart) {
                        var data = chart.data;
                        return data.datasets.map(function (dataset, i) {
                            return {
                                text: self._shortenLabel(dataset.label),
                                textFull: dataset.label,
                                fillStyle: dataset[referenceColor],
                                hidden: !chart.isDatasetVisible(i),
                                lineCap: dataset.borderCapStyle,
                                lineDash: dataset.borderDash,
                                lineDashOffset: dataset.borderDashOffset,
                                lineJoin: dataset.borderJoinStyle,
                                lineWidth: dataset.borderWidth,
                                strokeStyle: dataset[referenceColor],
                                pointStyle: dataset.pointStyle,
                                datasetIndex: i,
                            };
                        });
                    },
                };
            } else {
                legendOptions.labels = {
                    generateLabels: function (chart) {
                        var data = chart.data;
                        var metaData = data.datasets.map(function (dataset, index) {
                            return chart.getDatasetMeta(index).data;
                        });
                        return data.labels.map(function (label, i) {
                            var hidden = metaData.reduce(
                                function (hidden, data) {
                                    if (data[i]) {
                                        hidden = hidden || data[i].hidden;
                                    }
                                    return hidden;
                                },
                                false
                            );
                            var text = self._shortenLabel(self._relabelling(label));
                            return {
                                text: text,
                                fillStyle: label.isNoData ? '#d3d3d3' : self._getColor(i),
                                hidden: hidden,
                                index: i,
                            };
                        });
                    },
                };
            }
            return legendOptions;
        },
        /**
         * Returns the options used to generate the chart axes.
         *
         * @private
         * @returns {Object}
         */
        _getScaleOptions: function () {
            var self = this;
            if (_.contains(['bar', 'line'], this.state.mode)) {
                return {
                    xAxes: [{
                        type: 'category',
                        scaleLabel: {
                            display: this.state.groupBy.length && !this.isEmbedded,
                            labelString: this.state.groupBy.length ?
                                this.fields[this.state.groupBy[0].split(':')[0]].string : '',
                        },
                        ticks: {
                            // don't use bind:  callback is called with 'index' as second parameter
                            // with value labels.indexOf(label)!
                            callback: function (label) {
                                return self._relabelling(label);
                            },
                        },
                    }],
                    yAxes: [{
                        type: 'linear',
                        scaleLabel: {
                            display: !this.isEmbedded,
                            labelString: this.fields[this.state.measure].string,
                        },
                        stacked: this.state.mode === 'bar' && this.state.stacked,
                        ticks: {
                            callback: this._formatValue.bind(this),
                            suggestedMin: 0,
                            mirror: true,
                        }
                    }],
                };
            }
            return {};
        },
        /**
         * build the tooltip label
         * @param {Object} dataset are the datasets to be displayed
         * @param {Array} label
         * @return {string} returns builded label
         */
        _buildLabel: function (dataset, label) {
            label = this._relabelling(label, dataset.originIndex);
            if (this.state.groupBy.length > 1 || this.state.origins.length > 1) {
                label = label + "/" + dataset.label;
            }
            return label;
        },
        /**
         * This function extracts the informations that are going to be displayed for each dataset
         * @param {Object} datasets are the datasets to be displayed
         * @param {number} yLabel is the abscisse of the tolltil
         * @param {Object} tooltipModel see chartjs documentation
         * @param {Array} label
         * @return {Object[]} contains in order by count the informations necessary to display the tooltip
         *
         */
        _GetDisplayTooltipValues: function (datasets, yLabel, tooltipModel, label) {
            var self = this;
            var datasetsDisplayValues = [];
            //removes dataset that has no data for a given abscisse
            datasets = datasets.filter(function (item, i) {
                return item.data[yLabel] !== undefined && self.chart.isDatasetVisible(i);
            });
            datasets.forEach(function (dataset, i) {
                var buildLabel = self._buildLabel(dataset, label);
                var value = self._formatValue(dataset.data[yLabel]);
                var color = tooltipModel.labelColors[i].backgroundColor;
                datasetsDisplayValues.push({ label: buildLabel, value: value, color: color });
            });
            datasetsDisplayValues.sort(function (tr1, tr2) {
                return tr2.value - tr1.value;
            });
            return datasetsDisplayValues;
        },
        /**
         * This function aims to compute the number of lines that have to be slice of the tooltip for it being able to fit on the chart canvas
         * It then proceed to slicing the unwanted lines.
         * sizeOneLine contains the size taken by one line (dataset)
         * @param {DOM Element} tooltipEl this element contains the tooltip div
         * @param {number} maxTooltipHeight this the max height in pixels of the tooltip
         * @param {DOM elemnts[]} trArray contains the lines of the tooltip
         * @param {DOM element} tbody contains the table tbody of tooltip
         */
        _AdjustTooltipHeight: function (tooltipEl, maxTooltipHeight, trArray, tbody) {
            var sizeOneLine = tooltipEl.clientHeight / this.chart.config.data.datasets.length;
            var numberOfLinesToRemoved = Math.round((tooltipEl.clientHeight - maxTooltipHeight) / sizeOneLine);
            for (var i = 0; i < numberOfLinesToRemoved; i++) {
                var trToRemove = trArray.pop();
                trToRemove.parentNode.removeChild(trToRemove);
            }
            var tr = document.createElement('tr');
            var td = document.createElement('td');
            td.style.textAlign = "center";
            td.innerHTML = "There are " + numberOfLinesToRemoved + " more to show";
            tr.appendChild(td);
            tbody.appendChild(tr);
        },
        /**
         * This function compute the left position of the tooltip to avoid the tooltip to be positionned over the chart's limit
         * @param {DOM Element} tooltipEl this element contains the tooltip div
         * @param {Object} position position of the tooltip
         * @param {Object} tooltipModel see chartjs documentation
         * @param {Number} chartAreaLeft left border of the chart
         * @param {Number} chartAreaRight right border of the chart
         * @return {Number} leftPosition the left position of the tooltip after potential corrections
         */
        _AdjustTooltipLeftPosition: function (tooltipEl, position, tooltipModel, chartAreaLeft, chartAreaRight) {
            var tooltilWidth = tooltipEl.clientWidth;
            var leftPosition = position.left + window.pageXOffset + tooltipModel.caretX - tooltilWidth / 2;
            if (leftPosition < chartAreaLeft) {
                leftPosition += tooltilWidth / 2;
            } else if (leftPosition > chartAreaRight - tooltilWidth / 2) {
                leftPosition -= tooltilWidth / 2;
            }
            return leftPosition + 'px';
        },
        /**
         * This function compute the top position of the tooltip to avoid the tooltip to be positionned over the chart's limit
         * @param {DOM Element} tooltipEl this element contains the tooltip div
         * @param {Object} position position of the tooltip
         * @param {Object} tooltipModel see chartjs documentation
         * @param {Number} chartAreaBottom bottom border of the chart
         * @param {Number} chartAreaTop top border of the chart
         * @return {Number} topPosition the left position of the tooltip after potential corrections
         */
        _AdjustTooltipTopPosition: function (tooltipEl, position, tooltipModel, chartAreaBottom, chartAreaTop) {
            if (this.isEmbedded) {
                return '85px';
            } else {
                var tooltipHeight = tooltipEl.clientHeight;
                var topPosition = position.top + window.pageYOffset + tooltipModel.caretY - 160;
                var bottomPosition = topPosition + tooltipHeight;
                if (bottomPosition > chartAreaBottom) {
                    topPosition -= bottomPosition - chartAreaBottom + 5;
                } else if (topPosition < chartAreaTop) {
                    topPosition -= topPosition - chartAreaTop - 5;
                }
                tooltipEl.style.top = topPosition + 'px';
            }
        },
        /**
         * This function creates a custom HTML tooltip.
         * @param {Object} tooltipModel see chartjs documentation for more info https://www.chartjs.org/docs/latest/configuration/tooltip.html
         */
        _customTooltip: function (tooltipModel) {
            var tooltipFontSize = 10;
            var tooltipPaddingBottom = 0;
            if (tooltipModel.dataPoints) {
                var yLabel = tooltipModel.dataPoints[0].index;
            }
            var tooltipEl = document.getElementById('chartjs-tooltip');
            var chartAreaTop = this.chart.chartArea.top;
            var chartAreaBottom = this.chart.chartArea.bottom;
            var chartAreaLeft = this.chart.chartArea.left;
            var chartAreaRight = this.chart.chartArea.right;
            var maxTooltipWidth = (chartAreaRight - chartAreaLeft) / 3;
            var maxTooltipHeight = window.innerHeight - 250;
            if (!tooltipEl) {
                tooltipEl = document.createElement('div');
                tooltipEl.id = 'chartjs-tooltip';
                tooltipEl.classList.add("o_tooltip_graph");
                this.el.appendChild(tooltipEl);
            }
            if (tooltipModel.opacity === 0) {
                tooltipEl.style.opacity = 0;
                return;
            }
            if (tooltipModel.body) {
                tooltipEl.innerHTML = "";
                var table = document.createElement('table');
                var thead = document.createElement('thead');
                var thLabel = document.createElement('th');
                var thCount = document.createElement('th');
                var tbody = document.createElement('tbody');
                table.classList.add('overflow');
                table.style.fontSize = tooltipFontSize + 'px';
                thLabel.innerHTML = "Label";
                thLabel.style.paddingBottom = tooltipPaddingBottom + 'px';
                thCount.classList.add('count');
                thCount.style.paddingBottom = tooltipPaddingBottom + 'px';
                thCount.innerHTML = "Count";
                thead.appendChild(thLabel);
                thead.appendChild(thCount);
                table.appendChild(thead);
                var trArray = [];
                var label = this.chart.config.data.labels[yLabel];
                var datasetsDisplayValues = this._GetDisplayTooltipValues(this.chart.config.data.datasets, yLabel, tooltipModel, label);

                datasetsDisplayValues.forEach(function (dataset) {
                    var tr = document.createElement('tr');
                    var tdLabel = document.createElement('td');
                    var spanSquare = document.createElement('span');
                    var spanLabel = document.createElement('span');
                    var tdValue = document.createElement('td');
                    spanSquare.classList.add('square');
                    spanSquare.style.backgroundColor = dataset.color;
                    spanLabel.innerHTML = " " + dataset.label;
                    tdLabel.appendChild(spanSquare);
                    tdLabel.appendChild(spanLabel);
                    tdLabel.classList.add("label");
                    tdLabel.style.maxWidth = maxTooltipWidth + "px";
                    tdValue.classList.add('count');
                    tdValue.innerHTML = dataset.value;
                    trArray.push(tr);
                    tr.appendChild(tdLabel);
                    tr.appendChild(tdValue);
                    tbody.append(tr);
                });
                table.appendChild(tbody);
                tooltipEl.appendChild(table);
                if (maxTooltipHeight < tooltipEl.clientHeight) {
                    this._AdjustTooltipHeight(tooltipEl, maxTooltipHeight, trArray, tbody);
                }
            }
            var position = this.chart.canvas.getBoundingClientRect();
            tooltipEl.style.opacity = 0.8;
            tooltipEl.style.fontFamily = tooltipModel._bodyFontFamily;
            tooltipEl.style.fontStyle = tooltipModel._bodyFontStyle;
            tooltipEl.style.left = this._AdjustTooltipLeftPosition(tooltipEl, position, tooltipModel, chartAreaLeft, chartAreaRight);
            tooltipEl.style.top = this._AdjustTooltipTopPosition(tooltipEl, position, tooltipModel, chartAreaBottom, chartAreaTop);
        },
        /**
         * Returns the options used to generate chart tooltips.
         *
         * @private
         * @returns {Object}
         */
        _getTooltipOptions: function () {
            var self = this;
            var tooltipOptions = {
                bodyFontColor: 'rgba(0,0,0,1)',
                titleFontSize: 13,
                titleFontColor: 'rgba(0,0,0,1)',
                backgroundColor: 'rgba(255,255,255,0.6)',
                borderColor: 'rgba(0,0,0,0.2)',
                borderWidth: 1,
                callbacks: {
                    title: function () {
                        return self.fields[self.state.measure].string;
                    },
                },
            };
            if (_.contains(['bar', 'line'], this.state.mode)) {
                var referenceColor;
                if (this.state.mode === 'bar') {
                    referenceColor = 'backgroundColor';
                } else {
                    referenceColor = 'borderColor';
                    tooltipOptions = _.extend(tooltipOptions, {
                        mode: 'index',
                        intersect: false,
                        position: this.isEmbedded ? 'custom' : 'average',
                    });
                }
                tooltipOptions.callbacks = _.extend(tooltipOptions.callbacks, {
                    label: function (tooltipItem, data) {
                        var dataset = data.datasets[tooltipItem.datasetIndex];
                        var label = data.labels[tooltipItem.index];
                        label = self._relabelling(label, dataset.originIndex);
                        if (self.state.groupBy.length > 1 || self.state.origins.length > 1) {
                            label = label + "/" + dataset.label;
                        }
                        label = label + ': ' + self._formatValue(tooltipItem.yLabel);
                        return label;
                    },
                    labelColor: function (tooltipItem, chart) {
                        var dataset = chart.data.datasets[tooltipItem.datasetIndex];
                        var tooltipBackgroundColor = dataset[referenceColor];
                        var tooltipBorderColor = chart.tooltip._model.backgroundColor;
                        return {
                            borderColor: tooltipBorderColor,
                            backgroundColor: tooltipBackgroundColor,
                        };
                    },
                });
                if (this.state.mode === 'line') {
                    tooltipOptions.enabled = false;
                    tooltipOptions.custom = this._customTooltip.bind(this);
                }
            } else {
                tooltipOptions.callbacks = _.extend(tooltipOptions.callbacks, {
                    label: function (tooltipItem, data) {
                        var dataset = data.datasets[tooltipItem.datasetIndex];
                        var label = data.labels[tooltipItem.index];
                        if (label === _t('No data')) {
                            return dataset.label + "/" + label + ': ' + self._formatValue(0);
                        } else {
                            label = self._relabelling(label, dataset.originIndex);
                        }
                        if (self.state.origins.length > 1) {
                            label = dataset.label + "/" + label;
                        }
                        label = label + ': ' + self._formatValue(dataset.data[tooltipItem.index]);
                        return label;
                    },
                    labelColor: function (tooltipItem, chart) {
                        var dataset = chart.data.datasets[tooltipItem.datasetIndex];
                        var tooltipBackgroundColor = dataset.backgroundColor[tooltipItem.index];
                        var tooltipBorderColor = chart.tooltip._model.backgroundColor;
                        return {
                            borderColor: tooltipBorderColor,
                            backgroundColor: tooltipBackgroundColor,
                        };
                    },
                });
            }
            return tooltipOptions;
        },
        /**
         * Return the first index of the array list where label can be found
         * or -1.
         *
         * @private
         * @param {Array[]} list
         * @param {Array} label
         * @returns {number}
         */
        _indexOf: function (list, label) {
            var index = -1;
            for (var j = 0; j < list.length; j++) {
                var otherLabel = list[j];
                if (label.length === otherLabel.length) {
                    var equal = true;
                    for (var i = 0; i < label.length; i++) {
                        if (label[i] !== otherLabel[i]) {
                            equal = false;
                        }
                    }
                    if (equal) {
                        index = j;
                        break;
                    }
                }
            }
            return index;
        },
        /**
         * Separate dataPoints comming from the read_group(s) into different datasets.
         * This function returns the parameters data and labels used to produce the charts.
         *
         * @private
         * @param {Object[]} dataPoints
         * @param {function} getLabel,
         * @param {function} getDatasetLabel, determines to which dataset belong a given data point
         * @param {function} [getDatasetDataLength], determines the initial section of the labels array
         *                    over which the datasets have to be completed. These sections only depend
         *                    on the datasets origins. Default is the constant function _ => labels.length.
         * @returns {Object} the paramater data used to instatiate the chart.
         */
        _prepareData: function (dataPoints) {
            var self = this;

            var labels = dataPoints.reduce(
                function (acc, dataPt) {
                    var label = self._getLabel(dataPt);
                    var index = self._indexOf(acc, label);
                    if (index === -1) {
                        acc.push(label);
                    }
                    return acc;
                },
                []
            );

            var newDataset = function (datasetLabel, originIndex) {
                var data = new Array(self._getDatasetDataLength(originIndex, labels.length)).fill(0);
                return {
                    label: datasetLabel,
                    data: data,
                    originIndex: originIndex,
                };
            };

            // dataPoints --> datasets
            var datasets = _.values(dataPoints.reduce(
                function (acc, dataPt) {
                    var datasetLabel = self._getDatasetLabel(dataPt);
                    if (!(datasetLabel in acc)) {
                        acc[datasetLabel] = newDataset(datasetLabel, dataPt.originIndex);
                    }
                    var label = self._getLabel(dataPt);
                    var labelIndex = self._indexOf(labels, label);
                    acc[datasetLabel].data[labelIndex] = dataPt.value;
                    return acc;
                },
                {}
            ));

            // sort by origin
            datasets = datasets.sort(function (dataset1, dataset2) {
                return dataset1.originIndex - dataset2.originIndex;
            });

            return {
                datasets: datasets,
                labels: labels,
            };
        },
        /**
         * Prepare options for the chart according to the current mode (= chart type).
         * This function returns the parameter options used to instantiate the chart
         *
         * @private
         * @param {number} datasetsCount
         * @returns {Object} the chart options used for the current mode
         */
        _prepareOptions: function (datasetsCount) {
            return {
                maintainAspectRatio: false,
                scales: this._getScaleOptions(),
                legend: this._getLegendOptions(datasetsCount),
                tooltips: this._getTooltipOptions(datasetsCount),
            };
        },
        /**
         * Determine how to relabel a label according to a given origin.
         * The idea is that the getLabel function is in general not invertible but
         * it is when restricted to the set of dataPoints comming from a same origin.
         * @private
         * @param {Array} label
         * @param {Array} originIndex
         * @returns {string}
         */
        _relabelling: function (label, originIndex) {
            if (label.isNoData) {
                return label[0];
            }
            var i = this.state.comparisonFieldIndex;
            if (_.contains(['bar', 'line'], this.state.mode) && i === 0) {
                // here label is an array of length 1 and contains a number
                return this.dateClasses.representative(label, originIndex) || '';
            } else if (this.state.mode === 'pie' && i >= 0) {
                // here label is an array of length at least one containing string or numbers
                var labelCopy = label.slice(0);
                if (originIndex !== undefined) {
                    labelCopy.splice(i, 1, this.dateClasses.representative(label[i], originIndex));
                } else {
                    labelCopy.splice(i, 1, this.dateClasses.dateClassMembers(label[i]));
                }
                return labelCopy.join('/');
            }
            // here label is an array containing strings or numbers.
            return label.join('/') || _t('Total');
        },
        /**
         * Render the chart or display a message error in case data is not good enough.
         *
         * Note that This method is synchronous, but the actual rendering is done
         * asynchronously.  The reason for that is that Chart.js needs to be in the
         * DOM to correctly render itself.  So, we trick Odoo by returning
         * immediately, then we render the chart when the widget is in the DOM.
         *
         * @override
         * @private
         * @returns {Promise} The _super promise is actually resolved immediately
         */
        _render: function () {
            if (this.chart) {
                this.chart.destroy();
            }
            this.$el.empty();
            if (!_.contains(CHART_TYPES, this.state.mode)) {
                this.trigger_up('warning', {
                    title: _t('Invalid mode for chart'),
                    message: _t('Cannot render chart with mode : ') + this.state.mode
                });
            }
            var dataPoints = this._filterDataPoints();
            if (!dataPoints.length && this.state.mode !== 'pie') {
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
                var $canvasContainer = $('<div/>', { class: 'o_graph_canvas_container' });
                var $canvas = $('<canvas/>').attr('id', this.chartId);
                $canvasContainer.append($canvas);
                this.$el.append($canvasContainer);

                var i = this.state.comparisonFieldIndex;
                if (i === 0 || (i > 0 && this.state.mode === 'pie')) {
                    this.dateClasses = this._getDateClasses(dataPoints);
                }
                if (this.state.mode === 'bar') {
                    this._renderBarChart(dataPoints);
                } else if (this.state.mode === 'line') {
                    this._renderLineChart(dataPoints);
                } else if (this.state.mode === 'pie') {
                    this._renderPieChart(dataPoints);
                }
                this._renderTitle();
            }
            return this._super.apply(this, arguments);
        },
        /**
         * create bar chart.
         *
         * @private
         * @param {Object[]} dataPoints
         */
        _renderBarChart: function (dataPoints) {
            var self = this;

            // style rectangles
            Chart.defaults.global.elements.rectangle.borderWidth = 1;

            // prepare data
            var data = this._prepareData(dataPoints);

            // this.isStackable will be true if at least one origin has
            // at least two datasets.
            var originDatasetCounts = {};
            this.isStackable = false;
            for (let dataset of data.datasets) {
                var originIndex = dataset.originIndex;
                if (originIndex in originDatasetCounts) {
                    this.isStackable = true;
                    break;
                } else {
                    originDatasetCounts[originIndex] = 1;
                }
            }

            data.datasets.forEach(function (dataset, index) {
                // used when stacked
                dataset.stack = self.isStackable && self.state.stacked ? self.state.origins[dataset.originIndex] : undefined;
                // set dataset color
                var color = self._getColor(index);
                dataset.backgroundColor = color;
            });

            // prepare options
            var options = this._prepareOptions(data.datasets.length);

            // create chart
            var ctx = document.getElementById(this.chartId);
            this.chart = new Chart(ctx, {
                type: 'bar',
                data: data,
                options: options,
            });
        },
        /**
         * create line chart.
         *
         * @private
         * @param {Object[]} dataPoints
         */
        _renderLineChart: function (dataPoints) {
            var self = this;

            // style lines
            Chart.defaults.global.elements.line.tension = 0;
            Chart.defaults.global.elements.line.fill = false;
            Chart.Tooltip.positioners.custom = function (elements, eventPosition) {
                var nearest = Chart.Tooltip.positioners.nearest(elements, eventPosition);
                return {
                    x: nearest.x,
                    y: 10,
                };
            };

            // prepare data
            var data = this._prepareData(dataPoints);
            data.datasets.forEach(function (dataset, index) {
                if (self.state.groupBy.length <= 1 && self.state.origins.length > 1) {
                    if (dataset.originIndex === 0) {
                        dataset.fill = 'origin';
                        dataset.backgroundColor = hexToRGBA(COLORS[0], 0.4);
                        dataset.borderColor = hexToRGBA(COLORS[0], 1);
                    } else if (dataset.originIndex === 1) {
                        dataset.borderColor = hexToRGBA(COLORS[1], 1);
                    } else {
                        dataset.borderColor = self._getColor(index);
                    }
                } else {
                    dataset.borderColor = self._getColor(index);
                }
                if (data.labels.length === 1) {
                    // decalage of the real value to right. This is done to center the points in the chart
                    // See data.labels below in Chart parameters
                    dataset.data.unshift(undefined);
                }
                dataset.pointBackgroundColor = dataset.borderColor;
                dataset.pointBorderColor = 'rgba(0,0,0,0.2)';
            });
            // center the points in the chart (whithout that code they are put on the left and the graph seems empty)
            data.labels = data.labels.length > 1 ?
                data.labels :
                Array.prototype.concat.apply([], [[['']], data.labels, [['']]]);

            // prepare options
            var options = this._prepareOptions(data.datasets.length);

            // create chart
            var ctx = document.getElementById(this.chartId);
            this.chart = new Chart(ctx, {
                type: 'line',
                data: data,
                options: options,
            });
        },
        /**
         * create pie chart
         *
         * @private
         * @param {Object[]} dataPoints
         */
        _renderPieChart: function (dataPoints) {
            var self = this;

            // try to see if some pathologies are still present after the filtering
            var allNegative = true;
            var someNegative = false;
            var allZero = true;
            dataPoints.forEach(function (datapt) {
                allNegative = allNegative && (datapt.value < 0);
                someNegative = someNegative || (datapt.value < 0);
                allZero = allZero && (datapt.value === 0);
            });
            if (someNegative && !allNegative) {
                this.$el.empty();
                this.$el.append(qweb.render('GraphView.error', {
                    title: _t("Invalid data"),
                    description: _t("Pie chart cannot mix positive and negative numbers. " +
                        "Try to change your domain to only display positive results"),
                }));
                return;
            }
            if (allZero && !this.isEmbedded && this.state.origins.length === 1) {
                this.$el.empty();
                this.$el.append(qweb.render('GraphView.error', {
                    title: _t("Invalid data"),
                    description: _t("Pie chart cannot display all zero numbers.. " +
                        "Try to change your domain to display positive results"),
                }));
                return;
            }

            // prepare data
            var data = {};
            var colors = [];
            if (allZero) {
                // add fake data to display a pie chart with a grey zone associated
                // with every origin
                data.labels = [NO_DATA];
                data.datasets = this.state.origins.map(function (origin) {
                    return {
                        label: origin,
                        data: [1],
                        backgroundColor: ['#d3d3d3'],
                    };
                });
            } else {
                data = this._prepareData(dataPoints);
                // give same color to same groups from different origins
                colors = data.labels.map(function (label, index) {
                    return self._getColor(index);
                });
                data.datasets.forEach(function (dataset) {
                    dataset.backgroundColor = colors;
                    dataset.borderColor = 'rgba(255,255,255,0.6)';
                });
                // make sure there is a zone associated with every origin
                var representedOriginIndexes = data.datasets.map(function (dataset) {
                    return dataset.originIndex;
                });
                var addNoDataToLegend = false;
                var fakeData = (new Array(data.labels.length)).concat([1]);
                this.state.origins.forEach(function (origin, originIndex) {
                    if (!_.contains(representedOriginIndexes, originIndex)) {
                        data.datasets.splice(originIndex, 0, {
                            label: origin,
                            data: fakeData,
                            backgroundColor: colors.concat(['#d3d3d3']),
                        });
                        addNoDataToLegend = true;
                    }
                });
                if (addNoDataToLegend) {
                    data.labels.push(NO_DATA);
                }
            }

            // prepare options
            var options = this._prepareOptions(data.datasets.length);

            // create chart
            var ctx = document.getElementById(this.chartId);
            this.chart = new Chart(ctx, {
                type: 'pie',
                data: data,
                options: options,
            });
        },
        /**
         * Add the graph title (if any) above the canvas
         *
         * @private
         */
        _renderTitle: function () {
            if (this.title) {
                this.$('.o_graph_canvas_container').last().prepend($('<label/>', {
                    text: this.title,
                }));
            }
        },
    });
});
