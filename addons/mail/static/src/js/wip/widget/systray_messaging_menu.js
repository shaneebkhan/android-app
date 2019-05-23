odoo.define('mail.wip.widget.SystrayMessagingMenu', function (require) {
"use strict";

const ThreadPreviewList = require('mail.wip.widget.ThreadPreviewList');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {Object} getters
 * @return {Object}
 */
function mapStateToProps(state, ownProps, getters) {
    return {
        counter: getters['threads/global_unread_counter'](),
        discussOpen: state.discuss.open,
    };
}

class SystrayMessagingMenu extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.DEBUG = true;
        this.id = 'systray_messaging_menu';
        this.state = {
            filter: 'all',
            toggleShow: false,
        };
        this.template = 'mail.wip.widget.SystrayMessagingMenu';
        this.widgets = { ThreadPreviewList };

        if (this.DEBUG) {
            window.systray_messaging_menu = this;
        }
        this._globalCaptureEventListener = ev => this._onClickCaptureGlobal(ev);
    }

    mounted() {
        document.addEventListener('click', this._globalCaptureEventListener, true);
    }

    willUnmount() {
        document.removeEventListener('click', this._globalCaptureEventListener, true);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _reset() {
        this.state.filter = 'all';
        this.state.toggleShow = false;
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
        if (ev.target.closest(`[data-odoo-id="${this.id}"`)) {
            return;
        }
        this._reset();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickFilter(ev) {
        if (ev.odooPrevented) { return; }
        ev.odooPrevented = true;
        this.state.filter = ev.currentTarget.dataset.filter;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickNewMessage(ev) {
        if (ev.odooPrevented) { return; }
        ev.odooPrevented = true;
        this.env.store.commit('chat_window_manager/open', {
            item: 'new_message',
            mode: 'last_visible',
        });
        this._reset();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickToggleShow(ev) {
        if (ev.odooPrevented) { return; }
        ev.odooPrevented = true;
        ev.preventDefault(); // no redirect href
        ev.stopPropagation(); // no bootstrap click handler fixme: maybe use our own flesh dropdown menu?
        this.state.toggleShow = !this.state.toggleShow;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     * @param {Object} param1
     * @param {string} param1.threadLID
     */
    _onSelectThread(ev, { threadLID }) {
        if (ev.odooPrevented) { return; }
        ev.odooPrevented = true;
        this.env.store.dispatch('thread/open', { threadLID });
        this._reset();
    }
}

return connect(mapStateToProps)(SystrayMessagingMenu);

});
