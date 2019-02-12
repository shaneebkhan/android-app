odoo.define('mail.wip.model.Message', function (require) {
'use strict';

const emojis = require('mail.emojis');
const mailUtils = require('mail.utils');
const Model = require('mail.wip.model.Model');

const session = require('web.session');
const time = require('web.time');

class Message extends Model {
    /**
     * @override {mail.wip.model.Model}
     * @private
     */
    _compute() {
        const {
            author_id,
            date,
            id,
            model,
            res_id,
        } = this;

        Object.assign(this, {
            $body: this._computeBody(),
            $date: date ? moment(time.str_to_datetime(date)) : moment(),
            _model: 'mail.message',
            authorLID: author_id ? `res.partner_${author_id[0]}` : undefined,
            lid: `mail.message_${id}`,
            originLID: res_id && model ? `${model}_${res_id}` : undefined,
            threadLIDs: this._computeThreadLIDs(),
        });
    }

    /**
     * @private
     * @return {string}
     */
    _computeBody() {
        let body = this.body;
        for (let emoji of emojis) {
            const { unicode } = emoji;
            let regexp = new RegExp(
                `(?:^|\\s|<[a-z]*>)(${unicode})(?=\\s|$|</[a-z]*>)`,
                "g"
            );
            let originalBody = body;
            body = body.replace(
                regexp,
                ` <span class="o_mail_emoji">${unicode}</span> `
            );
            // Idiot-proof limit. If the user had the amazing idea of
            // copy-pasting thousands of emojis, the image rendering can lead
            // to memory overflow errors on some browsers (e.g. Chrome). Set an
            // arbitrary limit to 200 from which we simply don't replace them
            // (anyway, they are already replaced by the unicode counterpart).
            if (_.str.count(body, "o_mail_emoji") > 200) {
                body = originalBody;
            }
        }
        // add anchor tags to urls
        return mailUtils.parseAndTransform(body, mailUtils.addLink);
    }

    /**
     * @private
     * @return {mail.wip.model.Thread[]}
     */
    _computeThreadLIDs() {
        const {
            channel_ids=[],
            model,
            needaction_partner_ids=[],
            res_id,
            starred_partner_ids=[],
        } = this;
        let threadLIDs = channel_ids.map(id => `mail.channel_${id}`);
        if (needaction_partner_ids.includes(session.partner_id)) {
            threadLIDs.push('mail.box_inbox');
        }
        if (starred_partner_ids.includes(session.partner_id)) {
            threadLIDs.push('mail.box_starred');
        }
        if (model && res_id) {
            const originLID = `${model}_${res_id}`;
            if (originLID && !threadLIDs.includes(originLID)) {
                threadLIDs.push(originLID);
            }
        }
        return threadLIDs;
    }
}

return Message;

});
