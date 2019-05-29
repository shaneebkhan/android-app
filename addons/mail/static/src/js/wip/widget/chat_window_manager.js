odoo.define('mail.wip.widget.ChatWindowManager', function (require) {
"use strict";

const ChatWindow = require('mail.wip.widget.ChatWindow');
const HiddenMenu = require('mail.wip.widget.ChatWindowHiddenMenu');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @return {Object}
 */
function mapStateToProps(state) {
    const {
        autofocusCounter,
        autofocusItem,
        computed,
    } = state.chatWindowManager;

    return {
        autofocusCounter,
        autofocusItem,
        computed,
    };
}

class ChatWindowManager extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.DEBUG = true;
        // owl
        this.template = 'mail.wip.widget.ChatWindowManager';
        this.widgets = { ChatWindow, HiddenMenu };
        // others
        this.TEXT_DIRECTION = this.env._t.database.parameters.direction;
        this._lastAutofocusedItem = undefined;
        this._lastAutofocusedCounter = 0;
        if (this.DEBUG) {
            window.chat_window_manager = this;
        }
    }

    mounted() {
        this._handleAutofocus();
    }

    patched() {
        this._handleAutofocus();
    }

    //--------------------------------------------------------------------------
    // Getter / Setter
    //--------------------------------------------------------------------------

    /**
     * @return {string} either 'rtl' or 'ltr'
     */
    get direction() {
        if (this.TEXT_DIRECTION === 'rtl') {
            return 'ltr';
        } else {
            return 'rtl';
        }
    }

    /**
     * @return {Array}
     */
    get reverseVisible() {
        return [...this.props.computed.visible].reverse();
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {integer} index index of visible chat window
     * @return {Object}
     */
    chatWindowOptions(index) {
        return {
            displayExpand: true,
            displayLeftShift: index < this.props.computed.visible.length - 1,
            displayRightShift: index !== 0,
        };
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _handleAutofocus() {
        let handled = false;
        const cwm = this.env.store.state.chatWindowManager;
        const lastNotifiedAutofocusCounter = cwm.notifiedAutofocusCounter;
        if (
            !handled &&
            this.props.autofocusCounter === lastNotifiedAutofocusCounter
        ) {
            handled = true;
        }
        if (
            !handled &&
            this._lastAutofocusedItem === this.props.autofocusItem &&
            this._lastAutofocusedCounter === this.props.autofocusCounter
        ) {
            handled = true;
        }
        if (
            !handled &&
            this._lastAutofocusedItem === undefined
        ) {
            this.refs[this.props.autofocusItem].focus();
            handled = true;
        }
        if (
            !handled &&
            this._lastAutofocusedItem === this.props.autofocusItem &&
            this._lastAutofocusedCounter !== this.props.autofocusCounter
        ) {
            this.refs[this.props.autofocusItem].focus();
            handled = true;
        }
        if (
            !handled &&
            this._lastAutofocusedItem !== this.props.autofocusItem
        ) {
            this.refs[this.props.autofocusItem].focus();
            handled = true;
        }
        this._lastAutofocusedItem = this.props.autofocusItem;
        this._lastAutofocusedCounter = this.props.autofocusCounter;
        this.env.store.commit('chat_window_manager/notify_autofocus_counter',
            this._lastAutofocusedCounter);
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev
     * @param {Object} param1
     * @param {string} param1.item
     */
    _onCloseChatWindow(ev, { item }) {
        if (ev.odooPrevented) { return; }
        ev.odooPrevented = true;
        this.env.store.commit('chat_window_manager/close', { item });
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
        if (model === 'mail.channel') {
            ev.odooPrevented = true;
            const threadLID = `${model}_${id}`;
            const channel = this.env.store.state.threads[threadLID];
            if (!channel) {
                this.env.store.dispatch('channel/join', {
                    autoselect: true,
                    channelID: id,
                    chatWindowOpenMode: 'last_visible',
                });
            } else {
                this.env.store.commit('chat_window_manager/open', { item: threadLID });
            }
        } else if (model === 'res.partner') {
            ev.odooPrevented = true;
            const dm = Object.values(this.props.threads).find(thread =>
                thread.directPartnerLID === `res.partner_${id}`);
            if (!dm) {
                this.env.store.dispatch('channel/create', {
                    autoselect: true,
                    chatWindowOpenMode: 'last_visible',
                    partnerID: id,
                    type: 'chat',
                });
            } else {
                this.env.store.commit('chat_window_manager/open', { item: dm.lid });
            }
        }
    }

    /**
     * @private
     * @param {Event} ev
     * @param {Object} param1
     * @param {string} param1.item
     */
    _onSelectChatWindow(ev, { item }) {
        if (ev.odooPrevented) { return; }
        ev.odooPrevented = true;
        this.env.store.commit('chat_window_manager/make_visible', { item });
    }

    /**
     * @private
     * @param {Event} ev
     * @param {Object} param1
     * @param {string} param1.item
     * @param {string} param1.threadLID
     */
    _onSelectThreadChatWindow(ev, { item, threadLID }) {
        if (ev.odooPrevented) { return; }
        ev.odooPrevented = true;
        this.env.store.commit('chat_window_manager/replace', {
            oldItem: item,
            newItem: threadLID,
        });
    }

    /**
     * @private
     * @param {Event} ev
     * @param {Object} param1
     * @param {string} param1.item
     */
    _onShiftLeftChatWindow(ev, { item }) {
        if (ev.odooPrevented) { return; }
        ev.odooPrevented = true;
        this.env.store.commit('chat_window_manager/shift_left', { item });
    }

    /**
     * @private
     * @param {Event} ev
     * @param {Object} param1
     * @param {string} param1.item
     */
    _onShiftRightChatWindow(ev, { item }) {
        if (ev.odooPrevented) { return; }
        ev.odooPrevented = true;
        this.env.store.commit('chat_window_manager/shift_right', { item });
    }
}

return connect(mapStateToProps, { deep: false })(ChatWindowManager);

});
