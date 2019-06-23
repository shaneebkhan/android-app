odoo.define('mail.component.SystrayMessagingMenu', function (require) {
"use strict";

const ThreadPreviewList = require('mail.component.ThreadPreviewList');

const { Component, connect } = owl;

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
        this.template = 'mail.component.SystrayMessagingMenu';
        this.components = { ThreadPreviewList };

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
        if (ev.target === this.el) {
            return;
        }
        if (ev.target.closest(`[data-id="${this.id}"]`)) {
            return;
        }
        this._reset();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickFilter(ev) {
        this.state.filter = ev.currentTarget.dataset.filter;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickNewMessage(ev) {
        this.env.store.commit('openChatWindow', {
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
        ev.preventDefault(); // no redirect href
        this.state.toggleShow = !this.state.toggleShow;
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.threadLocalID
     */
    _onSelectThread(ev) {
        this.env.store.dispatch('openThread', {
            threadLocalID: ev.detail.threadLocalID,
        });
        this._reset();
    }
}

/**
 * Props validation
 */
SystrayMessagingMenu.props = {
    counter: {
        type: Number,
    },
    discussOpen: {
        type: Boolean,
    },
};

return connect(
    SystrayMessagingMenu,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {Object} getters
     * @return {Object}
     */
    (state, ownProps, getters) => {
        return {
            counter: getters.threadsGlobalUnreadCounter(),
            discussOpen: state.discuss.open,
        };
    },
    { deep: false }
);

});
