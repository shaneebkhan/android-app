odoo.define("pos_restaurant.DB", function(require) {
    "use strict";
    var core = require("web.core");
    var utils = require("web.utils");
    var db = require("point_of_sale.DB");
    var models = require("point_of_sale.models");

    var _t = core._t;
    var round_pr = utils.round_precision;

    db.include({
        init: function(options) {
            this._super(options);
            this.confirmed_orders = [];
        },

        insert_validated_order: function(order) {
            var order_to_save = _.pick(
                order,
                "uid",
                "amount_total_without_tip",
                "tip_amount",
                "creation_date",
                "partner_id",
                "table",
                "waiter_name"
            );

            // TODO replace partner_id with name

            this.confirmed_orders.push(order_to_save);

            console.log("confirmed orders", this.confirmed_orders);
        },

        // After an order is synced it'll be removed. We save a copy
        // of it for the tipping interface.
        remove_order: function(order_id) {
            var order = this.get_order(order_id);
            this.insert_validated_order(
                _.extend(order.data, {
                    waiter_name: "boingboing",
                    amount_total_without_tip: 123
                })
            );

            this._super(order_id);
        }
    });

    models.load_models({
        model: "pos.order",
        fields: [
            "pos_reference",
            "amount_total",
            "date_order",
            "tip_amount",
            "partner_id.display_name", // TODO: create computed field
            "table_id.name", // TODO: create computed field
            "waiter_name"
        ],
        order: [{ name: "date_order", asc: false }],
        domain: function(self) {
            return [["session_id", "=", self.pos_session.id]];
        },
        loaded: function(self, orders) {
            orders.forEach(function(order) {
                self.db.insert_validated_order({
                    uid: order.pos_reference.replace(_t("Order "), ""),

                    // mimic _symbol_set
                    amount_total_without_tip: parseFloat(
                        round_pr(order.amount_total - order.tip_amount, self.currency.rounding).toFixed(self.currency.decimals)
                    ),

                    tip_amount: order.tip_amount,
                    creation_date: order.date_order, // TODO make date equivalent to what POS generates
                    partner_id: order.partner_id && order.partner_id[1],
                    table: order.table_id && order.table_id[1],
                    waiter_name: order.waiter_name
                });
            });
        }
    });
});
