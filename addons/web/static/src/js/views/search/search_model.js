odoo.define('web.SearchModel', function (require) {
"use strict";

var AbstractModel = require('web.AbstractModel');
var Domain = require('web.Domain');
var pyUtils = require('web.py_utils');

var SearchModel = AbstractModel.extend({

	init: function (parent) {
		this._super.apply(this, arguments);
		this.filters = {};
		this.groups = {};
		this.query = [];
	},

	//--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

	load: function (params) {
		var self = this;
		// determine data structure used by model
		// we should also determine here what are the favorites and what are the
		// default filters
		params.groups.forEach(function (group) {
			var type;
			var groupId = _.uniqueId('__group__');
			group.forEach(function (filter) {
				var id = _.uniqueId('__filter__');
				filter.id = id;
				filter.groupId = groupId;
				type = filter.type;
				self.filters[id] = filter;
			});
			self.groups[groupId] = {
				id: groupId,
				type: type,
				activeFilterIds: [],
			};
		});
		return $.when();
	},

	// handle is empty here and does not make sense
	reload: function (handle, params) {
		if (params.filterToggledId) {
			var filter = this.filters[params.filterToggledId];
			var group = this.groups[filter.groupId];
			var index = group.activeFilterIds.indexOf(filter.id);
			if (index === -1) {
				group.activeFilterIds.push(filter.id);
			} else {
				group.activeFilterIds.splice(index, 1);
			}
		}
		return this._super.apply(this, arguments);
	},

	get: function () {
		var self = this;
		// we maintain a unique source activeFilterIds that contain information
		// on active filters. But the renderer can have more information since
		// it does not change that.
		// deepcopy this.filters;
		var filtersCopy = JSON.parse(JSON.stringify(this.filters));
		// we want to give a different structure to renderer.
		// filters are filters of filter type only!
		var filters = [];
		for (var filterId in filtersCopy) {
			var filter = filtersCopy[filterId];
			var group = self.groups[filter.groupId];
			filter.isActive = group.activeFilterIds.indexOf(filterId) !== -1;
			if (filter.type === 'filter') {
				filters.push(filter);
			}
		}
		return {filters: filters, groups: this.groups};
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
		var domains = Object.keys(this.groups).map(function (groupId) {
			var group = self.groups[groupId];
			return self._getGroupDomain(group);
		});
		return pyUtils.assembleDomains(domains, 'AND');
    },

	_getFilterDomain: function (filter) {
		var domain = "[]";
		if (filter.type === 'filter') {
			domain = filter.domain;
			if (!filter.domain) {
				// code using constructDomain?
			}
		}
		return domain;
	},

	_getGroupDomain: function (group) {
		var self = this;
		var domains = group.activeFilterIds.map(function (filterId) {
			var filter = self.filters[filterId];
			return self._getFilterDomain(filter);
		});
		return pyUtils.assembleDomains(domains, 'OR');
	},

});

return SearchModel;

});