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
		this.fields = {};
	},

	//--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

	load: function (params) {
		var self = this;
		this.fields = params.fields;
		// determine data structure used by model
		// we should also determine here what are the favorites and what are the
		// default filters
		params.groups.forEach(function (group) {
			self._createGroupOfFilters(group);
		});
		return $.when();
	},

	// handle is empty here and does not make sense
	reload: function (handle, params) {
		var self = this;
		if (params.toggleFilter) {
			this._toggleFilter(params.toggleFilter.id);
		}
		if (params.toggleOption) {
			this._toggleFilterWithOptions(
				// id is a filter id
				params.toggleOption.id,
				params.toggleOption.optionId
			);
		}
		if (params.newFilters) {
			var newFilters = params.newFilters.filters;
			this._createGroupOfFilters(newFilters);
			newFilters.forEach(function (filter) {
				self._toggleFilter(filter.id);
			});

		}
		return this._super.apply(this, arguments);
	},

	get: function () {
		var self = this;
		// we maintain a unique source activeFilterIds that contain information
		// on active filters. But the renderer can have more information since
		// it does not change that.
		// copy this.filters;
		// we want to give a different structure to renderer.
		// filters are filters of filter type only, groupbys are groupbys,...!
		var filters = [];
		var groupBys = [];
		Object.keys(this.filters).forEach(function (filterId) {
			var filter = _.extend({}, self.filters[filterId]);
			var group = self.groups[filter.groupId];
			filter.isActive = group.activeFilterIds.indexOf(filterId) !== -1;
			if (filter.type === 'filter') {
				filters.push(filter);
			}
			if (filter.type === 'groupBy') {
				groupBys.push(filter);
			}
		});
		return {
			filters: filters,
			groupBys: groupBys,
			groups: this.groups,
			query: this.query,
			fields: this.fields};
	},

	getQuery: function () {
		var userContext = this.getSession().user_context;
		var domain = Domain.prototype.stringToArray(
			this._getDomain(),
			userContext
		);
		var groupBys = this._getGroupBys();
		return {
			// for now action manager wants domains and contexts I would prefer
			// to use domain and context.
			domain: domain,
            contexts: {},
            groupBys: groupBys,
		};
	},

	// save favorites should call this method. Here no evaluation of domains,...
	saveQuery: function () {
		return {
			domains: this._getDomain(),
			// groupbys in context for ir.filter.
			contexts: {},
		};
	},

	//--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    // group is a list of (pre) filter
	_createGroupOfFilters: function (group) {
		var self= this;
		var type;
		var groupId = _.uniqueId('__group__');
		group.forEach(function (filter) {
			var id = _.uniqueId('__filter__');
			filter.id = id;
			filter.groupId = groupId;
			type = filter.type;
			self.filters[id] = filter;
		});
		this.groups[groupId] = {
			id: groupId,
			type: type,
			activeFilterIds: [],
		};
	},

    _getDomain: function () {
    	var self = this;
		var domains = this.query.map(function (groupId) {
			var group = self.groups[groupId];
			return self._getGroupDomain(group);
		});
		return pyUtils.assembleDomains(domains, 'AND');
    },

	_getFilterDomain: function (filter) {
		var domain = "[]";
		if (filter.type === 'filter') {
			domain = filter.domain;
			if (filter.domain === undefined) {
				domain = Domain.prototype.constructDomain(
					filter.fieldName,
					filter.currentOptionId,
					filter.fieldType
				);
			}
		}
		return domain;
	},

	_getFilterGroupBy: function (filter) {
		var groupBy;
		if (filter.type === 'groupBy') {
			groupBy = filter.fieldName;
			if (filter.currentOptionId) {
				groupBy = groupBy + ':' + filter.currentOptionId;
			}
		}
		return groupBy;
	},

	_getGroupBys: function () {
		var self = this;
		var groupBys = this.query.reduce(
			function (acc, groupId) {
				var group = self.groups[groupId];
				return acc.concat(self._getGroupGroupbys(group));
			},
			[]
		);
		return groupBys;
	},

	_getGroupDomain: function (group) {
		var self = this;
		var domains = group.activeFilterIds.map(function (filterId) {
			var filter = self.filters[filterId];
			return self._getFilterDomain(filter);
		});
		return pyUtils.assembleDomains(domains, 'OR');
	},

	_getGroupGroupbys: function (group) {
		var self = this;
		var groupBys = group.activeFilterIds.map(function (filterId) {
			var filter = self.filters[filterId];
			return self._getFilterGroupBy(filter);
		});
		return _.compact(groupBys);
	},

	// This method could work in batch and take a list of ids as args.
	// (it would be useful for initialization and deletion of a facet/group)
	_toggleFilter: function (filterId) {
		var filter = this.filters[filterId];
		var group = this.groups[filter.groupId];
		var index = group.activeFilterIds.indexOf(filterId);
		var initiaLength = group.activeFilterIds.length;
		if (index === -1) {
			group.activeFilterIds.push(filterId);
			// we need to empty the query when activating a favorite
			if (filter.type === 'favorite') {
				this.query = [];
			}
			// if initiaLength is 0, the group was not active.
			if (initiaLength === 0) {
				this.query.push(group.id);
			}
		} else {
			group.activeFilterIds.splice(index, 1);
			// if initiaLength is 1, the group is now inactive.
			if (initiaLength === 1) {
				this.query.splice(this.query.indexOf(group.id), 1);
			}
		}
	},
	// This method should work in batch too
	// TO DO: accept selection of multiple options?
	// for now: activate an option forces the deactivation of the others
	// optionId optional: the method could be used at initialization...
	// --> one falls back on defautlOptionId.
	_toggleFilterWithOptions: function (filterId, optionId) {
		var filter = this.filters[filterId];
		var group = this.groups[filter.groupId];
		var alreadyActive = group.activeFilterIds.indexOf(filterId) !== -1;
		if (alreadyActive) {
			if (filter.currentOptionId === optionId) {
				this._toggleFilter(filterId);
				filter.currentOptionId = false;
			} else {
				filter.currentOptionId = optionId || filter.defautlOptionId;
			}
		} else {
			this._toggleFilter(filterId);
			filter.currentOptionId = optionId || filter.defautlOptionId;
		}
	},
});

return SearchModel;

});