odoo.define('mail.wip.widget.ChatWindowNewMessage', function (require) {
"use strict";

const AutocompleteInput = require('mail.wip.widget.AutocompleteInput');
const Header = require('mail.wip.widget.ChatWindowHeader');

const { Component } = owl;

const id = _.uniqueId('o_chat_window_new_message');

class ChatWindowNewMessage extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.id = id;
        this.state = {
            focused: false,
            folded: false,
        };
        this.template = 'mail.wip.widget.ChatWindowNewMessage';
        this.widgets = { AutocompleteInput, Header };

        this._documentEventListener = ev => this._onDocumentClick(ev);

        // bind since passed as props
        this._onAutocompleteSource = this._onAutocompleteSource.bind(this);
    }

    mounted() {
        this._applyOffset();
        document.addEventListener('click', this._documentEventListener);
    }

    patched() {
        this._applyOffset();
    }

    willUnmount() {
        document.removeEventListener('click', this._documentEventListener);
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    focus() {
        this.state.focused = true;
        this.refs.input.focus();
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
     * @param {Object} item
     * @param {integer} item.id
     */
    _onAutocompleteSelect(item) {
        const partnerID = item.id;
        const partnerLID = `res.partner_${partnerID}`;
        const chat = this.env.store.getters['thread/chat_from_partner']({ partnerLID });
        if (chat) {
            this.trigger('select-thread', { threadLID: chat.lid });
        } else {
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
        if (this.id in ev && !ev[this.id].click) {
            return;
        }
        this.focus();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickClose(ev) {
        if (!ev[this.id]) {
            ev[this.id] = {};
        }
        ev[this.id].click = false;
        this.trigger('close');
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickToggleFold(ev) {
        if (!ev[this.id]) {
            ev[this.id] = {};
        }
        ev[this.id].click = false;
        this.state.folded = !this.state.folded;
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
            'clickNewMessage' in ev['o_systray_messaging_menu'] &&
            ev['o_systray_messaging_menu'].clickNewMessage
        ) {
            return;
        }
        if (ev.target.closest(`#${this.id}`)) {
            return;
        }
        this.state.focused = false;
    }
}

return ChatWindowNewMessage;

});
