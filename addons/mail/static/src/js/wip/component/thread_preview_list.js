odoo.define('mail.wip.component.ThreadPreviewList', function (require) {
'use strict';

const ThreadPreview = require('mail.wip.component.ThreadPreview');

const { Component, connect } = owl;

class ThreadPreviewList extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = { ThreadPreview };
        this.template = 'mail.wip.component.ThreadPreviewList';
    }

    mounted() {
        this._loadPreviews();
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    async _loadPreviews() {
        this.env.store.dispatch('loadThreadPreviews', {
            threadLocalIDs: this.props.threadLocalIDs,
        });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.threadLocalID
     */
    _onClickedPreview(ev) {
        this.trigger('select-thread', {
            threadLocalID: ev.detail.threadLocalID,
        });
    }
}

/**
 * Props validation
 */
ThreadPreviewList.props = {
    filter: {
        type: String,
        default: 'all',
    },
    threadLocalIDs: {
        type: Array,
        element: String,
    },
};

return connect(
    ThreadPreviewList,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.filter
     * @return {Object}
     */
    (state, ownProps) => {
        let threadLocalIDs;
        if (ownProps.filter === 'mailbox') {
            threadLocalIDs = state.threadMailboxLocalIDs;
        } else if (ownProps.filter === 'channel') {
            threadLocalIDs = state.threadChannelLocalIDs;
        } else if (ownProps.filter === 'chat') {
            threadLocalIDs = state.threadChatLocalIDs;
        } else {
            // "All" filter is for channels and chats
            threadLocalIDs = state.threadMailChannelLocalIDs;
        }
        return { threadLocalIDs };
    },
    { deep: false }
);

});
