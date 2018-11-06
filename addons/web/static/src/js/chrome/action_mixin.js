odoo.define('web.ActionMixin', function (require) {
"use strict";

/**
 * We define here the ActionMixin, the generic notion of action (from the point
 * of view of the web client).  In short, an action is a widget which controls
 * the main part of the screen (everything below the control panel).
 *
 * More precisely, the action manager is the component that coordinates a stack
 * of actions.  Whenever the user navigates in the interface, switches views,
 * open different menus, the action manager creates/updates/destroys special
 * widgets which implements the ActionMixin.  These actions need to answer to a
 * standardised API, which is the reason for this mixin.
 *
 * In practice, most actions are view controllers (coming from a
 * ir.action.act_window).  However, some actions are 'client actions'.  They
 * also need to implement the ActionMixin for a better cooperation with the
 * action manager.
 *
 * @module web.ActionMixin
 */

var core = require('web.core');

var qweb = core.qweb;

var ActionMixin = {
    template: 'Action',

    renderElement: function () {
        this._super.apply(this, arguments);
        if (this.contentTemplate) {
            this.$('.o_content').append(core.qweb.render(this.contentTemplate, {widget: this}));
        }
    },
    /**
     * Called each time the action is attached into the DOM.
     */
    on_attach_callback: function () {},
    /**
     * Called each time the action is detached from the DOM.
     */
    on_detach_callback: function () {},

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * In some situations, we need confirmation from the controller that the
     * current state can be destroyed without prejudice to the user.  For
     * example, if the user has edited a form, maybe we should ask him if we
     * can discard all his changes when we switch to another action.  In that
     * case, the action manager will call this method.  If the returned
     * deferred is succesfully resolved, then we can destroy the current action,
     * otherwise, we need to stop.
     *
     * @returns {Deferred} resolved if the action can be removed, rejected otherwise
     */
    canBeRemoved: function () {
        return $.when();
    },
    /**
     * This function is called when the current context (~state) of the action
     * should be known. For instance, if the action is a view controller,
     * this may be useful to reinstantiate the view in the same state.
     */
    getContext: function () {
    },
    /**
     * Gives the focus to the action
     */
    giveFocus: function () {
    },
    /**
     * Renders the buttons to append, in most cases, to the control panel (in
     * the bottom left corner). When the action is rendered in a dialog, those
     * buttons might be moved to the dialog's footer.
     *
     * @param {jQuery Node} $node
     */
    renderButtons: function ($node) {
    },
    // TMP
    updateControlPanel: function (status, options) {
        if (this._controlPanel) {
            this._controlPanel.updateContents(status || {}, options || {});
        }
    },
};

return ActionMixin;

});
