odoo.define('mail.component.ChatWindow', function (require) {
"use strict";

const AutocompleteInput = require('mail.component.AutocompleteInput');
const Header = require('mail.component.ChatWindowHeader');
const Thread = require('mail.component.Thread');

const { Component, connect } = owl;

class ChatWindow extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = { AutocompleteInput, Header, Thread };
        this.id = `chat_window_${this.props.item}`;
        this.state = {
            focused: false,
            folded: false, // used for 'new_message' chat window
        };
        this.template = 'mail.component.ChatWindow';

        this._globalCaptureFocusEventListener = ev => this._onFocusCaptureGlobal(ev);
        this._globalMousedownEventListener = ev => this._onMousedownGlobal(ev);
        // bind since passed as props
        this._onAutocompleteSelect = this._onAutocompleteSelect.bind(this);
        this._onAutocompleteSource = this._onAutocompleteSource.bind(this);
    }

    mounted() {
        this._applyOffset();
        document.addEventListener('focus', this._globalCaptureFocusEventListener, true);
        document.addEventListener('mousedown', this._globalMousedownEventListener, false);
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
        document.removeEventListener('focus', this._globalCaptureFocusEventListener, true);
        document.removeEventListener('mousedown', this._globalMousedownEventListener);
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
     * @private
     */
    _close() {
        this.trigger('close', {
            item: this.props.item,
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
        const partnerID = ui.item.id;
        const partnerLocalID = `res.partner_${partnerID}`;
        const chat = this.env.store.getters.threadChatFromPartner({ partnerLocalID });
        if (chat) {
            this.trigger('select-thread', {
                item: this.props.item,
                threadLocalID: chat.localID,
            });
        } else {
            this._close();
            this.env.store.dispatch('createChannel', {
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
        return this.env.store.dispatch('searchPartners', {
            callback: (partners) => {
                const suggestions = partners.map(partner => {
                    return {
                        id: partner.id,
                        value: partner.displayName,
                        label: partner.displayName
                    };
                });
                res(_.sortBy(suggestions, 'label'));
            },
            keyword: _.escape(req.term),
            limit: 10,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        if (!this.folded) {
            this.focus();
        } else {
            this._focusout();
        }
    }

    /**
     * @private
     * @param {CustomEvent} ev
     */
    _onClickedHeader(ev) {
        if (!this.props.thread) {
            this.state.folded = !this.state.folded;
        } else {
            this.env.store.commit('toggleFoldThread', { threadLocalID: this.props.item });
        }
    }

    /**
     * @private
     * @param {CustomEvent} ev
     */
    _onCloseHeader(ev) {
        this._close();
    }

    /**
     * @private
     * @param {FocusEvent} ev
     */
    _onFocusCaptureGlobal(ev) {
        if (ev.target === this.el) {
            this.focus();
            return;
        }
        if (ev.target.closest(`[data-id="${this.id}"]`)) {
            this.focus();
            return;
        }
        this._focusout();
    }

    /**
     * @private
     * @param {FocusEvent} ev
     */
    _onFocusinThread(ev) {
        this.state.focused = true;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onMousedownGlobal(ev) {
        if (ev.target === this.el) {
            this.focus();
            return;
        }
        if (ev.target.closest(`[data-id="${this.id}"]`)) {
            this.focus();
            return;
        }
        this._focusout();
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     */
    _onShiftLeftHeader(ev) {
        ev.detail.item = this.props.item;
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     */
    _onShiftRightHeader(ev) {
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

return connect(
    ChatWindow,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.item
     * @return {Object}
     */
    (state, ownProps) => {
        return {
            thread: state.threads[ownProps.item],
        };
    },
    { deep: false }
);

});
