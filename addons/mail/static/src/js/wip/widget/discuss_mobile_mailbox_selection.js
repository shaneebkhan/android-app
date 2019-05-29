odoo.define('mail.wip.widget.DiscussMobileMailboxSelection', function (require) {
'use strict';

const Thread = require('mail.wip.model.Thread');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {Object} getters
 * @return {Object}
 */
function mapStateToProps(state, ownProps, getters) {
    return {
        mailboxes: getters['threads/mailbox'](),
    };
}

class MobileMailboxSelection extends Component {
    /**
     * @param  {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.DiscussMobileMailboxSelection';
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {mail.wip.model.Thread} mailbox
     * @return {boolean}
     */
    active(mailbox) {
        return this.props.threadLID === mailbox.lid;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        if (ev.odooPrevented) { return; }
        this.trigger('select-thread', ev, {
            threadLID: ev.currentTarget.dataset.mailboxLid,
        });
    }
}

/**
 * Props validation
 */
MobileMailboxSelection.props = {
    mailboxes: {
        type: Array,
        element: Thread,
    },
    threadLID: {
        type: String,
        optional: true,
    },
};

return connect(mapStateToProps, { deep: false })(MobileMailboxSelection);

});
