odoo.define('mail.component.EmojisPopover', function (require) {
'use strict';

const emojis = require('mail.emojis');

const { Component } = owl;

class EmojisPopover extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.component.EmojisPopover';
        this.emojis = emojis;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickEmoji(ev) {
        this.trigger('selection', {
            unicode: ev.currentTarget.dataset.unicode,
        });
    }
}

return EmojisPopover;

});
