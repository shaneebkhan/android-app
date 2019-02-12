odoo.define('mail.wip.widget.ThreadIcon', function (require) {
'use strict';

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {string} ownProps.threadLID
 * @param {Object} state.getters
 * @return {Object}
 */
function mapStateToProps(state, ownProps, getters) {
    const thread = state.threads[ownProps.threadLID];
    return {
        directPartner: state.partners[thread.directPartnerLID],
        name: getters['thread/name']({ threadLID: ownProps.threadLID }),
        thread,
    };
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

return connect(mapStateToProps, { deep: false })(ThreadIcon);

});
