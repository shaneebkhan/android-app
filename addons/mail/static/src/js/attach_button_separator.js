odoo.define('mail.attach_button_separator', function (require) {
"use strict";

var AbstractField = require('web.AbstractField');
var core = require('web.core');
var field_registry = require('web.field_registry');
var relationalFields = require('web.relational_fields');
var Widget = require('web.Widget');
var widgetRegistry = require('web.widget_registry');

var _t = core._t;
var qweb = core.qweb;
var QWeb = core.qweb;

var attachButton = Widget.extend({
    template: "attach_button",
    events: {
    'click .o_attach': '_onAttach',
    },
    init: function (parent, record, node) {
        this.stateId = record.id;
        if (node.attrs && node.attrs.binary_field) {
            this.trigger_field = node.attrs.binary_field;
        }
        this._super.apply(this, arguments);
    },
    _onAttach: function(){
        if (this.trigger_field) {
            this.trigger_up('open_uploader', {
                fieldName: this.trigger_field,
                stateId: this.stateId
            })
        }
    },
 });

widgetRegistry.add('attach_button', attachButton);

return {attachButton: attachButton};

});
