odoo.define('mail.wip.widget.Message', function (require) {
'use strict';

const mailUtils = require('mail.utils');

const time = require('web.time');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {string} ownProps.messageLID
 * @param {string} ownProps.threadLID
 */
function mapStateToProps(state, ownProps) {
    const message = state.messages[ownProps.messageLID];
    return {
        author: state.partners[message.authorLID],
        message,
        odoobot: state.partners.odoobot,
        origin: state.threads[message.originLID],
        thread: state.threads[ownProps.threadLID],
    };
}

class Message extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.id = `message_${this.props.messageLID}`;
        this.template = 'mail.wip.widget.Message';
        this.state = {
            timeElapsed: mailUtils.timeFromNow(this.props.message.$date),
            toggledClick: false
        };
        this._intervalID = undefined;
    }

    willUnmount() {
        clearInterval(this._intervalID);
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

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
     * @return {boolean}
     */
    get isStarred() {
        return this.props.message.starred_partner_ids &&
            this.props.message.starred_partner_ids.includes(this.env.session.partner_id);
    }

    /**
     * @return {Object}
     */
    get options() {
        return this.props.options || {};
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
        ev.odooPrevented = true;
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
        this.trigger('redirect', ev, {
            id: this.props.author.id,
            model: this.props.author._model,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickOrigin(ev) {
        if (ev.odooPrevented) { return; }
        this.trigger('redirect', ev, {
            id: this.props.origin.id,
            model: this.props.origin._model,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickStar(ev) {
        if (ev.odooPrevented) { return; }
        ev.odooPrevented = true;
        return this.env.store.dispatch('message/toggle_star', {
            messageLID: this.props.messageLID,
        });
    }
}

return connect(mapStateToProps, { deep: false })(Message);

});
