odoo.define('mail.wip.widget.AutoresizeInput', function () {
'use strict';

const { Component } = owl;

class AutoresizeInput extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.AutoresizeInput';
        this._scrollable = false;
    }

    mounted() {
        this.el.setAttribute('rows', this.options.rows);
        this._compute();
    }

    //--------------------------------------------------------------------------
    // Getter / Setter
    //--------------------------------------------------------------------------

    /**
     * @return {Object}
     */
    get options() {
        let options = { ...this.props.options };
        if (!('rows' in options)) {
            options.rows = 1;
        }
        if (!('maxHeight' in options)) {
            options.maxHeight = 200;
        }
        return options;
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

    /**
     * @return {string}
     */
    getValue() {
        return this.el.value;
    }

    /**
     * @param {string} content
     */
    insert(content) {
        const start = this.el.selectionStart;
        const end = this.el.selectionEnd;
        const left = this.el.value.substring(0, start);
        const right = this.el.value.substring(end);
        const newValue = `${left}${content}${right}`;
        const newSelection = newValue.length - right.length;
        this.el.value = newValue;
        this.focus();
        this.el.setSelectionRange(newSelection, newSelection);
    }

    resetValue() {
        this.el.value = '';
        this._compute();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _compute() {
        let prevScrollTop;
        if (this._scrollable) {
            prevScrollTop = this.el.scrollTop;
        }
        this.el.style['overflow-y'] = 'hidden';
        this.el.style['height'] = 'auto';
        this.el.style['height'] = `${this.el.scrollHeight}px`;
        this.el.style['resize'] = 'none';
        if (this.el.scrollHeight > this.options.maxHeight) {
            this.el.style['height'] = `${this.options.maxHeight}px`;
            this.el.style['overflow-y'] = 'auto';
            if (prevScrollTop && this.el.scrollTop !== prevScrollTop) {
                this.el.scrollTop = prevScrollTop;
            }
            this._scrollable = true;
        } else {
            this.el.style['overflow-y'] = 'hidden';
            this._scrollable = false;
        }
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onInput() {
        this._compute();
    }
}

/**
 * Props validation
 */
AutoresizeInput.props = {
    options: {
        type: Object,
        default: {},
        shape: {
            maxHeight: {
                type: Number,
                default: 200,
            },
            rows: {
                type: Number,
                default: 1,
            }
        },
    }
};

return AutoresizeInput;

});
