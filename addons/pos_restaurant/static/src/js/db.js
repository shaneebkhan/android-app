odoo.define("pos_restaurant.DB", function(require) {
    "use strict";
    var core = require("web.core");
    var utils = require("web.utils");
    var db = require("point_of_sale.DB");
    var models = require("point_of_sale.models");
    var field_utils = require("web.field_utils");

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
                "partner_name",
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
                    amount_total_without_tip: 123,
                    tip_amount: 0,
                    creation_date: field_utils.format.datetime(moment(order.creation_date), {}, { timezone: false }),
                    partner_name: order.data.partner_id && this.get_partner_by_id(order.data.partner_id).name
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
            "partner_name",
            "table_name",
            "waiter_name" // TODO: create this
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
                        round_pr(order.amount_total - order.tip_amount, self.currency.rounding).toFixed(
                            self.currency.decimals
                        )
                    ),

                    tip_amount: order.tip_amount,
                    creation_date: field_utils.format.datetime(moment(order.date_order), {}, { timezone: false }),
                    partner_name: order.partner_name,
                    table: order.table_name,
                    waiter_name: order.waiter_name
                });
            });
        }
    });
});
