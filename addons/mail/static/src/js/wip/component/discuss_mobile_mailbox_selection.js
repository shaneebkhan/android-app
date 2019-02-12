odoo.define('mail.wip.component.DiscussMobileMailboxSelection', function (require) {
'use strict';

const { Component, connect } = owl;

class MobileMailboxSelection extends Component {
    /**
     * @param  {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.component.DiscussMobileMailboxSelection';
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {mail.wip.model.Thread} mailbox
     * @return {boolean}
     */
    active(mailbox) {
        return this.props.threadLocal === mailbox.localID;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        this.trigger('select-thread', ev, {
            threadLocalID: ev.currentTarget.dataset.mailboxLocalId,
        });
    }
}

/**
 * Props validation
 */
MobileMailboxSelection.props = {
    mailboxes: {
        type: Array,
        element: Object, // {mail.wip.model.Thread}
    },
    threadLocalID: {
        type: String,
        optional: true,
    },
};

return connect(
    MobileMailboxSelection,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {Object} getters
     * @return {Object}
     */
    (state, ownProps, getters) => {
        return {
            mailboxes: getters.threadMailboxes(),
        };
    },
    { deep: false }
);

});
