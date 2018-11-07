odoo.define('web.ControlPanelMixin', function (require) {
"use strict";

/**
 * Mixin allowing widgets to communicate with the ControlPanel. Widgets needing a
 * ControlPanel should use this mixin and call update_control_panel(cp_status) where
 * cp_status contains information for the ControlPanel to update itself.
 *
 * Note that the API is slightly awkward.  Hopefully we will improve this when
 * we get the time to refactor the control panel.
 *
 * For example, here is what a typical client action would need to do to add
 * support for a control panel with some buttons::
 *
 *     var ControlPanelMixin = require('web.ControlPanelMixin');
 *
 *     var SomeClientAction = Widget.extend(ControlPanelMixin, {
 *         ...
 *         start: function () {
 *             this._renderButtons();
 *             this._updateControlPanel();
 *             ...
 *         },
 *         do_show: function () {
 *              ...
 *              this._updateControlPanel();
 *         },
 *         _renderButtons: function () {
 *             this.$buttons = $(QWeb.render('SomeTemplate.Buttons'));
 *             this.$buttons.on('click', ...);
 *         },
 *         _updateControlPanel: function () {
 *             this.update_control_panel({
 *                 cp_content: {
 *                    $buttons: this.$buttons,
 *                 },
 *          });
 */
var ControlPanelMixin = {
    need_control_panel: true,
    /**
     * @param {web.ControlPanel} [cp]
     */
    set_cp: function (cp) {
        this._controlPanel = cp;
    },
    /**
     * @param {Object} [cp_status] see web.ControlPanel.updateContents() for a description
     * @param {Object} [options] see web.ControlPanel.updateContents() for a description
     */
    update_control_panel: function (cp_status, options) {
        if (this._controlPanel) {
            this._controlPanel.updateContents(cp_status || {}, options || {});
        }
    },
};

return ControlPanelMixin;

});

odoo.define('web.ControlPanelView', function (require) {
"use strict";

var ControlPanelController = require('web.ControlPanelController');
var ControlPanelModel = require('web.ControlPanelModel');
var ControlPanelRenderer = require('web.ControlPanelRenderer');
var mvc = require('web.mvc');
var pyUtils = require('web.py_utils');
var searchViewParameters = require('web.searchViewParameters');
var viewUtils = require('web.viewUtils');

var DEFAULT_INTERVAL = searchViewParameters.DEFAULT_INTERVAL;
var DEFAULT_PERIOD = searchViewParameters.DEFAULT_PERIOD;
var INTERVAL_OPTIONS = searchViewParameters.INTERVAL_OPTIONS;
var PERIOD_OPTIONS = searchViewParameters.PERIOD_OPTIONS;

var Factory = mvc.Factory;

var ControlPanelView = Factory.extend({
    config: _.extend({}, Factory.prototype.config, {
        Controller: ControlPanelController,
        Model: ControlPanelModel,
        Renderer: ControlPanelRenderer,
    }),
    viewType: 'controlpanel',

    /**
     * @override
     * @param {Object} [params]
     * @param {Object} [params.viewInfo] a controlpanel (or search) fieldsview
     * @param {string} [params.viewInfo.arch]
     * @param {string} [params.context={}]
     * @param {string} [params.domain=[]]
     * @param {string} [params.template] the QWeb template to render
     */
    init: function (params) {
        this._super();
        params = params || {};
        var viewInfo = params.viewInfo || {arch: '<controlpanel/>', fields: {}};

        // TODO: use this where necessary
        // var context = params.context || {};
        // var searchDefaults = {};
        // for (var key in context) {
        //     var match = /^search_default_(.*)$/.exec(key);
        //     if (match) {
        //         searchDefaults[match[1]] = context[key];
        //     }
        // }
        // var disableCustomFilters = context.search_disable_custom_filters;
        // var hasSearchView = params.hasSearchView;


        this.arch = viewUtils.parseArch(viewInfo.arch);
        this.fields = viewInfo.fields;

        this.controllerParams.modelName = params.modelName;

        this.modelParams.context = params.context || {};
        this.modelParams.domain = params.domain || [];

        this.rendererParams.template = params.template;
        this.rendererParams.breadcrumbs = params.breadcrumbs;

        this.loadParams.actionId = params.actionId;
        this.loadParams.fields = this.fields;
        this.loadParams.groups = [];
        this.loadParams.modelName = params.modelName;
        if (this.arch.tag === 'controlpanel') {
            this._parseControlPanelArch();
        } else {
            this._parseSearchArch();
        }

        // don't forget to compute and rename:
        //  - groupable
        //  - enableTimeRangeMenu
        //  - search view visibility
        //  - space available for breadcrumb (depends on visibility of search view and mobile mode)
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} child parsed arch node
     * @returns {Object}
     */
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
    /**
     * @private
     * @param {Object} filter
     * @param {Object} attrs
     */
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
                filter.options = PERIOD_OPTIONS;
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
                filter.options = INTERVAL_OPTIONS;
                filter.defaultOptionId = attrs.defaultInterval ||
                                            DEFAULT_INTERVAL;
                filter.currentOptionId = false;
            }
        }
    },
    /**
     * Executed when the given arch has root node <controlpanel>.
     *
     * @private
     */
    _parseControlPanelArch: function () {
        var controls = [];
        this.arch.children.forEach(function (node) {
            if (node.tag === 'controls') {
                node.children.forEach(function (control) {
                    controls.push(control);
                });
            }
        });
        this.rendererParams.controls = controls;
    },
    /**
     * Executed when the given arch has root node <search>, for backward
     * compatibility with former 'search' view.
     *
     * @private
     */
    _parseSearchArch: function () {
        var self = this;
        var groups = [];
        var preFilters = _.flatten(this.arch.children.map(function (child) {
            return child.tag !== 'group' ?
                    self._evalArchChild(child) :
                    child.children.map(self._evalArchChild);
        }));
        preFilters.push({tag: 'separator'});

        var filter;
        var currentTag;
        var currentGroup = [];
        var groupOfGroupBys = [];
        var groupNumber = 1;

        _.each(preFilters, function (preFilter) {
            if (preFilter.tag !== currentTag || _.contains(['separator', 'field'], preFilter.tag)) {
                if (currentGroup.length) {
                    if (currentTag === 'groupBy') {
                        groupOfGroupBys = groupOfGroupBys.concat(currentGroup);
                    } else {
                        groups.push(currentGroup);
                    }
                }
                currentTag = preFilter.tag;
                currentGroup = [];
                groupNumber++;
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
                if (filter.type === 'filter' || filter.type === 'groupBy') {
                    filter.groupNumber = groupNumber;
                }
                self._extractAttributes(filter, preFilter.attrs);
                currentGroup.push(filter);
            }
        });
        groups.push(groupOfGroupBys);
        this.loadParams.groups = groups;
    },
});

return ControlPanelView;

});
