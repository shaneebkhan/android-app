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
     * @param  {...any} args
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

        if (this.DEBUG) {
            window.systray_messaging_menu = this;
        }
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
     * @param {MouseEvent} ev
     */
    _onClickToggleShow(ev) {
        ev.preventDefault(); // no redirect href
        ev.stopPropagation(); // no bootstrap click handler
        this.state.toggleShow = !this.state.toggleShow;
    }
}

return connect(mapStateToProps)(SystrayMessagingMenu);

});
