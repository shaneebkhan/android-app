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
});

return SearchView;
});