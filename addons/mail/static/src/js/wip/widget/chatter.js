odoo.define('mail.wip.widget.Chatter', function (require) {
'use strict';

const Activity = require('mail.Activity');
const Composer = require('mail.wip.widget.Composer');
const Followers = require('mail.Followers');
const Thread = require('mail.wip.widget.Thread');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {Object} ownProps.record
 * @return {Object}
 */
function mapStateToProps(state, ownProps) {
    const record = ownProps.record;
    const threadLID = `${record.model}_${record.res_id}`;
    const thread = state.threads[threadLID];
    return {
        record,
        thread,
        threadLID,
    };
}

class Chatter extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.state = { composerMode: 'send' };
        this.template = 'mail.wip.widget.Chatter';
        this.widgets = { Composer, Thread };

        this.fields = {};  // for Odoo widgets
        if (this.props.mailFields.mail_activity) {
            this.fields.activity = new Activity(
                this.props.parent,
                this.props.mailFields.mail_activity,
                this.props.record
            );
        }
        if (this.props.mailFields.mail_followers) {
            this.fields.followers = new Followers(
                this.props.parent,
                this.props.mailFields.mail_followers,
                this.props.record
            );
        }
    }

    async willStart() {
        const proms = _.invoke(this.fields, 'appendTo', $('<div>'));
        await Promise.all(proms);
    }

    mounted() {
        this.env.store.commit('thread/insert', {
            _model: this.props.record.model,
            _messageIds: this.props.record.data.message_ids.res_ids,
            id: this.props.record.res_id,
        });

        // append Odoo widgets for optionnal activities and followers
        if (this.fields.activity) {
            this.el.appendChild(this.fields.activity.$el[0]);
        }
        if (this.fields.followers) {
            this.el.querySelector('.o_chatter_topbar').appendChild(this.fields.followers.$el[0]);
        }

    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onClickSend() {
        this.state.composerMode = 'send';
    }

    /**
     * @private
     */
    _onClickLog() {
        this.state.composerMode = 'log';
    }

    /**
     * @private
     */
    _onClickScheduleActivity() {
        this.fields.activity.scheduleActivity();
    }
}

return connect(mapStateToProps, { deep: false })(Chatter);

});
