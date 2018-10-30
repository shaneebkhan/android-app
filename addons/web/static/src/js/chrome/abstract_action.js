odoo.define('web.AbstractAction', function (require) {
"use strict";

/**
 * We define here the AbstractAction widget, which implements the ActionMixin.
 * All client actions must extend this widget.
 *
 * @module web.AbstractAction
 */

var ActionMixin = require('web.ActionMixin');
var Widget = require('web.Widget');

var AbstractAction = Widget.extend(ActionMixin);

return AbstractAction;

});
