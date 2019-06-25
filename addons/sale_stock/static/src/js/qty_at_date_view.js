odoo.define('sale_stock.saleOrderView', function (require) {
"use strict";

var SaleOrderController = require('sale_stock.SaleOrderController');
var ListView = require('web.ListView');
var viewRegistry = require('web.view_registry');

var SaleOrderView = ListView.extend({
    config: _.extend({}, ListView.prototype.config, {
        Controller: SaleOrderController
    })
});

viewRegistry.add('sale_order_info_button', SaleOrderView);

});
