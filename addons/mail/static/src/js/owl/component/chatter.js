odoo.define('mail.component.Chatter', function (require) {
'use strict';

const Activity = require('mail.Activity');
// TODO: we should probably use something like ChatterComposer here, which is
// a bit different from classic composer
const Followers = require('mail.Followers');
const Composer = require('mail.component.Composer');
const Thread = require('mail.component.Thread');

const { Component, connect } = owl;

class Chatter extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = { Composer, Thread };
        this.state = { composerMode: '' };
        this.template = 'mail.component.Chatter';

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
        if (!this.props.thread) {
            this.env.store.commit('insertThread', {
                _model: this.props.record.model,
                _messageIds: this.props.record.data.message_ids.res_ids,
                id: this.props.record.res_id,
            });
        }

        // append Odoo widgets for optionnal activities and followers
        if (this.fields.activity) {
            this.refs.activity.appendChild(this.fields.activity.$el[0]);
        }
        if (this.fields.followers) {
            this.refs.topbarRight.appendChild(this.fields.followers.$el[0]);
        }
    }

    patched() {
        if (!this.props.thread) {
            this.env.store.commit('insertThread', {
                _model: this.props.record.model,
                _messageIds: this.props.record.data.message_ids.res_ids,
                id: this.props.record.res_id,
            });
        }
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {Object}
     */
    get composerOptions() {
        return {
            chatter: true,
            isLog: this.state.composerMode === 'log',
            recordName: this.props.record.data.display_name,
        };
    }

    /**
     * @return {Object}
     */
    get threadOptions() {
        return {
            order: 'desc',
            showComposer: false,
        };
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onClickSend() {
        this.state.composerMode = 'send';

        // TODO: flicker (composer will be re-render when suggested are fetched)
        if (!this.props.suggestedRecipients) {
            this.env.store.dispatch('getSuggestedRecipientsOnThread', {
                threadLocalID: this.props.threadLocalID,
            });
        }
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

return connect(
    Chatter,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {Object} ownProps.record
     * @return {Object}
     */
    (state, ownProps) => {
        const record = ownProps.record;
        const threadLocalID = `${record.model}_${record.res_id}`;
        const thread = state.threads[threadLocalID];
        const suggestedRecipients = thread && thread.suggestedRecipients;
        return {
            record,
            threadLocalID,
            suggestedRecipients,
        };
    },
    { deep: false }
);

});
