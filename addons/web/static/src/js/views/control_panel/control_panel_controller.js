odoo.define('web.ControlPanelController', function (require) {
"use strict";

var mvc = require('web.mvc');

var ControlPanelController = mvc.Controller.extend({
    custom_events: {
        button_clicked: '_onButtonClicked',
        facet_removed: '_onFacetRemoved',
        item_option_clicked: '_onItemOptionClicked',
        item_trashed: '_onItemTrashed',
        menu_item_clicked: '_onMenuItemClicked',
        new_favorite: '_onNewFavorite',
        new_filters: '_onNewFilters',
        new_groupBy: '_onNewGroupBy',
        activate_time_range: '_onActivateTimeRange',
    },

    /**
     * @override
     */
    init: function (parent, model, renderer, params) {
        this._super.apply(this, arguments);

        this.controllerID = params.controllerID;
        this.modelName = params.modelName;

        // the updateIndex is used to prevent concurrent updates of the control
        // panel depending on asynchronous code to be executed in the wrong order
        this.updateIndex = 0;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Compute the search related values that will be
     *
     * @returns {Object} object with keys 'context', 'domain', 'groupBy'
     */
    getSearchState: function () {
        return this.model.getQuery();
    },
    update: function (params) {
        var self = this;
        return this.model.reload(params).then(function () {
            self._reportNewQuery();
            var state = self.model.get();
            return self.renderer.updateState(state);
        });
    },
    /**
     * Updates the content and displays the ControlPanel
     *
     * @see  ControlPanelRenderer (update)
     */
    updateContents: function (status, options) {
        this.updateIndex++;
        this.renderer.render(status, options);
    },
    /**
     * Called at each switch view. This is required until the control panel is
     * shared between controllers of an action.
     *
     * @param {string} controllerID
     */
    setControllerID: function (controllerID) {
        this.controllerID = controllerID;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _getSubMenus: function () {
        return this.renderer.$subMenus;
    },
    _reportNewQuery: function () {
        this.trigger_up('search', {
            controllerID: this.controllerID,
            query: this.model.getQuery(),
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onButtonClicked: function (ev) {
        ev.stopPropagation();
        this.trigger_up('execute_action', {
            action_data: ev.data.attrs,
            env: {
                context: {},
                model: this.modelName,
            },
        });
    },
    _onFacetRemoved: function (ev) {
        var group = ev.data.group;
        if (!group) {
            group = this.renderer.getLastFacet();
        }
        this.update({removeGroup: group});
    },
    _onItemOptionClicked: function (event) {
        return this.update({toggleOption: event.data});
    },
    _onItemTrashed: function (event) {
        return this.update({trashItem: event.data});
    },
    _onMenuItemClicked: function (event) {
        return this.update({toggleFilter: event.data});
    },
    _onNewFavorite: function (event) {
        return this.update({newFavorite: event.data});
    },
    _onNewFilters: function (event) {
        return this.update({newFilters: event.data});
    },
    _onNewGroupBy: function (event) {
        return this.update({newGroupBy: event.data});
    },
    _onActivateTimeRange: function (event) {
        return this.update({activateTimeRange: event.data});
    }
});

return ControlPanelController;

});
