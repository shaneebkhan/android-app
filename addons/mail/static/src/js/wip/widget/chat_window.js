odoo.define('mail.wip.widget.ChatWindow', function (require) {
"use strict";

const AutocompleteInput = require('mail.wip.widget.AutocompleteInput');
const Header = require('mail.wip.widget.ChatWindowHeader');
const Thread = require('mail.wip.widget.Thread');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {string} ownProps.item
 * @return {Object}
 */
function mapStateToProps(state, ownProps) {
    const thread = state.threads[ownProps.item];
    let res = {};
    if (thread) {
        Object.assign(res, { thread });
    }
    return res;
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
        this.widgets = { AutocompleteInput, Header, Thread };
        this._globalCaptureClickEventListener = ev => this._onClickCaptureGlobal(ev);
        this._globalCaptureFocusEventListener = ev => this._onFocusCaptureGlobal(ev);
        // bind since passed as props
        this._onAutocompleteSelect = this._onAutocompleteSelect.bind(this);
        this._onAutocompleteSource = this._onAutocompleteSource.bind(this);
    }

    mounted() {
        this._applyOffset();
        document.addEventListener('click', this._globalCaptureClickEventListener, true);
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
        document.removeEventListener('click', this._globalCaptureClickEventListener, true);
        document.removeEventListener('focus', this._globalCaptureFocusEventListener, true);
    }

    //--------------------------------------------------------------------------
    // Getter / Setter
    //--------------------------------------------------------------------------

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
        let options = { ...this.props.options };
        _.defaults(options, {
            expand: false,
            shiftLeft: false,
            shiftRight: false,
        });
        return options;
    }

    /**
     * @return {Object}
     */
    get threadOptions() {
        return {
            composerAvatar: false,
            composerAttachmentEditable: true,
            composerAttachmentLayout: 'card',
            composerAttachmentLayoutCardLabel: false,
            composerSendButton: false,
            domain: [],
            redirectAuthor: this.props.thread.channel_type !== 'chat',
            showComposer: this.props.thread._model !== 'mail.box',
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
            this.refs.thread.focus();
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

    /**
     * @param {Event} [ev]
     */
    _close(ev) {
        this.trigger('close', {
            item: this.props.item,
            originalEvent: ev,
        });
    }

    /**
     * @private
     */
    _focusout() {
        this.state.focused = false;
        if (!this.props.thread) {
            this.refs.input.focusout();
        } else {
            this.refs.thread.focusout();
        }
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
            this.trigger('select-thread', {
                item: this.props.item,
                threadLID: chat.lid,
                originalEvent: ev,
            });
        } else {
            this._close(ev);
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
    _onClick(ev) {
        ev.preventOdoo();
        this.focus();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickCaptureGlobal(ev) {
        if (ev.odooPrevented) { return; }
        if (ev.target === this.el) {
            return;
        }
        if (ev.target.closest(`[data-id="${this.id}"]`)) {
            return;
        }
        this._focusout();
    }

    /**
     * @private
     * @param {CustomEvent} ev
     */
    _onClickedHeader(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        if (!this.props.thread) {
            this.state.folded = !this.state.folded;
        } else {
            this.env.store.commit('thread/toggle_fold', { threadLID: this.props.item });
        }
    }

    /**
     * @private
     * @param {CustomEvent} ev
     */
    _onCloseHeader(ev) {
        if (ev.odooPrevented) { return; }
        this._close(ev);
    }

    /**
     * @private
     * @param {FocusEvent} ev
     */
    _onFocusCaptureGlobal(ev) {
        if (ev.odooPrevented) { return; }
        if (ev.target === this.el) {
            this.focus();
            return;
        }
        if (ev.target.closest(`[data-id="${this.id}"]`)) {
            this.focus();
            return;
        }
        this.state.focused = false;
    }

    /**
     * @private
     * @param {FocusEvent} ev
     */
    _onFocusinThread(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this.state.focused = true;
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     */
    _onShiftLeftHeader(ev) {
        if (ev.odooPrevented) { return; }
        ev.detail.item = this.props.item;
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     */
    _onShiftRightHeader(ev) {
        if (ev.odooPrevented) { return; }
        ev.detail.item = this.props.item;
    }
}

/**
 * Props validation
 */
ChatWindow.props = {
    direction: {
        type: String,
        default: 'rtl',
    },
    item: {
        type: String,
    },
    offset: {
        type: Number,
    },
    options: {
        type: Object,
        default: {},
        shape: {
            expand: {
                type: Boolean,
                default: false,
            },
            shiftLeft: {
                type: Boolean,
                default: false,
            },
            shiftRight: {
                type: Boolean,
                default: false,
            },
        }
    },
    thread: {
        type: Thread,
        optional: true,
    }
};

return connect(mapStateToProps, { deep: false })(ChatWindow);

});
