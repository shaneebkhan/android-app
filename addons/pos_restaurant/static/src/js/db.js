odoo.define("pos_restaurant.DB", function(require) {
    "use strict";
    var db = require("point_of_sale.DB");

    db.include({
        init: function(options) {
            this._super(options);
            this.confirmed_orders = [];
        },

        insert_validated_order: function(order) {
            var order_to_save = _.pick(
                order.data,
                "uid",
                "amount_total",
                "creation_date",
                "partner_id",
                "table",
                "user_id"
            );

            // TODO replace user_id with name
            // TODO replace partner_id with name

            this.confirmed_orders.push(order_to_save);

            console.log("confirmed orders", this.confirmed_orders);
        },

        // After an order is synced it'll be removed. We save a copy
        // of it for the tipping interface.
        remove_order: function(order_id) {
            var order = this.get_order(order_id);
            this.insert_validated_order(order);

            this._super(order_id);
        }
    });
});
