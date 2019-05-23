odoo.define('mail.wip.widget.ChatWindow', function (require) {
"use strict";

const AutocompleteInput = require('mail.wip.widget.AutocompleteInput');
const Header = require('mail.wip.widget.ChatWindowHeader');
const Composer = require('mail.wip.widget.Composer');
const Thread = require('mail.wip.widget.Thread');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {string} ownProps.item
 * @return {Object}
 */
function mapStateToProps(state, ownProps) {
    return {
        thread: state.threads[ownProps.item],
    };
}

class ChatWindow extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.id = `chat_window_${this.props.item}`;
        this.state = {
            focused: false,
            folded: false, // used for 'new_message' chat window
        };
        this.template = 'mail.wip.widget.ChatWindow';
        this.widgets = { AutocompleteInput, Composer, Header, Thread };
        this._globalCaptureMousedownEventListener = ev => this._onMousedownCaptureGlobal(ev);
        this._globalCaptureFocusEventListener = ev => this._onFocusCaptureGlobal(ev);
        // bind since passed as props
        this._onAutocompleteSource = this._onAutocompleteSource.bind(this);
    }

    mounted() {
        this._applyOffset();
        document.addEventListener('mousedown', this._globalCaptureMousedownEventListener, true);
        document.addEventListener('focus', this._globalCaptureFocusEventListener, true);
    }

    /**
     * @param {Object} nextProps
     * @param {string} [nextProps.item]
     */
    willUpdateProps(nextProps) {
        const { item = this.props.item } = nextProps;
        this.id = `chat_window_${item}`;
    }

    patched() {
        this._applyOffset();
    }

    willUnmount() {
        document.removeEventListener('mousedown', this._globalCaptureMousedownEventListener, true);
        document.removeEventListener('focus', this._globalCaptureFocusEventListener, true);
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
        if (this.props.thread) {
            return this.props.thread.fold_state === 'folded';
        }
        return this.state.folded;
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
        if (this.props.thread) {
            return this.props.thread._model !== 'mail.box';
        }
        return false;
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
        if (!this.props.thread) {
            this.refs.input.focus();
        } else {
            if (!this.showComposer) {
                return;
            }
            this.refs.composer.focus();
        }
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
     * @param {Event} ev
     * @param {Object} ui
     * @param {Object} ui.item
     * @param {integer} ui.item.id
     */
    _onAutocompleteSelect(ev, ui) {
        if (ev.odooPrevented) { return; }
        const partnerID = ui.item.id;
        const partnerLID = `res.partner_${partnerID}`;
        const chat = this.env.store.getters['thread/chat_from_partner']({ partnerLID });
        if (chat) {
            this.trigger('select-thread', ev, {
                item: this.props.item,
                threadLID: chat.lid,
            });
        } else {
            this.trigger('close', ev, { item: this.props.item });
            this.env.store.dispatch('channel/create', {
                autoselect: true,
                partnerID,
                type: 'chat'
            });
        }
    }

    /**
     * @private
     * @param {Object} req
     * @param {string} req.term
     * @param {function} res
     */
    _onAutocompleteSource(req, res) {
        return this.env.store.dispatch('partner/search', {
            callback: res,
            limit: 10,
            value: _.escape(req.term)
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onCloseHeader(ev) {
        if (ev.odooPrevented) { return; }
        this.trigger('close', ev, { item: this.props.item });
    }

    /**
     * @private
     * @param {FocusEvent} ev
     */
    _onFocusCaptureGlobal(ev) {
        if (ev.odooPrevented) { return; }
        if (ev.target === this.el) {
            this.state.focused = true;
            return;
        }
        if (ev.target.closest(`[data-odoo-id="${this.id}"]`)) {
            this.state.focused = true;
            return;
        }
        this.state.focused = false;
    }

    /**
     * @private
     * @param {FocusEvent} ev
     */
    _onFocusComposer(ev) {
        if (ev.odooPrevented) { return; }
        this.state.focused = true;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onMousedown(ev) {
        if (ev.odooPrevented) { return; }
        if (ev.button !== 0) { return; } // ignore non-main buttons
        ev.odooPrevented = true;
        this.focus();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onMousedownCaptureGlobal(ev) {
        if (ev.odooPrevented) { return; }
        if (ev.button !== 0) { return; } // ignore non-main buttons
        if (ev.target === this.el) {
            this.state.focused = true;
            return;
        }
        if (ev.target.closest(`[data-odoo-id="${this.id}"]`)) {
            this.state.focused = true;
            return;
        }
        this.state.focused = false;
    }

    /**
     * @private
     * @param {Event} ev
     * @param {Object} param1
     * @param {integer} param1.id
     * @param {string} param1.model
     */
    _onRedirect(ev, { id, model }) {
        if (ev.odooPrevented) { return; }
        this.trigger('redirect', ev, { id, model });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onSelectHeader(ev) {
        if (ev.odooPrevented) { return; }
        ev.odooPrevented = true;
        if (!this.props.thread) {
            this.state.folded = !this.state.folded;
        } else {
            this.env.store.commit('thread/toggle_fold', { threadLID: this.props.item });
        }
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onShiftLeftHeader(ev) {
        if (ev.odooPrevented) { return; }
        this.trigger('shift-left', ev, { item: this.props.item });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onShiftRightHeader(ev) {
        if (ev.odooPrevented) { return; }
        this.trigger('shift-right', ev, { item: this.props.item });
    }
}

return connect(mapStateToProps, { deep: false })(ChatWindow);

});
