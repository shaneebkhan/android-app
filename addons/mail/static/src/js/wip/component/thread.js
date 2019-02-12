odoo.define('mail.wip.component.Thread', function (require) {
'use strict';

const Composer = require('mail.wip.component.Composer');
const MessageList = require('mail.wip.component.MessageList');

const { Component, connect } = owl;

class Thread extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = { Composer, MessageList };
        this.template = 'mail.wip.component.Thread';
        this._renderedThreadCacheLocalID = null;
    }

    mounted() {
        if (!this.loaded) {
            this._loadThread();
        }
        this._renderedThreadCacheLocalID = this.props.threadCacheLocalID;
        this.trigger('rendered');
    }

    patched() {
        if (!this.loading && !this.loaded) {
            this._loadThread();
        }
        if (this.loaded && this.hasMessages) {
            if (this.options.scrollTop !== undefined) {
                this.refs.messageList.setScrollTop(this.options.scrollTop);
            } else if (this._renderedThreadCacheLID !== this.props.threadCacheLID) {
                this.refs.messageList.scrollToLastMessage();
            }
        }
        this._renderedThreadCacheLocalID = this.props.threadCacheLocalID;
        this.trigger('rendered');
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {Object}
     */
    get composerOptions() {
        return {
            attachmentEditable: this.options.composerAttachmentEditable,
            attachmentLayout: this.options.composerAttachmentLayout,
            attachmentLayoutCardLabel: this.options.composerAttachmentLayoutCardLabel,
            avatar: this.options.composerAvatar,
            sendButton: this.options.composerSendButton,
        };
    }

    /**
     * @return {boolean}
     */
    get hasMessages() {
        return (
            this.props.threadCache &&
            this.props.threadCache.messageLocalIDs.length > 0
        ) || false;
    }

    /**
     * @return {boolean}
     */
    get loaded() {
        return (
            this.props.threadCache &&
            this.props.threadCache.loaded
        ) || false;
    }

    /**
     * @return {boolean}
     */
    get loading() {
        return (
            this.props.threadCache &&
            this.props.threadCache.loading
        ) || false;
    }

    /**
     * @return {Object}
     */
    get options() {
        let options = { ...this.props.options };
        _.defaults(options, {
            domain: [],
            order: 'asc',
            redirectAuthor: false,
            showComposer: false,
            squashCloseMessages: false,
        });
        return options;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    focus() {
        if (!this.refs.composer) {
            return;
        }
        this.refs.composer.focus();
    }

    focusout() {
        if (!this.refs.composer) {
            return;
        }
        this.refs.composer.focusout();
    }

    /**
     * @return {integer}
     */
    getScrollTop() {
        return this.refs.messageList.getScrollTop();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _loadThread() {
        this.env.store.dispatch('loadMessagesOnThread', {
            searchDomain: this.options.domain,
            threadLocalID: this.props.threadLocalID,
        });
    }
}

/**
 * Props validation
 */
Thread.props = {
    options: {
        type: Object,
        default: {},
        shape: {
            composerAttachmentEditable: {
                type: Boolean,
                optional: true,
            },
            composerAttachmentLayout: {
                type: String,
                optional: true,
            },
            composerAttachmentLayoutCardLabel: {
                type: Boolean,
                optional: true,
            },
            composerAvatar: {
                type: Boolean,
                optional: true,
            },
            composerSendButton: {
                type: Boolean,
                optional: true,
            },
            domain: {
                type: Array,
                default: [],
            },
            order: {
                type: String,
                default: 'asc', // ['asc', 'desc']
            },
            redirectAuthor: {
                type: Boolean,
                default: false,
            },
            scrollTop: {
                type: Number,
                optional: true,
            },
            showComposer: {
                type: Boolean,
                default: false,
            },
            squashCloseMessages: {
                type: Boolean,
                default: false,
            },
        }
    },
    threadCacheLocalID: {
        type: String
    },
    threadCache: {
        type: Object, // {mail.wip.model.ThreadCache}
        optional: true,
    },
    threadLocalID: {
        type: String
    },
};

return connect(
    Thread,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {Array} [ownProps.domain=[]]
     * @param {string} ownProps.threadLocalID
     * @return {Object}
     */
    (state, ownProps) => {
        const options = ownProps.options || {};
        const threadCacheLocalID = `${ownProps.threadLocalID}_${JSON.stringify(options.domain || [])}`;
        const threadCache = state.threadCaches[threadCacheLocalID];
        return {
            threadCache,
            threadCacheLocalID,
        };
    },
    { deep: false }
);

});
