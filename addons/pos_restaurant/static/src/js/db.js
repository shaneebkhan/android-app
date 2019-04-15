odoo.define("pos_restaurant.DB", function(require) {
    "use strict";
    var db = require("point_of_sale.DB");

    db.include({
        insert_validated_order: function(order) {

        },
        
        remove_order: function(order_id) {
            var order = this.get_order(order_id);
            var order_to_save = _.pick(
                order,
                "uid",
                "amount_total",
                "creation_date",
                "partner_id",
                "table",
                "user_id"
            );

            // TODO replace user_id with name
            // TODO replace partner_id with name

            this._super(order_id);
        }
    });
});
