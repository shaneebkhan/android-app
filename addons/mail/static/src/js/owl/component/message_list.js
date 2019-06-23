odoo.define('mail.component.MessageList', function (require) {
'use strict';

const Message = require('mail.component.Message');

const { Component, connect } = owl;

class MessageList extends Component {
    constructor(...args) {
        super(...args);
        this.components = {
            Message,
        };
        this.template = 'mail.component.MessageList';
        this._autoLoadOnScroll = true;
        this._onScroll = _.throttle(this._onScroll.bind(this), 100);
        this._renderedThreadCacheLocalID = null;
    }

    mounted() {
        if (this.options.scrollTop) {
            this.el.scrollTop = this.options.scrollTop;
        } else {
            this.scrollToLastMessage();
        }
        this._renderedThreadCacheLocalID = this.props.threadCacheLocalID;
    }

    /**
     * @return {Object} snapshot object
     */
    willPatch() {
        const {
            length: l,
            0: firstMessageLocalID,
            [l-1]: lastMessageLocalID,
        } = this.props.messageLocalIDs;

        const firstMessageRef = this.firstMessageRef;
        const lastMessageRef = this.lastMessageRef;
        const isPatchedWithNewThreadCache =
            this._renderedThreadCacheLocalID !== this.props.threadCacheLocalID;

        return {
            isLastMessageVisible:
                lastMessageRef &&
                lastMessageRef.bottomVisible
            ,
            isPatchedWithNewMessages:
                !isPatchedWithNewThreadCache &&
                (
                    (
                        // FIXME:
                        // had messages, has different last message
                        // it assumes it comes from new message, but what if
                        // last message was deleted?
                        // this is important for moderation, in case of message
                        // deletion
                        lastMessageRef &&
                        lastMessageLocalID &&
                        lastMessageRef.props.messageLocalID !== lastMessageLocalID
                    ) ||
                    (
                        // had no messages, now has a last message
                        !lastMessageRef &&
                        lastMessageLocalID
                    )
                ),
            isPatchedWithLoadMoreMessages:
                !isPatchedWithNewThreadCache &&
                firstMessageRef.props.messageLocalID !== firstMessageLocalID,
            isPatchedWithNewThreadCache,
            scrollHeight: this.el.scrollHeight,
            scrollTop: this.el.scrollTop,
        };
    }

    /**
     * @param {Object} snapshot
     * @param {boolean} snapshot.isLastMessageVisible
     * @param {boolean} snapshot.isPatchedWithNewMessages
     * @param {boolean} snapshot.isPatchedWithLoadMoreMessages
     * @param {boolean} snapshot.isPatchedWithNewThreadCache
     * @param {integer} snapshot.scrollHeight
     * @param {integer} snapshot.scrollTop
     */
    patched(snapshot) {
        if (snapshot.isPatchedWithLoadMoreMessages) {
            this.el.scrollTop =
                this.el.scrollHeight -
                snapshot.scrollHeight +
                snapshot.scrollTop;
        }
        if (
            snapshot.isPatchedWithNewThreadCache ||
            (
                snapshot.isPatchedWithNewMessages &&
                snapshot.isLastMessageVisible
            )
        ) {
            this._autoLoadOnScroll = false;
            this.lastMessageRef
                .scrollToVisibleBottom()
                .then(() => {
                    this._autoLoadOnScroll = true;
                    this._onScroll();
                });
        }
        this._renderedThreadCacheLocalID = this.props.threadCacheLocalID;
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {mail.component.Message}
     */
    get firstMessageRef() {
        return this.messageRefs[0];
    }

    /**
     * @return {boolean}
     */
    get hasMessages() {
        return this.props.messages.length > 0;
    }

    /**
     * @return {mail.component.Message}
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
     * @return {mail.component.Message[]}
     */
    get messageRefs() {
        return Object.entries(this.refs)
            .filter(([refID, ref]) => refID.indexOf('mail.message') !== -1)
            .map(([refID, ref]) => ref)
            .sort((ref1, ref2) => (ref1.props.message.id < ref2.props.message.id ? -1 : 1));
    }
    /**
     * @return {mail.model.Message[]}
     */
    get messages() {
        if (this.options.order === 'desc') {
            return [ ...this.props.messages ].reverse();
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
     * @param {mail.store.model.Message} message
     * @return {string}
     */
    getDateDay(message) {
        var date = message.dateMoment.format('YYYY-MM-DD');
        if (date === moment().format('YYYY-MM-DD')) {
            return this.env._t("Today");
        } else if (
            date === moment()
                .subtract(1, 'days')
                .format('YYYY-MM-DD')
        ) {
            return this.env._t("Yesterday");
        }
        return message.dateMoment.format('LL');
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
     * @param {mail.store.model.Message} prevMessage
     * @param {mail.store.model.Message} message
     * @return {boolean}
     */
    shouldSquash(prevMessage, message) {
        if (!this.options.squashCloseMessages) {
            return false;
        }
        const prevDate = prevMessage.dateMoment;
        const date = message.dateMoment;
        if (Math.abs(date.diff(prevDate)) > 60000) {
            // more than 1 min. elasped
            return false;
        }
        if (prevMessage.message_type !== 'comment' || message.message_type !== 'comment') {
            return false;
        }
        if (prevMessage.authorLocalID !== message.authorLocalID) {
            // from a different author
            return false;
        }
        if (prevMessage.originThreadLocalID !== message.originThreadLocalID) {
            return false;
        }
        const prevOriginThread = this.env.store.state.threads[prevMessage.originThreadLocalID];
        const originThread = this.env.store.state.threads[message.originThreadLocalID];
        if (
            prevOriginThread &&
            originThread &&
            prevOriginThread._model === originThread._model &&
            originThread._model !== 'mail.channel' &&
            prevOriginThread.id !== originThread.model
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
        this.env.store.dispatch('loadMoreMessagesOnThread', {
            searchDomain: this.options.domain,
            threadLocalID: this.props.threadLocalID,
        });
    }

    /**
     * @private
     */
    _markAsSeen() {
        this.env.store.dispatch('markThreadAsSeen', {
            threadLocalID: this.props.threadLocalID,
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
        ev.preventDefault();
        this._loadMore();
    }

    /**
     * @private
     * @param {ScrollEvent} ev
     */
    _onScroll(ev) {
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
    messageLocalIDs: {
        type: Array,
        element: String,
    },
    messages: {
        type: Array,
        element: Object, // {mail.store.model.Message}
    },
    thread: {
        type: Object, // {mail.store.model.Thread}
    },
    threadCache: {
        type: Object, // {mail.store.model.ThreadCache}
    },
    threadCacheLocalID: {
        type: String,
    },
    threadLocalID: {
        type: String,
    },
};

return connect(
    MessageList,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.threadCacheLocalID
     * @param {string} ownProps.threadLocalID
     * @return {Object}
     */
    (state, ownProps) => {
        const threadCache = state.threadCaches[ownProps.threadCacheLocalID];
        return {
            messageLocalIDs: threadCache.messageLocalIDs,
            messages: threadCache.messageLocalIDs.map(localID => state.messages[localID]),
            thread: state.threads[ownProps.threadLocalID],
            threadCache,
        };
    },
    { deep: false }
);

});
