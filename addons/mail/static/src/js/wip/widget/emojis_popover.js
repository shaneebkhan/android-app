odoo.define('mail.wip.widget.EmojisPopover', function (require) {
'use strict';

const emojis = require('mail.emojis');

const { Component } = owl;

class EmojisPopover extends Component {

    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.EmojisPopover';
    }

    get emojis() {
        return emojis;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onClickEmoji(ev) {
        this.trigger('selection', {
            source: ev.currentTarget.dataset.source
        });
    }
}

return EmojisPopover;

});
