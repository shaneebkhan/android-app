odoo.define('mail.wip.widget.Discuss', function (require) {
'use strict';

const Thread = require('mail.wip.model.Thread');
const ThreadCache = require('mail.wip.model.ThreadCache');
const MobileMailboxSelection = require('mail.wip.widget.DiscussMobileMailboxSelection');
const MobileNavbar = require('mail.wip.widget.DiscussMobileNavbar');
const Sidebar = require('mail.wip.widget.DiscussSidebar');
const ThreadWidget = require('mail.wip.widget.Thread');
const ThreadPreviewList = require('mail.wip.widget.ThreadPreviewList');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @return {Object}
 */
function mapStateToProps(state) {
    const {
        stringifiedDomain,
        threadLID,
    } = state.discuss;
    const thread = state.threads[threadLID];
    const threadCacheLID = `${threadLID}_${stringifiedDomain}`;
    const threadCache = state.threadCaches[threadCacheLID];
    let res = {
        ...state.discuss,
        isMobile: state.isMobile,
        threadCacheLID,
    };
    if (thread) {
        Object.assign(res, { thread });
    }
    if (threadCache) {
        Object.assign(res, { threadCache });
    }
    return res;
}

class Discuss extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.DEBUG = true;
        this.template = 'mail.wip.widget.Discuss';
        this.state = {
            mobileNavbarTab: 'mailbox',
            threadCachesInfo: {},
        };
        this.widgets = {
            MobileMailboxSelection,
            MobileNavbar,
            Sidebar,
            Thread: ThreadWidget,
            ThreadPreviewList,
        };
        /**
         * Last rendering "isMobile" status. Used to notify old_widget discuss
         * in case it changes, in order to update control panel.
         */
        this._wasMobile = undefined;

        if (this.DEBUG) {
            window.discuss = this;
        }
    }

    mounted() {
        if (this.props.threadLID !== this.env.discuss.initThreadLID) {
            this.trigger('push_state_action_manager', {
                threadLID: this.env.discuss.initThreadLID,
            });
        }
        this.env.store.commit('discuss/update', {
            domain: [],
            open: true,
            threadLID: this.env.discuss.initThreadLID,
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
        this.env.store.commit('discuss/close');
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
        return this.props.threadCache.messageLIDs.length > 0;
    }

    /**
     * @return {Object}
     */
    get threadOptions() {
        let scrollTop;
        const threadCacheInfo = this.state.threadCachesInfo[this.props.threadCacheLID];
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
        this.env.store.commit('discuss/update', { domain });
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
    _onRedirect(ev) {
        if (ev.odooPrevented) { return; }
        const { id, model } = ev.detail;
        if (model === 'mail.channel') {
            ev.preventOdoo();
            const threadLID = `${model}_${id}`;
            const channel = this.env.store.state.threads[threadLID];
            if (!channel) {
                this.env.store.dispatch('channel/join', {
                    autoselect: true,
                    channelID: id,
                });
            } else {
                this.env.store.commit('discuss/update', { threadLID });
            }
        } else if (model === 'res.partner') {
            ev.preventOdoo();
            const chat = this.env.store.getters['thread/chat_from_partner']({
                partnerLID: `res.partner_${id}`,
            });
            if (!chat) {
                this.env.store.dispatch('channel/create', {
                    autoselect: true,
                    partnerID: id,
                    type: 'chat',
                });
            } else {
                this.env.store.commit('discuss/update', { threadLID: chat.lid });
            }
        }
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.tab
     */
    _onSelectMobileNavbarTab(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        const { tab } = ev.detail;
        if (this.state.mobileNavbarTab === tab) {
            return;
        }
        this.env.store.commit('discuss/update', {
            threadLID: tab === 'mailbox' ? 'mail.box_inbox' : null,
        });
        this.state.mobileNavbarTab = tab;
        this.trigger('update_control_panel', { originalEvent: ev });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.threadLID
     */
    _onSelectThread(ev) {
        if (ev.odooPrevented) { return; }
        if (this.refs.thread && this.refs.thread.hasMessages) {
            this.state.threadCachesInfo[this.props.threadCacheLID] = {
                scrollTop: this.refs.thread.getScrollTop(),
            };
        }
        const { threadLID } = ev.detail;
        this.env.store.commit('discuss/update', { threadLID });
        this.trigger('push_state_action_manager', {
            threadLID,
            originalEvent: ev,
        });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     */
    _onThreadRendered(ev) {
        this.trigger('update_control_panel', { originalEvent: ev });
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
        type: Thread,
        optional: true,
    },
    threadCache: {
        type: ThreadCache,
        optional: true,
    },
    threadCacheLID: {
        type: String,
    },
    threadLID: {
        type: String,
    },
};

return connect(mapStateToProps, { deep: false })(Discuss);

});
