odoo.define('mail.wip.store.mutations', function (require) {
"use strict";

const MailFailure = require('mail.wip.model.MailFailure');
const Message = require('mail.wip.model.Message');
const Partner = require('mail.wip.model.Partner');
const Thread = require('mail.wip.model.Thread');
const ThreadCache = require('mail.wip.model.ThreadCache');

const config = require('web.config');
const core = require('web.core');
const session = require('web.session');

const _t = core._t;

const mutations = {
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     */
    'chat_window_manager/close_blank'({ state }) {
        const cwm = state.chatWindowManager;
        cwm.items = cwm.items.filter(item => item !== 'blank');
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.item either 'blank' or a thread LID
     * @param {boolean} [param1.replaceBlank=false]
     */
    'chat_window_manager/open_item'(
        { commit, state },
        { item, replaceBlank=false }
    ) {
        const cwm = state.chatWindowManager;
        if (item === 'blank') {
            cwm.items = cwm.items.filter(it => it !== item);
            cwm.items.unshift(item);
            return;
        }
        // item is a threadLID
        commit('thread/update', {
            threadLID: item,
            changes: {
                fold_state: 'open',
                is_minimized: true,
            },
        });
        if (replaceBlank) {
            commit('chat_window_manager/swap_items', {
                autocloseBlank: true,
                item1: item,
                item2: 'blank',
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.set
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {boolean} [param1.autocloseBlank=false]
     * @param {string} param1.item1
     * @param {string} param1.item2
     */
    'chat_window_manager/swap_items'(
        { set, state },
        { autocloseBlank=false, item1, item2 }
    ) {
        const cwm = state.chatWindowManager;
        const items = cwm.items;
        const index1 = items.findIndex(item => item === item1);
        const index2 = items.findIndex(item => item === item2);
        if (index1 === -1 || index2 === -1) {
            return;
        }
        set(items, index1, item2);
        set(items, index2, item1);
        if (autocloseBlank) {
            cwm.items = cwm.items.filter(item => item !== 'blank');
        }
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} changes
     * @param {Array} [changes.domain]
     * @param {boolean} [changes.open]
     * @param {string} [changes.threadLID]
     */
    'discuss/update'({ state }, changes) {
        if (changes.stringifiedDomain) {
            throw new Error('cannot set stringified domain on discuss state (read-only)');
        }
        let shouldRecomputeStringifiedDomain = false;
        if ('domain' in changes) {
            shouldRecomputeStringifiedDomain = true;
        } else if (
            'threadLID' in changes &&
            changes.threadLID !== state.discuss.threadLID
        ) {
            shouldRecomputeStringifiedDomain = true;
        }
        if ('open' in changes && !changes.open) {
            state.discuss.threadLID = undefined;
        }
        Object.assign(state.discuss, changes);
        if (shouldRecomputeStringifiedDomain) {
            state.discuss.stringifiedDomain = JSON.stringify(state.discuss.domain);
        }
        const thread = state.threads[state.discuss.threadLID];
        if (!thread) {
            return;
        }
        state.discuss.showComposer = thread._model !== 'mail.box';
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.channel_slots
     * @param {Array} [param1.commands=[]]
     * @param {boolean} [param1.is_moderator=false]
     * @param {Object[]} [param1.mail_failures=[]]
     * @param {Object[]} [param1.mention_partner_suggestions=[]]
     * @param {Object[]} [param1.moderation_channel_ids=[]]
     * @param {integer} [param1.moderation_counter=0]
     * @param {integer} [param1.needaction_inbox_counter=0]
     * @param {Object[]} [param1.shortcodes=[]]
     * @param {integer} [param1.starred_counter=0]
     */
    'init'(
        { commit, state },
        {
            channel_slots,
            commands=[],
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
        commit('init/commands', commands); // required for channels, hence before
        commit('init/channels', channel_slots);
        commit('init/mailboxes', {
            is_moderator,
            moderation_counter,
            needaction_inbox_counter,
            starred_counter
        });
        commit('init/mail_failures', mail_failures);
        commit('init/canned_responses', shortcodes);
        commit('init/mention_partner_suggestions', mention_partner_suggestions);
        state.discuss.menu_id = menu_id;
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object[]} shortcodes
     */
    'init/canned_responses'({ state }, shortcodes) {
        const cannedResponses = shortcodes
            .map(s => {
                let { id, source, substitution } = s;
                return { id, source, substitution };
            })
            .reduce((obj, cr) => {
                obj[cr.id] = cr;
                return obj;
            }, {});
        Object.assign(state, { cannedResponses });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {Object[]} [param1.channel_channel=[]]
     * @param {Object[]} [param1.channel_direct_message=[]]
     * @param {Object[]} [param1.channel_private_group=[]]
     */
    'init/channels'(
        { commit },
        {
            channel_channel=[],
            channel_direct_message=[],
            channel_private_group=[],
        }
    ) {
        for (let data of channel_channel) {
            commit('thread/insert', { _model: 'mail.channel', ...data });
        }
        for (let data of channel_direct_message) {
            commit('thread/insert', { _model: 'mail.channel', ...data });
        }
        for (let data of channel_private_group) {
            commit('thread/insert', { _model: 'mail.channel', ...data });
        }
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object[]} commandsData
     */
    'init/commands'({ state }, commandsData) {
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
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {boolean} param1.is_moderator
     * @param {integer} param1.moderation_counter
     * @param {integer} param1.needaction_inbox_counter
     * @param {integer} param1.starred_counter
     */
    'init/mailboxes'(
        { commit },
        {
            is_moderator,
            moderation_counter,
            needaction_inbox_counter,
            starred_counter
        }
    ) {
        commit('thread/create', {
            _model: 'mail.box',
            counter: needaction_inbox_counter,
            id: 'inbox',
            name: _t("Inbox"),
        });
        commit('thread/create', {
            _model: 'mail.box',
            counter: starred_counter,
            id: 'starred',
            name: _t("Starred"),
        });
        if (is_moderator) {
            commit('thread/create', {
                _model: 'mail.box',
                counter: moderation_counter,
                id: 'moderation',
                name: _t("Moderate Messages"),
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.set
     * @param {Object} param0.state
     * @param {Object[]} mailFailuresData
     */
    'init/mail_failures'({ set, state }, mailFailuresData) {
        for (let data of mailFailuresData) {
            let mailFailure = new MailFailure(data);
            set(state.mailFailures, mailFailure.lid, mailFailure);
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object[]} mentionPartnerSuggestionsData
     */
    'init/mention_partner_suggestions'(
        { commit },
        mentionPartnerSuggestionsData
    ) {
        for (let suggestions of mentionPartnerSuggestionsData) {
            for (let suggestion of suggestions) {
                const { email, id, name } = suggestion;
                commit('partner/insert', { email, id, name });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.set
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
    'message/create'(
        { commit, set, state },
        {
            author_id, author_id: [authorID, authorName]=[],
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
        const message = new Message({
            author_id,
            channel_ids,
            model,
            needaction_partner_ids,
            record_name,
            res_id,
            starred_partner_ids,
            ...kwargs
        });
        const messageLID = message.lid;
        if (state.messages[messageLID]) {
            console.warn(`message with local ID "${messageLID}" already exists in store`);
            return;
        }
        set(state.messages, messageLID, message);

        // 2. author: create/update + link
        if (authorID) {
            const partnerLID = commit('partner/insert', {
                id: authorID,
                name: authorName,
            });
            commit('partner/link_message', {
                messageLID,
                partnerLID,
            });
        }

        // 3. threads: create/update + link
        if (message.originLID) {
            commit('thread/insert', {
                _model: model,
                id: res_id,
                name: record_name,
            });
        }
        // 3a. link message <- threads
        for (let threadLID of message.threadLIDs) {
            let threadCacheLID = `${threadLID}_[]`;
            if (!state.threadCaches[threadCacheLID]) {
                commit('thread_cache/create', { threadLID });
            }
            commit('thread_cache/link_message', {
                messageLID,
                threadCacheLID,
            });
        }
        return message;
    },
    /**
     * Unused for the moment, but may be useful for moderation
     *
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLID
     */
    'message/delete'({ commit, state }, { messageLID }) {
        delete state.messages[messageLID];
        for (let cache of Object.values(state.threadCaches)) {
            if (cache.messageLIDs.includes(messageLID)) {
                commit('thread_cache/update', {
                    threadCacheLID: cache.lid,
                    changes: {
                        messageLIDs: cache.messageLIDs.filter(msgLID =>
                            msgLID !== messageLID),
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
     * @param {integer} param1.id
     * @param {...Object} param1.kwargs
     * @return {string} message local ID
     */
    'message/insert'({ commit, state }, { id, ...kwargs }) {
        const messageLID = `mail.message_${id}`;
        if (!state.messages[messageLID]) {
            commit('message/create', { id, ...kwargs });
        } else {
            commit('message/update', {
                messageLID,
                changes: kwargs,
            });
        }
        return messageLID;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLID
     */
    'message/set_star'({ commit, state }, { messageLID }) {
        const message = state.messages[messageLID];
        const currentPartnerID = session.partner_id;
        if (message.starred_partner_ids.includes(currentPartnerID)) {
            return;
        }
        commit('message/update', {
            messageLID,
            changes: {
                starred_partner_ids: message.starred_partner_ids.concat([currentPartnerID]),
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLID
     */
    'message/unset_star'({ commit, state }, { messageLID }) {
        const message = state.messages[messageLID];
        const currentPartnerID = session.partner_id;
        if (!message.starred_partner_ids.includes(currentPartnerID)) {
            return;
        }
        commit('message/update', {
            messageLID,
            changes: {
                starred_partner_ids: message.starred_partner_ids.filter(id => id !== currentPartnerID),
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLID
     * @param {Object} param1.changes
     * @param {Array} [param1.changes.author_id]
     */
    'message/update'(
        { commit, state },
        {
            messageLID,
            changes, changes: {
                author_id: [authorID, authorName]=[],
            },
        }
    ) {
        const message = state.messages[messageLID];
        let prevAuthorLID = message.authorLID;
        const prevThreadLIDs = [ ...message.threadLIDs ];

        // 1. alter message
        message.update(changes);
        if (authorID) {
            commit('partner/insert', {
                id: authorID,
                name: authorName,
            });
        }
        // 2. author: create/update + link
        if (prevAuthorLID && prevAuthorLID !== message.authorLID) {
            commit('partner/unlink_message', {
                messageLID,
                partnerLID: prevAuthorLID,
            });
        }
        if (
            message.authorLID &&
            prevAuthorLID !== message.authorLID
        ) {
            commit('partner/link_message', {
                messageLID,
                partnerLID: message.authorLID,
            });
        }

        // 3. threads: create/update + link
        const oldThreadLIDs = prevThreadLIDs.filter(threadLID =>
            !message.threadLIDs.includes(threadLID));
        for (let threadLID of oldThreadLIDs) {
            let thread = state.threads[threadLID];
            for (let threadCacheLID of thread.cacheLIDs) {
                commit('thread_cache/unlink_message', {
                    messageLID,
                    threadCacheLID,
                });
            }
        }
        const newThreadLIDs = message.threadLIDs.filter(threadLID =>
            !prevThreadLIDs.includes(threadLID));
        for (let threadLID of newThreadLIDs) {
            let thread = state.threads[threadLID];
            for (let threadCacheLID of thread.cacheLIDs) {
                commit('thread_cache/link_message', {
                    messageLID,
                    threadCacheLID,
                });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {...Object} param1.data
     */
    'notification/needaction'({ commit, state }, { ...data }) {
        const message = commit('message/insert', { ...data });
        state.threads['mail.box_inbox'].counter++;
        for (let threadLID of message.threadLIDs) {
            const currentPartnerID = session.partner_id;
            const thread = state.threads[threadLID];
            if (
                thread.channel_type === 'channel' &&
                message.needaction_partner_ids.includes(currentPartnerID)
            ) {
                commit('thread/update', {
                    threadLID,
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
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer[]} [param1.message_ids=[]]
     */
    'notification/partner/mark_as_read'(
        { commit, state },
        { message_ids=[] }
    ) {
        const inboxLID = 'mail.box_inbox';
        const inbox = state.threads[inboxLID];
        for (let cacheLID of inbox.cacheLIDs) {
            for (let messageID of message_ids) {
                let messageLID = `mail.message_${messageID}`;
                commit('thread_cache/unlink_message', {
                    messageLID,
                    threadCacheLID: cacheLID,
                });
            }
        }
        const channels = Object.values(state.threads).filter(thread =>
            thread._model === 'mail.channel');
        for (let channel of channels) {
            let channelLID = channel.lid;
            commit('thread/update', {
                threadLID: channelLID,
                changes: { message_needaction_counter: 0 },
            });
        }
        commit('thread/update', {
            threadLID: inboxLID,
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
    'notification/partner/toggle_star'(
        { commit, state },
        { message_ids=[], starred }
    ) {
        const starredBoxLID = 'mail.box_starred';
        const starredBox = state.threads[starredBoxLID];
        const starredBoxMainCacheLID = `${starredBoxLID}_[]`;
        if (!state.threadCaches[starredBoxMainCacheLID]) {
            commit('thread_cache/create', {
                threadLID: starredBoxLID,
            });
        }
        for (let messageID of message_ids) {
            let messageLID = `mail.message_${messageID}`;
            let message = state.messages[messageLID];
            if (!message) {
                continue;
            }
            if (starred) {
                commit('message/set_star', { messageLID });
                commit('thread/update', {
                    threadLID: starredBoxLID,
                    changes: {
                        counter: starredBox.counter + 1,
                    },
                });
            } else {
                commit('message/unset_star', { messageLID });
                commit('thread/update', {
                    threadLID: starredBoxLID,
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
    'notification/partner/transient_message'(
        { commit, state },
        { author_id, ...kwargs }
    ) {
        const { length: l, [l - 1]: lastMessage } = Object.values(state.messages);
        commit('message/create', {
            ...kwargs,
            author_id: author_id || state.partners.odoobot.lID,
            id: (lastMessage ? lastMessage.id : 0) + 0.01
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.set
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.id
     * @param {string} [param1.im_status]
     * @param {string} [param1.email]
     * @param {string} [param1.name]
     * @return {string} partner local ID
     */
    'partner/create'({ set, state }, data) {
        const partner = new Partner({ ...data });
        const partnerLID = partner.lid;
        if (state.partners[partnerLID]) {
            console.warn(`partner with local ID "${partnerLID}" already exists in store`);
            return;
        }
        set(state.partners, partnerLID, partner);
        // todo: links
        return partnerLID;
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
    'partner/insert'({ commit, state }, { id, ...kwargs }) {
        const partnerLID = `res.partner_${id}`;
        if (!state.partners[partnerLID]) {
            commit('partner/create', { id, ...kwargs });
        } else {
            commit('partner/update', {
                partnerLID,
                changes: kwargs,
            });
        }
        return partnerLID;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLID
     * @param {string} param1.partnerLID
     */
    'partner/link_message'(
        { commit, state },
        { messageLID, partnerLID }
    ) {
        const partner = state.partners[partnerLID];
        if (partner.messageLIDs.includes(messageLID)) {
            return;
        }
        commit('partner/update', {
            partnerLID,
            changes: {
                messageLIDs: partner.messageLIDs.concat([messageLID])
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLID
     * @param {string} param1.partnerLID
     */
    'partner/unlink_message'(
        { commit, state },
        { messageLID, partnerLID }
    ) {
        const partner = state.partners[partnerLID];
        if (partner.messageLIDs.includes(messageLID)) {
            return;
        }
        commit('partner/update', {
            partnerLID,
            changes: {
                messageLIDs: partner.messageLIDs.filter(lid =>
                    lid !== messageLID),
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.changes
     * @param {string} param1.partnerLID
     */
    'partner/update'({ state }, { changes, partnerLID }) {
        const partner = state.partners[partnerLID];
        partner.update(changes);
        // todo: changes of links, e.g. messageLIDs
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     */
    'resize'({ state }) {
        state.global.innerHeight = window.innerHeight;
        state.global.innerWidth = window.innerWidth;
        state.isMobile = config.device.isMobile;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {string} param1.threadLID
     */
    'thread/close_chat_window'({ commit }, { threadLID }) {
        commit('thread/update', {
            threadLID,
            changes: {
                fold_state: 'closed',
                is_minimized: false,
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.set
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object[]} [param1.direct_partner]
     * @param {Array} [param1.members=[]]
     * @param {boolean} [param1.isPinned=true]
     * @param {...Object} param1.kwargs
     * @return {string} thread local ID
     */
    'thread/create'(
        { commit, set, state },
        {
            direct_partner,
            is_minimized,
            members=[],
            pin=true,
            ...kwargs
        }
    ) {
        const thread = new Thread({
            direct_partner,
            is_minimized,
            members,
            isPinned: pin,
            ...kwargs
        });
        const threadLID = thread.lid;
        if (state.threads[threadLID]) {
            console.warn(`already exists thread with local ID ${threadLID} in store`);
            return;
        }
        /* Update thread data */
        set(state.threads, threadLID, thread);
        /* Update thread relationships */
        for (let member of members) {
            commit('partner/insert', member);
        }
        if (direct_partner && direct_partner[0]) {
            commit('partner/insert', direct_partner[0]);
        }
        /**
         * Update thread lists.
         * This is done after updating relationships due to list requiring some
         * order that depends on computed relations. For instance, the threads
         * may be ordered by their name, and the name of a chat thread is the
         * name of the direct partner.
         */
        state.threadLIDs.push(threadLID);
        if (pin) {
            commit('thread/updating:register_pinned', { threadLID });
        }
        if (is_minimized) {
            commit('thread/updating:register_minimized', { threadLID });
        }
        if (thread._model === 'mail.box') {
            commit('thread/updating:register_mailbox', { threadLID });
        }
        if (thread._model === 'mail.channel') {
            commit('thread/updating:register_mail_channel', { threadLID });
        }
        if (thread.channel_type === 'channel') {
            commit('thread/updating:register_channel', { threadLID });
        }
        if (thread.channel_type === 'chat') {
            commit('thread/updating:register_chat', { threadLID });
        }
        return threadLID;
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
    'thread/insert'({ commit, state }, { _model, id, ...kwargs }) {
        const threadLID = `${_model}_${id}`;
        if (!state.threads[threadLID]) {
            commit('thread/create', { _model, id, ...kwargs });
        } else {
            commit('thread/update', { threadLID, changes: kwargs });
        }
        return threadLID;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLID
     * @param {string} param1.threadCacheLID
     */
    'thread/link_thread_cache'(
        { commit, state },
        { threadLID, threadCacheLID }
    ) {
        if (!state.threads[threadLID]) {
            throw new Error('no thread exists for new thread cache');
            // // todo: this is bad to determine model and id from spliting threadLID...
            // const separatorIndex = threadLID.lastIndexOf('_');
            // commit('thread/create', {
            //     _model: threadLID.substring(0, separatorIndex),
            //     id: Number(threadLID.substring(separatorIndex+1)),
            // });
        }
        let thread = state.threads[threadLID];
        if (thread.cacheLIDs.includes(threadCacheLID)) {
            return;
        }
        commit('thread/update', {
            threadLID,
            changes: {
                cacheLIDs: thread.cacheLIDs.concat([threadCacheLID]),
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.messageData
     * @param {Array} [param1.searchDomain=[]]
     * @param {string} [param1.threadLID]
     */
    'thread/loaded'(
        { commit, state },
        { messagesData, searchDomain=[], threadLID }
    ) {
        const stringifiedDomain = JSON.stringify(searchDomain);
        commit('thread_cache/insert', {
            allHistoryLoaded: messagesData.length < state.MESSAGE_FETCH_LIMIT,
            loaded: true,
            loading: false,
            loadingMore: false,
            stringifiedDomain,
            threadLID,
        });
        for (let data of messagesData) {
            // message auto-linked to thread cache on insert
            commit('message/insert', data);
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLID
     */
    'thread/toggle_fold'({ commit, state }, { threadLID }) {
        const thread = state.threads[threadLID];
        commit('thread/update', {
            threadLID,
            changes: {
                fold_state: thread.fold_state === 'open' ? 'folded' : 'open',
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} [param1.threadLID]
     */
    'thread/unpin'({ commit }, { threadLID }) {
        commit('thread/update', {
            threadLID,
            changes: { pin: false },
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.changes
     * @param {boolean} [param1.changes.is_minimized]
     * @param {boolean} [param1.changes.pin]
     * @param {string} param1.threadLID
     */
    'thread/update'({ commit, state }, { changes, threadLID }) {
        const thread = state.threads[threadLID];
        const wasMinimized = thread.is_minimized;
        const wasPinned = thread.pinned;
        thread.update(changes);
        if (!wasMinimized && thread.is_minimized) {
            commit('thread/updating:register_minimized', { threadLID });
        } else if (wasMinimized && !thread.is_minimized) {
            commit('thread/updating:unregister_minimized', { threadLID });
        } else if (!wasPinned && thread.isPinned) {
            commit('thread/updating:register_pinned', { threadLID });
        } else if (wasPinned && !thread.isPinned) {
            commit('thread/updating:unregister_pinned', { threadLID });
        }
    },
    /**
     * Channels are alphabetically ordered by name
     *
     * @param {Object} param0
     * @param {Object} param0.getters
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLID
     */
    'thread/updating:register_channel'({ getters, state }, { threadLID }) {
        const index = state.threadChannelLIDs.findIndex(lid => {
            const otherName = getters['thread/name']({ threadLID: lid });
            const currentName = getters['thread/name']({ threadLID });
            return otherName > currentName;
        });
        if (index !== -1) {
            state.threadChannelLIDs.splice(index, 0, threadLID);
        } else {
            state.threadChannelLIDs.push(threadLID);
        }
    },
    /**
     * Chats are alphabetically ordered by name
     *
     * @param {Object} param0
     * @param {Object} param0.getters
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLID
     */
    'thread/updating:register_chat'({ getters, state }, { threadLID }) {
        const index = state.threadChatLIDs.findIndex(lid => {
            const otherName = getters['thread/name']({ threadLID: lid });
            const currentName = getters['thread/name']({ threadLID });
            return otherName > currentName;
        });
        if (index !== -1) {
            state.threadChatLIDs.splice(index, 0, threadLID);
        } else {
            state.threadChatLIDs.push(threadLID);
        }
    },
    /**
     * Mailboxes are ordered as follow: inbox, starred, then alphabetical order
     *
     * @param {Object} param0
     * @param {Object} param0.getters
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLID
     */
    'thread/updating:register_mailbox'({ getters, state }, { threadLID }) {
        state.threadMailboxLIDs.push(threadLID);
        state.threadMailboxLIDs.sort((lid1, lid2) => {
            if (lid1 === 'mail.box_inbox') {
                return -1;
            }
            if (lid2 === 'mail.box_inbox') {
                return 1;
            }
            if (lid1 === 'mail.box_starred') {
                return -1;
            }
            if (lid2 === 'mail.box_starred') {
                return 1;
            }
            const name1 = getters['thread/name']({ threadLID: lid1 });
            const name2 = getters['thread/name']({ threadLID: lid2 });
            return name1 < name2 ? -1 : 1;
        });
    },
    /**
     * Mail channels are alphabetically ordered by name
     *
     * @param {Object} param0
     * @param {Object} param0.getters
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLID
     */
    'thread/updating:register_mail_channel'({ getters, state }, { threadLID }) {
        const index = state.threadMailChannelLIDs.findIndex(lid => {
            const otherName = getters['thread/name']({ threadLID: lid });
            const currentName = getters['thread/name']({ threadLID });
            return otherName > currentName;
        });
        if (index !== -1) {
            state.threadMailChannelLIDs.splice(index, 0, threadLID);
        } else {
            state.threadMailChannelLIDs.push(threadLID);
        }
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.threadLID
     */
    'thread/updating:register_minimized'({ state }, { threadLID }) {
        const cwm = state.chatWindowManager;
        cwm.items.push(threadLID);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.threadLID
     */
    'thread/updating:register_pinned'({ state }, { threadLID }) {
        state.threadPinnedLIDs.push(threadLID);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.threadLID
     */
    'thread/updating:unregister_minimized'({ state }, { threadLID }) {
        const cwm = state.chatWindowManager;
        cwm.items = cwm.items.filter(item => item !== threadLID);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.threadLID
     */
    'thread/updating:unregister_pinned'({ state }, { threadLID }) {
        state.threadPinnedLIDs = state.threadPinnedLIDs.filter(lid => lid !== threadLID);
    },
    /**
     * @param {Object} param0
     * @param {function} param0.set
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} [param1.stringifiedDomain='[]']
     * @param {string} param1.threadLID
     * @return {string} thread cache local ID
     */
    'thread_cache/create'(
        { commit, set, state },
        { stringifiedDomain='[]', threadLID }
    ) {
        const threadCache = new ThreadCache({
            stringifiedDomain,
            threadLID,
        });
        const threadCacheLID = threadCache.lid;
        set(state.threadCaches, threadCacheLID, threadCache);
        commit('thread/link_thread_cache', {
            threadCacheLID,
            threadLID,
        });
        return threadCacheLID;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} [param1.stringifiedDomain='[]']
     * @param {string} param1.threadLID
     * @param {...Object} param1.kwargs
     * @return {string} thread cache local ID
     */
    'thread_cache/insert'(
        { commit, state },
        { stringifiedDomain='[]', threadLID, ...kwargs }
    ) {
        const threadCacheLID = `${threadLID}_${stringifiedDomain}`;
        if (!state.threadCaches[threadCacheLID]) {
            commit('thread_cache/create', {
                stringifiedDomain,
                threadLID,
                ...kwargs,
            });
        } else {
            commit('thread_cache/update', {
                threadCacheLID,
                changes: kwargs,
            });
        }
        return threadCacheLID;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLID
     * @param {string} param1.threadCacheLID
     */
    'thread_cache/link_message'(
        { commit, state },
        { messageLID, threadCacheLID }
    ) {
        const cache = state.threadCaches[threadCacheLID];
        const message = state.messages[messageLID];
        if (cache.messageLIDs.includes(messageLID)) {
            return;
        }
        // message are ordered by ID
        const index = cache.messageLIDs.findIndex(lid => {
            const otherMessage = state.messages[lid];
            return otherMessage.id > message.id;
        });
        let newMessageLIDs = [...cache.messageLIDs];
        if (index !== -1) {
            newMessageLIDs.splice(index, 0, messageLID);
        } else {
            newMessageLIDs.push(messageLID);
        }
        commit('thread_cache/update', {
            threadCacheLID,
            changes: {
                messageLIDs: newMessageLIDs,
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLID
     * @param {string} param1.threadCacheLID
     */
    'thread_cache/unlink_message'(
        { commit, state },
        { messageLID, threadCacheLID }
    ) {
        const cache = state.threadCaches[threadCacheLID];
        if (!cache.messageLIDs.includes(messageLID)) {
            return;
        }
        commit('thread_cache/update', {
            threadCacheLID,
            changes: {
                messageLIDs: cache.messageLIDs.filter(lid =>
                    lid !== messageLID),
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.changes
     * @param {string} param1.threadCacheLID
     */
    'thread_cache/update'({ state }, { threadCacheLID, changes }) {
        const cache = state.threadCaches[threadCacheLID];
        cache.update(changes);
    },
};

return mutations;

});
