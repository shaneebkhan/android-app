odoo.define('mail.widget.DiscussInvitePartnerDialog', function (require) {
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
    template: 'mail.widget.DiscussInvitePartnerDialog',
    /**
     * @override {web.Dialog}
     * @param {mail.widget.Discuss} parent
     * @param {Object} param1
     * @param {owl.Store} param1.store
     * @param {string} param1.threadLocalID
     */
    init: function (parent, { store, threadLocalID }) {
        const channelName = store.getters.threadName({ threadLocalID });
        this.threadLocalID = threadLocalID;
        this.channelID = store.state.threads[threadLocalID].id;
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
                    const partnerLocalID = `res.partner_${item.id}`;
                    const partner = this.store.state.partners[partnerLocalID];
                    status = partner.im_status;
                }
                const $status = QWeb.render('mail.widget.userStatus', { status });
                return $('<span>').text(item.text).prepend($status);
            },
            query: query => {
                this.store.dispatch('searchPartners', {
                    callback: partners => {
                        let results = partners.map(partner => {
                            return {
                                id: partner.id,
                                label: partner.displayName,
                                text: partner.displayName,
                                value: partner.displayName,
                            };
                        });
                        results = _.sortBy(results, 'label');
                        query.callback({ results });
                    },
                    keyword: query.term,
                    limit: 20,
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
