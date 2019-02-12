odoo.define('mail.wip.model.Thread', function (require) {
'use strict';

const Model = require('mail.wip.model.Model');

class Thread extends Model {
    /**
     * @override {mail.wip.model.Model}
     * @private
     */
    _compute() {
        let {
            _model,
            cacheLIDs=[],
            channel_type,
            direct_partner: [{
                id: directPartnerID,
                im_status: directPartnerImStatus,
                email: directPartnerEmail,
                name: directPartnerName,
            }={}]=[],
            id,
            members=[],
            typingMemberLIDs=[],
        } = this;

        if (!_model && channel_type) {
            _model = 'mail.channel';
        }
        if (!_model || !id) {
            throw new Error('thread must always have `model` and `id`');
        }

        if (directPartnerID) {
            this.directPartnerLID = `res.partner_${directPartnerID}`;
        }

        Object.assign(this, {
            _model,
            cacheLIDs,
            lid: `${_model}_${id}`,
            memberLIDs: members.map(member => `res.partner_${member.id}`),
            typingMemberLIDs,
        });
    }
}

return Thread;

});
