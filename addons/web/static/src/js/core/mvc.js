odoo.define('web.mvc', function (require) {
"use strict";

var ajax = require('web.ajax');
var Class = require('web.Class');
var mixins = require('web.mixins');
var ServicesMixin = require('web.ServicesMixin');
var Widget = require('web.Widget');

var Model = Class.extend(mixins.EventDispatcherMixin, ServicesMixin, {
    /**
     * @param {Widget} parent
     */
    init: function (parent) {
        mixins.EventDispatcherMixin.init.call(this);
        this.setParent(parent);
    },
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * This method should return the complete state necessary for the view
     * to display the current data.
     *
     * @returns {*}
     */
    get: function () {
    },
    /**
     * The load method is called once in a model, when we load the data for the
     * first time.  The method returns (a promise that resolves to) some kind
     * of token/handle.  The handle can then be used with the get method to
     * access a representation of the data.
     *
     * @param {Object} params
     * @returns {Promise} The promise resolves to some kind of handle
     */
    load: function () {
        return $.when();
    },
});

var View = Widget.extend({
    init: function (parent, state, params) {
        this._super(parent);
        this.state = state;
    },
});

var Controller = Widget.extend({
    /**
     * @constructor
     * @param {Widget} parent
     * @param {Model} model
     * @param {View} view
     * @param {Object} params
     */
    init: function (parent, model, view, params) {
        this._super.apply(this, arguments);
        this.model = model;
        this.view = view;
    },
    /**
     * @returns {Promise}
     */
    start: function () {
        return $.when(
            this._super.apply(this, arguments),
            this.view.appendTo(this.$el)
        );
    },
});

var Factory = Class.extend({
    config: {
        Model: Model,
        View: View,
        Controller: Controller,
    },
    init: function () {
        this.viewParams = {};
        this.controllerParams = {};
        this.loadParams = {};
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Main method of the Factory class. Create a controller, and make sure that
     * data and libraries are loaded.
     *
     * There is a unusual thing going in this method with parents: we create
     * view/model with parent as parent, then we have to reassign them at
     * the end to make sure that we have the proper relationships.  This is
     * necessary to solve the problem that the controller need the model and the
     * view to be instantiated, but the model need a parent to be able to
     * load itself, and the view needs the data in its constructor.
     *
     * @param {Widget} parent The parent of the resulting Controller (most
     *      likely an action manager)
     * @returns {Promise} The deferred resolves to a controller
     */
    getController: function (parent) {
        var self = this;
        return $.when(this._loadData(parent), ajax.loadLibs(this)).then(function () {
            var state = self.model.get(arguments[0]);
            var view = self.getView(parent, state);
            var Controller = self.Controller || self.config.Controller;
            var controller = new Controller(parent, self.model, view, self.controllerParams);
            view.setParent(controller);
            return controller;
        });
    },
    /**
     * Returns the view model or create an instance of it if none
     *
     * @param {Widget} parent the parent of the model, if it has to be created
     * @returns {Object} instance of the view model
     */
    getModel: function (parent) {
        var Model = this.config.Model;
        this.model = new Model(parent);
    },
    /**
     * Returns the a new view instance
     *
     * @param {Widget} parent the parent of the model, if it has to be created
     * @param {Object} state the information related to the rendered view
     * @returns {Object} instance of the view
     */
    getView: function (parent, state) {
        var View = this.config.View;
        return new View(parent, state, this.viewParams);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Load initial data from the model
     *
     * @private
     * @param {Widget} parent the parent of the model
     * @returns {Promise<*>} a promise that resolves to whatever the model
     *   decide to return
     */
    _loadData: function (parent) {
        var model = this.getModel(parent);
        return model.load(this.loadParams);
    },
});


return {
    Factory: Factory,
    Model: Model,
    View: View,
    Controller: Controller,
};

});
