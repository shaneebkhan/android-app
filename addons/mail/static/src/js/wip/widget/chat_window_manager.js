odoo.define('mail.wip.widget.ChatWindowManager', function (require) {
"use strict";

const ChatWindow = require('mail.wip.widget.ChatWindow');
const ChatWindowNewMessage = require('mail.wip.widget.ChatWindowNewMessage');
const HiddenMenu = require('mail.wip.widget.ChatWindowHiddenMenu');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @return {Object}
 */
function mapStateToProps(state) {
    const { showNewMessage, threadLIDs } = state.chatWindowManager;

    return {
        GLOBAL_WIDTH: state.global.innerWidth,
        discussOpen: state.discuss.open,
        isMobile: state.isMobile,
        showNewMessage,
        threadLIDs,
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
        this.widgets = { ChatWindow, ChatWindowNewMessage, HiddenMenu };

        // screen positioning
        this.BETWEEN_GAP_WIDTH = 5;
        this.CHAT_WINDOW_WIDTH = 325;
        this.END_GAP_WIDTH = 10;
        this.HIDDEN_MENU_WIDTH = 200; // max width, including width of dropup items
        this.START_GAP_WIDTH = 10;
        this.TEXT_DIRECTION = this.env._t.database.parameters.direction;

        /**
         * data computed with `_compute()`
         */
        this.computed = undefined;

        if (this.DEBUG) {
            window.chat_window_manager = this;
        }

        this._compute();
    }

    mounted() {
        this._notifyAvailableVisibleSlots();
    }

    /**
     * Compute the amount of chat windows to show/hide.
     * Note that this cannot be done in willPatch, because the context of
     * template is already set and can't change. This is not an issue in case
     * of props changed, but that means we need to manually compute on state
     * changed. A work-around is to move chat window manager state to the store,
     * so that it is handled as props.
     *
     * @param {Object} nextProps
     */
    willUpdateProps(nextProps) {
        this._compute(nextProps);
    }

    patched() {
        this._notifyAvailableVisibleSlots();
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
     * @param {integer} index index of visible chat window
     * @return {Object}
     */
    chatWindowOptions(index) {
        return {
            displayExpand: true,
            displayLeftShift: index < this.computed.visible.length - 1,
            displayRightShift: this.props.showNewMessage ? index > 1 : index !== 0,
        };
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} params
     * @param {integer} [param0.GLOBAL_WIDTH]
     * @param {boolean} [param0.discussOpen]
     * @param {boolean} [param0.isMobile]
     * @param {boolean} [param0.showNewMessage]
     * @param {string[]} [param0.threadLIDs]
     * @return {Object}
     */
    _compute(params={}) {
        const {
            GLOBAL_WIDTH = this.props.GLOBAL_WIDTH,
            discussOpen = this.props.discussOpen,
            isMobile = this.props.isMobile,
            showNewMessage = this.props.showNewMessage,
            threadLIDs = this.props.threadLIDs,
        } = params;
        let items = [...threadLIDs];
        let computed = {
            availableVisibleSlots: undefined,
            /**
             * Data related to hidden menu.
             */
            hidden: {
                /**
                 * Offset of hidden menu starting point from the starting point
                 * of chat window manager. Makes only sense if it is visible.
                 */
                offset: 0,
                /**
                 * Whether hidden menu is visible or not
                 */
                showMenu: false,
                /**
                 * List of hidden threads. Useful to compute counter.
                 */
                items: [],
            },
            /**
             * Data related to visible chat windows.
             * Index determine order of thread.
             * Value: { item, offset }.
             * Offset is offset of starting point of chat window from starting
             * point of chat window manager.
             */
            visible: [],
        };

        if (isMobile || discussOpen) {
            this.computed = computed;
            return;
        }

        if (showNewMessage) {
            items.unshift('new_message');
        }

        if (!items.length) {
            this.computed = computed;
            return;
        }

        const relativeGlobalWidth = GLOBAL_WIDTH
            - this.START_GAP_WIDTH
            - this.END_GAP_WIDTH;
        const maxAmountWithoutHidden = Math.floor(
            relativeGlobalWidth /
            (this.CHAT_WINDOW_WIDTH + this.BETWEEN_GAP_WIDTH));
        const maxAmountWithHidden = Math.floor(
            (
                relativeGlobalWidth
                - this.HIDDEN_MENU_WIDTH
                - this.BETWEEN_GAP_WIDTH
            ) /
            (this.CHAT_WINDOW_WIDTH + this.BETWEEN_GAP_WIDTH));

        if (items.length <= maxAmountWithoutHidden) {
            // all visible
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const offset = this.START_GAP_WIDTH
                    + i * (this.CHAT_WINDOW_WIDTH + this.BETWEEN_GAP_WIDTH);
                computed.visible.push({
                    item,
                    offset,
                });
            }
            computed.availableVisibleSlots = maxAmountWithoutHidden;
        } else if (maxAmountWithHidden > 0) {
            // some visible, some hidden
            let i;
            for (i = 0; i < maxAmountWithHidden; i++) {
                const item = items[i];
                const offset = this.START_GAP_WIDTH
                    + i * ( this.CHAT_WINDOW_WIDTH + this.BETWEEN_GAP_WIDTH );
                computed.visible.push({
                    item,
                    offset,
                });
            }
            if (items.length > maxAmountWithHidden) {
                computed.hidden.showMenu = true;
                computed.hidden.offset = computed.visible[i-1].offset
                    + this.CHAT_WINDOW_WIDTH + this.BETWEEN_GAP_WIDTH;
            }
            for (let j = maxAmountWithHidden; j < items.length; j++) {
                computed.hidden.items.push(items[j]);
            }
            computed.availableVisibleSlots = maxAmountWithHidden;
        } else {
            // all hidden
            if (showNewMessage) {
                items.shift(); // remove 'new message' chat window from hidden
            }
            computed.hidden.showMenu = true;
            computed.hidden.offset = this.START_GAP_WIDTH;
            computed.hidden.items.concat(items);
            console.warn('cannot display any visible chat windows (screen is too small)');
            computed.availableVisibleSlots = 0;
        }
        this.computed = computed;
    }

    /**
     * @private
     */
    _notifyAvailableVisibleSlots() {
        if (
            (
                this.props.availableVisibleSlots === undefined &&
                this.computed.availableVisibleSlots !== undefined
            ) ||
            (
                this.props.availableVisibleSlots !== undefined &&
                this.computed.availableVisibleSlots !== undefined &&
                this.computed.availableVisibleSlots !== this.props.availableVisibleSlots
            )
        ) {
            this.env.store.commit('chat_window_manager/set_available_visible_slots',
                this.computed.availableVisibleSlots);
        }
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} param0
     * @param {string} param0.threadLID
     */
    _onCloseChatWindow({ threadLID }) {
        this.env.store.commit('chat_window_manager/close_thread', { threadLID });
    }

    /**
     * @private
     */
    _onCloseChatWindowNewMessage() {
        this.env.store.commit('chat_window_manager/close_new_message');
    }

    /**
     * @private
     * @param {Object} param0
     * @param {integer} param0.id
     * @param {string} param0.model
     */
    _onRedirect({ id, model }) {
        if (model === 'mail.channel') {
            const threadLID = `${model}_${id}`;
            const channel = this.env.store.state.threads[threadLID];
            if (!channel) {
                this.env.store.dispatch('channel/join', {
                    autoselect: true,
                    channelID: id,
                });
            } else {
                this.env.store.commit('chat_window_manager/open_thread', { threadLID });
            }
        } else if (model === 'res.partner') {
            const dm = Object.values(this.props.threads).find(thread =>
                thread.directPartnerLID === `res.partner_${id}`);
            if (!dm) {
                this.env.store.dispatch('channel/create', {
                    autoselect: true,
                    partnerID: id,
                    type: 'chat',
                });
            } else {
                this.env.store.commit('chat_window_manager/open_thread', { threadLID: dm.lid });
            }
        }
    }

    /**
     * @private
     * @param {Object} param0
     * @param {string} param0.threadLID
     */
    _onSelectChatWindow({ threadLID }) {
        const {
            length: l,
            [l-1]: { item: lastItem }
        } = this.computed.visible;
        if (lastItem === 'new_message') {
            this.env.store.commit('chat_window_manager/close_new_message');
            this.env.store.commit('chat_window_manager/open_thread', { threadLID });
        } else {
            this.env.store.commit('chat_window_manager/swap_threads', {
                threadLID1: threadLID,
                threadLID2: lastItem,
            });
        }
    }

    /**
     * @private
     * @param {Object} param0
     * @param {string} param0.threadLID
     */
    _onSelectThreadFromChatWindowNewMessage({ threadLID }) {
        this.env.store.commit('chat_window_manager/close_new_message');
        this.env.store.commit('chat_window_manager/open_thread', { threadLID });
    }

    /**
     * @private
     * @param {Object} param0
     * @param {string} param0.threadLID
     */
    _onShiftLeftChatWindow({ threadLID }) {
        this.env.store.commit('chat_window_manager/shift_thread_left', { threadLID });
    }

    /**
     * @private
     * @param {Object} param0
     * @param {string} param0.threadLID
     */
    _onShiftRightChatWindow({ threadLID }) {
        this.env.store.commit('chat_window_manager/shift_thread_right', { threadLID });
    }

    /**
     * @private
     * @param {Object} param0
     * @param {string} param0.threadLID
     */
    _onToggleFoldChatWindow({ threadLID }) {
        this.env.store.commit('thread/toggle_fold', { threadLID });
    }
}

return connect(mapStateToProps, { deep: false })(ChatWindowManager);

});
