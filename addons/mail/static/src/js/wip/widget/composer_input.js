odoo.define('mail.wip.widget.ComposerInput', function (require) {
'use strict';

var ajax = require('web.ajax');

const { Component } = owl;

class ComposerInput extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.ComposerInput';
        this._$editable = undefined;
        this._$textarea = undefined;
        this._summernote = undefined;
    }

    willStart() {
        return ajax.loadLibs({
            jsLibs: ['/web_editor/static/lib/summernote/summernote.js'],
            cssLibs: ['/web_editor/static/lib/summernote/summernote.css'],
        });
    }

    mounted() {
        this._$textarea = $(this.refs.textarea);
        this._$textarea.summernote({
            callbacks: {
                onPaste(ev) {
                    const bufferText = ((ev.originalEvent || ev).clipboardData ||
                        window.clipboardData).getData('Text');
                    ev.preventDefault();
                    document.execCommand('insertText', false, bufferText);
                },
            },
            disableDragAndDrop: true,
            disableResizeEditor: true,
            // hint: {
            //     mentions: ['jayden', 'sam', 'alvin', 'david'],
            //     match: /@(\w*)$/,
            //     search(keyword, callback) {
            //         callback(this.mentions.filter(item =>
            //             item.indexOf(keyword) === 0));
            //       },
            //       content(item) {
            //         return `@${item}`;
            //       },
            // },
            // hintDirection: 'top',
            placeholder: this.env._t("Write something..."),
            shortcuts: false,
            toolbar: false,
        });
        this._summernote = this._$textarea.data('summernote');
        this._$editable = $(this.el).find('> .note-editor > .note-editing-area > .note-editable');
        this._$editable.html(''); // remove initial <p></br></p>
        this._$editable.on('blur', ev => this._onBlur(ev));
        this._$editable.on('keydown', ev => this._onKeydown(ev));
        this._$editable.on('input', ev => this._onInput(ev));
    }

    willUnmount() {
        this._summernote.destroy();
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    focus() {
        this._$editable.focus();
    }

    focusout() {
        this._$editable.blur();
    }

    /**
     * @return {string}
     */
    getValue() {
        return this._$editable.html();
    }

    /**
     * @param {string} content
     */
    insert(content) {
        this._summernote.invoke('editor.restoreRange');
        this._summernote.invoke('editor.insertText', content);
    }

    resetValue() {
        this._$editable.html("");
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {jQuery.Event} ev
     */
    _onBlur(ev) {
        this._summernote.invoke('editor.saveRange');
    }

    /**
     * @private
     * @param {jQuery.Event} ev
     */
    _onKeydown(ev) {
        if (ev.key === 'Enter' && !ev.shiftKey) {
            if (!this.refs.input.getValue()) {
                return;
            }
            this.trigger('post-message', { originalEvent: ev });
            ev.preventDefault();
        }
    }

    /**
     * @private
     * @param {jQuery.Event} ev
     */
    _onInput(ev) {
        if (this._$editable.text().length === 0) {
            this._$editable.html("");
        }
    }
}

/**
 * Props validation
 */
ComposerInput.props = {
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

return ComposerInput;

});
