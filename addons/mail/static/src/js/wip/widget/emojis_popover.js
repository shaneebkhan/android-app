odoo.define('mail.wip.widget.EmojisPopover', function (require) {
'use strict';

const emojis = require('mail.emojis');

const { Component } = owl;

class EmojisPopover extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.EmojisPopover';
    }

    /**
     * @return {Object[]}
     */
    get emojis() {
        return emojis;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickEmoji(ev) {
        if (ev.odooPrevented) { return; }
        this.trigger('selection', ev, {
            source: ev.currentTarget.dataset.source
        });
    }
}

return EmojisPopover;

});
