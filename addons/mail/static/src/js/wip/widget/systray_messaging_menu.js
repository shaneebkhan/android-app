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
        this.state = {
            filter: 'all',
            toggleShow: false,
        };
        this.template = 'mail.wip.widget.SystrayMessagingMenu';
        this.widgets = { ThreadPreviewList };
        this._id = _.uniqueId('systray_messaging_menu');

        if (this.DEBUG) {
            window.systray_messaging_menu = this;
        }
    }

    mounted() {
        $(document).on(`click.${this._id}`, ev => this._onDocumentClick(ev));
    }

    willUnmount() {
        $(document).off(`click.${this._id}`);
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
    _onClickFilter(ev) {
        this.state.filter = ev.currentTarget.dataset.filter;
    }

    /**
     * @private
     */
    _onClickNewMessage() {
        this.env.store.commit('chat_window_manager/open_new_message');
        this._reset();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickToggleShow(ev) {
        ev.preventDefault(); // no redirect href
        ev.stopPropagation(); // no bootstrap click handler
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
        if (ev.target.closest('.o_mail_wip_systray_messaging_menu')) {
            return;
        }
        this._reset();
    }

    /**
     * @private
     * @param {Object} param0
     * @param {string} param0.threadLID
     */
    _onSelectThread({ threadLID }) {
        this.env.store.dispatch('thread/open', { threadLID });
        this._reset();
    }
}

return connect(mapStateToProps)(SystrayMessagingMenu);

});
