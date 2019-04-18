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

    var TippingScreenList = PosBaseWidget.extend({
        template: "TippingScreenList",

        init: function(parent, options) {
            this._super(parent, options);
            this.parent = parent;
        }
    });

    var TippingScreenWidget = ScreenWidget.extend({
        template: "TippingScreenWidget",

        init: function(parent, options) {
            this._super(parent, options);
            this.filtered_confirmed_orders = [];
            this.tipping_screen_list_widget = new TippingScreenList(
                this,
                options
            );
        },

        show: function() {
            var self = this;
            this._super();
            this.filtered_confirmed_orders = this.pos.db.confirmed_orders;

            // re-render the template when showing it to have the
            // latest orders.
            this.renderElement();
            this.render_orders();

            this.$(".back").click(function() {
                self.gui.back();
            });

            var search_timeout = undefined;

            // use keydown because keypress isn't triggered for backspace
            this.$(".searchbox input").on("keydown", function(_) {
                var searchbox = this;
                clearTimeout(search_timeout);

                console.log("got ", searchbox.value);
                search_timeout = setTimeout(function() {
                    self.search(searchbox.value);
                }, 70);
            });
        },

        render_orders: function() {
            this.tipping_screen_list_widget.renderElement();
            this.$el
                .find(".list-table-contents")
                .replaceWith(this.tipping_screen_list_widget.el);
        },

        search: function(term) {
            this.filtered_confirmed_orders = _.filter(
                this.pos.db.confirmed_orders,
                function(order) {
                    return _.some(_.values(order), function(value) {
                        return String(value).indexOf(term) !== -1;
                    });
                }
            );

            console.log(this.filtered_confirmed_orders);
            this.render_orders();
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
