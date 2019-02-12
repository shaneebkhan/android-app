odoo.define('mail.wip.widget.Composer', function (require) {
'use strict';

const AutoresizeInput = require('mail.wip.widget.AutoresizeInput');
const EmojisButton = require('mail.wip.widget.EmojisButton');

const { Component } = owl;

class Composer extends Component {

    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.Composer';
        this.widgets = { AutoresizeInput, EmojisButton };
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {Object}
     */
    get inputOptions() {
        return {
            minHeight: 30,
        };
    }

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
        if (!('displayAvatar' in options)) {
            options.displayAvatar = true;
        }
        if (!('displaySendButton' in options)) {
            options.displaySendButton = true;
        }
        return options;
    }

    /**
     * @return {string}
     */
    get userAvatar() {
        const avatar =
            this.env.session.uid > 0
                ? this.env.session.url('/web/image', {
                      model: 'res.users',
                      field: 'image_small',
                      id: this.env.session.uid
                  })
                : '/web/static/src/img/user_menu_avatar.png';
        return avatar;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _postMessage() {
        this.env.store.dispatch('thread/post_message', {
            data: { content: this.refs.input.value },
            threadLID: this.props.threadLID,
        });
        this.refs.input.resetValue();
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onClickAddAttachment() {}

    /**
     * @private
     */
    _onClickSend() {
        if (!this.refs.input.value) {
            return;
        }
        this._postMessage();
    }

    /**
     * @private
     * @param {Object} param0
     * @param {string} param0.source
     */
    _onEmojiSelection({ source }) {
        const input = this.refs.input;
        const cursorPosition = input.getSelectionRange(input);
        const leftSubstring = input.value.substring(0, cursorPosition.start);
        const rightSubstring = input.value.substring(cursorPosition.end);
        const newValue = [leftSubstring, source, rightSubstring].join(" ");
        const newCursorPosition = newValue.length - rightSubstring.length;
        input.setValue(newValue);
        input.focus();
        input.setSelectionRange(newCursorPosition, newCursorPosition);
    }

    /**
     * @private
     * @param {KeyboardEvent} ev
     */
    _onInputKeydown(ev) {
        if (ev.which === $.ui.keyCode.ENTER) {
            if (!this.refs.input.value) {
                return;
            }
            this._postMessage();
            ev.preventDefault();
        }
    }
}

return Composer;
});
