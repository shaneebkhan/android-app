odoo.define('mail.wip.widget.ThreadPreviewList', function (require) {
'use strict';

const ThreadPreview = require('mail.wip.widget.ThreadPreview');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {string} ownProps.filter
 * @return {Object}
 */
function mapStateToProps(state, ownProps) {
    let threadLIDs;
    if (ownProps.filter === 'mailbox') {
        threadLIDs = state.threadMailboxLIDs;
    } else if (ownProps.filter === 'channel') {
        threadLIDs = state.threadChannelLIDs;
    } else if (ownProps.filter === 'chat') {
        threadLIDs = state.threadChatLIDs;
    } else {
        // "All" filter is for channels and chats
        threadLIDs = state.threadMailChannelLIDs;
    }
    return { threadLIDs };
}

class ThreadPreviewList extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.ThreadPreviewList';
        this.widgets = { ThreadPreview };
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
        this.env.store.dispatch('threads/load_previews', {
            threadLIDs: this.props.threadLIDs,
        });
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
    _onClickPreview(ev, { threadLID }) {
        if (ev.odooPrevented) { return; }
        this.trigger('select-thread', ev, { threadLID });
    }
}

return connect(mapStateToProps, { deep: false })(ThreadPreviewList);

});
