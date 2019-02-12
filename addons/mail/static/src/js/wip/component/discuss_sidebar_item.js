odoo.define('mail.wip.component.DiscussSidebarItem', function (require) {
'use strict';

const EditableText = require('mail.wip.component.EditableText');
const Icon = require('mail.wip.component.ThreadIcon');

const Dialog = require('web.Dialog');

const { Component, connect } = owl;

class DiscussSidebarItem extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = { EditableText, Icon };
        this.id = "discuss_sidebar";
        this.state = { renaming: false };
        this.template = 'mail.wip.component.DiscussSidebarItem';
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
        this.state.renaming = false;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        this.trigger('clicked', {
            threadLocalID: this.props.threadLocalID,
        });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     */
    _onClickedEditableText(ev) {
        ev.stopPropagation();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickLeave(ev) {
        let prom;
        if (this.props.thread.create_uid === this.env.session.uid) {
            prom = this._askAdminConfirmation();
        } else {
            prom = Promise.resolve();
        }
        return prom.then(() =>
            this.env.store.dispatch('unsubscribeFromChannel', {
                threadLocalID: this.props.threadLocalID,
            }));
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickRename(ev) {
        this.state.renaming = true;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickSettings(ev) {
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
        return this.env.store.dispatch('unsubscribeFromChannel', {
            threadLocalID: this.props.threadLocalID,
        });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.newName
     */
    _onRename(ev) {
        this.state.renaming = false;
        this.env.store.dispatch('renameThread', {
            name: ev.detail.newName,
            threadLocalID: this.props.threadLocalID,
        });
    }
}

/**
 * Props validation
 */
DiscussSidebarItem.props = {
    directPartner: {
        type: Object, // {mail.wip.model.Partner}
        optional: true,
    },
    isActive: {
        type: Boolean,
        default: false,
    },
    thread: {
        type: Object, // {mail.wip.model.Thread}
    },
    threadLocalID: {
        type: String,
    },
    threadName: {
        type: String,
    },
};

return connect(
    DiscussSidebarItem,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.threadLocalID
     * @param {Object} state.getters
     * @return {Object}
     */
    (state, ownProps, getters) => {
        const thread = state.threads[ownProps.threadLocalID];
        const directPartner = thread.directPartnerLocalID
            ? state.partners[thread.directPartnerLocalID]
            : undefined;
        return {
            directPartner,
            thread,
            threadName: getters.threadName({ threadLocalID: ownProps.threadLocalID }),
        };
    },
    { deep: false }
);

});
