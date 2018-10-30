odoo.define('web.ControlPanelModel', function (require) {
"use strict";

var mvc = require('web.mvc');

var ControlPanelModel = mvc.Model.extend({
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    get: function () {
        return {};
    },
});

return ControlPanelModel;

});
