odoo.define('mail.wip.widget.EditableText', function () {
'use strict';

const { Component } = owl;

class EditableText extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.EditableText';
    }

    mounted() {
        this.el.focus();
        this.el.setSelectionRange(0, (this.el.value && this.el.value.length) || 0);
    }

    willUnmount() {
        this.trigger('cancel');
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onBlur(ev) {
        this.trigger('cancel', { originalEvent: ev });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        this.trigger('clicked', { originalEvent: ev });
    }

    /**
     * @private
     * @param {KeyboardEvent} ev
     */
    _onKeydown(ev) {
        switch (ev.key) {
            case 'Enter':
                this._onKeydownEnter(ev);
                break;
            case 'Escape':
                this.trigger('cancel', { originalEvent: ev });
                break;
        }
    }

    /**
     * @private
     * @param {KeyboardEvent} ev
     */
    _onKeydownEnter(ev) {
        const value = this.el.value;
        const newName = value || this.props.placeholder;
        if (this.props.value !== newName) {
            this.trigger('validate', {
                newName: newName,
                originalEvent: ev,
            });
        } else {
            this.trigger('cancel', { originalEvent: ev });
        }
    }
}

/**
 * Props validation
 */
EditableText.props = {
    placeholder: {
        type: String,
        default: '',
    },
    value: {
        type: String,
        default: '',
    },
};

return EditableText;

});
