odoo.define('web.SearchModel', function (require) {
"use strict";

var AbstractModel = require('web.AbstractModel');
var Domain = require('web.Domain');

var SearchModel = AbstractModel.extend({

	load: function (params) {
		this.groups = params.groups;
		this.filters = params.filters;
	},

	// handle is empty here and does not make sense
	reload: function (handle, params) {
		if (params.itemClickedId) {
			var filter = this.filters.find(function (f) {
				return f.id === params.itemClickedId;
			});
			var group = this.groups.find(function (g) {
				return g.id === filter.groupId;
			});
			var index = group.activeFilterIds.findIndex(function (id) {
				return id === filter.id;
			});
			if (index !== 1) {
				group.activeFilterIds.push(filter.id);
			} else {
				group.activeFilterIds.splice(index, 1);
			}
		}
		return this._super.apply(this, arguments);
	},

	get: function () {
		return {groups: this.groups, filters: this.filters};
	},

	getEvaluatedDomain: function (filter) {
        var userContext = this.getSession().user_context;
		var domain = [];
		if (filter.type === 'filter') {
			if (filter.attrs.domain) {
				domain = Domain.prototype.stringToArray(domain, userContext);
			}
		}
		return domain;
	},

	getQuery: function () {
		var self = this;
		var activeFilterIds = this.groups.reduce(
			function (activeFilterIds, group) {
				return activeFilterIds.concat(group.activeFilterIds);
			},
			[]
		);
		var domains = [];
		var index;
		// false !!! We should combine domains with AND and OR!!!!
		this.filters.forEach(function (filter) {
			if (activeFilterIds.length) {
				index = activeFilterIds.findIndex(function (id) {
					return filter.id === id;
				});
				if (index !== -1) {
					activeFilterIds.splice(index, 1);
					domains.push(self.getEvaluatedDomain(filter));
				}
			}
		});
		return {
			domains: domains,
            contexts: {},
            groupbys: {},
		};
	},

	// save favorites should call this method. Here no evaluation of domains,...
	saveQuery: function () {
	},

});

return SearchModel;
});