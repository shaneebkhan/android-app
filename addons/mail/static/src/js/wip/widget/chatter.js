odoo.define('mail.wip.widget.Chatter', function (require) {
'use strict';

const Composer = require('mail.wip.widget.Composer');
const Thread = require('mail.wip.widget.Thread');

function mapStateToProps(state, ownProps) {
    const record = ownProps.state;
    const threadLID = `${record.model}_${record.res_id}`;
    const thread = state.threads[threadLID];

    return {
        record,
        thread,
        threadLID,
    };
}

class Chatter extends owl.Component {

    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.Chatter';
        this.widgets = { Composer, Thread };
    }
    mounted() {
        this.env.store.commit('thread/insert', {
            _model: this.props.record.model,
            id: this.props.record.res_id,
            _messageIds: this.props.record.data.message_ids.res_ids,
        });

    }
    _onClickSend() {
        this.state.composerMode = 'send';
    }
    _onClickLog() {
        this.state.composerMode = 'log';
    }
}

return owl.connect(mapStateToProps, { deep: false })(Chatter);

});
