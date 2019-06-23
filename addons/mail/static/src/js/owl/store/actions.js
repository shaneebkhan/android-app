odoo.define('mail.store.actions', function (require) {
"use strict";

const emojis = require('mail.emojis');
const mailUtils = require('mail.utils');

const config = require('web.config');
const core = require('web.core');
const session = require('web.session');
const utils = require('web.utils');

const _t = core._t;

/**
 * @param {Object[]} notifications
 * @return {Object[]}
 */
function filterNotificationsOnUnsubscribe(notifications) {
    const unsubscribedNotif = notifications.find(notif =>
        notif[1].info === 'unsubscribe');
    if (unsubscribedNotif) {
        notifications = notifications.filter(notif =>
            notif[0][1] !== 'mail.channel' ||
            notif[0][2] !== unsubscribedNotif[1].id);
    }
    return notifications;
}

/**
 * @param {string} htmlString
 * @return {string}
 */
function generateEmojisOnHtml(htmlString) {
    for (const emoji of emojis) {
        for (const source of emoji.sources) {
            const escapedSource = String(source).replace(
                /([.*+?=^!:${}()|[\]/\\])/g,
                '\\$1');
            const regexp = new RegExp(
                '(\\s|^)(' + escapedSource + ')(?=\\s|$)',
                'g');
            htmlString = htmlString.replace(regexp, '$1' + emoji.unicode);
        }
    }
    return htmlString;
}

/**
 * @param {Object} param0
 * @param {Object} param0.state
 * @param {Object} param1
 * @param {string} param1.threadLocalID
 * @return {Object}
 */
function getThreadFetchMessagesKwargs({ state }, { threadLocalID }) {
    const thread = state.threads[threadLocalID];
    let kwargs = {
        limit: state.MESSAGE_FETCH_LIMIT,
        context: session.user_context
    };
    if (thread.moderation) {
        // thread is a channel
        kwargs.moderated_channel_ids = [thread.id];
    }
    return kwargs;
}

const actions = {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.partnerLocalID
     */
    async checkPartnerIsUser(
        { commit, env, state },
        { partnerLocalID }
    ) {
        const partner = state.partners[partnerLocalID];
        const userIDs = await env.rpc({
            model: 'res.users',
            method: 'search',
            args: [[['partner_id', '=', partner.id]]],
        });
        commit('updatePartner', {
            partnerLocalID,
            changes: {
                userID: userIDs.length ? userIDs[0] : null,
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param1
     * @param {boolean} [param1.autoselect=false]
     * @param {string} [param1.chatWindowOpenMode]
     * @param {string} param1.name
     * @param {integer|undefined} [param1.partnerID=undefined]
     * @param {string|undefined} [param1.public=undefined]
     * @param {string} param1.type
     */
    async createChannel(
        { commit, env, state },
        {
            autoselect=false,
            chatWindowOpenMode,
            name,
            partnerID,
            public: publicStatus,
            type,
        }
    ) {
        const data = await env.rpc({
            model: 'mail.channel',
            method: type === 'chat' ? 'channel_get' : 'channel_create',
            args: type === 'chat' ? [[partnerID]] : [name, publicStatus],
            kwargs: {
                context: {
                    ...session.user_content,
                    isMobile: config.device.isMobile
                }
            }
        });
        const threadLocalID = commit('createThread', { ...data });
        if (autoselect) {
            if (state.discuss.open) {
                commit('updateDiscuss', { threadLocalID });
            } else {
                commit('openChatWindow', {
                    item: threadLocalID,
                    mode: chatWindowOpenMode,
                });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLocalID
     */
    async getSuggestedRecipientsOnThread(
        { commit, env, state },
        { threadLocalID }
    ) {
        const thread = state.threads[threadLocalID];
        const result = await env.rpc({
            route: '/mail/get_suggested_recipients',
            params: {
                model: thread._model,
                res_ids: [thread.id],
            },
        });
        const suggestedRecipients = result[thread.id].map(recipient => {
            const parsedEmail = recipient[1] && mailUtils.parseEmail(recipient[1]);
            return {
                checked: true,
                email_address: parsedEmail[1],
                full_name: recipient[1],
                name: parsedEmail[0],
                partner_id: recipient[0],
                reason: recipient[2],
            };
        });
        commit('updateThread', {
            threadLocalID,
            changes: { suggestedRecipients },
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param1
     * @param {function} param1.ready
     */
    async initMessaging(
        { commit, dispatch, env },
        { ready }
    ) {
        await session.is_bound;
        const context = {
            isMobile: config.device.isMobile,
            ...session.user_context
        };
        const data = await env.rpc({
            route: '/mail/init_messaging',
            params: { context: context }
        });
        commit('initMessaging', data);
        env.call('bus_service', 'onNotification', null, notifs => dispatch('_handleNotifications', notifs));
        ready();
        env.call('bus_service', 'startPolling');
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {boolean} [param1.autoselect=false]
     * @param {integer} param1.channelID
     * @param {string} [param1.chatWindowOpenMode]
     */
    async joinChannel(
        { commit, env, state },
        { autoselect=false, channelID, chatWindowOpenMode }
    ) {
        const channel = state.threads[`mail.channel_${channelID}`];
        if (channel) {
            return;
        }
        const data = await env.rpc({
            model: 'mail.channel',
            method: 'channel_join_and_get_info',
            args: [[channelID]]
        });
        const threadLocalID = commit('createThread', { ...data });
        if (autoselect) {
            if (state.discuss.open) {
                commit('updateDiscuss', {
                    domain: [],
                    threadLocalID,
                });
            } else {
                commit('openChatWindow', {
                    item: threadLocalID,
                    mode: chatWindowOpenMode,
                });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Array} [param1.searchDomain=[]]
     * @param {string} param1.threadLocalID
     */
    async loadMessagesOnThread(
        { commit, dispatch, env, state },
        { searchDomain=[], threadLocalID }
    ) {
        const thread = state.threads[threadLocalID];
        if (!['mail.box', 'mail.channel'].includes(thread._model)) {
            return dispatch('_loadMessagesOnDocumentThread', { threadLocalID });
        }
        const stringifiedDomain = JSON.stringify(searchDomain);
        const threadCacheLocalID = `${threadLocalID}_${stringifiedDomain}`;
        if (!state.threadCaches[threadCacheLocalID]) {
            commit('createThreadCache', {
                stringifiedDomain,
                threadLocalID,
            });
        }
        const threadCache = state.threadCaches[threadCacheLocalID];
        if (threadCache.loaded && threadCache.loading) {
            return;
        }
        let domain = searchDomain.length ? searchDomain : [];
        if (thread._model === 'mail.channel') {
            domain = domain.concat([['channel_ids', 'in', [thread.id]]]);
        } else if (threadLocalID === 'mail.box_inbox') {
            domain = domain.concat([['needaction', '=', true]]);
        } else if (threadLocalID === 'mail.box_starred') {
            domain = domain.concat([['starred', '=', true]]);
        } else if (threadLocalID === 'mail.box_moderation') {
            domain = domain.concat([['need_moderation', '=', true]]);
        }
        commit('updateThreadCache', {
            threadCacheLocalID,
            changes: { loading: true },
        });
        const messagesData = await env.rpc({
            model: 'mail.message',
            method: 'message_fetch',
            args: [domain],
            kwargs: getThreadFetchMessagesKwargs(
                { state },
                { threadLocalID })
        }, { shadow: true });
        commit('handleThreadLoaded', {
            messagesData,
            searchDomain,
            threadLocalID,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Array} [param1.searchDomain=[]]
     * @param {string} param1.threadLocalID
     */
    async loadMoreMessagesOnThread(
        { commit, env, state },
        { searchDomain=[], threadLocalID }
    ) {
        const thread = state.threads[threadLocalID];
        const stringifiedDomain = JSON.stringify(searchDomain);
        const threadCacheLocalID = `${threadLocalID}_${stringifiedDomain}`;
        const threadCache = state.threadCaches[threadCacheLocalID];
        let domain = searchDomain.length ? searchDomain : [];
        if (thread._model === 'mail.channel') {
            domain = domain.concat([['channel_ids', 'in', [thread.id]]]);
        } else if (threadLocalID === 'mail.box_inbox') {
            domain = domain.concat([['needaction', '=', true]]);
        } else if (threadLocalID === 'mail.box_starred') {
            domain = domain.concat([['starred', '=', true]]);
        } else if (threadLocalID === 'mail.box_moderation') {
            domain = domain.concat([['need_moderation', '=', true]]);
        }
        if (threadCache.allHistoryLoaded && threadCache.loadingMore) {
            return;
        }
        commit('updateThreadCache', {
            changes: { loadingMore: true },
            threadCacheLocalID,
        });
        const minMessageID = Math.min(
            ...threadCache.messageLocalIDs.map(messageLocalID =>
                state.messages[messageLocalID].id)
        );
        domain = [['id', '<', minMessageID]].concat(domain);
        const messagesData = await env.rpc({
            model: 'mail.message',
            method: 'message_fetch',
            args: [domain],
            kwargs: getThreadFetchMessagesKwargs(
                { state },
                { threadLocalID }
            )
        }, { shadow: true });
        commit('handleThreadLoaded', {
            messagesData,
            searchDomain,
            threadLocalID,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string[]} param1.threadLocalIDs
     */
    async loadThreadPreviews(
        { commit, env, state },
        {  threadLocalIDs }
    ) {
        const threads = threadLocalIDs.map(localID => state.threads[localID]);
        const channelIDs = threads.reduce((list, thread) => {
            if (thread._model === 'mail.channel') {
                return list.concat(thread.id);
            }
            return list;
        }, []);
        const messagePreviews = await env.rpc({
            model: 'mail.channel',
            method: 'channel_fetch_preview',
            args: [channelIDs],
        }, { shadow: true });
        for (const preview of messagePreviews) {
            commit('insertMessage', preview.last_message);
        }
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Array[]} domains
     */
    async markAllMessagesAsRead({ env }, domain) {
        await env.rpc({
            model: 'mail.message',
            method: 'mark_all_as_read',
            kwargs: {
                channel_ids: [],
                domain
            }
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLocalID
     */
    async markThreadAsSeen(
        { commit, env, state },
        { threadLocalID }
    ) {
        const thread = state.threads[threadLocalID];
        if (thread.message_unread_counter === 0) {
            return;
        }
        if (thread._model === 'mail.channel') {
            const seen_message_id = await env.rpc({
                model: 'mail.channel',
                method: 'channel_seen',
                args: [[thread.id]]
            }, { shadow: true });
            commit('updateThread', {
                changes: { seen_message_id },
                threadLocalID,
            });
        }
        commit('updateThread', {
            changes: { message_unread_counter: 0 },
            threadLocalID,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLocalID
     */
    openThread({ commit, state }, { threadLocalID }) {
        if (state.discuss.open) {
            commit('updateDiscuss', { threadLocalID });
        } else {
            commit('openChatWindow', {
                item: threadLocalID,
                mode: 'last_visible',
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {functon} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.data
     * @param {string[]} param1.data.attachmentLocalIDs
     * @param {*[]} param1.data.canned_response_ids
     * @param {integer[]} param1.data.channel_ids
     * @param {*} param1.data.command
     * @param {string} param1.data.content
     * @param {string} param1.data.message_type
     * @param {integer[]} param1.data.partner_ids
     * @param {string} param1.data.subject
     * @param {string} [param1.data.subtype='mail.mt_comment']
     * @param {integer|undefined} [param1.data.subtype_id=undefined]
     * @param {...Object} param1.data.kwargs
     * @param {Object} [param1.options]
     * @param {integer|undefined} [param1.options.res_id=undefined]
     * @param {integer|undefined} [param1.options.res_model=undefined]
     * @param {string} param1.threadLocalID
     */
    async postMessageOnThread(
        { commit, dispatch, env, state },
        {
            data: {
                attachmentLocalIDs,
                canned_response_ids,
                channel_ids=[],
                command,
                content,
                context,
                message_type,
                partner_ids,
                subject,
                subtype='mail.mt_comment',
                subtype_id,
                ...kwargs
            },
            options: { res_id, res_model } = {},
            threadLocalID,
        }
    ) {
        const thread = state.threads[threadLocalID];
        if (thread._model === 'mail.box') {
            return dispatch('postMessageOnThread', {
                data: {
                    attachmentLocalIDs,
                    canned_response_ids,
                    channel_ids,
                    command,
                    content,
                    context,
                    message_type,
                    partner_ids,
                    subject,
                    subtype,
                    subtype_id,
                    ...kwargs
                },
                threadLocalID: `${res_model}_${res_id}`,
            });
        }
        // This message will be received from the mail composer as html content
        // subtype but the urls will not be linkified. If the mail composer
        // takes the responsibility to linkify the urls we end up with double
        // linkification a bit everywhere. Ideally we want to keep the content
        // as text internally and only make html enrichment at display time but
        // the current design makes this quite hard to do.
        let body = mailUtils.parseAndTransform(
            content.trim(),
            mailUtils.addLink
        );
        body = generateEmojisOnHtml(body);
        let postData = {
            attachment_ids: attachmentLocalIDs.map(localID => state.attachments[localID].id),
            body,
        };
        if (thread._model === 'mail.channel') {
            Object.assign(postData, {
                message_type: 'comment',
                subtype: 'mail.mt_comment'
            });
            await env.rpc({
                model: 'mail.channel',
                method: command ? 'execute_command' : 'message_post',
                args: [thread.id],
                kwargs: postData
            });
        } else {
            Object.assign(postData, {
                partner_ids,
                channel_ids: channel_ids.map(id => [4, id, false]),
                canned_response_ids
            });
            if (subject) {
                postData.subject = subject;
            }
            Object.assign(postData, {
                context,
                message_type,
                subtype,
                subtype_id
            });
            const id = await env.rpc({
                model: thread._model,
                method: 'message_post',
                args: [thread.id],
                kwargs: postData
            });
            const [msgData] = await env.rpc({
                model: 'mail.message',
                method: 'message_format',
                args: [[id]]
            });
            commit('createMessage', {
                ...msgData,
                model: thread._model,
                res_id: thread.id
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.name
     * @param {string} param1.threadLocalID
     */
    async renameThread(
        { commit, env, state },
        { name, threadLocalID }
    ) {
        const thread = state.threads[threadLocalID];
        if (thread.channel_type === 'chat') {
            await env.rpc({
                model: 'mail.channel',
                method: 'channel_set_custom_name',
                args: [thread.id],
                kwargs: { name }
            });
        }
        commit('updateThread', {
            changes: {
                custom_channel_name: name,
            },
            threadLocalID,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {function} param1.callback
     * @param {string} param1.keyword
     * @param {integer} [param1.limit=10]
     */
    async searchPartners(
        { commit, env, state },
        { callback, keyword, limit=10 }
    ) {
        // prefetched partners
        let partners = [];
        const searchRegexp = new RegExp(
            _.str.escapeRegExp(utils.unaccent(keyword)),
            'i'
        );
        for (const partner of Object.values(state.partners)) {
            if (partners.length < limit) {
                if (
                    partner.id !== session.partner_id &&
                    searchRegexp.test(partner.name)
                ) {
                    partners.push(partner);
                }
            }
        }
        if (!partners.length) {
            const partnersData = await env.rpc(
                {
                    model: 'res.partner',
                    method: 'im_search',
                    args: [keyword, limit]
                },
                { shadow: true }
            );
            for (const data of partnersData) {
                const partnerLocalID = commit('insertPartner', data);
                partners.push(state.partners[partnerLocalID]);
            }
        }
        callback(partners);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLocalID
     */
    async toggleStarMessage(
        { env, state },
        { messageLocalID }
    ) {
        return env.rpc({
            model: 'mail.message',
            method: 'toggle_message_starred',
            args: [[state.messages[messageLocalID].id]]
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.attachmentLocalID
     */
    async unlinkAttachment({ commit, env, state }, { attachmentLocalID }) {
        const attachment = state.attachments[attachmentLocalID];
        await env.rpc({
            model: 'ir.attachment',
            method: 'unlink',
            args: [attachment.id],
        }, { shadow: true });
        commit('deleteAttachment', { attachmentLocalID });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     */
    async unstarAllMessages({ env }) {
        return env.rpc({
            model: 'mail.message',
            method: 'unstar_all',
        });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLocalID
     */
    async unsubscribeFromChannel(
        { env, state },
        { threadLocalID }
    ) {
        const thread = state.threads[threadLocalID];
        if (thread.channel_type === 'channel') {
            return env.rpc({
                model: 'mail.channel',
                method: 'action_unfollow',
                args: [[thread.id]]
            });
        }
        return env.rpc({
            model: 'mail.channel',
            method: 'channel_pin',
            args: [thread.uuid, false]
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.dispatch
     * @param {Object} param1
     * @param {integer} param1.channelID
     * @param {string|undefined} [param1.info=undefined]
     * @param {...Object} param1.kwargs
     */
    async _handleNotificationChannel(
        { dispatch },
        { channelID, info, ...kwargs }
    ) {
        switch (info) {
            case 'channel_fetched':
                return; // disabled seen notification feature
            case 'channel_seen':
                return dispatch('_handleNotificationChannelSeen', { channelID, ...kwargs });
            case 'typing_status':
                return; // disabled typing status notification feature
            default:
                return dispatch('_handleNotificationChannelMessage', { channelID, info, ...kwargs });
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Array|undefined} [param1.author_id=undefined]
     * @param {integer|undefined} [param1.author_id[0]=undefined]
     * @param {integer} param1.channelID
     * @param {integer[]} param1.channel_ids
     * @param {...Object} param1.kwargs
     */
    async _handleNotificationChannelMessage(
        { commit, dispatch, state },
        {
            author_id, author_id: [authorID]=[],
            channelID,
            channel_ids,
            ...kwargs
        }
    ) {
        if (channel_ids.length === 1) {
            await dispatch('joinChannel', { channelID: channel_ids[0] });
        }
        commit('createMessage', { author_id, channel_ids, ...kwargs });
        if (authorID === session.partner_id) {
            return;
        }
        const threadLocalID = `mail.channel_${channelID}`;
        const thread = state.threads[threadLocalID];
        commit('updateThread', {
            changes: {
                message_unread_counter: thread.message_unread_counter + 1,
            },
            threadLocalID,
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {integer} param1.channelID
     * @param {integer} param1.last_message_id
     * @param {integer} param1.partner_id
     */
    async _handleNotificationChannelSeen(
        { commit },
        { channelID, last_message_id, partner_id }
    ) {
        if (session.partner_id !== partner_id) {
            return;
        }
        commit('updateThread', {
            changes: {
                seen_message_id: last_message_id,
                message_unread_counter: 0
            },
            threadLocalID: `mail.channel_${channelID}`,
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param1
     * @param {string|undefined} [param1.info=undefined]
     * @param {string|undefined} [param1.type=undefined]
     * @param {...Object} param1.kwargs
     */
    async _handleNotificationPartner(
        { commit, dispatch },
        { info, type, ...kwargs }
    ) {
        if (type === 'activity_updated') {
            return; // disabled
        } else if (type === 'author') {
            return; // disabled
        } else if (type === 'deletion') {
            return; // disabled
        } else if (type === 'mail_failure') {
            return dispatch('_handleNotificationPartnerMailFailure', { ...kwargs });
        } else if (type === 'mark_as_read') {
            return commit('handleNotificationPartnerMarkAsRead', { ...kwargs });
        } else if (type === 'moderator') {
            return; // disabled
        } else if (type === 'toggle_star') {
            return commit('handleNotificationPartnerToggleStar', { ...kwargs });
        } else if (info === 'transient_message') {
            return commit('handleNotificationPartnerTransientMessage', { info, type, ...kwargs });
        } else if (info === 'unsubscribe') {
            return dispatch('_handleNotificationPartnerUnsubscribe', { ...kwargs });
        } else if (type === 'user_connection') {
            return dispatch('_handleNotificationPartnerUserConnection', { ...kwargs });
        } else {
            return dispatch('_handleNotificationPartnerChannel', { ...kwargs });
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.channel_type
     * @param {integer} param1.id
     * @param {string|undefined} [param1.info=undefined]
     * @param {boolean} [param1.is_minimized=false]
     * @param {string} param1.name
     * @param {string} param1.state
     * @param {...Object} param1.kwargs
     */
    _handleNotificationPartnerChannel(
        { commit, env, state },
        {
            channel_type,
            id,
            info,
            is_minimized=false,
            name,
            state: channelState,
            ...kwargs
        }
    ) {
        if (channel_type !== 'channel' || channelState !== 'open') {
            return;
        }
        if (!is_minimized && info !== 'creation') {
            env.do_notify(
                _t("Invitation"),
                _t(`You have been invited to: ${name}`)
            );
        }
        if (!state.threads[`mail.channel_${id}`]) {
            commit('createThread', {
                channel_type,
                id,
                info,
                is_minimized,
                name,
                ...kwargs
            });
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {Array} param1.elements
     */
    _handleNotificationPartnerMailFailure(
        { commit },
        { elements }
    ) {
        for (const data of elements) {
            // todo
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.id
     */
    _handleNotificationPartnerUnsubscribe(
        { commit, env, state },
        { id }
    ) {
        const threadLocalID = `mail.channel_${id}`;
        const thread = state.threads[threadLocalID];
        if (!thread) {
            return;
        }
        let message;
        if (thread.directPartner) {
            const directPartner = this.state.partners[thread.directPartner];
            message = _t(`You unpinned your conversation with <b>${directPartner.name}</b>.`);
        } else {
            message = _t(`You unsubscribed from <b>${thread.name}</b>.`);
        }
        env.do_notify(_t("Unsubscribed"), message);
        commit('unpinThread', { threadLocalID });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param1
     * @param {integer} param1.partner_id
     * @param {string} param1.title
     * @param {string} param1.message
     */
    _handleNotificationPartnerUserConnection(
        { env },
        { partner_id, title, message }
    ) {
        env.call('bus_service', 'sendNotification', title, message);
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object[]} notifs
     */
    async _handleNotifications(
        { commit, dispatch },
        notifs
    ) {
        notifs = filterNotificationsOnUnsubscribe(notifs);
        const proms = notifs.map(notif => {
            const model = notif[0][1];
            switch (model) {
                case 'ir.needaction':
                    return commit('handleNotificationNeedaction', { ...notif[1] });
                case 'mail.channel':
                    return dispatch('_handleNotificationChannel', {
                        channelID: notif[0][2],
                        ...notif[1]
                    });
                case 'res.partner':
                    return dispatch('_handleNotificationPartner', { ...notif[1] });
                default:
                    console.warn(`[store ${this.name}] Unhandled notification "${model}"`);
                    return;
            }
        });
        return Promise.all(proms);
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLID
     */
    async _loadMessagesOnDocumentThread(
        { commit, dispatch, env, state },
        { threadLocalID }
    ) {
        const thread = state.threads[threadLocalID];
        const message_ids = thread._messageIds;

        // TODO: this is for document_thread inside chat window
        // else {
        //     const [{ message_ids }] = await env.rpc({
        //         model: thread._model,
        //         method: 'read',
        //         args: [[thread.id], ['message_ids']]
        //     });
        // }
        const threadCacheLocalID = `${threadLocalID}_[]`;
        if (!state.threadCaches[threadCacheLocalID]) {
            commit('createThreadCache', {
                stringifiedDomain: '[]',
                threadLocalID,
            });
        }
        const threadCache = state.threadCaches[threadCacheLocalID];
        const loadedMessageIDs = threadCache.messageLocalIDs
            .filter(localID => message_ids.includes(state.messages[localID].id))
            .map(localID => state.messages[localID].id);
        const shouldFetch = message_ids
            .slice(0, state.MESSAGE_FETCH_LIMIT)
            .filter(messageID => !loadedMessageIDs.includes(messageID))
            .length > 0;
        if (!shouldFetch) {
            return;
        }
        const idsToLoad = message_ids
            .filter(messageID => !loadedMessageIDs.includes(messageID))
            .slice(0, state.MESSAGE_FETCH_LIMIT);
        commit('updateThreadCache', {
            threadCacheLocalID,
            changes: { loading: true },
        });
        const messagesData = await env.rpc({
            model: 'mail.message',
            method: 'message_format',
            args: [idsToLoad],
            context: session.user_context
        });
        commit('handleThreadLoaded', {
            messagesData,
            threadLocalID,
        });
        // await dispatch('_markMessageAsRead', { messageLocalIDs });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string[]} param1.messageLocalIDs
     */
    async _markMessageAsRead(
        { env, state },
        { messageLocalIDs }
    ) {
        const ids = messageLocalIDs
            .filter(localID => {
                const message = state.messages[localID];
                // If too many messages, not all are fetched,
                // and some might not be found
                return !message || message.needaction_partner_ids.includes(session.partner_id);
            })
            .map(localID => state.messages[localID].id);
        if (!ids.length) {
            return;
        }
        await env.rpc({
            model: 'mail.message',
            method: 'set_message_done',
            args: [ids]
        });
    },
};

return actions;

});
