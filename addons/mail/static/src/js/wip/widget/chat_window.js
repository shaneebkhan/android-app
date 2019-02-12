odoo.define('mail.wip.widget.ChatWindow', function (require) {
"use strict";

const Header = require('mail.wip.widget.ChatWindowHeader');
const Composer = require('mail.wip.widget.Composer');
const Thread = require('mail.wip.widget.Thread');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {string} ownProps.threadLID
 * @return {Object}
 */
function mapStateToProps(state, ownProps) {
    return {
        thread: state.threads[ownProps.threadLID],
    };
}

class ChatWindow extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.ChatWindow';
        this.widgets = { Composer, Header, Thread };
    }

    mounted() {
        this._applyOffset();
    }

    patched() {
        this._applyOffset();
    }

    //--------------------------------------------------------------------------
    // Getter / Setter
    //--------------------------------------------------------------------------

    /**
     * @return {Object}
     */
    get composerOptions() {
        return {
            displayAvatar: false,
            displaySendButton: false,
        };
    }

    /**
     * @return {boolean}
     */
    get folded() {
        return this.props.thread.fold_state === 'folded';
    }

    /**
     * @return {boolean}
     */
    get showComposer() {
        return this.props.thread._model !== 'mail.box';
    }

    /**
     * @return {Object}
     */
    get threadOptions() {
        return {
            domain: [],
            redirectAuthor: this.props.thread.channel_type !== 'chat',
            squashCloseMessages: this.props.thread._model !== 'mail.box',
        };
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _applyOffset() {
        const offsetFrom = this.props.direction === 'rtl' ? 'right' : 'left';
        const oppositeFrom = offsetFrom === 'right' ? 'left' : 'right';
        this.el.style[offsetFrom] = this.props.offset + 'px';
        this.el.style[oppositeFrom] = 'auto';
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onHeaderClose() {
        this.trigger('close', { threadLID: this.props.threadLID });
    }

    /**
     * @private
     */
    _onHeaderSelect() {
        this.trigger('toggle-fold', { threadLID: this.props.threadLID });
    }

    /**
     * @private
     * @param {Object} param0
     * @param {integer} param0.id
     * @param {string} param0.model
     */
    _onRedirect({ id, model }) {
        this.trigger('redirect', { id, model });
    }
}

return connect(mapStateToProps, { deep: false })(ChatWindow);

});
