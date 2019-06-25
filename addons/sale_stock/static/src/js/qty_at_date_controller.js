odoo.define('sale_stock.SaleOrderController', function (require) {
"use strict";

var core = require('web.core');
var ListController = require('web.ListController');

var _t = core._t;
var qweb = core.qweb;

var SaleOrderController = ListController.extend({
    /**
     * @override
     */
    init: function (parent, model, renderer, params) {
        var context = renderer.state.getContext();
        this.inventory_id = context.active_id;
        return this._super.apply(this, arguments);
    },

    // -------------------------------------------------------------------------
    // Public
    // -------------------------------------------------------------------------
    /**
     * @override
     */
    renderButtons: function ($node) {
        this._super.apply(this, arguments);
        var $validationButton = $(qweb.render('InventoryLines.Buttons'));
        $validationButton.prependTo($node.find('.o_list_buttons'));
    },
});

return SaleOrderController;

});
