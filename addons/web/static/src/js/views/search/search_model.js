odoo.define('web.SearchModel', function (require) {
"use strict";

var AbstractModel = require('web.AbstractModel');
var Domain = require('web.Domain');
var pyUtils = require('web.py_utils');

var SearchModel = AbstractModel.extend({


	//--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

	load: function (params) {
		this.groups = params.groups;
		this.filters = params.filters;
		return $.when();
	},

	// handle is empty here and does not make sense
	reload: function (handle, params) {
		if (params.itemClickedId) {
			// var filter = this.filters[params.itemClickedId];
			// var group = this.groups[filter.groupId];
			// var index = group.activeFilterIds.indexOf(filter.id);
			var filter = this.filters.find(function (f) {
				return f.id === params.itemClickedId;
			});
			var group = this.groups.find(function (g) {
				return g.id === filter.groupId;
			});
			var index = group.activeFilterIds.findIndex(function (id) {
				return id === filter.id;
			});
			if (index === -1) {
				group.activeFilterIds.push(filter.id);
			} else {
				group.activeFilterIds.splice(index, 1);
			}
		}
		return this._super.apply(this, arguments);
	},

	get: function () {
		var activeFilterIds = this.groups.reduce(
			function (acc, group) {
				acc = acc.concat(group.activeFilterIds);
				return acc;
			},
			[]
		);
		var filters = this.filters.map(function (filter) {
			filter.isActive = !!activeFilterIds.find(function (id) {
				return id === filter.id;
			});
			return filter;
		});
		return {filters: filters};
	},

	getQuery: function () {
		var userContext = this.getSession().user_context;
		var domain = Domain.prototype.stringToArray(
			this._getDomain(),
			userContext
		);
		return {
			// for now action manager wants domains and contexts I would prefer
			// to use domain and context.
			domains: [domain],
            contexts: {},
            groupbys: {},
		};
	},

	// save favorites should call this method. Here no evaluation of domains,...
	saveQuery: function () {
		return {
			domains: this._getDomain(),
			contexts: {},
			groupbys: {},
		};
	},

	//--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _getDomain: function () {
    	var self = this;
		var domains = this.groups.map(function (group) {
			return self._getGroupDomain(group);
		});
		return pyUtils.assembleDomains(domains, 'AND');
    },

	_getFilterDomain: function (filter) {
		var domain = "[]";
		if (filter.type === 'filter') {
			if (filter.attrs.domain) {
				domain = filter.attrs.domain;
			}
			if (filter.attrs.date) {
				// code case date
			}
		}
		return domain;
	},

	_getGroupDomain: function (group) {
		var self = this;
		// var domains = group.activeFilterIds.map(function (id) {
		// 	var filter = self.filters[id];
		// 	return self._getFilterDomain(filter);
		// });
		var domains = this.filters.filter(
			function (filter) {
				var inGroup = filter.groupId === group.id;
				if (inGroup) {
					var activeInGroup = group.activeFilterIds.find(function (id) {
						return filter.id === id;
					});
					return activeInGroup;
				} else {
					return false;
				}
			}
		).map(function (filter) {
			return self._getFilterDomain(filter);
		});

		return pyUtils.assembleDomains(domains, 'OR');
	},

});

return SearchModel;
});