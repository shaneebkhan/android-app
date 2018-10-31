odoo.define('web.ControlPanelController', function (require) {
"use strict";

var mvc = require('web.mvc');

var ControlPanelController = mvc.Controller.extend({
    custom_events: {
        button_clicked: '_onButtonClicked',
        facet_removed: '_onFacetRemoved',
        item_option_clicked: '_onItemOptionClicked',
        menu_item_clicked: '_onMenuItemClicked',
        new_filters: '_onNewFilters',
        new_groupBy: '_onNewGroupBy',
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

        // see control panel that looks for "searchview.$buttons"
        this.$buttons = this._getSubMenus();
    },
    destroy: function () {
        // delete reference to this.$buttons, to prevent crash.  Note that
        // the $buttons is actually a part of this.renderer, which should be
        // destroyed by the renderer anyway
        delete this.$buttons;
        this._super.apply(this, arguments);
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
    /**
     * Updates the content and displays the ControlPanel
     *
     * @see  ControlPanelRenderer (update)
     */
    update: function (status, options) {
        this.updateIndex++;
        this.renderer.render(status, options);
    },
    update2: function (params) {
        this.model.reload(params);
        this._reportNewQuery();
        var state = this.model.get();
        return this.renderer.updateState(state);
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
        this.update2({removeGroup: group});
    },
    _onItemOptionClicked: function (event) {
        return this.update2({toggleOption: event.data});
    },
    _onMenuItemClicked: function (event) {
        return this.update2({toggleFilter: event.data});
    },
    _onNewFilters: function (event) {
        return this.update2({newFilters: event.data});
    },
    _onNewGroupBy: function (event) {
        return this.update2({newGroupBy: event.data});
    }
});

return ControlPanelController;

});
