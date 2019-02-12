odoo.define('mail.wip.widget.ChatWindowManager', function (require) {
"use strict";

const ChatWindow = require('mail.wip.widget.ChatWindow');
const ChatWindowBlank = require('mail.wip.widget.ChatWindowBlank');
const HiddenMenu = require('mail.wip.widget.ChatWindowHiddenMenu');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @return {Object}
 */
function mapStateToProps(state) {

    const { items, ...cwm } = state.chatWindowManager;

    return {
        ...cwm,
        GLOBAL_WIDTH: state.global.innerWidth,
        discussOpen: state.discuss.open,
        isMobile: state.isMobile,
        items,
    };
}

class ChatWindowManager extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);

        // owl
        this.template = 'mail.wip.widget.ChatWindowManager';
        this.widgets = { ChatWindow, ChatWindowBlank, HiddenMenu };

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

        this._compute();
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
     * @param {integer} nextProps.GLOBAL_WIDTH
     * @param {string[]} nextProps.items
     */
    willUpdateProps(nextProps) {
        this._compute({
            GLOBAL_WIDTH: nextProps.GLOBAL_WIDTH,
            items: nextProps.items,
        });
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

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} param0
     * @param {integer} [param0.GLOBAL_WIDTH]
     * @param {string[]} [param0.items]
     * @return {Object}
     */
    _compute({ GLOBAL_WIDTH, items }={}) {
        let computed = {
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
                 * List of hidden items. Useful to compute counter.
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

        if (!GLOBAL_WIDTH && !items) {
            // use props
            GLOBAL_WIDTH = this.props.GLOBAL_WIDTH;
            items = this.props.items;
        }

        if (this.props.isMobile || this.props.discussOpen) {
            this.computed = computed;
            return;
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
        } else {
            // all hidden
            computed.hidden.showMenu = true;
            computed.hidden.offset = this.START_GAP_WIDTH;
            computed.hidden.items.push(items);
        }
        if (!this.computed.visible.length && this.computed.hidden.items.length) {
            console.warn('cannot display any visible chat windows (screen is too small)');
        }
        this.computed = computed;
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
        this.env.store.commit('thread/close_chat_window', { threadLID });
    }

    /**
     * @private
     */
    _onCloseChatWindowBlank() {
        this.env.store.commit('chat_window_manager/close_blank');
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
                this.env.store.commit('chat_window_manager/open_item', { item: threadLID });
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
                this.env.store.commit('chat_window_manager/open_item', { item: dm.lid });
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
        this.env.store.commit('chat_window_manager/swap_items', {
            autocloseBlank: lastItem === 'blank',
            item1: threadLID,
            item2: lastItem,
        });
    }

    /**
     * @private
     * @param {Object} param0
     * @param {string} param0.threadLID
     */
    _onSelectThreadFromChatWindowBlank({ threadLID }) {
        this.env.store.commit('chat_window_manager/open_item', {
            item: threadLID,
            replaceBlank: true,
        });
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
