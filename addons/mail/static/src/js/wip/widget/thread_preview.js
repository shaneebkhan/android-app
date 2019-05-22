odoo.define('mail.wip.widget.ThreadPreview', function (require) {
'use strict';

var mailUtils = require('mail.utils');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {string} ownProps.threadLID
 * @param {Object} getters
 */
function mapStateToProps(state, ownProps, getters) {
    const threadLID = ownProps.threadLID;
    const threadCache = state.threadCaches[`${threadLID}_[]`];
    let lastMessage;
    if (threadCache) {
        const { length: l, [l-1]: lastMessageLID } = threadCache.messageLIDs;
        lastMessage = state.messages[lastMessageLID];
    }
    return {
        lastMessage,
        lastMessageAuthor: lastMessage && state.partners[lastMessage.authorLID],
        thread: state.threads[threadLID],
        threadName: getters['thread/name']({ threadLID }),
    };
}
class ThreadPreview extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.ThreadPreview';
        this._id = _.uniqueId('thread_preview');
    }

    //--------------------------------------------------------------------------
    // Getter / Setter
    //--------------------------------------------------------------------------

    /**
     * @return {string}
     */
    get inlineLastMessageBody() {
        if (!this.props.lastMessage) {
            return '';
        }
        return mailUtils.parseAndTransform(this.props.lastMessage.$body, mailUtils.inline);
    }

    /**
     * @return {string}
     */
    get image() {
        if (this.props.thread.direct_partner) {
            return `/web/image/res.partner/${this.props.thread.direct_partner[0].id}/image_small`;
        }
        return `/web/image/mail.channel/${this.props.thread.id}/image_small`;
    }

    /**
     * @return {boolean}
     */
    get isMyselfLastMessageAuthor() {
        return (
            this.props.lastMessageAuthor &&
            this.props.lastMessageAuthor.id === this.env.session.partner_id
        ) || false;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        if (`click_${this._id}` in ev && !ev[`click_${this._id}`]) {
            return;
        }
        this.trigger('click', { threadLID: this.props.threadLID });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickMarkAsRead(ev) {
        ev[`click_${this._id}`] = false;
        this.env.store.dispatch('thread/mark_as_seen', {
            threadLID: this.props.threadLID,
        });
    }
}

return connect(mapStateToProps, { deep: false })(ThreadPreview);


});
