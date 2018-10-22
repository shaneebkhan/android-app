odoo.define('web.SearchView', function (require) {
"use strict";

var AbstractView = require('web.AbstractView');
var SearchController = require('web.SearchController');
var SearchModel = require('web.SearchModel');
var SearchRenderer = require('web.SearchRenderer');

var SearchView = AbstractView.extend({
    config: {
        Model: SearchModel,
        Controller: SearchController,
        Renderer: SearchRenderer,
    },

    init: function (viewInfo, params) {
    	this._super.apply(this, arguments);

    	// don't forget to compute and rename:
    	//  - groupable
    	//  - enableTimeRangeMenu
    	//  - search view visibility
    	//  - space available for breadcrumb (depends on visibility of search view and mobile mode)
    },


});

return SearchView;
});