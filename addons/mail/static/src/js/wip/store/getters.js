odoo.define('mail.wip.store.getters', function () {
"use strict";

const getters = {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @return {integer}
     */
    amountOfPinnedMailChannels({ state }) {
        return state.threadMailChannelLocalIDs.length;
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.getters
     * @param {Object} param0.state
     * @return {mail.wip.model.Thread[]}
     */
    pinnedThreadChannels({ getters, state }) {
        return getters._threadChannels().filter(thread =>
            state.threadPinnedLocalIDs.includes(thread.localID));
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.getters
     * @param {Object} param0.state
     * @return {mail.wip.model.Thread[]}
     */
    pinnedThreadChats({ getters, state }) {
        return getters._threadChats().filter(thread =>
            state.threadPinnedLocalIDs.includes(thread.localID));
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.partnerLocalID
     * @return {mail.wip.model.Thread|undefined}
     */
    threadChatFromPartner({ state }, { partnerLocalID }) {
        const matchedLocalID = state.threadChatLocalIDs.find(threadLocalID => {
            const thread = state.threads[threadLocalID];
            return thread.directPartnerLocalID === partnerLocalID;
        });
        if (!matchedLocalID) {
            return;
        }
        return state.threads[matchedLocalID];
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @return {mail.wip.model.Thread[]}
     */
    threadMailboxes({ state }) {
        return state.threadMailboxLocalIDs.map(localID =>
            state.threads[localID]);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @return {mail.wip.model.Thread[]}
     */
    threadMailChannels({ state }) {
        return state.threadMailChannelLocalIDs.map(localID =>
            state.threads[localID]);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLocalID
     * @return {string}
     */
    threadName({ state }, { threadLocalID }) {
        const thread = state.threads[threadLocalID];
        if (thread.channel_type === 'chat') {
            const directPartner = state.partners[thread.directPartnerLocalID];
            return thread.custom_channel_name || directPartner.name;
        }
        return thread.name;
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.getters
     * @return {integer}
     */
    threadsGlobalUnreadCounter({ getters, state }) {
        const unreadMailChannelCounter = getters.threadMailChannels()
            .reduce((acc, thread) => {
                if (thread.message_unread_counter > 0) {
                    acc++;
                }
                return acc;
            }, 0);
        const mailboxInboxCounter = state.threads['mail.box_inbox'].counter;
        return unreadMailChannelCounter + mailboxInboxCounter;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.state
     * @return {mail.wip.model.Thread[]}
     */
    _threadChannels({ state }) {
        return state.threadChannelLocalIDs.map(threadLocalID =>
            state.threads[threadLocalID]);
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.state
     * @return {mail.wip.model.Thread[]}
     */
    _threadChats({ state }) {
        return state.threadChatLocalIDs.map(threadLocalID =>
            state.threads[threadLocalID]);
    },
};

return getters;

});
