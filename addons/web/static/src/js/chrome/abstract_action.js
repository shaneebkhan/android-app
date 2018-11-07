odoo.define('web.AbstractAction', function (require) {
"use strict";

/**
 * We define here the AbstractAction widget, which implements the ActionMixin.
 * All client actions must extend this widget.
 *
 * @module web.AbstractAction
 */

var ActionMixin = require('web.ActionMixin');
var ControlPanelView = require('web.ControlPanelView');
var Widget = require('web.Widget');

var AbstractAction = Widget.extend(ActionMixin, {
    config: {
        ControlPanelView: ControlPanelView,
    },
    hasControlPanel: false,

    init: function (parent, action, options) {
        this._super(parent);
        this._title = action.display_name || action.name;
        this.controlPanelParams = {
            actionId: action.id,
            context: action.context,
            breadcrumbs: options && options.breadcrumbs || [],
        };
    },
    willStart: function () {
        var self = this;
        if (this.hasControlPanel) {
            var params = this.controlPanelParams;
            var controlPanelView = new this.config.ControlPanelView(params);
            return controlPanelView.getController(this).then(function (controlPanel) {
                self._controlPanel = controlPanel;
                return self._controlPanel.appendTo(document.createDocumentFragment());
            });
        }
        return $.when();
    },
    start: function () {
        if (this._controlPanel) {
            this._controlPanel.$el.prependTo(this.$el);
        }
        return this._super.apply(this, arguments);
    },
});

return AbstractAction;

});
