odoo.define("pos_restaurant.tipping", function(require) {
    "use strict";

    var ScreenWidget = require("point_of_sale.screens").ScreenWidget;
    var PosBaseWidget = require("point_of_sale.BaseWidget");
    var chrome = require("point_of_sale.chrome");
    var gui = require("point_of_sale.gui");

    var TippingWidget = PosBaseWidget.extend({
        template: "TippingWidget",

        start: function(){
            var self = this;
            this.$el.click(function(){
                self.gui.show_screen('tipping');
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
        },

        show: function(){
            var self = this;
            this._super();

            // re-render the template when showing it to have the
            // latest orders.
            this.renderElement();

            this.$('.back').click(function(){
                self.gui.back();
            });
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
        },
    });
    gui.define_screen({ name: "tipping", widget: TippingScreenWidget });

    return {
        TippingWidget: TippingWidget,
        TippingScreenWidget: TippingScreenWidget
    };
});
