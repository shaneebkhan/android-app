odoo.define('mail.wip.widget.ChatWindowNewMessage', function (require) {
"use strict";

const AutocompleteInput = require('mail.wip.widget.AutocompleteInput');
const Header = require('mail.wip.widget.ChatWindowHeader');

const { Component } = owl;

class ChatWindowNewMessage extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.state = { folded: false };
        this.template = 'mail.wip.widget.ChatWindowNewMessage';
        this.widgets = { AutocompleteInput, Header };

        // bind since passed as props
        this._onAutocompleteSource = this._onAutocompleteSource.bind(this);
    }

    mounted() {
        this.refs.autocompleteInput.focus();
        this._applyOffset();
    }

    patched() {
        this._applyOffset();
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
     */
    _onClickClose() {
        this.trigger('close');
    }

    /**
     * @private
     */
    _onClickToggleFold() {
        this.state.folded = !this.state.folded;
    }
}

return ChatWindowNewMessage;

});
