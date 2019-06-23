odoo.define('mail.component.ThreadPreview', function (require) {
'use strict';

const mailUtils = require('mail.utils');

const { Component, connect } = owl;

class ThreadPreview extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.component.ThreadPreview';
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
        return mailUtils.parseAndTransform(this.props.lastMessage.bodyWithLinks, mailUtils.inline);
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
        this.trigger('clicked', {
            threadLocalID: this.props.threadLocalID,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickMarkAsRead(ev) {
        this.env.store.dispatch('markThreadAsSeen', {
            threadLocalID: this.props.threadLocalID,
        });
    }
}

/**
 * Props validation
 */
ThreadPreview.props = {
    lastMessage: {
        type: Object, // {mail.store.model.Message}
        optional: true,
    },
    lastMessageAuthor: {
        type: Object, // {mail.store.model.Partner}
        optional: true,
    },
    thread: {
        type: Object, // {mail.store.model.Thread}
    },
    threadLocalID: {
        type: String,
    },
    threadName: {
        type: String,
    },
};

return connect(
    ThreadPreview,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.threadLocalID
     * @param {Object} getters
     * @return {Object}
     */
    (state, ownProps, getters) => {
        const threadLocalID = ownProps.threadLocalID;
        const threadCache = state.threadCaches[`${threadLocalID}_[]`];
        let lastMessage;
        let lastMessageAuthor;
        if (threadCache) {
            const { length: l, [l-1]: lastMessageLocalID } = threadCache.messageLocalIDs;
            lastMessage = state.messages[lastMessageLocalID];
            if (lastMessage) {
                lastMessageAuthor = state.partners[lastMessage.authorLocalID];
            }
        }
        const thread = state.threads[threadLocalID];
        return {
            lastMessage,
            lastMessageAuthor,
            thread,
            threadName: getters.threadName({ threadLocalID }),
        };
    },
    { deep: false }
);


});
