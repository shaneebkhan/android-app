odoo.define('mail.wip.widget.DialogManager', function (require) {
"use strict";

const Dialog = require('mail.wip.widget.Dialog');

const { Component, connect } = owl;

function mapStateToProps(state) {
    return {
        ...state.dialogManager,
    };
}

class DialogManager extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.DEBUG = true;
        // owl
        this.template = 'mail.wip.widget.DialogManager';
        this.widgets = { Dialog };
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
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this.env.store.commit('dialog/close', {
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

return connect(mapStateToProps, { deep: false })(DialogManager);

});
