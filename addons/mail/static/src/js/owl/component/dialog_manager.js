odoo.define('mail.component.DialogManager', function (require) {
"use strict";

const Dialog = require('mail.component.Dialog');

const { Component, connect } = owl;

class DialogManager extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.DEBUG = true;
        // owl
        this.components = { Dialog };
        this.template = 'mail.component.DialogManager';
        if (this.DEBUG) {
            window.dialog_manager = this;
        }
    }

    mounted() {
        this._checkDialogOpen();
    }

    patched() {
        this._checkDialogOpen();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _checkDialogOpen() {
        if (this.props.dialogs.length > 0) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.id
     */
    _onCloseDialog(ev) {
        this.env.store.commit('closeDialog', {
            id: ev.detail.id,
        });
    }
}

/**
 * Props validation
 */
DialogManager.props = {
    dialogs: {
        type: Array,
        element: {
            Component: {
                type: Component,
            },
            id: {
                type: String,
            },
            info: {
                type: Object,
            },
        },
    },
};

return connect(
    DialogManager,
    /**
     * @param {Object} state
     * @return {Object}
     */
    state => {
        return {
            ...state.dialogManager,
        };
    },
    { deep: false }
);

});
