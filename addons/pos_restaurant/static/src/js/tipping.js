odoo.define("pos_restaurant.tipping", function(require) {
    "use strict";

    var core = require("web.core");
    var ScreenWidget = require("point_of_sale.screens").ScreenWidget;
    var PosBaseWidget = require("point_of_sale.BaseWidget");
    var chrome = require("point_of_sale.chrome");
    var gui = require("point_of_sale.gui");
    var rpc = require("web.rpc");

    var _t = core._t;

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

    var TippingScreenOrder = PosBaseWidget.extend({
        template: "TippingScreenOrder",

        init: function(parent, options) {
            this._super(parent, options);
            this.parent = parent;
            this.order = options.order;
        },

        renderElement: function() {
            var self = this;
            this._super();

            this.$el.click(function() {
                var $this = $(this);
                $this.addClass("highlight");

                self.gui.show_popup("number", {
                    title: _t("Add Tip"),
                    value: self.format_currency_no_symbol(self.order.tip_amount),
                    confirm: function(value) {
                        value = Number(value);
                        rpc.query({
                            model: "pos.order",
                            method: "set_tip",
                            args: [self.order.uid, value]
                        }).catch(function() {
                            // TODO
                            console.error("ERROR");
                        });

                        self.order.is_tipped = true;
                        self.order.tip_amount = value;
                        self.order.amount_total = self.order.amount_total_without_tip + value;
                        self.renderElement();

                        var search_box = self.parent.el.querySelector(".searchbox input");
                        search_box.focus();

                        // search_box.select() doesn't work on iOS
                        search_box.setSelectionRange(0, search_box.value.length);

                        $this.removeClass("highlight");
                    },
                    cancel: function() {
                        $this.removeClass("highlight");
                    }
                });
            });
        }
    });

    var TippingScreenWidget = ScreenWidget.extend({
        template: "TippingScreenWidget",
        auto_back: true,

        init: function(parent, options) {
            this._super(parent, options);
            this.filtered_confirmed_orders = [];
            this.current_search = "";
        },

        show: function() {
            var self = this;
            this._super();

            // this screen is not related to orders, so hide this widget
            this.chrome.widget.order_selector.hide();

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
            this.$(".searchbox input").on("keydown", function() {
                var searchbox = this;
                clearTimeout(search_timeout);

                console.log("got ", self.current_search);
                search_timeout = setTimeout(function() {
                    if (self.current_search != searchbox.value) {
                        self.current_search = searchbox.value;
                        self.search(self.current_search);
                    } else {
                        console.log("skipping re-render cause search term didn't change");
                    }
                }, 70);
            });
        },

        render_orders: function() {
            var self = this;

            this.$el
                .find(".list-table-contents")
                .empty()
                .append(
                    this.filtered_confirmed_orders.map(function(order) {
                        var tipping_order = new TippingScreenOrder(self, {
                            order: order
                        });
                        tipping_order.renderElement();
                        return tipping_order.$el;
                    })
                );
        },

        // TODO JOV: document
        search: function(term) {
            var self = this;

            term = term.toLowerCase();
            this.filtered_confirmed_orders = this.pos.db.confirmed_orders;

            term.split(" ").forEach(function(term) {
                self.filtered_confirmed_orders = _.filter(self.filtered_confirmed_orders, function(order) {
                    return _.some(_.values(order), function(value) {
                        return (
                            String(value)
                                .toLowerCase()
                                .indexOf(term) !== -1
                        );
                    });
                });
            });

            this.render_orders();
        },

        // todo is this still necessary?
        close: function() {
            this._super();
            this.chrome.widget.order_selector.show();

            if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
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
