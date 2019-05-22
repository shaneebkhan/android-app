odoo.define('mail.wip.widget.ChatWindowHiddenMenu', function (require) {
"use strict";

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
            .filter(item => item !== 'blank')
            .map(lid => state.threads[lid]),
    };
}

class HiddenMenu extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.state = { toggleShow: false };
        this.template = 'mail.wip.widget.ChatWindowHiddenMenu';
        this.widgets = { ChatWindowHeader };
        this._id = _.uniqueId('chat_window_hidden_menu');
    }

    mounted() {
        this._apply();
        $(document).on(`click.${this._id}`, ev => this._onDocumentClick(ev));
    }

    patched() {
        this._apply();
    }

    willUnmount() {
        $(document).off(`click.${this._id}`);
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
     */
    _onClickToggle() {
        this.state.toggleShow = !this.state.toggleShow;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onDocumentClick(ev) {
        if (ev.target === this.el) {
            return;
        }
        if (ev.target.closest('.o_hidden_menu')) {
            return;
        }
        this.state.toggleShow = false;
    }

    /**
     * @private
     * @param {Object} param0
     * @param {string} param0.threadLID
     */
    _onItemClose({ threadLID }) {
        this.trigger('close-item', { threadLID });
    }

    /**
     * @private
     * @param {Object} param0
     * @param {string} param0.threadLID
     */
    _onItemSelect({ threadLID }) {
        this.trigger('select-item', { threadLID });
    }
}

return connect(mapStateToProps, { deep: false })(HiddenMenu);

});
