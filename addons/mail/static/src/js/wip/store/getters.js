odoo.define('mail.wip.store.getters', function (require) {
"use strict";

const getters = {
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.partnerLID
     * @return {mail.wip.model.Thread|undefined}
     */
    'thread/chat_from_partner'({ state }, { partnerLID }) {
        const matchedLID = state.threadChatLIDs.find(threadLID => {
            const thread = state.threads[threadLID];
            return thread.directPartnerLID === partnerLID;
        });
        if (!matchedLID) {
            return;
        }
        return state.threads[matchedLID];
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLID
     * @return {string}
     */
    'thread/name'({ state }, { threadLID }) {
        const thread = state.threads[threadLID];
        if (thread.channel_type === 'chat') {
            const directPartner = state.partners[thread.directPartnerLID];
            return thread.custom_channel_name || directPartner.name;
        }
        return thread.name;
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @return {mail.wip.model.Thread[]}
     */
    'threads/channel'({ state }) {
        return state.threadChannelLIDs.map(threadLID =>
            state.threads[threadLID]);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @return {mail.wip.model.Thread[]}
     */
    'threads/chat'({ state }) {
        return state.threadChatLIDs.map(threadLID =>
            state.threads[threadLID]);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.getters
     * @return {integer}
     */
    'threads/global_unread_counter'({ getters, state }) {
        const unreadMailChannelCounter = getters['threads/mail_channel']()
            .reduce((acc, thread) => {
                if (thread.message_unread_counter > 0) {
                    acc++;
                }
                return acc;
            }, 0);
        const mailboxInboxCounter = state.threads['mail.box_inbox'].counter;
        return unreadMailChannelCounter + mailboxInboxCounter;
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @return {mail.wip.model.Thread[]}
     */
    'threads/mailbox'({ state }) {
        return state.threadMailboxLIDs.map(threadLID =>
            state.threads[threadLID]);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @return {mail.wip.model.Thread[]}
     */
    'threads/mail_channel'({ state }) {
        return state.threadMailChannelLIDs.map(threadLID =>
            state.threads[threadLID]);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.getters
     * @param {Object} param0.state
     * @return {mail.wip.model.Thread[]}
     */
    'threads/pinned_channel'({ getters, state }) {
        return getters['threads/channel']().filter(thread =>
            state.threadPinnedLIDs.includes(thread.lid));
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.getters
     * @param {Object} param0.state
     * @return {mail.wip.model.Thread[]}
     */
    'threads/pinned_chat'({ getters, state }) {
        return getters['threads/chat']().filter(thread =>
            state.threadPinnedLIDs.includes(thread.lid));
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @return {integer}
     */
    'threads/pinned_mail_channel_amount'({ state }) {
        return state.threadMailChannelLIDs.length;
    },
};

return getters;

});
