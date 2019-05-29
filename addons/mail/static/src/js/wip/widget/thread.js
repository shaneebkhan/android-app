odoo.define('mail.wip.widget.Thread', function (require) {
'use strict';

const ThreadCache = require('mail.wip.model.ThreadCache');
const Composer = require('mail.wip.widget.Composer');
const MessageList = require('mail.wip.widget.MessageList');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {Array} [ownProps.domain=[]]
 * @param {string} ownProps.threadLID
 * @return {Object}
 */
function mapStateToProps(state, ownProps) {
    const options = ownProps.options || {};
    const threadCacheLID = `${ownProps.threadLID}_${JSON.stringify(options.domain || [])}`;
    const threadCache = state.threadCaches[threadCacheLID];
    let res = { threadCacheLID };
    if (threadCache) {
        Object.assign(res, { threadCache });
    }
    return res;
}

class Thread extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.Thread';
        this.widgets = { Composer, MessageList };
        this._renderedThreadCacheLID = null;
    }

    mounted() {
        if (!this.loaded) {
            this._loadThread();
        }
        this._renderedThreadCacheLID = this.props.threadCacheLID;
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
        this._renderedThreadCacheLID = this.props.threadCacheLID;
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
            this.props.threadCache.messageLIDs.length > 0
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
        this.env.store.dispatch('thread/load', {
            searchDomain: this.options.domain,
            threadLID: this.props.threadLID,
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
    threadCacheLID: {
        type: String
    },
    threadCache: {
        type: ThreadCache,
        optional: true,
    },
    threadLID: {
        type: String
    },
};

return connect(mapStateToProps, { deep: false })(Thread);

});
