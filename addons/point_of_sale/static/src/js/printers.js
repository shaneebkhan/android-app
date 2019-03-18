odoo.define('point_of_sale.Printer', function (require) {
"use strict";

var Session = require('web.Session');
var core = require('web.core');
var _t = core._t;

return core.Class.extend({
    init: function (url, pos) {
        this.receipt_queue = [];
        this.pos = pos;
        this.connection = new Session(undefined, url || 'http://localhost:8069', { use_cors: true});
    },

    /**
     * Sends a command to the connected proxy to open the cashbox
     * (the physical box where you store the cash). Updates the status of
     * the printer with the answer from the proxy.
     */
    open_cashbox: function () {
        return this.connection.rpc('/hw_proxy/default_printer_action', {
            data: {
                action: 'cashbox'
            }
        }, { timeout: 5000 });
    },

    /**
     * Add the receipt to the queue of receipts to be printed and process it.
     * @param {String} receipt: The receipt to be printed, in HTML
     */
    print_receipt: function (receipt) {
        var self = this;
        if (receipt) {
            this.receipt_queue.push(receipt);
        }
        function process_next_job() {
            if (self.receipt_queue.length > 0) {
                var r = self.receipt_queue.shift();
                self.send_printing_job(r)
                    .then(function () {
                        process_next_job();
                    }, function (error) {
                        if (error) {
                            self.pos.gui.show_popup('error-traceback', {
                                'title': _t('Printing Error: ') + error.message.message,
                                'body': error.message.debug,
                            });
                            return;
                        }
                        self.receipt_queue.unshift(r);
                    });
            }
        }
        process_next_job();
    },

    /**
     * Sends the printing command the connected proxy and updates the status of
     * the printer with the answer from the proxy.
     * @param {String} receipt : The receipt to be printed, in HTML
     */
    send_printing_job: function (receipt) {
        return this.connection.rpc('/hw_proxy/default_printer_action', {
            data: {
                action: 'html_receipt',
                receipt: receipt,
            }
        }, { timeout: 5000 });
    },
});
});
