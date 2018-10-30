odoo.define('web.SearchBar', function (require) {
"use strict";

var SearchBarInput = require('web.SearchBarInput');
var SearchFacet = require('web.SearchFacet');
var Widget = require('web.Widget');

var SearchBar = Widget.extend({
    template: 'SearchView.SearchBar',
    custom_events: _.extend({}, Widget.prototype.custom_events, {
    }),
    events: _.extend({}, Widget.prototype.events, {
    }),
    init: function (parent, facets) {
        this._super.apply(this, arguments);

        this.facets = facets;
    },
    start: function () {
        var self = this;

        var defs = [this._super.apply(this, arguments)];
        _.each(this.facets, function (facet) {
            return self._renderFacet(facet);
        });
        defs.push(this._renderInput());
        return $.when.apply($, defs);
    },
    _renderFacet: function (facet) {
        var searchFacet = new SearchFacet(this, facet);
        return searchFacet.appendTo(this.$el);
    },
    _renderInput: function () {
        var input = new SearchBarInput(this);
        return input.appendTo(this.$el);
    },
    // /**
    //  * instantiate auto-completion widget
    //  */
    // _setupAutoCompletion: function () {
    //     this.autoComplete = new AutoComplete(this, {
    //      // the widget should be changed
    //      // I have changed source and select for now because I don't want to
    //      // break things
    //         source: function () {},
    //         select: function () {},
    //         get_search_string: function () {
    //             return this.$('.o_searchview_input').val().trim();
    //         },
    //     });
    //     return this.autoComplete.appendTo(this.$('.o_searchview_input_container'));
    // },
});

return SearchBar;

});