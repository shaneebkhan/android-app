odoo.define('web.SearchModel', function (require) {
"use strict";

var AbstractModel = require('web.AbstractModel');

var SearchModel = AbstractModel.extend({

	load: function (params) {
		this.groups = params.groups;
		this.filters = params.filters;
	},

	get: function() {
		return {groups: this.groups, filters: this.filters};
	},
});

return SearchModel;
});