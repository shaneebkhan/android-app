odoo.define('account.payment.tree', function (require) {
"use strict";
    var core = require('web.core');
    var ListController = require('web.ListController');
    var ListView = require('web.ListView');
    var ListRenderer = require('web.ListRenderer');
    var viewRegistry = require('web.view_registry');

    var qweb = core.qweb;

    var PaymentsListController = ListController.extend({
        buttons_template: 'PaymentListView.buttons',
        // custom_events: {
        //     selection_changed: '_onSelectionChanged',
        // },
        _resetButtons: function() {
            if (this.$buttons) {
                if (!this.model.get(this.handle).context.quick_action_deposit) {
                    this.renderer.quick_action_deposit = true;
                    this.$buttons.find('button.o_button_create_batch_payment').hide();
                    console.log("click")
                    return
                }
                this.$buttons.find('button').hide();
                if (this.getSelectedIds().length > 0) {
                    this.$buttons.find('button.o_button_create_batch_payment').show();
                }
            }
        },
        /**
         * Extends the renderButtons function of ListView by adding an event listener
         * on the bill upload button.
         *
         * @override
         */
        renderButtons: function () {
            this._super.apply(this, arguments); // Possibly sets this.$buttons
            if (this.$buttons) {
                var self = this;
                this._resetButtons();
                this.$buttons.on('click', '.o_button_create_batch_payment', function () {
                    var state = self.model.get(self.handle, {raw: true});
                    var context = state.getContext();
                    var activeIds = self.getSelectedIds();
                    // debugger
                    return self._rpc({
                        model: state.model,
                        method: 'create_batch_payment',
                        context: context,
                        args: [activeIds],
                    }).then(function (result) {
                        self.do_action(result);
                    })
                });
            }
        },
        _onSelectionChanged: function() {
            this._super.apply(this, arguments); // Possibly sets this.$buttons
            this._resetButtons();
        }
    });

    var PaymentsListRenderer = ListRenderer.extend({
        start: function() {
            var self = this;
            this._super.apply(this, arguments).then(function() {
                if (!self.quick_action_deposit) {
                    self.$('thead .o_list_record_selector input').prop('checked', true);
                    self.$('tbody .o_list_record_selector input:not(":disabled")').prop('checked', true);
                    self._updateSelection();
                }
            })
        }
    });
    var PaymentsListView = ListView.extend({
        config: _.extend({}, ListView.prototype.config, {
            Controller: PaymentsListController,
            Renderer: PaymentsListRenderer,
        }),
    });

    viewRegistry.add('account_payment_tree', PaymentsListView);
});
