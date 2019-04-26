odoo.define("pos_restaurant.DB", function(require) {
    "use strict";
    var core = require("web.core");
    var utils = require("web.utils");
    var db = require("point_of_sale.DB");
    var models = require("point_of_sale.models");
    var field_utils = require("web.field_utils");

    var _t = core._t;
    var round_pr = utils.round_precision;

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function() {
            _super_order.initialize.apply(this, arguments);
            this.is_tipped = false;
        },

        export_as_JSON: function() {
            var res = _super_order.export_as_JSON.apply(this, arguments);
            return _.extend(res, {
                tip_amount: this.get_tip()
            });
        }
    });

    db.include({
        init: function(options) {
            this._super(options);
            this.confirmed_orders = [];
        },

        insert_validated_order: function(order) {
            var order_to_save = _.pick(
                order,
                "uid",
                "amount_total",
                "amount_total_without_tip",
                "tip_amount",
                "is_tipped",
                "creation_date",
                "partner_name",
                "table"
            );

            // add this to the beginning because the tipping screen
            // shows orders from new to old.
            this.confirmed_orders.unshift(order_to_save);
            console.log("confirmed orders", this.confirmed_orders);
        },

        // After an order is synced it'll be removed. We save a copy
        // of it for the tipping interface.
        remove_order: function(order_id) {
            var order = this.get_order(order_id).data;
            this.insert_validated_order(
                _.extend(order, {
                    amount_total_without_tip: order.amount_total - (order.tip_amount || 0),
                    tip_amount: order.tip_amount || 0,
                    is_tipped: order.is_tipped,
                    creation_date: field_utils.format.datetime(moment(order.creation_date), {}, { timezone: false }),
                    partner_name: order.partner_id && this.get_partner_by_id(order.partner_id).name
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
            "is_tipped",
            "partner_name",
            "table_name"
        ],
        order: [{ name: "date_order" }],
        domain: function(self) {
            return [["session_id", "=", self.pos_session.id]];
        },
        loaded: function(self, orders) {
            orders.forEach(function(order) {
                self.db.insert_validated_order({
                    uid: order.pos_reference.replace(_t("Order "), ""),
                    amount_total: order.amount_total,

                    // mimic _symbol_set
                    amount_total_without_tip: parseFloat(
                        round_pr(order.amount_total - order.tip_amount, self.currency.rounding).toFixed(
                            self.currency.decimals
                        )
                    ),

                    tip_amount: order.tip_amount,
                    is_tipped: order.is_tipped,
                    creation_date: field_utils.format.datetime(moment(order.date_order), {}, { timezone: false }),
                    partner_name: order.partner_name,
                    table: order.table_name
                });
            });
        }
    });
});
