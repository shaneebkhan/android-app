odoo.define('mail.wip.store.actions', function (require) {
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
    for (let emoji of emojis) {
        for (let source of emoji.sources) {
            let escapedSource = String(source).replace(
                /([.*+?=^!:${}()|[\]/\\])/g,
                '\\$1');
            let regexp = new RegExp(
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
 * @param {string} param1.threadLID
 * @return {Object}
 */
function getThreadFetchMessagesKwargs({ state }, { threadLID }) {
    const thread = state.threads[threadLID];
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
    async 'channel/create'(
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
        const threadLID = commit('thread/create', { ...data });
        if (autoselect) {
            if (state.discuss.open) {
                commit('discuss/update', { threadLID });
            } else {
                commit('chat_window_manager/open', {
                    item: threadLID,
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
     * @param {boolean} [param1.autoselect=false]
     * @param {integer} param1.channelID
     * @param {string} [param1.chatWindowOpenMode]
     */
    async 'channel/join'(
        { commit, env, state },
        { autoselect=false, channelID, chatWindowOpenMode }
    ) {
        let channel = state.threads[`mail.channel_${channelID}`];
        if (channel) {
            return;
        }
        const data = await env.rpc({
            model: 'mail.channel',
            method: 'channel_join_and_get_info',
            args: [[channelID]]
        });
        const threadLID = commit('thread/create', { ...data });
        if (autoselect) {
            if (state.discuss.open) {
                commit('discuss/update', {
                    domain: [],
                    threadLID,
                });
            } else {
                commit('chat_window_manager/open', {
                    item: threadLID,
                    mode: chatWindowOpenMode,
                });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLID
     */
    async 'channel/unsubscribe'(
        { env, state },
        { threadLID }
    ) {
        const thread = state.threads[threadLID];
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
    async 'document_thread/load'(
        { commit, dispatch, env, state },
        { threadLID }
    ) {
        const thread = state.threads[threadLID];
        const message_ids = thread._messageIds;

        // TODO: this is for document_thread inside chat window
        // else {
        //     const [{ message_ids }] = await env.rpc({
        //         model: thread._model,
        //         method: 'read',
        //         args: [[thread.id], ['message_ids']]
        //     });
        // }
        const threadCacheLID = `${threadLID}_[]`;
        if (!state.threadCaches[threadCacheLID]) {
            commit('thread_cache/create', {
                stringifiedDomain: '[]',
                threadLID,
            });
        }
        const threadCache = state.threadCaches[threadCacheLID];
        const loadedMessageIDs = threadCache.messageLIDs
            .filter(messageLID => message_ids.includes(state.messages[messageLID].id))
            .map(messageLID => state.messages[messageLID].id);
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
        commit('thread_cache/update', {
            threadCacheLID,
            changes: { loading: true },
        });
        const messagesData = await env.rpc({
            model: 'mail.message',
            method: 'message_format',
            args: [idsToLoad],
            context: session.user_context
        });
        commit('thread/loaded', {
            messagesData,
            threadLID,
        });
        // await dispatch('message/mark_as_read', { messageLIDs });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param1
     * @param {function} param1.ready
     */
    async init(
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
        commit('init', data);
        env.call('bus_service', 'onNotification', null, notifs => dispatch('notification', notifs));
        ready();
        env.call('bus_service', 'startPolling');
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string[]} param1.messageLIDs
     */
    async 'message/mark_as_read'(
        { env, state },
        { messageLIDs }
    ) {
        const ids = messageLIDs
            .filter(messageLID => {
                let message = state.messages[messageLID];
                // If too many messages, not all are fetched,
                // and some might not be found
                return !message || message.needaction_partner_ids.includes(session.partner_id);
            })
            .map(messageLID => state.messages[messageLID].id);
        if (!ids.length) {
            return;
        }
        await env.rpc({
            model: 'mail.message',
            method: 'set_message_done',
            args: [ids]
        });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLID
     */
    async 'message/toggle_star'(
        { env, state },
        { messageLID }
    ) {
        return env.rpc({
            model: 'mail.message',
            method: 'toggle_message_starred',
            args: [[state.messages[messageLID].id]]
        });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     */
    async 'message/unstar_all'({ env }) {
        return env.rpc({
            model: 'mail.message',
            method: 'unstar_all',
        });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Array[]} domains
     */
    async 'messages/mark_all_as_read'({ env }, domain) {
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
     * @param {function} param0.dispatch
     * @param {Object[]} notifs
     */
    async notification(
        { commit, dispatch },
        notifs
    ) {
        notifs = filterNotificationsOnUnsubscribe(notifs);
        const proms = notifs.map(notif => {
            let model = notif[0][1];
            switch (model) {
                case 'ir.needaction':
                    return commit('notification/needaction', { ...notif[1] });
                case 'mail.channel':
                    return dispatch('notification/channel', {
                        channelID: notif[0][2],
                        ...notif[1]
                    });
                case 'res.partner':
                    return dispatch('notification/partner', { ...notif[1] });
                default:
                    console.warn(`[store ${this.name}] Unhandled notification "${model}"`);
                    return;
            }
        });
        return Promise.all(proms);
    },
    /**
     * @param {Object} param0
     * @param {function} param0.dispatch
     * @param {Object} param1
     * @param {integer} param1.channelID
     * @param {string|undefined} [param1.info=undefined]
     * @param {...Object} param1.kwargs
     */
    async 'notification/channel'(
        { dispatch },
        { channelID, info, ...kwargs }
    ) {
        switch (info) {
            case 'channel_fetched':
                return; // disabled seen notification feature
            case 'channel_seen':
                return dispatch('notification/channel/seen', { channelID, ...kwargs });
            case 'typing_status':
                return; // disabled typing status notification feature
            default:
                return dispatch('notification/channel/message', { channelID, info, ...kwargs });
        }
    },
    /**
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
    async 'notification/channel/message'(
        { commit, dispatch, state },
        {
            author_id, author_id: [authorID]=[],
            channelID,
            channel_ids,
            ...kwargs
        }
    ) {
        if (channel_ids.length === 1) {
            await dispatch('channel/join', { channelID: channel_ids[0] });
        }
        commit('message/create', { author_id, channel_ids, ...kwargs });
        if (authorID === session.partner_id) {
            return;
        }
        const threadLID = `mail.channel_${channelID}`;
        const thread = state.threads[threadLID];
        commit('thread/update', {
            changes: {
                message_unread_counter: thread.message_unread_counter + 1,
            },
            threadLID,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {integer} param1.channelID
     * @param {integer} param1.last_message_id
     * @param {integer} param1.partner_id
     */
    async 'notification/channel/seen'(
        { commit },
        { channelID, last_message_id, partner_id }
    ) {
        if (session.partner_id !== partner_id) {
            return;
        }
        commit('thread/update', {
            changes: {
                seen_message_id: last_message_id,
                message_unread_counter: 0
            },
            threadLID: `mail.channel_${channelID}`,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param1
     * @param {string|undefined} [param1.info=undefined]
     * @param {string|undefined} [param1.type=undefined]
     * @param {...Object} param1.kwargs
     */
    async 'notification/partner'(
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
            return dispatch('notification/partner/mail_failure', { ...kwargs });
        } else if (type === 'mark_as_read') {
            return commit('notification/partner/mark_as_read', { ...kwargs });
        } else if (type === 'moderator') {
            return; // disabled
        } else if (type === 'toggle_star') {
            return commit('notification/partner/toggle_star', { ...kwargs });
        } else if (info === 'transient_message') {
            return commit('notification/partner/transient_message', { info, type, ...kwargs });
        } else if (info === 'unsubscribe') {
            return dispatch('notification/partner/unsubscribe', { ...kwargs });
        } else if (type === 'user_connection') {
            return dispatch('notification/partner/user_connection', { ...kwargs });
        } else {
            return dispatch('notification/partner/channel', { ...kwargs });
        }
    },
    /**
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
    'notification/partner/channel'(
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
            commit('thread/create', {
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
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {Array} param1.elements
     */
    'notification/partner/mail_failure'(
        { commit },
        { elements }
    ) {
        for (let data of elements) {
            // todo
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.id
     */
    'notification/partner/unsubscribe'(
        { commit, env, state },
        { id }
    ) {
        const threadLID = `mail.channel_${id}`;
        const thread = state.threads[threadLID];
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
        commit('thread/unpin', { threadLID });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param1
     * @param {integer} param1.partner_id
     * @param {string} param1.title
     * @param {string} param1.message
     */
    'notification/partner/user_connection'(
        { env },
        { partner_id, title, message }
    ) {
        env.call('bus_service', 'sendNotification', title, message);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {function} param1.callback
     * @param {integer} [param1.limit=10]
     * @param {string} param1.value
     */
    async 'partner/search'(
        { env, state },
        { callback, limit=10, value }
    ) {
        // prefetched partners
        let partners = [];
        const searchRegexp = new RegExp(
            _.str.escapeRegExp(utils.unaccent(value)),
            'i'
        );
        for (let partner of Object.values(state.partners)) {
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
            partners = await env.rpc(
                {
                    model: 'res.partner',
                    method: 'im_search',
                    args: [value, limit]
                },
                { shadow: true }
            );
        }
        const suggestions = partners.map(partner => {
            return {
                id: partner.id,
                value: partner.name,
                label: partner.name
            };
        });
        await callback(_.sortBy(suggestions, 'label'));
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Array} [param1.searchDomain=[]]
     * @param {string} param1.threadLID
     */
    async 'thread/load'(
        { commit, dispatch, env, state },
        { searchDomain=[], threadLID }
    ) {
        const thread = state.threads[threadLID];
        if (!['mail.box', 'mail.channel'].includes(thread._model)) {
            return dispatch('document_thread/load', { threadLID });
        }
        const stringifiedDomain = JSON.stringify(searchDomain);
        const threadCacheLID = `${threadLID}_${stringifiedDomain}`;
        if (!state.threadCaches[threadCacheLID]) {
            commit('thread_cache/create', {
                stringifiedDomain,
                threadLID,
            });
        }
        let threadCache = state.threadCaches[threadCacheLID];
        if (threadCache.loaded && threadCache.loading) {
            return;
        }
        let domain = searchDomain.length ? searchDomain : [];
        if (thread._model === 'mail.channel') {
            domain = domain.concat([['channel_ids', 'in', [thread.id]]]);
        } else if (threadLID === 'mail.box_inbox') {
            domain = domain.concat([['needaction', '=', true]]);
        } else if (threadLID === 'mail.box_starred') {
            domain = domain.concat([['starred', '=', true]]);
        } else if (threadLID === 'mail.box_moderation') {
            domain = domain.concat([['need_moderation', '=', true]]);
        }
        commit('thread_cache/update', {
            threadCacheLID,
            changes: { loading: true },
        });
        const messagesData = await env.rpc({
            model: 'mail.message',
            method: 'message_fetch',
            args: [domain],
            kwargs: getThreadFetchMessagesKwargs(
                { state },
                { threadLID })
        }, { shadow: true });
        commit('thread/loaded', {
            messagesData,
            searchDomain,
            threadLID,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Array} [param1.searchDomain=[]]
     * @param {string} param1.threadLID
     */
    async 'thread/load_more'(
        { commit, env, state },
        { searchDomain=[], threadLID }
    ) {
        const thread = state.threads[threadLID];
        const stringifiedDomain = JSON.stringify(searchDomain);
        const threadCacheLID = `${threadLID}_${stringifiedDomain}`;
        const threadCache = state.threadCaches[threadCacheLID];
        let domain = searchDomain.length ? searchDomain : [];
        if (thread._model === 'mail.channel') {
            domain = domain.concat([['channel_ids', 'in', [thread.id]]]);
        } else if (threadLID === 'mail.box_inbox') {
            domain = domain.concat([['needaction', '=', true]]);
        } else if (threadLID === 'mail.box_starred') {
            domain = domain.concat([['starred', '=', true]]);
        } else if (threadLID === 'mail.box_moderation') {
            domain = domain.concat([['need_moderation', '=', true]]);
        }
        if (threadCache.allHistoryLoaded && threadCache.loadingMore) {
            return;
        }
        commit('thread_cache/update', {
            changes: { loadingMore: true },
            threadCacheLID,
        });
        const minMessageID = Math.min(
            ...threadCache.messageLIDs.map(messageLID =>
                state.messages[messageLID].id)
        );
        domain = [['id', '<', minMessageID]].concat(domain);
        const messagesData = await env.rpc({
            model: 'mail.message',
            method: 'message_fetch',
            args: [domain],
            kwargs: getThreadFetchMessagesKwargs(
                { state },
                { threadLID }
            )
        }, { shadow: true });
        commit('thread/loaded', {
            messagesData,
            searchDomain,
            threadLID,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLID
     */
    async 'thread/mark_as_seen'(
        { commit, env, state },
        { threadLID }
    ) {
        const thread = state.threads[threadLID];
        if (thread.message_unread_counter === 0) {
            return;
        }
        if (thread._model === 'mail.channel') {
            const seen_message_id = await env.rpc({
                model: 'mail.channel',
                method: 'channel_seen',
                args: [[thread.id]]
            }, { shadow: true });
            commit('thread/update', {
                changes: { seen_message_id },
                threadLID,
            });
        }
        commit('thread/update', {
            changes: { message_unread_counter: 0 },
            threadLID,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadLID
     */
    'thread/open'({ commit, state }, { threadLID }) {
        if (state.discuss.open) {
            commit('discuss/update', { threadLID });
        } else {
            commit('chat_window_manager/open', {
                item: threadLID,
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
     * @param {*[]} param1.data.attachment_ids
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
     * @param {string} param1.threadLID
     */
    async 'thread/post_message'(
        { commit, dispatch, env, state },
        {
            data: {
                attachment_ids,
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
            threadLID,
        }
    ) {
        const thread = state.threads[threadLID];
        if (thread._model === 'mail.box') {
            return dispatch('thread/post_message', {
                data: {
                    attachment_ids,
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
                threadLID: `${res_model}_${res_id}`,
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
        let postData;
        if (thread._model === 'mail.channel') {
            postData = {
                body,
                message_type: 'comment',
                subtype: 'mail.mt_comment'
            };
            await env.rpc({
                model: 'mail.channel',
                method: command ? 'execute_command' : 'message_post',
                args: [thread.id],
                kwargs: postData
            });
        } else {
            postData = {
                partner_ids,
                channel_ids: channel_ids.map(id => [4, id, false]),
                body,
                attachment_ids,
                canned_response_ids
            };
            if (subject) {
                postData.subject = subject;
            }
            postData = {
                ...postData,
                context,
                message_type,
                subtype,
                subtype_id
            };
            const id = await env.rpc({
                model: thread._model,
                method: 'message_post',
                args: [thread.id],
                kwargs: postData
            });
            let [msgData] = await env.rpc({
                model: 'mail.message',
                method: 'message_format',
                args: [[id]]
            });
            commit('message/create', {
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
     * @param {string} param1.threadLID
     */
    async 'thread/rename'(
        { commit, env, state },
        { name, threadLID }
    ) {
        const thread = state.threads[threadLID];
        if (thread.channel_type === 'chat') {
            await env.rpc({
                model: 'mail.channel',
                method: 'channel_set_custom_name',
                args: [thread.id],
                kwargs: { name }
            });
        }
        commit('thread/update', {
            changes: {
                custom_channel_name: name,
            },
            threadLID,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string[]} param1.threadLIDs
     */
    async 'threads/load_previews'(
        { commit, env, state },
        {  threadLIDs }
    ) {
        const threads = threadLIDs.map(threadLID => state.threads[threadLID]);
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
            commit('message/insert', preview.last_message);
        }
    },
};

return actions;

});
