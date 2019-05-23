odoo.define('mail.wip.widget.DiscussSidebarItem', function (require) {
'use strict';

const EditableText = require('mail.wip.widget.EditableText');
const Icon = require('mail.wip.widget.ThreadIcon');

const Dialog = require('web.Dialog');

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

class DiscussSidebarItem extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.id = "discuss_sidebar";
        this.template = 'mail.wip.widget.DiscussSidebarItem';
        this.state = { renaming: false };
        this.widgets = { EditableText, Icon };
    }

    /**
     * @return {integer}
     */
    get counter() {
        if (this.props.thread._model === 'mail.box') {
            return this.props.thread.counter;
        } else if (this.props.thread.channel_type === 'channel') {
            return this.props.thread.message_needaction_counter;
        } else if (this.props.thread.channel_type === 'chat') {
            return this.props.thread.message_unread_counter;
        }
        return 0;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @return {Promise}
     */
    _askAdminConfirmation() {
        return new Promise(resolve => {
            Dialog.confirm(
                this,
                this.env._t("You are the administrator of this channel. Are you sure you want to leave?"),
                {
                    buttons: [
                        {
                            text: this.env._t("Leave"),
                            classes: 'btn-primary',
                            close: true,
                            click: resolve
                        },
                        {
                            text: this.env._t("Discard"),
                            close: true
                        }
                    ]
                }
            );
        });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev
     */
    _onCancelRenaming(ev) {
        if (ev.odooPrevented) { return; }
        this.state.renaming = false;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        if (ev.odooPrevented) { return; }
        this.trigger('click', ev, { threadLID: this.props.threadLID });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickEditableText(ev) {
        if (ev.odooPrevented) { return; }
        ev.odooPrevented = true;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickLeave(ev) {
        if (ev.odooPrevented) {
            return;
        }
        ev.odooPrevented = true;
        let prom;
        if (this.props.thread.create_uid === this.env.session.uid) {
            prom = this._askAdminConfirmation();
        } else {
            prom = Promise.resolve();
        }
        return prom.then(() =>
            this.env.store.dispatch('channel/unsubscribe', {
                threadLID: this.props.threadLID,
            }));
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickRename(ev) {
        if (ev.odooPrevented) { return; }
        ev.odooPrevented = true;
        this.state.renaming = true;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickSettings(ev) {
        if (ev.odooPrevented) { return; }
        ev.odooPrevented = true;
        return this.env.do_action({
            type: 'ir.actions.act_window',
            res_model: this.props.thread._model,
            res_id: this.props.thread.id,
            views: [[false, 'form']],
            target: 'current'
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickUnpin(ev) {
        if (ev.odooPrevented) { return; }
        ev.odooPrevented = true;
        return this.env.store.dispatch('channel/unsubscribe', {
            threadLID: this.props.threadLID,
        });
    }

    /**
     * @private
     * @param {KeyboardEvent} ev
     * @param {Object} param1
     * @param {string} param1.newName
     */
    _onRename(ev, { newName }) {
        if (ev.odooPrevented) { return; }
        ev.odooPrevented = true;
        this.state.renaming = false;
        this.env.store.dispatch('thread/rename', {
            name: newName,
            threadLID: this.props.threadLID,
        });
    }
}

return connect(mapStateToProps, { deep: false })(DiscussSidebarItem);

});
