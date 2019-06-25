odoo.define('mail.component.Discuss', function (require) {
'use strict';

const MobileMailboxSelection = require('mail.component.DiscussMobileMailboxSelection');
const MobileNavbar = require('mail.component.DiscussMobileNavbar');
const Sidebar = require('mail.component.DiscussSidebar');
const Thread = require('mail.component.Thread');
const ThreadPreviewList = require('mail.component.ThreadPreviewList');

const { Component, Observer, connect } = owl;

class Discuss extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.DEBUG = true;
        this.components = {
            MobileMailboxSelection,
            MobileNavbar,
            Sidebar,
            Thread,
            ThreadPreviewList,
        };
        this.state = {
            mobileNavbarTab: 'mailbox',
            threadCachesInfo: {},
        };
        this.template = 'mail.component.Discuss';
        /**
         * Last rendering "isMobile" status. Used to notify widget discuss
         * in case it changes, in order to update control panel.
         */
        this._wasMobile = undefined;

        if (this.DEBUG) {
            window.discuss = this;
        }
    }

    mounted() {
        if (this.props.threadLocalID !== this.env.discuss.initThreadLocalID) {
            this.trigger('push_state_action_manager', {
                threadLocalID: this.env.discuss.initThreadLocalID,
            });
        }
        this.env.store.commit('updateDiscuss', {
            domain: [],
            open: true,
            threadLocalID: this.env.discuss.initThreadLocalID,
        });
        this._wasMobile = this.props.isMobile;
    }

    patched() {
        if (this._wasMobile !== this.props.isMobile) {
            this._wasMobile = this.props.isMobile;
            if (this.props.isMobile) {
                // adapt active mobile navbar tab based on thread in desktop
                this.state.mobileNavbarTab = !this.props.thread ? this.state.mobileNavbarTab
                    : this.props.thread._model === 'mail.box' ? 'mailbox'
                    : this.props.thread.channel_type === 'channel' ? 'channel'
                    : this.props.thread.channel_type === 'chat' ? 'chat'
                    : this.state.mobileNavbarTab;
            }
        }
        this.trigger('update_control_panel');
    }

    willUnmount() {
        this.env.store.commit('closeDiscuss');
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {boolean}
     */
    get hasThreadMessages() {
        if (!this.props.threadCache) {
            return false;
        }
        return this.props.threadCache.messageLocalIDs.length > 0;
    }

    /**
     * @return {Object}
     */
    get threadOptions() {
        let scrollTop;
        const threadCacheInfo = this.state.threadCachesInfo[this.props.threadCacheLocalID];
        if (threadCacheInfo) {
            scrollTop = threadCacheInfo.scrollTop;
        } else {
            scrollTop = undefined;
        }
        return {
            composerAttachmentEditable: true,
            composerAttachmentLayout: 'card',
            composerAttachmentLayoutCardLabel: true,
            composerAvatar: !this.props.isMobile,
            composerSendButton: !this.props.isMobile,
            domain: this.props.domain,
            redirectAuthor: this.props.thread.channel_type !== 'chat',
            scrollTop,
            showComposer: this.props.thread._model !== 'mail.box',
            squashCloseMessages: this.props.thread._model !== 'mail.box',
        };
    }

    /**
     * @return {Object}
     */
    get threadPreviewListOptions() {
        return { filter: this.state.mobileNavbarTab };
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {Array} domain
     */
    updateDomain(domain) {
        this.env.store.commit('updateDiscuss', { domain });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev
     * @param {Object} ev.detail
     * @param {integer} ev.detail.id
     * @param {string} ev.detail.model
     */
    async _onRedirect(ev) {
        const { id, model } = ev.detail;
        if (model === 'mail.channel') {
            ev.stopPropagation();
            const threadLocalID = `${model}_${id}`;
            const channel = this.env.store.state.threads[threadLocalID];
            if (!channel) {
                this.env.store.dispatch('joinChannel', {
                    autoselect: true,
                    channelID: id,
                });
                return;
            }
            this.env.store.commit('updateDiscuss', { threadLocalID });
            return;
        }
        if (model === 'res.partner') {
            if (id === this.env.session.partner_id) {
                this.env.do_action({
                    type: 'ir.actions.act_window',
                    res_model: 'res.partner',
                    views: [[false, 'form']],
                    res_id: id,
                });
                return;
            }
            const partnerLocalID = `res.partner_${id}`;
            const partner = this.env.store.state.partners[partnerLocalID];
            if (partner.userID === undefined) {
                // rpc to check that
                await this.env.store.dispatch('checkPartnerIsUser', { partnerLocalID });
            }
            if (partner.userID === null) {
                // partner is not a user, open document instead
                this.env.do_action({
                    type: 'ir.actions.act_window',
                    res_model: 'res.partner',
                    views: [[false, 'form']],
                    res_id: partner.id,
                });
                return;
            }
            ev.stopPropagation();
            const chat = this.env.store.getters.threadChatFromPartner({
                partnerLocalID: `res.partner_${id}`,
            });
            if (!chat) {
                this.env.store.dispatch('createChannel', {
                    autoselect: true,
                    partnerID: id,
                    type: 'chat',
                });
                return;
            }
            this.env.store.commit('updateDiscuss', { threadLocalID: chat.localID });
        }
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.tab
     */
    _onSelectMobileNavbarTab(ev) {
        const { tab } = ev.detail;
        if (this.state.mobileNavbarTab === tab) {
            return;
        }
        this.env.store.commit('updateDiscuss', {
            threadLocalID: tab === 'mailbox' ? 'mail.box_inbox' : null,
        });
        this.state.mobileNavbarTab = tab;
        this.trigger('update_control_panel');
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.threadLocalID
     */
    _onSelectThread(ev) {
        if (this.refs.thread && this.refs.thread.hasMessages) {
            Observer.set(this.state.threadCachesInfo, this.props.threadCacheLocalID, {
                scrollTop: this.refs.thread.getScrollTop(),
            });
        }
        const { threadLocalID } = ev.detail;
        this.env.store.commit('updateDiscuss', { threadLocalID });
        this.trigger('push_state_action_manager', {
            threadLocalID,
        });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     */
    _onThreadRendered(ev) {
        this.trigger('update_control_panel');
    }
}

/**
 * Props validation
 */
Discuss.props = {
    domain: {
        type: Array,
        default: [],
    },
    isMobile: {
        type: Boolean,
    },
    thread: {
        type: Object, // {mail.store.model.Thread}
        optional: true,
    },
    threadCache: {
        type: Object, // {mail.store.model.ThreadCache}
        optional: true,
    },
    threadCacheLocalID: {
        type: String,
    },
    threadLocalID: {
        type: String,
    },
};

return connect(
    Discuss,
    /**
     * @param {Object} state
     * @return {Object}
     */
    state => {
        const {
            stringifiedDomain,
            threadLocalID,
        } = state.discuss;
        const thread = state.threads[threadLocalID];
        const threadCacheLocalID = `${threadLocalID}_${stringifiedDomain}`;
        const threadCache = state.threadCaches[threadCacheLocalID];
        return {
            ...state.discuss,
            isMobile: state.isMobile,
            thread,
            threadCache,
            threadCacheLocalID,
        };
    },
    { deep: false }
);

});
