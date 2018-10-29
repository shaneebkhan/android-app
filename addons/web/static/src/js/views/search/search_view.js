odoo.define('web.SearchView', function (require) {
"use strict";

var AbstractView = require('web.AbstractView');

var SearchController = require('web.SearchController');
var SearchModel = require('web.SearchModel');
var SearchRenderer = require('web.SearchRenderer');
var pyUtils = require('web.py_utils');

var searchViewParameters = require('web.searchViewParameters');

var DEFAULT_PERIOD = searchViewParameters.DEFAULT_PERIOD;
var DEFAULT_INTERVAL = searchViewParameters.DEFAULT_INTERVAL;

var SearchView = AbstractView.extend({
    config: {
        Model: SearchModel,
        Controller: SearchController,
        Renderer: SearchRenderer,
    },

    init: function (viewInfo, params) {
    	this._super.apply(this, arguments);
        this.loadParams.fields = this.fields;
        this.loadParams.actionId = params.actionId;
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

    _extractAttributes: function (filter, attrs) {
        if (filter.type === 'filter') {
            filter.description = attrs.string ||
                                    attrs.help ||
                                    attrs.name ||
                                    attrs.domain ||
                                    'Ω';
            filter.domain = attrs.domain;
            if (attrs.date) {
                filter.fieldName = attrs.date;
                filter.fieldType = this.fields[attrs.date].type;
                // we should be able to declare list of options per date filter
                // (request of POs) (same remark for groupbys)
                filter.hasOptions = true;
                filter.options = searchViewParameters.periodOptions;
                filter.defaultOptionId = attrs.default_period ||
                                            DEFAULT_PERIOD;
                filter.currentOptionId = false;
            }
        }
        if (filter.type === 'groupBy') {
            filter.description = attrs.string ||
                                    attrs.help ||
                                    attrs.name ||
                                    attrs.fieldName ||
                                    'Ω';
            filter.fieldName = attrs.fieldName;
            filter.fieldType = this.fields[attrs.fieldName].type;
            if (_.contains(['date', 'datetime'], filter.fieldType)) {
                filter.hasOptions = true;
                filter.options = searchViewParameters.intervalOptions;
                filter.defaultOptionId = attrs.defaultInterval ||
                                            DEFAULT_INTERVAL;
                filter.currentOptionId = false;
            }
        }
    },

    _processControlPanelArch: function (arch) {
    	var groups = [];
        // TO DO after having specified new grammar
    	return {groups: groups};
    },

    _processSearchArch: function (arch) {
        var self = this;
        var groups = [];
        var preFilters = _.flatten(arch.children.map(function (child) {
            return child.tag !== 'group' ?
            		self._evalArchChild(child) :
            		child.children.map(self._evalArchChild);
        }));
        preFilters.push({tag: 'separator'});

        var filter;
        var currentTag;
        var currentGroup;

        _.each(preFilters, function (preFilter) {
        	if (preFilter.tag !== currentTag || _.contains(['separator', 'field'], preFilter.tag)) {
        		if (currentGroup) {
        			if (currentGroup.length) {
	        			groups.push(currentGroup);
        			}
        		}
        		currentTag = preFilter.tag;
        		currentGroup = [];
        	}
        	if (preFilter.tag !== 'separator') {
        		filter = {
            		type: preFilter.tag,
            		// we need to codify here what we want to keep from attrs
            		// and how, for now I put everything.
            		// In some sence, some filter are active (totally determined, given)
            		// and others are passive (require input(s) to become determined)
            		// What is the right place to process the attrs?
            	};
                self._extractAttributes(filter, preFilter.attrs);
            	currentGroup.push(filter);
        	}
        });
        return {groups: groups};
    }
});

return SearchView;
});