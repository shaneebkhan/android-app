odoo.define('mail.wip.model.ThreadCache', function (require) {
"use strict";

const Model = require('mail.wip.model.Model');

class ThreadCache extends Model {
    /**
     * @override {mail.wip.model.Model}
     * @private
     */
    _compute() {
        let {
            allHistoryLoaded=false,
            loaded=false,
            loading=false,
            loadingMore=false,
            messageLIDs=[],
            stringifiedDomain,
            threadLID,
        } = this;

        if (loaded) {
            loading = false;
        }

        Object.assign(this, {
            allHistoryLoaded,
            loaded,
            loading,
            loadingMore,
            lid: `${threadLID}_${stringifiedDomain}`,
            messageLIDs,
        });
    }
}

return ThreadCache;

});
