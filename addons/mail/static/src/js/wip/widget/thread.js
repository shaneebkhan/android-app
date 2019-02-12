odoo.define('mail.wip.widget.Thread', function (require) {
'use strict';

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
    return {
        threadCache,
        threadCacheLID,
    };
}

class Thread extends Component {

    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.Thread';
        this.widgets = { MessageList };
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
                this.refs.messageList.scrollTop = this.options.scrollTop;
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
        return this.props.options || {};
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @return {integer}
     */
    getScrollTop() {
        return this.refs.messageList.scrollTop;
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

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onRedirect({ id, model }) {
        this.trigger('redirect', { id, model });
    }
}

return connect(mapStateToProps, { deep: false })(Thread);

});
