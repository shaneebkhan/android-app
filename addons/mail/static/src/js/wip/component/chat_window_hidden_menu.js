odoo.define('mail.wip.component.ChatWindowHiddenMenu', function (require) {
"use strict";

const ChatWindowHeader = require('mail.wip.component.ChatWindowHeader');

const { Component, connect } = owl;

const id = _.uniqueId('chat_window_hidden_menu');

class HiddenMenu extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = { ChatWindowHeader };
        this.id = id;
        this.state = { toggleShow: false };
        this.template = 'mail.wip.component.ChatWindowHiddenMenu';
        this._globalCaptureClickEventListener = ev => this._onClickCaptureGlobal(ev);
    }

    mounted() {
        this._apply();
        document.addEventListener('click', this._globalCaptureClickEventListener, true);
    }

    patched() {
        this._apply();
    }

    willUnmount() {
        document.removeEventListener('click', this._globalCaptureClickEventListener, true);
    }

    //--------------------------------------------------------------------------
    // Getter / Setter
    //--------------------------------------------------------------------------

    /**
     * @return {integer}
     */
    get unreadCounter() {
        return this.props.threads.reduce((count, thread) => {
            count += thread.message_unread_counter > 0 ? 1 : 0;
            return count;
        }, 0);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _apply() {
        this._applyListHeight();
        this._applyOffset();
    }

    /**
     * @private
     */
    _applyListHeight() {
        this.refs.list.style['max-height'] = `${this.props.GLOBAL_HEIGHT/2}px`;
    }

    /**
     * @private
     */
    _applyOffset() {
        const offsetFrom = this.props.direction === 'rtl' ? 'right' : 'left';
        const oppositeFrom = offsetFrom === 'right' ? 'left' : 'right';
        this.el.style[offsetFrom] = `${this.props.offset}px`;
        this.el.style[oppositeFrom] = 'auto';
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickCaptureGlobal(ev) {
        if (ev.target === this.el) {
            return;
        }
        if (ev.target.closest(`[data-id="${this.id}"]`)) {
            return;
        }
        this.state.toggleShow = false;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickToggle(ev) {
        this.state.toggleShow = !this.state.toggleShow;
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.item
     */
    _onCloseItem(ev) {
        this.trigger('close-item', {
            item: ev.detail.item,
        });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.item
     */
    _onClickedItem(ev) {
        this.trigger('select-item', {
            item: ev.detail.item,
        });
        this.state.toggleShow = false;
    }
}

/**
 * Props validation
 */
HiddenMenu.props = {
    GLOBAL_HEIGHT: {
        type: Number,
    },
    direction: {
        type: String,
        default: 'rtl',
    },
    items: {
        type: Array,
        element: String,
    },
    offset: {
        type: Number,
    },
    threads: {
        type: Array,
        element: Object, // {mail.wip.model.Thread}
    },
};

return connect(
    HiddenMenu,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string[]} ownProps.items
     * @return {Object}
     */
    (state, ownProps) => {
        return {
            GLOBAL_HEIGHT: state.global.innerHeight,
            threads: ownProps.items
                .filter(item => item !== 'new_message')
                .map(localID => state.threads[localID]),
        };
    },
    { deep: false }
);

});
