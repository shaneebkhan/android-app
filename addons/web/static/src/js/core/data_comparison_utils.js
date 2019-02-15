odoo.define('web.dataComparisonUtils', function (require) {
"use strict";

var fieldUtils = require('web.field_utils');

function dateComparison (date1, date2) {
    if (date1 < date2) {
        return -1;
    } else if (date1 > date2) {
        return 1;
    }
}
/**
 * @param {moment[]} dateSet1
 * @param {moment[]} dateSet2
 * @returns {function}
 */
function dateQuotient (dateSet1, dateSet2, interval) {
    var d = [];
    d[0] = dateSet1.sort(dateComparison);
    d[1] = dateSet2.sort(dateComparison);

    var equivalenceClasses = {};
    equivalenceClasses[0] = {};
    equivalenceClasses[1] = {};
    if (d[1].length === 0) {
        d[0].forEach(function (date) {
            equivalenceClasses[0][date] = [date];
        });
    } else if (d[0].length === 0) {
        d[1].forEach(function (date) {
            equivalenceClasses[1][date] = [date];
        });
    } else {
        var diff = d[1].length - d[0].length;
        var len = Math.max(d[1].length, d[0].length);
        var key;
        if (diff > 0) {
            key = 0;
        } else if (diff < 0){
            key = 1;
        }
        if (key) {
            // complete d for key
            var lastDate = d[key][d[key].length - 1];
            for (var i = 0; i < Math.abs(diff); i++) {
                var date = moment(lastDate).add(i + 1, interval).format('DD MMM YYYY');
                d[key].push(date);
            }
        }
        for (var j= 0; j < len; j++) {
            var a = d[0][j];
            var b = d[1][j];
            equivalenceClasses[0][a] = [a, b];
            equivalenceClasses[1][b] = [a, b];
        }
    }
    return function (key) {
        return function (date) {
            return equivalenceClasses[key][date];
        };
    };
}




/**
 * @param {Number} value
 * @param {Number} comparisonValue
 * @returns {Object}
 */
function computeVariation (value, comparisonValue) {
    var magnitude;
    var signClass;

    if (!isNaN(value) && !isNaN(comparisonValue)) {
        if (comparisonValue === 0) {
            if (value === 0) {
                magnitude = 0;
            } else if (value > 0){
                magnitude = 1;
            } else {
                magnitude = -1;
            }
        } else {
            magnitude = (value - comparisonValue) / Math.abs(comparisonValue);
        }
        if (magnitude > 0) {
            signClass = ' o_positive';
        } else if (magnitude < 0) {
            signClass = ' o_negative';
        } else if (magnitude === 0) {
            signClass = ' o_null';
        }
        return {magnitude: magnitude, signClass: signClass};
	} else {
		return {magnitude: NaN};
	}
}

/**
 * @param {Object} variation
 * @param {Object} field
 * @param {Object} options
 * @returns {Object}
 */
function renderVariation (variation, field, options) {
	var $variation;
    if (!isNaN(variation.magnitude)) {
		$variation = $('<div>', {class: 'o_variation' + variation.signClass}).html(
            fieldUtils.format.percentage(variation.magnitude, field, options
        ));
    } else {
        $variation = $('<div>', {class: 'o_variation'}).html('-');
    }
    return $variation;
}

/**
 * @param {JQuery} $node
 * @param {Number} value
 * @param {Number} comparisonValue
 * @param {Object} variation (with key 'magnitude' and 'signClass')
 * @param {function} formatter
 * @param {Object} field
 * @param {Object} options
 * @returns {Object}
 */
function renderComparison ($node, value, comparisonValue, variation, formatter, field, options) {
    var $variation = renderVariation(variation, field, options);
	$node.append($variation);
	if (!isNaN(variation.magnitude)) {
		$node.append(
			$('<div>', {class: 'o_comparison'})
			.html(formatter(value, field, options) + ' <span>vs</span> ' + formatter(comparisonValue, field, options))
		);
	}
}

return {
	computeVariation: computeVariation,
    dateQuotient: dateQuotient,
	renderComparison: renderComparison
};

});
