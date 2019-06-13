odoo.define('mail.wip.widget.MessageList', function (require) {
'use strict';

const Message = require('mail.wip.model.Message');
const Thread = require('mail.wip.model.Thread');
const ThreadCache = require('mail.wip.model.ThreadCache');
const MessageWidget = require('mail.wip.widget.Message');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {string} ownProps.threadCacheLID
 * @param {string} ownProps.threadLID
 * @return {Object}
 */
function mapStateToProps(state, ownProps) {
    const threadCache = state.threadCaches[ownProps.threadCacheLID];
    return {
        messageLIDs: threadCache.messageLIDs,
        messages: threadCache.messageLIDs.map(lid => state.messages[lid]),
        thread: state.threads[ownProps.threadLID],
        threadCache,
    };
}

class MessageList extends Component {
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.MessageList';
        this.widgets = {
            Message: MessageWidget,
        };
        this._autoLoadOnScroll = true;
        this._onScroll = _.throttle(this._onScroll.bind(this), 100);
        this._renderedThreadCacheLID = null;
    }

    mounted() {
        if (this.options.scrollTop) {
            this.el.scrollTop = this.options.scrollTop;
        } else {
            this.scrollToLastMessage();
        }
        this._renderedThreadCacheLID = this.props.threadCacheLID;
    }

    /**
     * @return {Object} snapshot object
     */
    willPatch() {
        const lastMessageRef = this.lastMessageRef;
        const {
            length: l,
            [l-1]: lastMessageLID,
        } = this.props.messageLIDs;

        const hasNewMessages = !this._renderedThreadCacheLID === this.props.threadCacheLID &&
            lastMessageRef.props.messageLID !== lastMessageLID;
        const isNewlyLoaded = this._renderedThreadCacheLID !== this.props.threadCacheLID;

        const loadedMore = !this.loadingMore && this.refs.loadMore;
        const scrollHeight = this.el.scrollHeight;
        const scrollTop = this.el.scrollTop;
        const scrollToLastMessage = (hasNewMessages && lastMessageRef.bottomVisible) ||
            isNewlyLoaded;

        return {
            loadedMore,
            scrollHeight,
            scrollToLastMessage,
            scrollTop,
        };
    }

    /**
     * @param {Object} snapshot
     * @param {boolean} [snapshot.loadedMore=false]
     * @param {integer} snapshot.scrollHeight
     * @param {boolean} [snapshot.scrollToLastMessage=false]
     * @param {integer} snapshot.scrollTop
     */
    patched(snapshot) {
        this.el.scrollTop =
            this.el.scrollHeight -
            snapshot.scrollHeight +
            snapshot.scrollTop;
        if (snapshot.scrollToLastMessage && this.hasMessages) {
            this._autoLoadOnScroll = false;
            this.lastMessageRef
                .scrollToVisibleBottom()
                .then(() => {
                    this._autoLoadOnScroll = true;
                    this._onScroll();
                });
        }
        this._renderedThreadCacheLID = this.props.threadCacheLID;
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {boolean}
     */
    get hasMessages() {
        return this.props.messages.length > 0;
    }

    /**
     * @return {mail.wip.widget.Message}
     */
    get lastMessageRef() {
        let { length: l, [l-1]: lastMessageRef } = this.messageRefs;
        return lastMessageRef;
    }

    /**
     * @return {boolean}
     */
    get loadingMore() {
        return this.props.threadCache.loadingMore || false;
    }

    /**
     * @return {boolean}
     */
    get loadMoreVisible() {
        const loadMore = this.refs.loadMore;
        if (!loadMore) {
            return false;
        }
        const loadMoreRect = loadMore.getBoundingClientRect();
        const elRect = this.el.getBoundingClientRect();
        // intersection with 10px offset
        return (
            loadMoreRect.top < elRect.bottom + 10 &&
            elRect.top < loadMoreRect.bottom + 10
        );
    }

    /**
     * @return {mail.wip.widget.Message[]}
     */
    get messageRefs() {
        return Object.entries(this.refs)
            .filter(([refID, ref]) => refID.indexOf('mail.message') !== -1)
            .map(([refID, ref]) => ref)
            .sort((ref1, ref2) => (ref1.props.message.id < ref2.props.message.id ? -1 : 1));
    }
    get messages() {
        if (this.options.order === 'desc') {
            return this.props.messages.reverse();
        }
        return this.props.messages;
    }

    /**
     * @return {Object}
     */
    get options() {
        return this.props.options || {};
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {mail.wip.model.Message} message
     * @return {string}
     */
    getDateDay(message) {
        var date = moment(message.$date).format('YYYY-MM-DD');
        if (date === moment().format('YYYY-MM-DD')) {
            return this.env._t("Today");
        } else if (
            date === moment()
                .subtract(1, 'days')
                .format('YYYY-MM-DD')
        ) {
            return this.env._t("Yesterday");
        }
        return moment(message.$date).format('LL');
    }

    /**
     * @return {integer}
     */
    getScrollTop() {
        return this.el.scrollTop;
    }

    /**
     * @param {boolean} squashed
     * @return {Object}
     */
    messageOptions(squashed) {
        return {
            ...this.options,
            squashed,
        };
    }

    /**
     * @return {Promise}
     */
    scrollToLastMessage() {
        if (!this.hasMessages) {
            return Promise.resolve();
        }
        this._autoLoadOnScroll = false;
        return this.lastMessageRef.scrollToVisibleBottom().then(() => {
            this._autoLoadOnScroll = true;
        });
    }

    /**
     * @param {integer} value
     */
    setScrollTop(value) {
        this.el.scrollTop = value;
    }

    /**
     * @param {mail.wip.model.Message} prevMessage
     * @param {mail.wip.model.Message} message
     * @return {boolean}
     */
    shouldSquash(prevMessage, message) {
        if (!this.options.squashCloseMessages) {
            return false;
        }
        const prevDate = moment(prevMessage.$date);
        const date = moment(message.$date);
        if (Math.abs(date.diff(prevDate)) > 60000) {
            // more than 1 min. elasped
            return false;
        }
        if (prevMessage.message_type !== 'comment' || message.message_type !== 'comment') {
            return false;
        }
        if (prevMessage.authorLID !== message.authorLID) {
            // from a different author
            return false;
        }
        if (prevMessage.originLID !== message.originLID) {
            return false;
        }
        const prevOrigin = this.env.store.state.threads[prevMessage.originLID];
        const origin = this.env.store.state.threads[message.originLID];
        if (
            prevOrigin && origin &&
            prevOrigin._model === origin._model &&
            origin._model !== 'mail.channel' &&
            prevOrigin.id !== origin.model
        ) {
            // messages linked to different document thread
            return false;
        }
        return true;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _loadMore() {
        this.env.store.dispatch('thread/load_more', {
            searchDomain: this.options.domain,
            threadLID: this.props.threadLID,
        });
    }

    /**
     * @private
     */
    _markAsSeen() {
        this.env.store.dispatch('thread/mark_as_seen', {
            threadLID: this.props.threadLID,
        });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickLoadMore(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventDefault();
        this._loadMore();
    }

    /**
     * @private
     * @param {ScrollEvent} ev
     */
    _onScroll(ev) {
        if (ev.odooPrevented) { return; }
        if (!this.el) {
            // could be unmounted in the meantime (due to throttled behavior)
            return;
        }
        if (!this._autoLoadOnScroll) {
            return;
        }
        if (this.loadMoreVisible) {
            this._loadMore();
        }
        if (
            this.options.domain &&
            !this.options.domain.length &&
            this.lastMessageRef.partiallyVisible
        ) {
            this._markAsSeen();
        }
    }
}

/**
 * Props validationn
 */
MessageList.props = {
    options: {
        type: Object,
        default: {},
        shape: {
            domain: {
                type: Array,
                default: [],
            },
            redirectAuthor: {
                type: Boolean,
                default: false,
            },
            scrollTop: {
                type: Number,
                optional: true,
            },
            squashCloseMessages: {
                type: Boolean,
                default: false,
            },
        },
    },
    messageLIDs: {
        type: Array,
        element: String,
    },
    messages: {
        type: Array,
        element: Message,
    },
    thread: {
        type: Thread,
    },
    threadCache: {
        type: ThreadCache,
    },
    threadCacheLID: {
        type: String,
    },
    threadLID: {
        type: String,
    },
};

return connect(mapStateToProps, { deep: false })(MessageList);

});
