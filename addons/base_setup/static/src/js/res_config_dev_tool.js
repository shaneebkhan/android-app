odoo.define('base_setup.ResConfigDevTool', function (require) {
    "use strict";

    var Widget = require('web.Widget');
    var widget_registry = require('web.widget_registry');
    var session = require ('web.session');

    var ResConfigDevTool = Widget.extend({
         template: 'res_config_dev_tool',

        /**
         * @override
         * @param {Widget|null} parent
         * @param {Object} params
         */
         init: function (parent, record, nodeInfo) {
            this._super.apply(this, arguments);
            this.debug = odoo.debug.split(",");
            this.demo_active = session.demo_active;
            console.log(session);
        }
    });

    widget_registry.add('res_config_dev_tool', ResConfigDevTool);
});