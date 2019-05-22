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
        this.id = `o_chat_window_${this.props.threadLID}`;
        this.state = { focused: false };
        this.template = 'mail.wip.widget.ChatWindow';
        this.widgets = { Composer, Header, Thread };

        this._documentEventListener = ev => this._onDocumentClick(ev);
    }

    mounted() {
        this._applyOffset();
        document.addEventListener('click', this._documentEventListener);
    }

    /**
     * @param {Object} nextProps
     * @param {string} [nextProps.threadLID]
     */
    willUpdateProps(nextProps) {
        const { threadLID = this.props.threadLID } = nextProps;
        this.id = `chat_window_${threadLID}`;
    }

    patched() {
        this._applyOffset();
    }

    willUnmount() {
        document.removeEventListener('click', this._documentEventListener);
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
     * @return {Object}
     */
    get options() {
        let options;
        if (this.props.options) {
            options = { ...this.props.options };
        } else {
            options = {};
        }
        return options;
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
    // Public
    //--------------------------------------------------------------------------

    focus() {
        this.state.focused = true;
        if (!this.showComposer) {
            return;
        }
        this.refs.composer.focus();
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
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        if (this.id in ev && !ev[this.id].click) {
            return;
        }
        this.focus();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickHeader(ev) {
        if (!ev[this.id]) {
            ev[this.id] = {};
        }
        ev[this.id].click = false;
        this.trigger('toggle-fold', { threadLID: this.props.threadLID });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickCloseHeader(ev) {
        if (!ev[this.id]) {
            ev[this.id] = {};
        }
        ev[this.id].click = false;
        this.trigger('close', { threadLID: this.props.threadLID });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickShiftLeftHeader(ev) {
        if (!ev[this.id]) {
            ev[this.id] = {};
        }
        ev[this.id].click = false;
        this.trigger('shift-left', { threadLID: this.props.threadLID });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickShiftRightHeader(ev) {
        if (!ev[this.id]) {
            ev[this.id] = {};
        }
        ev[this.id].click = false;
        this.trigger('shift-right', { threadLID: this.props.threadLID });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onDocumentClick(ev) {
        if (ev.target === this.el) {
            return;
        }
        if (
            'o_systray_messaging_menu' in ev &&
            'clickSelectedThread' in ev['o_systray_messaging_menu'] &&
            ev['o_systray_messaging_menu'].clickSelectedThread === this.props.threadLID
        ) {
            return;
        }
        if (this.id in ev) {
            return;
        }
        /**
         * Necessary to escape ID if it contains '.' in order to use '#'
         * in selector. e.g:
         * 'chat_window_mail.channel_1' => 'chat_window_mail\\.channel_1'
         * Work-around like [id="..."] requires much more processing
         */
        const escapedID = this.id.replace('.', '\\\\.');
        if (ev.target.closest(`#${escapedID}`)) {
            return;
        }
        this.state.focused = false;
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
