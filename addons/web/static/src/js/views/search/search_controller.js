odoo.define('web.SearchController', function (require) {
"use strict";

var AbstractController = require('web.AbstractController');


var SearchController = AbstractController.extend({
    custom_events: {
        menu_item_clicked: '_onMenuItemClicked',
        item_option_clicked: '_onItemOptionClicked',
        new_filters: '_onNewFilters',
        new_groupBy: '_onNewGroupBy',
        facet_removed: '_onFacetRemoved',
    },

    start: function () {
        this._super.apply(this, arguments);
        // see control panel that looks for "searchview.$buttons"
        this.$buttons = this._getSubMenus();
    },

    destroy: function () {
        // delete reference to this.$buttons, to prevent crash.  Note that
        // the $buttons is actually a part of this.renderer, which should be
        // destroyed by the renderer anyway
        delete this.$buttons;
        this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Compute the search related values that will be
     *
     * @returns {Object} object with keys 'context', 'domain', 'groupBy'
     */
    getSearchState: function () {
        return this.model.getQuery();
    },

    update: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            self._reportNewQuery();
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _getSubMenus: function () {
        return this.renderer.$subMenus;
    },

    _reportNewQuery: function () {
        this.trigger_up('search', this.model.getQuery());
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _onFacetRemoved: function (ev) {
        var group = ev.data.group;
        if (!group) {
            group = this.renderer.getLastFacet();
        }
        this.update({removeGroup: group});
    },
    _onItemOptionClicked: function (event) {
        return this.update({toggleOption: event.data});
    },
    _onMenuItemClicked: function (event) {
        return this.update({toggleFilter: event.data});
    },
    _onNewFilters: function (event) {
        return this.update({newFilters: event.data});
    },
    _onNewGroupBy: function (event) {
        return this.update({newGroupBy: event.data});
    }
});

return SearchController;
});