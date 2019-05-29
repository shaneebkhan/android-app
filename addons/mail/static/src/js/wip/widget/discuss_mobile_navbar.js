odoo.define('mail.wip.widget.DiscussMobileNavbar', function (require) {
'use strict';

const { Component } = owl;

class MobileNavbar extends Component {
    /**
     * @param  {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.DiscussMobileNavbar';
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {string}
     */
    get active() {
        return this.props.active;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        if (ev.odooPrevented) { return; }
        this.trigger('select', ev, { tab: ev.currentTarget.dataset.tab });
    }
}

/**
 * Props validation
 */
MobileNavbar.props = {
    active: {
        type: Boolean,
    },
};

return MobileNavbar;

});
