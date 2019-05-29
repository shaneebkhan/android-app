odoo.define('mail.wip.widget.ChatWindowHiddenMenu', function (require) {
"use strict";

const Thread = require('mail.wip.model.Thread');
const ChatWindowHeader = require('mail.wip.widget.ChatWindowHeader');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {string[]} ownProps.items
 * @return {Object}
 */
function mapStateToProps(state, ownProps) {
    return {
        GLOBAL_HEIGHT: state.global.innerHeight,
        threads: ownProps.items
            .filter(item => item !== 'new_message')
            .map(lid => state.threads[lid]),
    };
}

const id = _.uniqueId('chat_window_hidden_menu');

class HiddenMenu extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.id = id;
        this.state = { toggleShow: false };
        this.template = 'mail.wip.widget.ChatWindowHiddenMenu';
        this.widgets = { ChatWindowHeader };
        this._globalCaptureEventListener = ev => this._onClickCaptureGlobal(ev);
    }

    mounted() {
        this._apply();
        document.addEventListener('click', this._globalCaptureEventListener, true);
    }

    patched() {
        this._apply();
    }

    willUnmount() {
        document.removeEventListener('click', this._globalCaptureEventListener, true);
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
        if (ev.odooPrevented) { return; }
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
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this.state.toggleShow = !this.state.toggleShow;
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.item
     */
    _onCloseItem(ev) {
        if (ev.odooPrevented) { return; }
        this.trigger('close-item', {
            item: ev.detail.item,
            originalEvent: ev,
        });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.item
     */
    _onClickedItem(ev) {
        if (ev.odooPrevented) { return; }
        this.trigger('select-item', {
            item: ev.detail.item,
            originalEvent: ev,
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
        element: Thread,
    },
};

return connect(mapStateToProps, { deep: false })(HiddenMenu);

});
