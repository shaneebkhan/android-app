odoo.define('mail.wip.widget.Message', function (require) {
'use strict';

const mailUtils = require('mail.utils');
const Message = require('mail.wip.model.Message');
const Partner = require('mail.wip.model.Partner');
const Thread = require('mail.wip.model.Thread');
const AttachmentList = require('mail.wip.widget.AttachmentList');

const time = require('web.time');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {string} ownProps.messageLID
 * @param {string} ownProps.threadLID
 * @return {Object}
 */
function mapStateToProps(state, ownProps) {
    const message = state.messages[ownProps.messageLID];
    const attachmentLIDs = message.attachmentLIDs;
    const author = state.partners[message.authorLID];
    const odoobot = state.partners.odoobot;
    const origin = state.threads[message.originLID];
    const thread = state.threads[ownProps.threadLID];
    let res = {
        message,
        odoobot,
        thread,
    };
    if (attachmentLIDs) {
        Object.assign(res, { attachmentLIDs });
    }
    if (author) {
        Object.assign(res, { author });
    }
    if (origin) {
        Object.assign(res, { origin });
    }
    return res;
}

class MessageWidget extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.id = `message_${this.props.messageLID}`;
        this.state = {
            timeElapsed: mailUtils.timeFromNow(this.props.message.$date),
            toggledClick: false
        };
        this.template = 'mail.wip.widget.Message';
        this.widgets = { AttachmentList };
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
        if (!this.el.parent) {
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
        return this.props.message.$date.format(time.getLangDatetimeFormat());
    }

    /**
     * @return {string}
     */
    get displayedAuthorName() {
        if (this.props.author) {
            return this.props.author.$name;
        }
        return this.props.message.email_from || this.env._t("Anonymous");
    }

    /**
     * @return {boolean}
     */
    get hasDifferentOrigin() {
        return this.props.origin && this.props.origin !== this.props.thread;
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
        return this.props.message.$date.format('hh:mm');
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
            this.state.timeElapsed = mailUtils.timeFromNow(this.props.message.$date);
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
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this.state.toggledClick = !this.state.toggledClick;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickAuthor(ev) {
        if (ev.odooPrevented) { return; }
        if (!this.options.redirectAuthor) {
            return;
        }
        if (!this.props.author) {
            return;
        }
        this.trigger('redirect', {
            id: this.props.author.id,
            model: this.props.author._model,
            originalEvent: ev,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickOrigin(ev) {
        if (ev.odooPrevented) { return; }
        this.trigger('redirect', {
            id: this.props.origin.id,
            model: this.props.origin._model,
            originalEvent: ev,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickStar(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        return this.env.store.dispatch('message/toggle_star', {
            messageLID: this.props.messageLID,
        });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.attachmentLID
     */
    _onViewAttachment(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this.env.store.commit('attachments/view', {
            attachmentLID: ev.detail.attachmentLID,
            attachmentLIDs: this.props.attachmentLIDs.filter(attachmentLID => {
                const attachment = this.env.store.state.attachments[attachmentLID];
                return attachment.$viewable;
            }),
        });
    }
}

/**
 * Props validation
 */
MessageWidget.props = {
    author: {
        type: Partner,
        optional: true,
    },
    message: {
        type: Message,
    },
    messageLID: {
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
    origin: {
        type: Thread,
        optional: true,
    },
    thread: {
        type: Thread,
    },
    threadLID: {
        type: String,
    },
};

return connect(mapStateToProps, { deep: false })(MessageWidget);

});
