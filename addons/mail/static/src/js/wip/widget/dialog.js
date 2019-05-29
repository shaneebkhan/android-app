odoo.define('mail.wip.widget.Dialog', function (require) {
"use strict";

const { Component } = owl;

class Dialog extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.Dialog';
        this.widgets = { Component: this.props.Component };
        this._globalClickEventListener = ev => this._onClickGlobal(ev);
    }

    mounted() {
        document.addEventListener('click', this._globalClickEventListener);
    }

    /**
     * @param {Object} nextProps
     * @param {owl.Component} nextProps.Component
     */
    willUpdateProps(nextProps) {
        this.widgets.Component = nextProps.Component;
    }

    willUnmount() {
        document.removeEventListener('click', this._globalClickEventListener);
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickGlobal(ev) {
        if (ev.odooPrevented) { return; }
        if (ev.target.closest(`.o_dialog_component[data-dialog-id="${this.props.id}"]`)) {
            return;
        }
        if (!this.refs.component.isCloseable()) { return; }
        this.trigger('close', {
            id: this.props.id,
            originalEvent: ev,
        });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     */
    _onClose(ev) {
        if (ev.odooPrevented) { return; }
        ev.detail.id = this.props.id;
    }
}

/**
 * Props validation
 */
Dialog.props = {
    Component: {
        type: Component,
    },
    id: {
        type: String,
    },
    info: {
        type: Object,
    },
};

return Dialog;

});
