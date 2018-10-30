odoo.define('web.mvc', function (require) {
"use strict";

/**
 * TODO: doc (explain why mrc)
 */

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
     * This method should return the complete state necessary for the renderer
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

var Renderer = Widget.extend({
    /**
     * @override
     * @param {any} state
     * @param {Object} params
     */
    init: function (parent, state, params) {
        this._super(parent);
        this.state = state;
    },
});

var Controller = Widget.extend({
    /**
     * @override
     * @param {Model} model
     * @param {Renderer} renderer
     * @param {Object} params
     */
    init: function (parent, model, renderer, params) {
        this._super.apply(this, arguments);
        this.model = model;
        this.renderer = renderer;
    },
    /**
     * @returns {Promise}
     */
    start: function () {
        return $.when(
            this._super.apply(this, arguments),
            this.renderer.appendTo(this.$el)
        );
    },
});

var Factory = Class.extend({
    config: {
        Model: Model,
        Renderer: Renderer,
        Controller: Controller,
    },
    init: function () {
        this.rendererParams = {};
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
     * renderer/model with parent as parent, then we have to reassign them at
     * the end to make sure that we have the proper relationships.  This is
     * necessary to solve the problem that the controller needs the model and
     * the renderer to be instantiated, but the model need a parent to be able
     * to load itself, and the renderer needs the data in its constructor.
     *
     * @param {Widget} parent the parent of the resulting Controller (most
     *      likely an action manager)
     * @returns {Promise<Controller>}
     */
    getController: function (parent) {
        var self = this;
        return $.when(this._loadData(parent), ajax.loadLibs(this)).then(function (state) {
            var renderer = self.getRenderer(parent, state);
            var Controller = self.Controller || self.config.Controller;
            var controllerParams = _.extend({
                initialState: state,
            }, self.controllerParams);
            var controller = new Controller(parent, self.model, renderer, controllerParams);
            renderer.setParent(controller);
            return controller;
        });
    },
    /**
     * Returns a new model instance
     *
     * @param {Widget} parent the parent of the model
     * @returns {Model} instance of the model
     */
    getModel: function (parent) {
        var Model = this.config.Model;
        return new Model(parent);
    },
    /**
     * Returns a new renderer instance
     *
     * @param {Widget} parent the parent of the renderer
     * @param {Object} state the information related to the rendered data
     * @returns {Renderer} instance of the renderer
     */
    getRenderer: function (parent, state) {
        var Renderer = this.config.Renderer;
        return new Renderer(parent, state, this.rendererParams);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Loads initial data from the model
     *
     * @private
     * @param {Widget} parent the parent of the model
     * @returns {Promise<*>} a promise that resolves to the value returned by
     *   the get method from the model
     */
    _loadData: function (parent) {
        var model = this.getModel(parent);
        return model.load(this.loadParams).then(function () {
            return model.get.apply(model, arguments);
        });
    },
});


return {
    Factory: Factory,
    Model: Model,
    Renderer: Renderer,
    Controller: Controller,
};

});
