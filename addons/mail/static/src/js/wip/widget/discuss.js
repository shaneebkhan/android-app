odoo.define('mail.wip.widget.Discuss', function (require) {
'use strict';

const Composer = require('mail.wip.widget.Composer');
const MobileMailboxSelection = require('mail.wip.widget.DiscussMobileMailboxSelection');
const MobileNavbar = require('mail.wip.widget.DiscussMobileNavbar');
const Sidebar = require('mail.wip.widget.DiscussSidebar');
const Thread = require('mail.wip.widget.Thread');
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
    return {
        ...state.discuss,
        isMobile: state.isMobile,
        thread,
        threadCache,
        threadCacheLID,
    };
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
            Composer,
            MobileMailboxSelection,
            MobileNavbar,
            Sidebar,
            Thread,
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
        this.env.store.commit('discuss/update', {
            domain: [],
            open: true,
            threadLID: this.env.discuss.initThreadLID,
        });
        this._wasMobile = this.isMobile;
        this.trigger('ready');
    }

    patched() {
        if (this._wasMobile === this.isMobile) {
            return;
        }
        this._wasMobile = this.isMobile;
        if (this.isMobile) {
            // adapt active mobile navbar tab based on thread in desktop
            this.state.mobileNavbarTab = !this.props.thread ? this.state.mobileNavbarTab
                : this.props.thread._model === 'mail.box' ? 'mailbox'
                : this.props.thread.channel_type === 'channel' ? 'channel'
                : this.props.thread.channel_type === 'chat' ? 'chat'
                : this.state.mobileNavbarTab;
        }
        this.trigger('update_cp');
    }

    willUnmount() {
        this.env.store.commit('discuss/update', { open: false });
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {Object}
     */
    get composerOptions() {
        return {
            displayAvatar: !this.isMobile,
            displaySendButton: !this.isMobile,
        };
    }

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
     * @return {boolean}
     */
    get showComposer() {
        return this.props.thread._model !== 'mail.box';
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
            domain: this.props.domain,
            redirectAuthor: this.props.thread.channel_type !== 'chat',
            scrollTop,
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
     * @param {MouseEvent} ev
     * @param {Object} param1
     * @param {string} param1.threadLID
     */
    _onClickSelectThread(ev, { threadLID }) {
        if (this.refs.thread && this.refs.thread.hasMessages) {
            this.state.threadCachesInfo[this.props.threadCacheLID] = {
                scrollTop: this.refs.thread.getScrollTop(),
            };
        }
        this.env.store.commit('discuss/update', { threadLID });
        this.trigger('thread_selected');
    }

    /**
     * @private
     * @param {Object} param0
     * @param {integer} param0.id
     * @param {string} param0.model
     */
    _onRedirect({ id, model }) {
        if (model === 'mail.channel') {
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
     * @param {Object} param0
     * @param {string} param0.tab
     */
    _onSelectMobileNavbarTab({ tab }) {
        if (this.state.mobileNavbarTab === tab) {
            return;
        }
        this.env.store.commit('discuss/update', {
            threadLID: tab === 'mailbox' ? 'mail.box_inbox' : null,
        });
        this.state.mobileNavbarTab = tab;
        this.trigger('update_cp');
    }

    /**
     * @private
     */
    _onThreadRendered() {
        this.trigger('update_cp');
    }
}

return connect(mapStateToProps, { deep: false })(Discuss);

});
