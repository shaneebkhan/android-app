odoo.define('mail.wip.widget.ThreadPreview', function (require) {
'use strict';

const mailUtils = require('mail.utils');
const Message = require('mail.wip.model.Message');
const Partner = require('mail.wip.model.Partner');
const Thread = require('mail.wip.model.Thread');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {string} ownProps.threadLID
 * @param {Object} getters
 * @return {Object}
 */
function mapStateToProps(state, ownProps, getters) {
    const threadLID = ownProps.threadLID;
    const threadCache = state.threadCaches[`${threadLID}_[]`];
    let lastMessage;
    let lastMessageAuthor;
    if (threadCache) {
        const { length: l, [l-1]: lastMessageLID } = threadCache.messageLIDs;
        lastMessage = state.messages[lastMessageLID];
        if (lastMessage) {
            lastMessageAuthor = state.partners[lastMessage.authorLID];
        }
    }
    const thread = state.threads[threadLID];
    let res = {
        thread,
        threadName: getters['thread/name']({ threadLID }),
    };
    if (lastMessage) {
        Object.assign(res, { lastMessage });
    }
    if (lastMessageAuthor) {
        Object.assign(res, { lastMessageAuthor });
    }
    return res;
}
class ThreadPreview extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.ThreadPreview';
        this.id = _.uniqueId('thread_preview');
    }

    //--------------------------------------------------------------------------
    // Getter / Setter
    //--------------------------------------------------------------------------

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
     * @return {string}
     */
    get inlineLastMessageBody() {
        if (!this.props.lastMessage) {
            return '';
        }
        return mailUtils.parseAndTransform(this.props.lastMessage.$body, mailUtils.inline);
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
        if (ev.odooPrevented) { return; }
        this.trigger('clicked', {
            threadLID: this.props.threadLID,
            originalEvent: ev,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickMarkAsRead(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this.env.store.dispatch('thread/mark_as_seen', {
            threadLID: this.props.threadLID,
        });
    }
}

/**
 * Props validation
 */
ThreadPreview.props = {
    lastMessage: {
        type: Message,
        optional: true,
    },
    lastMessageAuthor: {
        type: Partner,
        optional: true,
    },
    thread: {
        type: Thread,
    },
    threadLID: {
        type: String,
    },
    threadName: {
        type: String,
    },
};

return connect(mapStateToProps, { deep: false })(ThreadPreview);


});
