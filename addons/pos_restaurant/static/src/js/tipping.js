odoo.define("pos_restaurant.tipping", function(require) {
    "use strict";

    var ScreenWidget = require("point_of_sale.screens").ScreenWidget;
    var PosBaseWidget = require("point_of_sale.BaseWidget");
    var chrome = require("point_of_sale.chrome");
    var gui = require("point_of_sale.gui");

    var TippingWidget = PosBaseWidget.extend({
        template: "TippingWidget",

        start: function() {
            var self = this;
            this.$el.click(function() {
                self.gui.show_screen("tipping");
            });
        }
    });

    chrome.Chrome.include({
        init: function() {
            this._super();
            this.widgets.push({
                name: "tipping",
                widget: TippingWidget,
                replace: ".placeholder-TippingWidget"
            });
        }
    });

    var TippingScreenWidget = ScreenWidget.extend({
        template: "TippingScreenWidget",

        init: function(parent, options) {
            this._super(parent, options);
            this.filtered_confirmed_orders = [];
        },

        show: function() {
            var self = this;
            this._super();
            this.filtered_confirmed_orders = this.pos.db.confirmed_orders;

            // re-render the template when showing it to have the
            // latest orders.
            this.renderElement();

            this.$(".back").click(function() {
                self.gui.back();
            });

            var search_timeout = undefined;
            this.$(".searchbox input").on("keypress", function(event) {
                var searchbox = this;
                clearTimeout(search_timeout);

                search_timeout = setTimeout(function() {
                    self.search(searchbox.value);
                }, 70);
            });
        },

        search: function(term) {
            this.filtered_confirmed_orders = _.filter(this.pos.db.confirmed_orders, function(order) {
                return _.values(order, function(value) {
                    return value.indexOf(term) !== -1;
                });
            });

            this.renderElement();
        },

        // todo is this still necessary?
        close: function() {
            this._super();
            if (
                this.pos.config.iface_vkeyboard &&
                this.chrome.widget.keyboard
            ) {
                this.chrome.widget.keyboard.hide();
            }
        }
    });
    gui.define_screen({ name: "tipping", widget: TippingScreenWidget });

    return {
        TippingWidget: TippingWidget,
        TippingScreenWidget: TippingScreenWidget
    };
});
