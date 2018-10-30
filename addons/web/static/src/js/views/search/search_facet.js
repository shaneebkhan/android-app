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
    }),
    init: function (parent, facet) {
        this._super.apply(this, arguments);

        this.facet = facet;
        this.facetValues = _.map(this.facet.values, function (value) {
            return value.description;
        });
        this.separator = this._getSeparator();
        this.icon = this._getIcon();
    },
    _getIcon: function () {
        var icon;
        if (this.facet.type === 'filter') {
            icon = 'fa-filter';
        } else if (this.facet.type === 'groupBy') {
            icon = 'fa-bars';
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
    _onFacetRemove: function () {
        this.trigger_up('facet_removed', this.facet);
    },
});

return SearchFacet;

});