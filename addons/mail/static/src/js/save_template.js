odoo.define('mail.save_template', function (require) {
"use strict";

var core = require('web.core');
var field_registry = require('web.field_registry');
var relationalFields = require('web.relational_fields');
var session = require('web.session')
var _t = core._t;

var save_template = relationalFields.FieldMany2One.extend({


     // _onInputFocusout: function (e) {},

    _search: function (search_val) {
        var self = this;
        return this._super.apply(this, arguments).then(function (values){
            session.user_context['form_value'] = self.$input.val();
            values.push({
                label: _t("Save as new Template..."),
                action: function () {
                    self.trigger_up('button_clicked', {
                        attrs: {
                            name: 'save_as_template',
                            type: 'object'
                        },
                        record: self.record
                    })
                },
                classname: 'o_m2o_dropdown_option',
            });
            return values;
		});
	}
});

field_registry.add('save_template', save_template);
return save_template;

});