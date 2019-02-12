odoo.define('mail.wip.component.ThreadIcon', function (require) {
'use strict';

const { Component, connect } = owl;

class ThreadIcon extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.component.ThreadIcon';
    }
}

/**
 * Props validation
 */
ThreadIcon.props = {
    directPartner: {
        type: Object, // {mail.wip.model.Partner}
        optional: true,
    },
    thread: {
        type: Object, // {mail.wip.model.Thread}
    },
    threadLocalID: {
        type: String,
    },
};

return connect(
    ThreadIcon,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.threadLocalID
     * @return {Object}
     */
    (state, ownProps) => {
        const thread = state.threads[ownProps.threadLocalID];
        const directPartner = thread
            ? state.partners[thread.directPartnerLocalID]
            : undefined;
        return {
            directPartner,
            thread,
        };
    },
    { deep: false }
);

});
