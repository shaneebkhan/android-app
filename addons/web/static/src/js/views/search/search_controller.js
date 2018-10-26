odoo.define('web.SearchController', function (require) {
"use strict";

var AbstractController = require('web.AbstractController');


var SearchController = AbstractController.extend({
    custom_events: {
        menu_item_clicked: '_onMenuItemClicked',
        item_option_clicked: '_onItemOptionClicked',
    },

    start: function () {
        this._super.apply(this, arguments);
        // see control panel that looks for "searchview.$buttons"
        this.$buttons = this._getSubMenus();
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

    _onMenuItemClicked: function (event) {
        return this.update({toggleFilter: event.data});
    },
    _onItemOptionClicked: function (event) {
        return this.update({toggleOption: event.data});
    },
});

return SearchController;
});