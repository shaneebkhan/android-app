odoo.define('web.SearchController', function (require) {
"use strict";

var AbstractController = require('web.AbstractController');


var SearchController = AbstractController.extend({

    start: function () {
        this._super.apply(this, arguments);
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
        return {
            domain: [],
            context: {},
            groupBy: [],
        };
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _getSubMenus: function () {
        return this.renderer.$subMenus;
    },

});

return SearchController;
});