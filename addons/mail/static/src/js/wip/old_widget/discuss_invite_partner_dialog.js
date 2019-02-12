odoo.define('mail.wip.old_widget.DiscussInvitePartnerDialog', function (require) {
"use strict";

const core = require('web.core');
const Dialog = require('web.Dialog');

const _t = core._t;
const QWeb = core.qweb;

/**
 * Widget : Invite People to Channel Dialog
 *
 * Popup containing a 'many2many_tags' custom input to select multiple partners.
 * Searches user according to the input, and triggers event when selection is
 * validated.
 */
var PartnerInviteDialog = Dialog.extend({
    dialog_title: _t("Invite people"),
    template: 'mail.wip.old_widget.DiscussInvitePartnerDialog',
    /**
     * @override {web.Dialog}
     * @param {mail.wip.old_widget.Discuss} parent
     * @param {Object} param1
     * @param {owl.Store} param1.store
     * @param {string} param1.threadLID
     */
    init: function (parent, { store, threadLID }) {
        const channelName = store.getters['thread/name']({ threadLID });
        this.threadLID = threadLID;
        this.channelID = store.state.threads[threadLID].id;
        this.store = store;
        this._super(parent, {
            title: _t(`Invite people to #${channelName}`),
            size: 'medium',
            buttons: [{
                text: _t("Invite"),
                close: true,
                classes: 'btn-primary',
                click: ev => this._invite(ev),
            }],
        });
    },
    /**
     * @override {web.Dialog}
     * @return {Promise}
     */
    start: function () {
        this.$input = this.$('.o_input');
        this.$input.select2({
            width: '100%',
            allowClear: true,
            multiple: true,
            formatResult: item => {
                let status;
                if (item.id === 'odoobot') {
                    status = 'bot';
                } else {
                    const partnerLID = `res.partner_${item.id}`;
                    const partner = this.store.state.partners[partnerLID];
                    status = partner.im_status;
                }
                const $status = QWeb.render('mail.wip.userStatus', { status });
                return $('<span>').text(item.text).prepend($status);
            },
            query: query => {
                this.store.dispatch('partner/search', {
                    callback: partners => {
                        query.callback({
                            results: partners.map(partner => {
                                return {
                                    ...partner,
                                    text: partner.label,
                                };
                             }),
                        });
                    },
                    limit: 20,
                    value: query.term,
                });
            }
        });
        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    async _invite() {
        const data = this.$input.select2('data');
        if (data.length === 0) {
            return;
        }
        await this._rpc({
            model: 'mail.channel',
            method: 'channel_invite',
            args: [this.channelID],
            kwargs: {
                partner_ids: _.pluck(data, 'id')
            },
        });
        const names = _.escape(_.pluck(data, 'text').join(', '));
        const notification = _t(`You added <b>${names}</b> to the conversation.`);
        this.do_notify(_t("New people"), notification);
    },
});

return PartnerInviteDialog;

});
