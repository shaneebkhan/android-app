odoo.define('mail.wip.model.Partner', function (require) {
'use strict';

const Model = require('mail.wip.model.Model');

class Partner extends Model {
    /**
     * @override {mail.wip.model.Model}
     * @private
     */
    _compute() {
        const {
            displayName,
            id,
            messageLIDs=[],
            name,
        } = this;
        Object.assign(this, {
            _model: 'res.partner',
            $name: name || displayName,
            lid: `res.partner_${id}`,
            messageLIDs,
        });
    }
}

return Partner;

});
