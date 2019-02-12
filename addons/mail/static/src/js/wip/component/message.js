odoo.define('mail.wip.component.Message', function (require) {
'use strict';

const mailUtils = require('mail.utils');
const AttachmentList = require('mail.wip.component.AttachmentList');

const time = require('web.time');

const { Component, connect } = owl;

class Message extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = { AttachmentList };
        this.id = `message_${this.props.messageLocalID}`;
        this.state = {
            timeElapsed: mailUtils.timeFromNow(this.props.message.dateMoment),
            toggledClick: false
        };
        this.template = 'mail.wip.component.Message';
        this._intervalID = undefined;
    }

    willUnmount() {
        clearInterval(this._intervalID);
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {Object}
     */
    get attachmentOptions() {
        return {
            downloadable: true,
            editable: false, // only if self-authored message?
            layout: 'card',
            layoutBasicImageSize: 'medium',
        };
    }

    /**
     * @return {string}
     */
    get avatar() {
        if (this.props.author && this.props.author === this.props.odoobot) {
            return '/mail/static/src/img/odoobot.png';
        } else if (this.props.author) {
            return `/web/image/res.partner/${this.props.author.id}/image_small`;
        } else if (this.props.message.message_type === 'email') {
            return '/mail/static/src/img/email_icon.png';
        }
        return '/mail/static/src/img/smiley/avatar.jpg';
    }

    /**
     * @return {boolean}
     */
    get bottomVisible() {
        const elRect = this.el.getBoundingClientRect();
        if (!this.el.parentNode) {
            return false;
        }
        const parentRect = this.el.parentNode.getBoundingClientRect();
        // bottom with (double) 5px offset
        return (
            elRect.bottom < parentRect.bottom + 5 &&
            parentRect.top < elRect.bottom + 5
        );
    }

    /**
     * @return {string}
     */
    get datetime() {
        return this.props.message.dateMoment.format(time.getLangDatetimeFormat());
    }

    /**
     * @return {string}
     */
    get displayedAuthorName() {
        if (this.props.author) {
            return this.props.author.displayName;
        }
        return this.props.message.email_from || this.env._t("Anonymous");
    }

    /**
     * @return {boolean}
     */
    get hasDifferentOriginThread() {
        return this.props.originThread && this.props.originThread !== this.props.thread;
    }

    /**
     * @return {Object}
     */
    get options() {
        let options = { ...this.props.options };
        if (!('redirectAuthor' in options)) {
            options.redirectAuthor = false;
        }
        if (!('squashed' in options)) {
            options.squashed = false;
        }
        return options;
    }

    /**
     * @return {boolean}
     */
    get partiallyVisible() {
        const elRect = this.el.getBoundingClientRect();
        if (!this.el.parentNode) {
            return false;
        }
        const parentRect = this.el.parentNode.getBoundingClientRect();
        // intersection with 5px offset
        return (
            elRect.top < parentRect.bottom + 5 &&
            parentRect.top < elRect.bottom + 5
        );
    }

    /**
     * @return {boolean}
     */
    get redirectAuthor() {
        if (!this.options.redirectAuthor) {
            return false;
        }
        if (!this.props.author) {
            return false;
        }
        if (this.props.author.id === this.env.session.partner_id) {
            return false;
        }
        return true;
    }

    /**
     * @return {string}
     */
    get shortTime() {
        return this.props.message.dateMoment.format('hh:mm');
    }

    /**
     * @return {boolean}
     */
    get starred() {
        return this.props.message.starred_partner_ids &&
            this.props.message.starred_partner_ids.includes(this.env.session.partner_id);
    }

    /**
     * @return {string}
     */
    get timeElapsed() {
        clearInterval(this._intervalID);
        this._intervalID = setInterval(() => {
            this.state.timeElapsed = mailUtils.timeFromNow(this.props.message.dateMoment);
        }, 60 * 1000);
        return this.state.timeElapsed;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {Object} [param0={}]
     * @param {string} [param0.behavior='auto']
     * @return {Promise}
     */
    scrollToVisibleBottom({ behavior='auto' }={}) {
        this.el.scrollIntoView({
            behavior,
            block: 'end',
            inline: 'nearest',
        });
        if (behavior === 'smooth') {
            return new Promise(resolve => setTimeout(resolve, 500));
        } else {
            return Promise.resolve();
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} param0
     * @param {integer} param0.id
     * @param {string} param0.model
     */
    _redirect({ id, model }) {
        this.trigger('redirect', { id, model });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        if (ev.target.closest('.o_mention')) {
            this.trigger('redirect', {
                id: Number(ev.target.dataset.oeId),
                model: ev.target.dataset.oeModel,
            });
            return;
        }
        ev.stopPropagation();
        this.state.toggledClick = !this.state.toggledClick;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickAuthor(ev) {
        if (!this.redirectAuthor) {
            return;
        }
        if (!this.props.author) {
            return;
        }
        this._redirect({
            id: this.props.author.id,
            model: this.props.author._model,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickOriginThread(ev) {
        this.trigger('redirect', {
            id: this.props.originThread.id,
            model: this.props.originThread._model,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickStar(ev) {
        return this.env.store.dispatch('toggleStarMessage', {
            messageLocalID: this.props.messageLocalID,
        });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.attachmentLocalID
     */
    _onViewAttachment(ev) {
        this.env.store.commit('viewAttachments', {
            attachmentLocalID: ev.detail.attachmentLocalID,
            attachmentLocalIDs: this.props.attachmentLocalIDs.filter(localID => {
                const attachment = this.env.store.state.attachments[localID];
                return attachment.isViewable;
            }),
        });
    }
}

/**
 * Props validation
 */
Message.props = {
    author: {
        type: Object, // {mail.wip.model.Partner}
        optional: true,
    },
    message: {
        type: Object, // {mail.wip.model.Message}
    },
    messageLocalID: {
        type: String,
    },
    options: {
        type: Object,
        default: {},
        shape: {
            redirectAuthor: {
                type: Boolean,
                default: false,
            },
            squashed: {
                type: Boolean,
                default: false,
            },
        },
    },
    originThread: {
        type: Object, // {mail.wip.model.Thread}
        optional: true,
    },
    thread: {
        type: Object, // {mail.wip.model.Thread}
    },
    threadLocalID: {
        type: String,
    },
};

return connect(
    Message,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.messageLocalID
     * @param {string} ownProps.threadLocalID
     * @return {Object}
     */
    (state, ownProps) => {
        const message = state.messages[ownProps.messageLocalID];
        const attachmentLocalIDs = message.attachmentLocalIDs;
        const author = state.partners[message.authorLocalID];
        const odoobot = state.partners.odoobot;
        const originThread = state.threads[message.originThreadLocalID];
        const thread = state.threads[ownProps.threadLocalID];
        return {
            attachmentLocalIDs,
            author,
            message,
            odoobot,
            originThread,
            thread,
        };
    },
    { deep: false }
);

});
