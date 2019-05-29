odoo.define('mail.wip.event_override', function () {
"use strict";

Object.assign(window.Event.prototype, {
    odooPrevented: false,
    preventOdoo() {
        this.odooPrevented = true;
        if (this.detail && this.detail.originalEvent) {
            this.detail.originalEvent.preventOdoo();
        }
    },
});

});
