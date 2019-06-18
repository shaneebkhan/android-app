odoo.define('base_setup.ResConfigEdition', function (require) {
    "use strict";

    var Widget = require('web.Widget');
    var widget_registry = require('web.widget_registry');
    var session = require ('web.session');
    

    var ResConfigEdition = Widget.extend({
        template: 'res_config_edition',

       /**
        * @override
        * @param {Widget|null} parent
        * @param {Object} params
        */
        init: function (parent, record, nodeInfo) {
           this._super.apply(this, arguments);
           this.debug = odoo.debug.split(",");
           this.demo_active = session.demo_active;
           this.server_version = session.server_version;
           
       }
   });

   widget_registry.add('res_config_edition', ResConfigEdition);
});