odoo.define('mail.wip.widget.EditableText', function () {
'use strict';

const { Component } = owl;

class EditableText extends Component {

    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.EditableText';
    }

    mounted() {
        this.el.focus();
        this.el.setSelectionRange(
            0,
            (this.el.value && this.el.value.length) || 0
        );
    }

    willUnmount() {
        this.trigger('cancel');
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onBlur() {
        this.trigger('cancel');
    }

    _onClick(ev) {
        ev.stopPropagation();
    }

    _onKeydown(ev) {
        switch (ev.key) {
            case 'Enter':
                this._onKeydownEnter(ev);
                break;
            case 'Escape':
                this.trigger('cancel');
                break;
        }
    }

    _onKeydownEnter() {
        const value = this.el.value;
        const newName = value || this.props.placeholder;
        if (this.props.value !== newName) {
            this.trigger('validate', { newName: newName });
        } else {
            this.trigger('cancel');
        }
    }
}

return EditableText;

});
