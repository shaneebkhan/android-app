odoo.define('mail.store.mutations', function (require) {
"use strict";

const emojis = require('mail.emojis');
const mailUtils = require('mail.utils');

const AttachmentViewer = require('mail.component.AttachmentViewer');

const core = require('web.core');
const time = require('web.time');

const _t = core._t;

const { Observer } = owl;

/**
 * @private
 * @param {Object} param0
 * @param {string|undefined} [param0.checksum]
 * @param {string|undefined} param0.fileType
 * @param {integer} param0.id
 * @param {string} [param0.url]
 * @return {string|undefined}
 */
function _computeAttachmentDefaultSource({ checksum, fileType, id, url }) {
    if (fileType === 'image') {
        return `/web/image/${id}?unique=1&amp;signature=${checksum}&amp;model=ir.attachment`;
    }
    if (fileType === 'application/pdf') {
        return `/web/static/lib/pdfjs/web/viewer.html?file=/web/content/${id}?model%3Dir.attachment`;
    }
    if (fileType && fileType.indexOf('text') !== -1) {
        return `/web/content/${id}?model%3Dir.attachment`;
    }
    if (fileType === 'youtu') {
        const token = _computeAttachmentDefaultSourceYoutubeToken({ fileType, url });
        return `https://www.youtube.com/embed/${token}`;
    }
    if (fileType === 'video') {
        return `/web/image/${id}?model=ir.attachment`;
    }
    return undefined;
}

/**
 * @private
 * @param {Object} param0
 * @param {string|undefined} param0.fileType
 * @param {string} param0.url
 * @return {string|undefined}
 */
function _computeAttachmentDefaultSourceYoutubeToken({ fileType, url }) {
    if (fileType !== 'youtu') {
        return undefined;
    }
    const urlArr = url.split('/');
    let token = urlArr[urlArr.length-1];
    if (token.indexOf('watch') !== -1) {
        token = token.split('v=')[1];
        const amp = token.indexOf('&');
        if (amp !== -1){
            token = token.substring(0, amp);
        }
    }
    return token;
}

/**
 * @private
 * @param {Object} param0
 * @param {string} [param0.mimetype]
 * @param {string} [param0.type]
 * @param {string} [param0.url]
 * @return {string|undefined}
 */
function _computeAttachmentFiletype({ mimetype, type, url }) {
    if (type === 'url' && !url) {
        return undefined;
    } else if (!mimetype) {
        return undefined;
    }
    const match = type === 'url'
        ? url.match('(youtu|.png|.jpg|.gif)')
        : mimetype.match('(image|video|application/pdf|text)');
    if (!match) {
        return undefined;
    }
    if (match[1].match('(.png|.jpg|.gif)')) {
        return 'image';
    }
    return match[1];
}

/**
 * @private
 * @return {string}
 */
function _computeMessageBodyWithLinks(body) {
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
 * @param {Object} param0
 * @param {integer[]} [param0.channel_ids=[]]
 * @param {integer} param0.currentPartnerID
 * @param {string} [param0.model]
 * @param {integer[]} [param0.needaction_partner_ids=[]]
 * @param {integer} [param0.res_id]
 * @param {integer[]} [param0.starred_partner_ids=[]]
 * @return {mail.store.model.Thread[]}
 */
function _computeMessageThreadLocalIDs({
    channel_ids=[],
    currentPartnerID,
    model,
    needaction_partner_ids=[],
    res_id,
    starred_partner_ids=[],
}) {
    let threadLocalIDs = channel_ids.map(id => `mail.channel_${id}`);
    if (needaction_partner_ids.includes(currentPartnerID)) {
        threadLocalIDs.push('mail.box_inbox');
    }
    if (starred_partner_ids.includes(currentPartnerID)) {
        threadLocalIDs.push('mail.box_starred');
    }
    if (model && res_id) {
        const originThreadLocalID = `${model}_${res_id}`;
        if (originThreadLocalID && !threadLocalIDs.includes(originThreadLocalID)) {
            threadLocalIDs.push(originThreadLocalID);
        }
    }
    return threadLocalIDs;
}

const mutations = {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.item either 'new_message' or thread local ID, a
     *   valid item in `items` list of chat window manager.
     */
    closeChatWindow({ commit, state }, { item }) {
        const cwm = state.chatWindowManager;
        cwm.items = cwm.items.filter(i => i !== item);
        if (item !== 'new_message') {
            commit('updateThread', {
                threadLocalID: item,
                changes: {
                    fold_state: 'closed',
                    is_minimized: false,
                },
            });
        }
        commit('_computeChatWindows');
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.id
     */
    closeDialog({ state }, { id }) {
        state.dialogManager.dialogs = state.dialogManager.dialogs.filter(item =>
            item.id !== id);
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     */
    closeDiscuss({ commit, state }) {
        if (!state.discuss.open) {
            return;
        }
        Object.assign(state.discuss, {
            domain: [],
            open: false,
            stringifiedDomain: '[]',
            threadLocalID: undefined,
        });
        commit('_computeChatWindows');
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} data
     * @param {string} data.filename
     * @param {integer} [data.id]
     * @param {string} [data.mimetype]
     * @param {string} [data.name]
     * @param {integer} [data.size]
     * @param {boolean} [data.temp=false]
     * @param {boolean} [data.uploaded=false]
     * @param {boolean} [data.uploading=false]
     * @return {string} attachment local ID
     */
    createAttachment({ commit, state }, data) {
        let {
            filename,
            id,
            mimetype,
            name,
            size,
            temp=false,
            uploaded=false,
            uploading=false,
        } = data;
        if (temp) {
            id = state.attachmentNextTempID;
            mimetype = '';
            state.attachmentNextTempID--;
        }
        const attachment = {
            filename,
            id,
            mimetype,
            name,
            size,
            temp,
            uploaded,
            uploading,
        };
        commit('_computeAttachment', attachment);
        Observer.set(state.attachments, attachment.localID, attachment);
        if (temp) {
            if (!(attachment.displayFilename in state.attachmentTempLocalIDs)) {
                Observer.set(state.attachmentTempLocalIDs, attachment.displayFilename, attachment.localID);
            } else {
                state.attachmentTempLocalIDs[attachment.displayFilename] = attachment.localID;
            }
        }
        return attachment.localID;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Array} [param1.author_id]
     * @param {integer} [param1.author_id[0]]
     * @param {string} [param1.author_id[1]]
     * @param {integer[]} param1.channel_ids
     * @param {string|boolean} [param1.model=false]
     * @param {integer[]} param1.needaction_partner_ids
     * @param {string} param1.record_name
     * @param {integer|boolean} [param1.res_id=false]
     * @param {integer[]} param1.starred_partner_ids
     * @param {...Object} param1.kwargs
     * @return {string} message local ID
     */
    createMessage(
        { commit, state },
        {
            attachment_ids=[],
            author_id, author_id: [
                authorID,
                authorLongName
            ]=[],
            channel_ids,
            model,
            needaction_partner_ids,
            record_name,
            res_id,
            starred_partner_ids,
            ...kwargs
        },
    ) {
        // 1. make message
        const message = {
            attachment_ids,
            author_id,
            channel_ids,
            model,
            needaction_partner_ids,
            record_name,
            res_id,
            starred_partner_ids,
            ...kwargs
        };
        commit('_computeMessage', message);
        const messageLocalID = message.localID;
        if (state.messages[messageLocalID]) {
            console.warn(`message with local ID "${messageLocalID}" already exists in store`);
            return;
        }
        Observer.set(state.messages, messageLocalID, message);
        // 2. author: create/update + link
        if (authorID) {
            const partnerLocalID = commit('insertPartner', {
                id: authorID,
                longName: authorLongName,
            });
            commit('_linkMessageToPartner', {
                messageLocalID,
                partnerLocalID,
            });
        }
        // 3. threads: create/update + link
        if (message.originThreadLocalID) {
            commit('insertThread', {
                _model: model,
                id: res_id,
            });
            if (message.record_name) {
                commit('updateThread', {
                    threadLocalID: message.originThreadLocalID,
                    changes: { name: record_name },
                });
            }
        }
        // 3a. link message <- threads
        for (const threadLocalID of message.threadLocalIDs) {
            const threadCacheLocalID = `${threadLocalID}_[]`;
            if (!state.threadCaches[threadCacheLocalID]) {
                commit('createThreadCache', { threadLocalID });
            }
            commit('_linkMessageToThreadCache', {
                messageLocalID,
                threadCacheLocalID,
            });
        }
        // 4. attachments: create/update + link
        for (const data of attachment_ids) {
            commit('insertAttachment', data);
        }

        return message;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.getters
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object[]} [param1.direct_partner]
     * @param {Array} [param1.members=[]]
     * @param {boolean} [param1.pin=true]
     * @param {...Object} param1.kwargs
     * @return {string} thread local ID
     */
    createThread(
        { commit, getters, state },
        {
            direct_partner,
            is_minimized,
            members=[],
            pin=true,
            ...kwargs
        }
    ) {
        const thread = {
            direct_partner,
            is_minimized,
            members,
            pin,
            ...kwargs
        };
        commit('_computeThread', thread);
        const threadLocalID = thread.localID;
        if (state.threads[threadLocalID]) {
            console.warn(`already exists thread with local ID ${threadLocalID} in store`);
            return;
        }
        /* Update thread data */
        Observer.set(state.threads, threadLocalID, thread);
        /* Update thread relationships */
        for (const member of members) {
            commit('insertPartner', member);
        }
        if (direct_partner && direct_partner[0]) {
            commit('insertPartner', direct_partner[0]);
        }
        /**
         * Update thread lists.
         * This is done after updating relationships due to list requiring some
         * order that depends on computed relations. For instance, the threads
         * may be ordered by their name, and the name of a chat thread is the
         * name of the direct partner.
         */
        state.threadLocalIDs.push(threadLocalID);
        if (pin) {
            // register as pinned
            state.threadPinnedLocalIDs.push(threadLocalID);
        }
        if (is_minimized) {
            commit('openChatWindow', { item: threadLocalID });
        }
        if (thread._model === 'mail.box') {
            // register as mailbox
            state.threadMailboxLocalIDs.push(threadLocalID);
            state.threadMailboxLocalIDs.sort((localID1, localID2) => {
                if (localID1 === 'mail.box_inbox') {
                    return -1;
                }
                if (localID2 === 'mail.box_inbox') {
                    return 1;
                }
                if (localID1 === 'mail.box_starred') {
                    return -1;
                }
                if (localID2 === 'mail.box_starred') {
                    return 1;
                }
                const name1 = getters.threadName({ threadLocalID: localID1 });
                const name2 = getters.threadName({ threadLocalID: localID2 });
                return name1 < name2 ? -1 : 1;
            });
        }
        if (thread._model === 'mail.channel') {
            // register as a mail channel
            const index = state.threadMailChannelLocalIDs.findIndex(localID => {
                const otherName = getters.threadName({ threadLocalID: localID });
                const currentName = getters.threadName({ threadLocalID });
                return otherName > currentName;
            });
            if (index !== -1) {
                state.threadMailChannelLocalIDs.splice(index, 0, threadLocalID);
            } else {
                state.threadMailChannelLocalIDs.push(threadLocalID);
            }
        }
        if (thread.channel_type === 'channel') {
            // register as channel
            const index = state.threadChannelLocalIDs.findIndex(localID => {
                const otherName = getters.threadName({ threadLocalID: localID });
                const currentName = getters.threadName({ threadLocalID });
                return otherName > currentName;
            });
            if (index !== -1) {
                state.threadChannelLocalIDs.splice(index, 0, threadLocalID);
            } else {
                state.threadChannelLocalIDs.push(threadLocalID);
            }
        }
        if (thread.channel_type === 'chat') {
            // register as chat
            const index = state.threadChatLocalIDs.findIndex(localID => {
                const otherName = getters.threadName({ threadLocalID: localID });
                const currentName = getters.threadName({ threadLocalID });
                return otherName > currentName;
            });
            if (index !== -1) {
                state.threadChatLocalIDs.splice(index, 0, threadLocalID);
            } else {
                state.threadChatLocalIDs.push(threadLocalID);
            }
        }
        return threadLocalID;
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} [param1.stringifiedDomain='[]']
     * @param {string} param1.threadLocalID
     * @return {string} thread cache local ID
     */
    createThreadCache(
        { commit, state },
        { stringifiedDomain='[]', threadLocalID }
    ) {
        const threadCache = {
            stringifiedDomain,
            threadLocalID,
        };
        commit('_computeThreadCache', threadCache);
        const threadCacheLocalID = threadCache.localID;
        Observer.set(state.threadCaches, threadCacheLocalID, threadCache);
        commit('_linkThreadCacheToThread', {
            threadCacheLocalID,
            threadLocalID,
        });
        return threadCacheLocalID;
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.attachmentLocalID
     */
    deleteAttachment({ state }, { attachmentLocalID }) {
        const attachment = state.attachments[attachmentLocalID];
        // todo: remove attachment from store, when `observer.delete()` is implemented
        if (attachment.temp) {
            Observer.delete(state.attachmentTempLocalIDs, attachment.displayFilename);
        }
    },
    /**
     * Unused for the moment, but may be useful for moderation
     *
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLocalID
     */
    deleteMessage({ commit, state }, { messageLocalID }) {
        delete state.messages[messageLocalID];
        for (const cache of Object.values(state.threadCaches)) {
            if (cache.messageLocalIDs.includes(messageLocalID)) {
                commit('updateThreadCache', {
                    threadCacheLocalID: cache.localID,
                    changes: {
                        messageLocalIDs: cache.messageLocalIDs.filter(localID =>
                            localID !== messageLocalID),
                    },
                });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.globalInnerHeight
     * @param {integer} param1.globalInnerWidth
     * @param {boolean} param1.isMobile
     */
    handleGlobalResize({ commit, state }, {
        globalInnerHeight,
        globalInnerWidth,
        isMobile,
    }) {
        state.global.innerHeight = globalInnerHeight;
        state.global.innerWidth = globalInnerWidth;
        state.isMobile = isMobile; // config.device.isMobile;
        commit('_computeChatWindows');
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {...Object} param1.data
     */
    handleNotificationNeedaction({ commit, state }, { ...data }) {
        const message = commit('insertMessage', { ...data });
        state.threads['mail.box_inbox'].counter++;
        for (const threadLocalID of message.threadLocalIDs) {
            const thread = state.threads[threadLocalID];
            if (
                thread.channel_type === 'channel' &&
                message.needaction_partner_ids.includes(state.currentPartnerID)
            ) {
                commit('updateThread', {
                    threadLocalID,
                    changes: {
                        message_needaction_counter: thread.message_needaction_counter + 1,
                    },
                });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.getters
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer[]} [param1.message_ids=[]]
     */
    handleNotificationPartnerMarkAsRead(
        { commit, getters, state },
        { message_ids=[] }
    ) {
        const inboxLocalID = 'mail.box_inbox';
        const inbox = state.threads[inboxLocalID];
        for (const cacheLocalID of inbox.cacheLocalIDs) {
            for (const messageID of message_ids) {
                const messageLocalID = `mail.message_${messageID}`;
                commit('_unlinkMessageFromThreadCache', {
                    messageLocalID,
                    threadCacheLocalID: cacheLocalID,
                });
            }
        }
        const channels = getters.threadMailChannels();
        for (const channel of channels) {
            const channelLocalID = channel.localID;
            commit('updateThread', {
                threadLocalID: channelLocalID,
                changes: { message_needaction_counter: 0 },
            });
        }
        commit('updateThread', {
            threadLocalID: inboxLocalID,
            changes: {
                counter: inbox.counter - message_ids.length,
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer[]} param1.message_ids
     * @param {boolean} param1.starred
     */
    handleNotificationPartnerToggleStar(
        { commit, state },
        { message_ids=[], starred }
    ) {
        const starredBoxLocalID = 'mail.box_starred';
        const starredBox = state.threads[starredBoxLocalID];
        const starredBoxMainCacheLocalID = `${starredBoxLocalID}_[]`;
        if (!state.threadCaches[starredBoxMainCacheLocalID]) {
            commit('createThreadCache', {
                threadLocalID: starredBoxLocalID,
            });
        }
        for (const messageID of message_ids) {
            const messageLocalID = `mail.message_${messageID}`;
            const message = state.messages[messageLocalID];
            if (!message) {
                continue;
            }
            if (starred) {
                commit('_setMessageStar', { messageLocalID });
                commit('updateThread', {
                    threadLocalID: starredBoxLocalID,
                    changes: {
                        counter: starredBox.counter + 1,
                    },
                });
            } else {
                commit('_unsetMessageStar', { messageLocalID });
                commit('updateThread', {
                    threadLocalID: starredBoxLocalID,
                    changes: {
                        counter: starredBox.counter - 1,
                    },
                });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Array} [param1.author_id]
     * @param {...Object} param1.kwargs
     */
    handleNotificationPartnerTransientMessage(
        { commit, state },
        { author_id, ...kwargs }
    ) {
        const { length: l, [l - 1]: lastMessage } = Object.values(state.messages);
        commit('createMessage', {
            ...kwargs,
            author_id: author_id || state.partners.odoobot.localID,
            id: (lastMessage ? lastMessage.id : 0) + 0.01
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.messageData
     * @param {Array} [param1.searchDomain=[]]
     * @param {string} [param1.threadLocalID]
     */
    handleThreadLoaded(
        { commit, state },
        { messagesData, searchDomain=[], threadLocalID }
    ) {
        const stringifiedDomain = JSON.stringify(searchDomain);
        commit('_insertThreadCache', {
            allHistoryLoaded: messagesData.length < state.MESSAGE_FETCH_LIMIT,
            loaded: true,
            loading: false,
            loadingMore: false,
            stringifiedDomain,
            threadLocalID,
        });
        for (const data of messagesData) {
            // message auto-linked to thread cache on insert
            commit('insertMessage', data);
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.channel_slots
     * @param {Array} [param1.commands=[]]
     * @param {integer} param1.currentPartnerID
     * @param {boolean} [param1.is_moderator=false]
     * @param {Object[]} [param1.mail_failures=[]]
     * @param {Object[]} [param1.mention_partner_suggestions=[]]
     * @param {Object[]} [param1.moderation_channel_ids=[]]
     * @param {integer} [param1.moderation_counter=0]
     * @param {integer} [param1.needaction_inbox_counter=0]
     * @param {Object[]} [param1.shortcodes=[]]
     * @param {integer} [param1.starred_counter=0]
     */
    initMessaging(
        { commit, state },
        {
            channel_slots,
            commands=[],
            currentPartnerID,
            is_moderator=false,
            mail_failures=[],
            mention_partner_suggestions=[],
            menu_id,
            moderation_channel_ids=[],
            moderation_counter=0,
            needaction_inbox_counter=0,
            shortcodes=[],
            starred_counter=0
        }
    ) {
        commit('_initMessagingPartners', currentPartnerID);
        commit('_initMessagingCommands', commands); // required for channels, hence before
        commit('_initMessagingChannels', channel_slots);
        commit('_initMessagingMailboxes', {
            is_moderator,
            moderation_counter,
            needaction_inbox_counter,
            starred_counter
        });
        commit('_initMessagingMailFailures', mail_failures);
        commit('_initMessagingCannedResponses', shortcodes);
        commit('_initMessagingMentionPartnerSuggestions', mention_partner_suggestions);
        state.discuss.menu_id = menu_id;
    },
    /**
     * Update existing attachment or create a new attachment
     *
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.id
     * @param {...Object} param1.kwargs
     * @return {string} attachment local ID
     */
    insertAttachment({ commit, state }, { id, ...kwargs }) {
        const attachmentLocalID = `ir.attachment_${id}`;
        if (!state.attachments[attachmentLocalID]) {
            commit('createAttachment', { id, ...kwargs });
        } else {
            commit('updateAttachment', { attachmentLocalID, changes: kwargs });
        }
        return attachmentLocalID;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.id
     * @param {...Object} param1.kwargs
     * @return {string} message local ID
     */
    insertMessage({ commit, state }, { id, ...kwargs }) {
        const messageLocalID = `mail.message_${id}`;
        if (!state.messages[messageLocalID]) {
            commit('createMessage', { id, ...kwargs });
        } else {
            commit('_updateMessage', {
                messageLocalID,
                changes: kwargs,
            });
        }
        return messageLocalID;
    },
    /**
     * Update existing partner or create a new partner
     *
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.id
     * @param {...Object} param1.kwargs
     * @return {string} partner local ID
     */
    insertPartner({ commit, state }, { id, ...kwargs }) {
        const partnerLocalID = `res.partner_${id}`;
        if (!state.partners[partnerLocalID]) {
            commit('_createPartner', { id, ...kwargs });
        } else {
            commit('updatePartner', {
                partnerLocalID,
                changes: kwargs,
            });
        }
        return partnerLocalID;
    },
    /**
     * Update existing thread or create a new thread
     *
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1._model
     * @param {integer} param1.id
     * @param {...Object} param1.kwargs
     * @return {string} thread local ID
     */
    insertThread({ commit, state }, { _model, id, ...kwargs }) {
        const threadLocalID = `${_model}_${id}`;
        if (!state.threads[threadLocalID]) {
            commit('createThread', { _model, id, ...kwargs });
        } else {
            commit('updateThread', { threadLocalID, changes: kwargs });
        }
        return threadLocalID;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.item item that is invisible
     */
    makeChatWindowVisible({ commit, state }, { item }) {
        const cwm = state.chatWindowManager;
        const {
            length: l,
            [l-1]: { item: lastItem }
        } = cwm.computed.visible;
        commit('swapChatWindows', {
            item1: item,
            item2: lastItem,
        });
        const thread = state.threads[item];
        if (thread && thread.fold_state !== 'open') {
            commit('updateThread', {
                threadLocalID: item,
                changes: { fold_state: 'open' },
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {boolean} [param1.focus=true]
     * @param {string} param1.item either a thread local ID or 'new_message',
     *   if the item is already in `items` and visible, simply focuses it. If
     *   it is already in `items` and invisible, it swaps with last visible chat
     *   window. New item is added based on provided mode.
     * @param {string} [param1.mode='last'] either 'last' or 'last_visible'
     */
    openChatWindow(
        { commit, state },
        { focus=true, item, mode='last' }
    ) {
        const cwm = state.chatWindowManager;
        const thread = state.threads[item];
        if (cwm.items.includes(item)) {
            // open already minimized item
            if (mode === 'last_visible' && cwm.computed.hidden.items.includes(item)) {
                commit('makeChatWindowVisible', { item });
            }
        } else {
            // new item
            cwm.items.push(item);
            if (item !== 'new_message') {
                commit('updateThread', {
                    threadLocalID: item,
                    changes: {
                        fold_state: 'open',
                        is_minimized: true,
                    },
                });
            }
            commit('_computeChatWindows');
            if (mode === 'last_visible') {
                commit('makeChatWindowVisible', { item });
            }
        }
        if (thread && thread.fold_state !== 'open') {
            commit('updateThread', {
                threadLocalID: item,
                changes: { fold_state: 'open' },
            });
        }
        if (focus) {
            commit('_focusChatWindow', { item });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.oldItem item to replace
     * @param {string} param1.newItem item to replace with
     */
    replaceChatWindow({ commit, state }, { oldItem, newItem }) {
        commit('swapChatWindows', {
            item1: newItem,
            item2: oldItem,
        });
        commit('closeChatWindow', { item: oldItem });
        const thread = state.threads[newItem];
        if (thread && !thread.fold_state !== 'open') {
            commit('updateThread', {
                threadLocalID: newItem,
                changes: { fold_state: 'open' },
            });
        }
        commit('_focusChatWindow', { item: newItem });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.item either 'new_message' or thread local ID
     */
    shiftLeftChatWindow(
        { commit, state },
        { item }
    ) {
        const cwm = state.chatWindowManager;
        const index = cwm.items.findIndex(i => i === item);
        if (index === cwm.items.length-1) {
            // already left-most
            return;
        }
        const otherItem = cwm.items[index+1];
        Observer.set(cwm.items, index, otherItem);
        Observer.set(cwm.items, index+1, item);
        commit('_computeChatWindows');
        commit('_focusChatWindow', { item });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.item either 'new_message' or thread local ID
     */
    shiftRightChatWindow(
        { commit, state },
        { item }
    ) {
        const cwm = state.chatWindowManager;
        const index = cwm.items.findIndex(i => i === item);
        if (index === 0) {
            // already right-most
            return;
        }
        const otherItem = cwm.items[index-1];
        Observer.set(cwm.items, index, otherItem);
        Observer.set(cwm.items, index-1, item);
        commit('_computeChatWindows');
        commit('_focusChatWindow', { item });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.item1
     * @param {string} param1.item2
     */
    swapChatWindows(
        { commit, state },
        { item1, item2 }
    ) {
        const cwm = state.chatWindowManager;
        const items = cwm.items;
        const index1 = items.findIndex(i => i === item1);
        const index2 = items.findIndex(i => i === item2);
        if (index1 === -1 || index2 === -1) {
            return;
        }
        Observer.set(items, index1, item2);
        Observer.set(items, index2, item1);
        commit('_computeChatWindows');
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLocalID
     */
    toggleFoldThread({ commit, state }, { threadLocalID }) {
        const thread = state.threads[threadLocalID];
        commit('updateThread', {
            threadLocalID,
            changes: {
                fold_state: thread.fold_state === 'open' ? 'folded' : 'open',
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} [param1.threadLocalID]
     */
    unpinThread({ commit }, { threadLocalID }) {
        commit('updateThread', {
            threadLocalID,
            changes: { pin: false },
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.attachmentLocalID
     * @param {Object} param1.changes
     */
    updateAttachment({ commit, state }, { changes, attachmentLocalID }) {
        const attachment = state.threads[attachmentLocalID];
        Object.assign(attachment, changes);
        commit('_computeAttachment', attachment);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} changes
     */
    updateChatWindowManager({ state }, changes) {
        Object.assign(state.chatWindowManager, changes);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.id
     * @param {any} param1.changes
     */
    updateDialogInfo({ state }, { id, changes }) {
        const dialog  = state.dialogManager.dialogs.find(dialog => dialog.id === id);
        if (!dialog) {
            return;
        }
        Object.assign(dialog.info, changes);
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} changes
     * @param {Array} [changes.domain]
     * @param {boolean} [changes.open]
     * @param {string} [changes.threadLocalID]
     */
    updateDiscuss({ commit, state }, changes) {
        if (changes.stringifiedDomain) {
            throw new Error('cannot set stringified domain on discuss state (read-only)');
        }
        let shouldRecomputeStringifiedDomain = false;
        if ('domain' in changes) {
            shouldRecomputeStringifiedDomain = true;
        } else if (
            'threadLocalID' in changes &&
            changes.threadLocalID !== state.discuss.threadLocalID
        ) {
            shouldRecomputeStringifiedDomain = true;
        }
        if ('open' in changes) {
            if (changes.open) {
                commit('_openDiscuss');
            } else {
                commit('closeDiscuss');
            }
        }
        Object.assign(state.discuss, changes);
        if (shouldRecomputeStringifiedDomain) {
            state.discuss.stringifiedDomain = JSON.stringify(state.discuss.domain);
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.changes
     * @param {string} param1.partnerLocalID
     */
    updatePartner({ commit, state }, { changes, partnerLocalID }) {
        const partner = state.partners[partnerLocalID];
        Object.assign(partner, changes);
        commit('_computePartner', partner);
        // todo: changes of links, e.g. messageLocalIDs
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.changes
     * @param {boolean} [param1.changes.is_minimized]
     * @param {boolean} [param1.changes.pin]
     * @param {string} param1.threadLocalID
     */
    updateThread({ commit, state }, { changes, threadLocalID }) {
        const thread = state.threads[threadLocalID];
        const wasMinimized = thread.is_minimized;
        const wasPinned = thread.pin;
        Object.assign(thread, changes);
        commit('_computeThread', thread);
        const cwm = state.chatWindowManager;
        if (
            !wasMinimized &&
            thread.is_minimized &&
            !cwm.items.includes(threadLocalID)
        ) {
            commit('openChatWindow', { item: threadLocalID });
        }
        if (
            wasMinimized &&
            !thread.is_minimized &&
            cwm.items.includes(threadLocalID)
        ) {
            commit('closeChatWindow', { item: threadLocalID });
        }
        if (!wasPinned && thread.pin) {
            // register as pinned
            state.threadPinnedLocalIDs.push(threadLocalID);
        }
        if (wasPinned && !thread.pin) {
            // unregister as pinned
            state.threadPinnedLocalIDs = state.threadPinnedLIDs.filter(localID =>
                localID !== threadLocalID);
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.changes
     * @param {string} param1.threadCacheLocalID
     */
    updateThreadCache({ commit, state }, { threadCacheLocalID, changes }) {
        const threadCache = state.threadCaches[threadCacheLocalID];
        Object.assign(threadCache, changes);
        commit('_computeThreadCache', threadCache);
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {string|undefined} [param1.attachmentLocalID]
     * @param {string[]} param1.attachmentLocalIDs
     * @return {string|undefined} unique id of open dialog, if open
     */
    viewAttachments({ commit }, { attachmentLocalID, attachmentLocalIDs }) {
        if (!attachmentLocalIDs) {
            return;
        }
        if (!attachmentLocalID) {
            attachmentLocalID = attachmentLocalIDs[0];
        }
        if (!attachmentLocalIDs.includes(attachmentLocalID)) {
            return;
        }
        return commit('_openDialog', {
            Component: AttachmentViewer,
            info: { attachmentLocalID, attachmentLocalIDs },
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.state
     */
    _computeChatWindows({ state }) {
        const BETWEEN_GAP_WIDTH = 5;
        const CHAT_WINDOW_WIDTH = 325;
        const END_GAP_WIDTH = 10;
        const GLOBAL_WIDTH = state.global.innerWidth;
        const HIDDEN_MENU_WIDTH = 200; // max width, including width of dropup items
        const START_GAP_WIDTH = 10;
        const cwm = state.chatWindowManager;
        const discussOpen = state.discuss.open;
        const isMobile = state.isMobile;
        const items = cwm.items;
        let computed = {
            /**
             * Amount of visible slots available for items.
             */
            availableVisibleSlots: 0,
            /**
             * Data related to the hidden menu.
             */
            hidden: {
                /**
                 * List of hidden items. Useful to compute counter. Items are
                 * ordered by their `items` order.
                 */
                items: [],
                /**
                 * Offset of hidden menu starting point from the starting point
                 * of chat window manager. Makes only sense if it is visible.
                 */
                offset: 0,
                /**
                 * Whether hidden menu is visible or not
                 */
                showMenu: false,
            },
            /**
             * Data related to visible chat windows. Index determine order of
             * items. Value: { item, offset }.
             * Offset is offset of starting point of chat window from starting
             * point of chat window manager. Items are ordered by their `items`
             * order
             */
            visible: [],
        };
        if (isMobile || discussOpen) {
            cwm.computed = computed;
            return;
        }
        if (!items.length) {
            cwm.computed = computed;
            return;
        }
        const relativeGlobalWidth = GLOBAL_WIDTH - START_GAP_WIDTH - END_GAP_WIDTH;
        const maxAmountWithoutHidden = Math.floor(
            relativeGlobalWidth / (CHAT_WINDOW_WIDTH + BETWEEN_GAP_WIDTH));
        const maxAmountWithHidden = Math.floor(
            (relativeGlobalWidth - HIDDEN_MENU_WIDTH - BETWEEN_GAP_WIDTH) /
            (CHAT_WINDOW_WIDTH + BETWEEN_GAP_WIDTH));
        if (items.length <= maxAmountWithoutHidden) {
            // all visible
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const offset = START_GAP_WIDTH + i * (CHAT_WINDOW_WIDTH + BETWEEN_GAP_WIDTH);
                computed.visible.push({ item, offset });
            }
            computed.availableVisibleSlots = maxAmountWithoutHidden;
        } else if (maxAmountWithHidden > 0) {
            // some visible, some hidden
            let i;
            for (i = 0; i < maxAmountWithHidden; i++) {
                const item = items[i];
                const offset = START_GAP_WIDTH + i * ( CHAT_WINDOW_WIDTH + BETWEEN_GAP_WIDTH );
                computed.visible.push({ item, offset });
            }
            if (items.length > maxAmountWithHidden) {
                computed.hidden.showMenu = true;
                computed.hidden.offset = computed.visible[i-1].offset
                    + CHAT_WINDOW_WIDTH + BETWEEN_GAP_WIDTH;
            }
            for (let j = maxAmountWithHidden; j < items.length; j++) {
                computed.hidden.items.push(items[j]);
            }
            computed.availableVisibleSlots = maxAmountWithHidden;
        } else {
            // all hidden
            computed.hidden.showMenu = true;
            computed.hidden.offset = START_GAP_WIDTH;
            computed.hidden.items.concat(items);
            console.warn('cannot display any visible chat windows (screen is too small)');
            computed.availableVisibleSlots = 0;
        }
        cwm.computed = computed;
    },
    /**
     * @private
     * @param {Object} unused
     * @param {mail.store.model.Attachment} attachment
     */
    _computeAttachment(unused, attachment) {
        const {
            checksum,
            filename,
            id,
            mimetype,
            name,
            type,
            url,
        } = attachment;

        const displayFilename = filename || name;
        const fileType = _computeAttachmentFiletype({ mimetype, type, url });
        const isTextFile = (fileType && fileType.indexOf('text') !== -1) || false;

        const mediaType = mimetype && mimetype.split('/').shift();
        Object.assign(attachment, {
            _model: 'ir.attachment',
            defaultSource: _computeAttachmentDefaultSource({
                checksum,
                fileType,
                id,
                url,
            }),
            displayFilename,
            displayName: name || filename,
            extension: displayFilename && displayFilename.split('.').pop(),
            fileType,
            isTextFile,
            isViewable: mediaType === 'image' ||
                mediaType === 'video' ||
                mimetype === 'application/pdf' ||
                isTextFile,
            localID: `ir.attachment_${id}`,
        });
    },
    /**
     * @private
     * @param {Object} unused
     * @param {mail.store.model.MailFailure} mailFailure
     */
    _computeMailFailure(unused, mailFailure) {
        const { message_id } = mailFailure;
        Object.assign(mailFailure, {
            _model: 'mail.failure',
            localID: `mail.failure_${message_id}`,
        });
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
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {mail.store.model.Message} message
     */
    _computeMessage({ state }, message) {
        const {
            attachment_ids,
            author_id,
            body,
            channel_ids,
            date,
            id,
            model,
            needaction_partner_ids,
            res_id,
            starred_partner_ids,
        } = message;

        Object.assign(message, {
            _model: 'mail.message',
            attachmentLocalIDs: attachment_ids.map(({ id }) => `ir.attachment_${id}`),
            authorLocalID: author_id ? `res.partner_${author_id[0]}` : undefined,
            body,
            bodyWithLinks: _computeMessageBodyWithLinks(body),
            dateMoment: date ? moment(time.str_to_datetime(date)) : moment(),
            localID: `mail.message_${id}`,
            originThreadLocalID: res_id && model ? `${model}_${res_id}` : undefined,
            threadLocalIDs: _computeMessageThreadLocalIDs({
                channel_ids,
                currentPartnerID: state.currentPartnerID,
                model,
                needaction_partner_ids,
                res_id,
                starred_partner_ids,
            }),
        });
    },
    /**
     * @private
     * @param {Object} unused
     * @param {mail.store.model.Partner} partner
     */
    _computePartner(unused, partner) {
        const {
            id,
            longName,
            messageLocalIDs=[],
            name,
        } = partner;

        Object.assign(partner, {
            _model: 'res.partner',
            displayName: name || longName,
            localID: `res.partner_${id}`,
            messageLocalIDs,
        });
    },
    /**
     * @private
     * @param {Object} unused
     * @param {mail.store.model.Thread} thread
     */
    _computeThread(unused, thread) {
        let {
            _model,
            cacheLocalIDs=[],
            channel_type,
            direct_partner: [{
                id: directPartnerID,
                im_status: directPartnerImStatus,
                email: directPartnerEmail,
                name: directPartnerName,
            }={}]=[],
            id,
            members=[],
            typingMemberLocalIDs=[],
        } = thread;

        if (!_model && channel_type) {
            _model = 'mail.channel';
        }
        if (!_model || !id) {
            throw new Error('thread must always have `model` and `id`');
        }

        if (directPartnerID) {
            thread.directPartnerLocalID = `res.partner_${directPartnerID}`;
        }

        Object.assign(thread, {
            _model,
            cacheLocalIDs,
            localID: `${_model}_${id}`,
            memberLocalIDs: members.map(member => `res.partner_${member.id}`),
            typingMemberLocalIDs,
        });
    },
    /**
     * @private
     * @param {Object} unused
     * @param {mail.store.model.ThreadCache} threadCache
     */
    _computeThreadCache(unused, threadCache) {
        let {
            allHistoryLoaded=false,
            loaded=false,
            loading=false,
            loadingMore=false,
            messageLocalIDs=[],
            stringifiedDomain,
            threadLocalID,
        } = threadCache;

        if (loaded) {
            loading = false;
        }

        Object.assign(threadCache, {
            allHistoryLoaded,
            loaded,
            loading,
            loadingMore,
            localID: `${threadLocalID}_${stringifiedDomain}`,
            messageLocalIDs,
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.id
     * @param {string} [param1.im_status]
     * @param {string} [param1.email]
     * @param {string} [param1.name]
     * @return {string} partner local ID
     */
    _createPartner({ commit, state }, data) {
        const partner = { ...data };
        commit('_computePartner', partner);
        const partnerLocalID = partner.localID;
        if (state.partners[partnerLocalID]) {
            console.warn(`partner with local ID "${partnerLocalID}" already exists in store`);
            return;
        }
        Observer.set(state.partners, partnerLocalID, partner);
        // todo: links
        return partnerLocalID;
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.item either 'new_message' or minimized thread
     *   local ID, a valid item in `items` list of chat window manager
     */
    _focusChatWindow({ state }, { item }) {
        const cwm = state.chatWindowManager;
        if (!cwm.computed.visible.map(v => v.item).includes(item)) {
            return;
        }
        cwm.autofocusItem = item;
        cwm.autofocusCounter++;
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object[]} shortcodes
     */
    _initMessagingCannedResponses({ state }, shortcodes) {
        const cannedResponses = shortcodes
            .map(s => {
                const { id, source, substitution } = s;
                return { id, source, substitution };
            })
            .reduce((obj, cr) => {
                obj[cr.id] = cr;
                return obj;
            }, {});
        Object.assign(state, { cannedResponses });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {Object[]} [param1.channel_channel=[]]
     * @param {Object[]} [param1.channel_direct_message=[]]
     * @param {Object[]} [param1.channel_private_group=[]]
     */
    _initMessagingChannels(
        { commit },
        {
            channel_channel=[],
            channel_direct_message=[],
            channel_private_group=[],
        }
    ) {
        for (const data of channel_channel) {
            commit('insertThread', { _model: 'mail.channel', ...data });
        }
        for (const data of channel_direct_message) {
            commit('insertThread', { _model: 'mail.channel', ...data });
        }
        for (const data of channel_private_group) {
            commit('insertThread', { _model: 'mail.channel', ...data });
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object[]} commandsData
     */
    _initMessagingCommands({ state }, commandsData) {
        const commands = commandsData
            .map(command => {
                return {
                    id: command.name,
                    ...command
                };
            })
            .reduce((obj, command) => {
                obj[command.id] = command;
                return obj;
            }, {});
        Object.assign(state, { commands });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {boolean} param1.is_moderator
     * @param {integer} param1.moderation_counter
     * @param {integer} param1.needaction_inbox_counter
     * @param {integer} param1.starred_counter
     */
    _initMessagingMailboxes(
        { commit },
        {
            is_moderator,
            moderation_counter,
            needaction_inbox_counter,
            starred_counter
        }
    ) {
        commit('createThread', {
            _model: 'mail.box',
            counter: needaction_inbox_counter,
            id: 'inbox',
            name: _t("Inbox"),
        });
        commit('createThread', {
            _model: 'mail.box',
            counter: starred_counter,
            id: 'starred',
            name: _t("Starred"),
        });
        if (is_moderator) {
            commit('createThread', {
                _model: 'mail.box',
                counter: moderation_counter,
                id: 'moderation',
                name: _t("Moderate Messages"),
            });
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object[]} mailFailuresData
     */
    _initMessagingMailFailures({ commit, state }, mailFailuresData) {
        for (const data of mailFailuresData) {
            const mailFailure = { ...data };
            commit('_computeMailFailure', mailFailure);
            Observer.set(state.mailFailures, mailFailure.localID, mailFailure);
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object[]} mentionPartnerSuggestionsData
     */
    _initMessagingMentionPartnerSuggestions(
        { commit },
        mentionPartnerSuggestionsData
    ) {
        for (const suggestions of mentionPartnerSuggestionsData) {
            for (const suggestion of suggestions) {
                const { email, id, name } = suggestion;
                commit('insertPartner', { email, id, name });
            }
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {integer} currentPartnerID
     */
    _initMessagingPartners({ commit, state }, currentPartnerID) {
        commit('_createPartner', {
            id: 'odoobot',
            name: _t("OdooBot"),
        });
        commit('_createPartner', {
            id: currentPartnerID,
        });
        state.currentPartnerID = currentPartnerID;
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} [param1.stringifiedDomain='[]']
     * @param {string} param1.threadLocalID
     * @param {...Object} param1.kwargs
     * @return {string} thread cache local ID
     */
    _insertThreadCache(
        { commit, state },
        { stringifiedDomain='[]', threadLocalID, ...kwargs }
    ) {
        const threadCacheLocalID = `${threadLocalID}_${stringifiedDomain}`;
        if (!state.threadCaches[threadCacheLocalID]) {
            commit('createThreadCache', {
                stringifiedDomain,
                threadLocalID,
                ...kwargs,
            });
        } else {
            commit('updateThreadCache', {
                threadCacheLocalID,
                changes: kwargs,
            });
        }
        return threadCacheLocalID;
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLocalID
     * @param {string} param1.partnerLocalID
     */
    _linkMessageToPartner(
        { commit, state },
        { messageLocalID, partnerLocalID }
    ) {
        const partner = state.partners[partnerLocalID];
        if (partner.messageLocalIDs.includes(messageLocalID)) {
            return;
        }
        commit('updatePartner', {
            partnerLocalID,
            changes: {
                messageLocalIDs: partner.messageLocalIDs.concat([messageLocalID])
            },
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLocalID
     * @param {string} param1.threadCacheLocalID
     */
    _linkMessageToThreadCache(
        { commit, state },
        { messageLocalID, threadCacheLocalID }
    ) {
        const cache = state.threadCaches[threadCacheLocalID];
        const message = state.messages[messageLocalID];
        if (cache.messageLocalIDs.includes(messageLocalID)) {
            return;
        }
        // message are ordered by ID
        const index = cache.messageLocalIDs.findIndex(localID => {
            const otherMessage = state.messages[localID];
            return otherMessage.id > message.id;
        });
        let newMessageLocalIDs = [...cache.messageLocalIDs];
        if (index !== -1) {
            newMessageLocalIDs.splice(index, 0, messageLocalID);
        } else {
            newMessageLocalIDs.push(messageLocalID);
        }
        commit('updateThreadCache', {
            threadCacheLocalID,
            changes: {
                messageLocalIDs: newMessageLocalIDs,
            },
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLocalID
     * @param {string} param1.threadCacheLocalID
     */
    _linkThreadCacheToThread(
        { commit, state },
        { threadLocalID, threadCacheLocalID }
    ) {
        if (!state.threads[threadLocalID]) {
            throw new Error('no thread exists for new thread cache');
        }
        const thread = state.threads[threadLocalID];
        if (thread.cacheLocalIDs.includes(threadCacheLocalID)) {
            return;
        }
        commit('updateThread', {
            threadLocalID,
            changes: {
                cacheLocalIDs: thread.cacheLocalIDs.concat([threadCacheLocalID]),
            },
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {owl.Component} param1.Component
     * @param {any} param1.info
     * @return {string} unique id of the newly open dialog
     */
    _openDialog({ state }, { Component, info }) {
        const id = _.uniqueId('o_mail_component_Dialog');
        state.dialogManager.dialogs.push({
            Component,
            id,
            info,
        });
        return id;
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     */
    _openDiscuss({ commit, state }) {
        if (state.discuss.open) {
            return;
        }
        state.discuss.open = true;
        commit('_computeChatWindows');
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLocalID
     */
    _setMessageStar({ commit, state }, { messageLocalID }) {
        const message = state.messages[messageLocalID];
        const currentPartnerID = state.currentPartnerID;
        if (message.starred_partner_ids.includes(currentPartnerID)) {
            return;
        }
        commit('_updateMessage', {
            messageLocalID,
            changes: {
                starred_partner_ids: message.starred_partner_ids.concat([currentPartnerID]),
            },
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLocalID
     * @param {string} param1.partnerLocalID
     */
    _unlinkMessageFromPartner(
        { commit, state },
        { messageLocalID, partnerLocalID }
    ) {
        const partner = state.partners[partnerLocalID];
        if (partner.messageLocalIDs.includes(messageLocalID)) {
            return;
        }
        commit('updatePartner', {
            partnerLocalID,
            changes: {
                messageLocalIDs: partner.messageLocalIDs.filter(localID =>
                    localID !== messageLocalID),
            },
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLocalID
     * @param {string} param1.threadCacheLocalID
     */
    _unlinkMessageFromThreadCache(
        { commit, state },
        { messageLocalID, threadCacheLocalID }
    ) {
        const cache = state.threadCaches[threadCacheLocalID];
        if (!cache.messageLocalIDs.includes(messageLocalID)) {
            return;
        }
        commit('updateThreadCache', {
            threadCacheLocalID,
            changes: {
                messageLocalIDs: cache.messageLocalIDs.filter(localID =>
                    localID !== messageLocalID),
            },
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLocalID
     */
    _unsetMessageStar({ commit, state }, { messageLocalID }) {
        const message = state.messages[messageLocalID];
        if (!message.starred_partner_ids.includes(state.currentPartnerID)) {
            return;
        }
        commit('_updateMessage', {
            messageLocalID,
            changes: {
                starred_partner_ids: message.starred_partner_ids.filter(id =>
                    id !== state.currentPartnerID),
            },
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLocalID
     * @param {Object} param1.changes
     * @param {Array} [param1.changes.author_id]
     */
    _updateMessage(
        { commit, state },
        {
            messageLocalID,
            changes, changes: {
                author_id: [authorID, authorLongName]=[],
            },
        }
    ) {
        const message = state.messages[messageLocalID];
        const prevAuthorLocalID = message.authorLocalID;
        const prevThreadLocalIDs = [ ...message.threadLocalIDs ];

        // 1. alter message
        Object.assign(message, changes);
        commit('_computeMessage', message);
        if (authorID) {
            commit('insertPartner', {
                longName: authorLongName,
                id: authorID,
            });
        }
        // 2. author: create/update + link
        if (prevAuthorLocalID && prevAuthorLocalID !== message.authorLocalID) {
            commit('_unlinkMessageFromPartner', {
                messageLocalID,
                partnerLocalID: prevAuthorLocalID,
            });
        }
        if (
            message.authorLocalID &&
            prevAuthorLocalID !== message.authorLocalID
        ) {
            commit('_linkMessageToPartner', {
                messageLocalID,
                partnerLocalID: message.authorLocalID,
            });
        }

        // 3. threads: create/update + link
        const oldThreadLocalIDs = prevThreadLocalIDs.filter(localID =>
            !message.threadLocalIDs.includes(localID));
        for (let threadLocalID of oldThreadLocalIDs) {
            let thread = state.threads[threadLocalID];
            for (let threadCacheLocalID of thread.cacheLocalIDs) {
                commit('_unlinkMessageFromThreadCache', {
                    messageLocalID,
                    threadCacheLocalID,
                });
            }
        }
        const newThreadLocalIDs = message.threadLocalIDs.filter(localID =>
            !prevThreadLocalIDs.includes(localID));
        for (const threadLocalID of newThreadLocalIDs) {
            const thread = state.threads[threadLocalID];
            for (const threadCacheLocalID of thread.cacheLocalIDs) {
                commit('_linkMessageToThreadCache', {
                    messageLocalID,
                    threadCacheLocalID,
                });
            }
        }
    },
};

return mutations;

});
