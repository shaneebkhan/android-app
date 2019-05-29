odoo.define('mail.wip.widget.ThreadIcon', function (require) {
'use strict';

const Partner = require('mail.wip.model.Partner');
const Thread = require('mail.wip.model.Thread');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {string} ownProps.threadLID
 * @return {Object}
 */
function mapStateToProps(state, ownProps) {
    const thread = state.threads[ownProps.threadLID];
    let res = { thread };
    if (thread.directPartnerLID) {
        Object.assign(res, {
            directPartner: state.partners[thread.directPartnerLID],
        });
    }
    return res;
}

class ThreadIcon extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.ThreadIcon';
    }
}

/**
 * Props validation
 */
ThreadIcon.props = {
    directPartner: {
        type: Partner,
        optional: true,
    },
    thread: {
        type: Thread,
    },
    threadLID: {
        type: String,
    },
};

return connect(mapStateToProps, { deep: false })(ThreadIcon);

});
