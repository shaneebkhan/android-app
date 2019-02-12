odoo.define('mail.wip.model.MailFailure', function (require) {
'use strict';

const Model = require('mail.wip.model.Model');

class MailFailure extends Model {
    /**
     * @override {mail.wip.model.Model}
     * @private
     */
    _compute() {
        const { message_id } = this;
        Object.assign(this, {
            _model: 'mail.failure',
            lid: `mail.failure_${message_id}`,
        });
    }
}

// /**
//  * Get a valid object for the 'mail.preview' template
//  *
//  * @returns {Object}
//  */
// getPreview: function () {
//     var preview = {
//         body: _t("An error occured when sending an email"),
//         date: this._lastMessageDate,
//         documentID: this.documentID,
//         documentModel: this.documentModel,
//         id: 'mail_failure',
//         imageSRC: this._moduleIcon,
//         title: this._modelName,
//     };
//     return preview;
// },

return MailFailure;

});
