odoo.define('web.SearchController', function (require) {
"use strict";

var AbstractController = require('web.AbstractController');


var SearchController = AbstractController.extend({
    custom_events: {
        menu_item_clicked: '_onMenuItemClicked',
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
        var self = this;
        return this.update({itemClickedId: event.data.id}).then(function () {
            self._reportNewQuery();
        });
    },
});

return SearchController;
});