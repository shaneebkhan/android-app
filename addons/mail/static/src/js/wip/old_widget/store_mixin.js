odoo.define('mail.wip.old_widget.StoreMixin', function (require) {
"use strict";

var StoreMixin = {
    /**
     * @throws {Error} in case the store service does not yet exist
     * @return {Promise}
     */
    async awaitStore() {
        const res = await this.call('store', 'get');
        if (!res) {
            throw new Error("Cannot get store. Either store service does not yet exist, or no store exists yet");
        }
        this.store = res;
    },
};

return StoreMixin;

});
