odoo.define('web.SearchController', function (require) {
"use strict";

var AbstractController = require('web.AbstractController');


var SearchController = AbstractController.extend({

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
    }
});

return SearchController;
});