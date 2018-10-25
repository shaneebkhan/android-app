odoo.define('web.SearchView', function (require) {
"use strict";

var AbstractView = require('web.AbstractView');

var SearchController = require('web.SearchController');
var SearchModel = require('web.SearchModel');
var SearchRenderer = require('web.SearchRenderer');
var pyUtils = require('web.py_utils');

var SearchViewParameters = require('web.SearchViewParameters');

var DEFAULT_PERIOD = SearchViewParameters.DEFAULT_PERIOD;

var SearchView = AbstractView.extend({
    config: {
        Model: SearchModel,
        Controller: SearchController,
        Renderer: SearchRenderer,
    },

    init: function (viewInfo, params) {
    	this._super.apply(this, arguments);
    	this._processArch();

    	// don't forget to compute and rename:
    	//  - groupable
    	//  - enableTimeRangeMenu
    	//  - search view visibility
    	//  - space available for breadcrumb (depends on visibility of search view and mobile mode)
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _evalArchChild: function (child) {
        if (child.attrs.context) {
            try {
                var context = pyUtils.eval('context', child.attrs.context);
                if (context.group_by) {
                    // let us extract basic data since we just evaluated context
                    // and use a correct tag!
                    child.tag = 'groupBy';
                    child.attrs.fieldName = context.group_by.split(':')[0];
                    child.attrs.defaultInterval = context.group_by.split(':')[1];
                }
            } catch (e) {}
        }
        return child;
    },

    _processArch: function () {
    	var info;
    	if (this.arch.tag === 'search') {
    		info = this._processSearchArch(this.arch);
    	}
    	if (this.arch.tag === 'control_panel') {
    		info = this._processControlPanelArch(this.arch);
    	}
        _.extend(this.loadParams, {groups: info.groups, filters: info.filters});
    },

    _extractAttributes: function (filter) {
        if (filter.type === 'filter') {
            filter.description = filter.attrs.string ||
                                    filter.attrs.help ||
                                    filter.attrs.name ||
                                    filter.attrs.domain ||
                                    'Ω';
            if (filter.attrs.date) {
                filter.hasOptions = true;
                // we should declare list of options per date filter
                // (request of POs)
                filter.fieldName = filter.attrs.date;
                filter.attrs.type = this.fields[filter.attrs.date].type;
                filter.defaultPeriod = filter.attrs.default_period || DEFAULT_PERIOD;
            }
        }
    },

    _processControlPanelArch: function (arch) {
    	var groups = [];
        var filters = [];
        // TO DO after having specified new grammar
    	return {groups: groups, filters: filters};
    },

    _processSearchArch: function (arch) {
        var self = this;
        var groups = [];
        var filters = [];
        var preFilters = [].concat.apply([], _.map(arch.children, function (child) {
            return child.tag !== 'group' ?
            		self._evalArchChild(child) :
            		child.children.map(self._evalArchChild);
        }));
        preFilters.push({tag: 'separator'});

        var filter;
        var currentTag;
        var currentGroup;

        _.each(preFilters, function (preFilter) {
        	if (preFilter.tag !== currentTag || _.contains(['separator, field'], preFilter.tag)) {
        		if (currentGroup) {
        			var hasFilter = filters.find(function (filter) {
        				return filter.groupId === currentGroup.id;
        			});
        			if (hasFilter) {
	        			groups.push(currentGroup);
        			}
        		}
        		currentTag = preFilter.tag;
        		currentGroup = {
					id: _.uniqueId('__group__'),
                    activeFilterIds: [],
				};
        	}
        	if (preFilter.tag !== 'separator') {
        		filter = {
            		id: _.uniqueId('__filter__'),
            		type: preFilter.tag,
            		// we need to codify here what we want to keep from attrs
            		// and how, for now I put everything.
            		// In some sence, some filter are active (totally determined, given)
            		// and others are passive (require input(s) to become determined)
            		// What is the right place to process the attrs?
            		attrs: preFilter.attrs,
            		groupId: currentGroup.id
            	};
                self._extractAttributes(filter);
            	filters.push(filter);
        	}
        });
        return {groups: groups, filters: filters};
    }
});

return SearchView;
});