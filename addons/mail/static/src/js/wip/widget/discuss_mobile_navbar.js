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
     * @param {string} tab
     */
    _onClick(tab) {
        this.trigger('select', { tab });
    }
}

return MobileNavbar;

});
