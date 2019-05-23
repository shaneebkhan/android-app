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
        let options;
        if (this.props.options) {
            options = { ...this.props.options };
        } else {
            options = {};
        }
        if (!('rows' in options)) {
            options.rows = 1;
        }
        if (!('maxHeight' in options)) {
            options.maxHeight = 200;
        }
        return options;
    }

    /**
     * @return {string}
     */
    get value() {
        return this.el.value;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    focus() {
        this.el.focus();
    }

    /**
     * @return {Object}
     */
    getSelectionRange() {
        return {
            start: this.el.selectionStart,
            end: this.el.selectionEnd,
        };
    }

    resetValue() {
        this.el.value = '';
    }

    /**
     * @param {integer} start
     * @param {integer} end
     */
    setSelectionRange(start, end) {
        this.el.setSelectionRange(start, end);
    }

    /**
     * @param {string} newValue
     */
    setValue(newValue) {
        this.el.value = newValue;
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
     * @param {FocusEvent} ev
     */
    _onFocus(ev) {
        this.trigger('focus', ev);
    }

    /**
     * @private
     * @param {InputEvent} ev
     */
    _onInput(ev) {
        this._compute();
        this.trigger('input', ev);
    }
    /**
     * @private
     * @param {KeyboardEvent} ev
     */
    _onKeydown(ev) {
        this.trigger('keydown', ev);
    }
}

return AutoresizeInput;

});
