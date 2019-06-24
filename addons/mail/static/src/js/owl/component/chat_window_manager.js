odoo.define('mail.component.ChatWindowManager', function (require) {
"use strict";

const ChatWindow = require('mail.component.ChatWindow');
const HiddenMenu = require('mail.component.ChatWindowHiddenMenu');

const { Component, connect } = owl;

class ChatWindowManager extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.DEBUG = true;
        // owl
        this.components = { ChatWindow, HiddenMenu };
        this.template = 'mail.component.ChatWindowManager';
        // others
        this.TEXT_DIRECTION = this.env._t.database.parameters.direction;
        this._lastAutofocusedCounter = 0;
        this._lastAutofocusedItem = undefined;
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
            expand: true,
            shiftLeft: index < this.props.computed.visible.length - 1,
            shiftRight: index !== 0,
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
        this.env.store.commit('updateChatWindowManager', {
            notifiedAutofocusCounter: this._lastAutofocusedCounter,
        });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.item
     */
    _onCloseChatWindow(ev) {
        this.env.store.commit('closeChatWindow', {
            item: ev.detail.item,
        });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {integer} ev.detail.id
     * @param {string} ev.detail.model
     */
    async _onRedirect(ev) {
        const { id, model } = ev.detail;
        if (model === 'mail.channel') {
            ev.stopPropagation();
            const threadLocalID = `${model}_${id}`;
            const channel = this.env.store.state.threads[threadLocalID];
            if (!channel) {
                this.env.store.dispatch('joinChannel', {
                    autoselect: true,
                    channelID: id,
                    chatWindowOpenMode: 'last_visible',
                });
                return;
            }
            this.env.store.commit('openChatWindow', { item: threadLocalID });
            return;
        }
        if (model === 'res.partner') {
            if (id === this.env.session.partner_id) {
                this.env.do_action({
                    type: 'ir.actions.act_window',
                    res_model: 'res.partner',
                    views: [[false, 'form']],
                    res_id: id,
                });
                return;
            }
            const partnerLocalID = `res.partner_${id}`;
            let partner = this.env.store.state.partners[partnerLocalID];
            if (!partner) {
                this.env.store.commit('insertPartner', { id });
                partner = this.env.store.state.partners[partnerLocalID];
            }
            if (partner.userID === undefined) {
                // rpc to check that
                await this.env.store.dispatch('checkPartnerIsUser', { partnerLocalID });
            }
            if (partner.userID === null) {
                // partner is not a user, open document instead
                this.env.do_action({
                    type: 'ir.actions.act_window',
                    res_model: 'res.partner',
                    views: [[false, 'form']],
                    res_id: partner.id,
                });
                return;
            }
            ev.stopPropagation();
            const chat = this.env.store.getters.threadChatFromPartner({
                partnerLocalID: `res.partner_${id}`,
            });
            if (!chat) {
                this.env.store.dispatch('createChannel', {
                    autoselect: true,
                    chatWindowOpenMode: 'last_visible',
                    partnerID: id,
                    type: 'chat',
                });
                return;
            }
            this.env.store.commit('openChatWindow', { item: chat.localID });
        }
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.item
     */
    _onSelectChatWindow(ev) {
        this.env.store.commit('makeChatWindowVisible', {
            item: ev.detail.item,
        });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.item
     * @param {string} ev.detail.threadLocalID
     */
    _onSelectThreadChatWindow(ev) {
        const { item, threadLocalID } = ev.detail;
        if (!this.env.store.state.threads[threadLocalID].is_minimized) {
            this.env.store.commit('openChatWindow', {
                item: threadLocalID,
            });
        }
        this.env.store.commit('replaceChatWindow', {
            oldItem: item,
            newItem: threadLocalID,
        });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.item
     */
    _onShiftLeftChatWindow(ev) {
        this.env.store.commit('shiftLeftChatWindow', {
            item: ev.detail.item,
        });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.item
     */
    _onShiftRightChatWindow(ev) {
        this.env.store.commit('shiftRightChatWindow', {
            item: ev.detail.item,
        });
    }
}

/**
 * Props validation
 */
ChatWindowManager.props = {
    autofocusCounter: {
        type: Number,
    },
    autofocusItem: {
        type: String,
    },
    computed: {
        type: Object,
        shape: {
            availableVisibleSlots: {
                type: Number,
            },
            hidden: {
                type: Object,
                shape: {
                    items: {
                        type: Array,
                        element: String,
                    },
                    offset: {
                        type: Number,
                    },
                    showMenu: {
                        type: Boolean,
                    },
                },
            },
            visible: {
                type: Array,
                element: {
                    type: Object,
                    shape: {
                        item: {
                            type: String,
                        },
                        offset: {
                            type: Number,
                        }
                    },
                },
            },
        },
    },
};

return connect(
    ChatWindowManager,
    /**
     * @param {Object} state
     * @return {Object}
     */
    state => {
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
    },
    { deep: false }
);

});
