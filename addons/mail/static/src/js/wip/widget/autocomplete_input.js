odoo.define('mail.wip.widget.AutocompleteInput', function () {
'use strict';

const { Component } = owl;

class AutocompleteInput extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.AutocompleteInput';
    }

    mounted() {
        if (this.props.focusOnMount) {
            this.el.focus();
        }
        $(this.el).autocomplete({
            select: (ev, ui) => this._onAutocompleteSelect(ev, ui),
            source: (req, res) => this._onAutocompleteSource(req, res),
            focus: ev => this._onAutocompleteFocus(ev),
            html: this.props.html,
        });
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    focus() {
        this.el.focus();
    }

    focusout() {
        if (!this.el) {
            return;
        }
        this.el.blur();
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {FocusEvent} ev
     */
    _onAutocompleteFocus(ev) {
        if (this.props.focus) {
            this.props.focus(ev);
        } else {
            ev.preventDefault();
        }
    }

    /**
     * @private
     * @param {Event} ev
     * @param {Object} ui
     */
    _onAutocompleteSelect(ev, ui) {
        if (this.props.select) {
            this.props.select(ev, ui);
        }
    }

    /**
     * @private
     * @param {Object} req
     * @param {function} res
     */
    _onAutocompleteSource(req, res) {
        if (this.props.source) {
            this.props.source(req, res);
        }
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onBlur(ev) {
        // ev.stopPropagation(); // todo: replace with cleaner solution
        this.trigger('hide', { originalEvent: ev });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onKeydown(ev) {
        if (ev.key === 'Escape') {
            this.trigger('hide', { originalEvent: ev });
        }
    }
}

/**
 * Props validation
 */
AutocompleteInput.props = {
    focus: {
        type: Function,
        optional: true,
    },
    focusOnMount: {
        type: Boolean,
        default: false,
    },
    html: {
        type: Boolean,
        default: false,
    },
    select: {
        type: Function,
        optional: true,
    },
    source: {
        type: Function,
        optional: true,
    }
};

return AutocompleteInput;

});
