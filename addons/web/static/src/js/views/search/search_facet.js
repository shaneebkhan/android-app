odoo.define('web.SearchFacet', function (require) {
"use strict";

var core = require('web.core');
var Widget = require('web.Widget');

var _t = core._t;

var SearchFacet = Widget.extend({
    template: 'SearchView.SearchFacet',
    custom_events: _.extend({}, Widget.prototype.custom_events, {
    }),
    events: _.extend({}, Widget.prototype.events, {
        'click .o_facet_remove': '_onFacetRemove',
        'keydown': '_onKeydown',
    }),
    init: function (parent, facet) {
        this._super.apply(this, arguments);

        var self = this;
        this.facet = facet;
        this.facetValues = _.map(this.facet.filters, function (filter) {
            return self._getFilterDescription(filter);
        });
        this.separator = this._getSeparator();
        this.icon = this._getIcon();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _getIcon: function () {
        var icon;
        if (this.facet.type === 'filter') {
            icon = 'fa-filter';
        } else if (this.facet.type === 'groupBy') {
            icon = 'fa-bars';
        } else if (this.facet.type === 'favorite') {
            icon = 'fa-star';
        } else if (this.facet.type === 'timeRange') {
            icon = 'fa-calendar';
        }
        return icon;
    },
    _getSeparator: function () {
        var separator;
        if (this.facet.type === 'filter') {
            separator = _t('or');
        } else if (this.facet.type === 'groupBy') {
            separator = '>';
        }
        return separator;
    },
    _getFilterDescription: function (filter) {
        var description = filter.description;
        if (filter.hasOptions) {
            var optionValue =_.findWhere(filter.options, {
                optionId: filter.currentOptionId,
            });
            description += ': ' + optionValue.description;
        }
        if (filter.type === 'timeRange') {
            var timeRangeValue =_.findWhere(filter.timeRangeOptions, {
                optionId: filter.timeRangeId,
            });
            description += ': ' + timeRangeValue.description;
            if (filter.comparisonTimeRangeId) {
                var comparisonTimeRangeValue =_.findWhere(filter.comparisonTimeRangeOptions, {
                    optionId: filter.comparisonTimeRangeId,
                });
                description += ' / ' + comparisonTimeRangeValue.description;
            }
        }
        return description;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onKeydown: function (e) {
        switch (e.which) {
            case $.ui.keyCode.BACKSPACE:
                this.trigger_up('facet_removed', {group: this.facet});
                break;
        }
    },
    _onFacetRemove: function () {
        this.trigger_up('facet_removed', {group: this.facet});
    },
});

return SearchFacet;

});