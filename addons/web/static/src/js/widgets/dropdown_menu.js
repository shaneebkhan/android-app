odoo.define('web.DropdownMenu', function (require) {
"use strict";

var Widget = require('web.Widget');

var DropdownMenu = Widget.extend({
    template: 'web.DropdownMenu',

    init: function (parent, dropdownHeader, items) {
        this._super(parent);
        this.dropdownCategory = dropdownHeader.category;
        this.dropdownTitle = dropdownHeader.title;
        this.dropdownIcon = dropdownHeader.icon;
        this.dropdownSymbol = dropdownHeader.symbol || false;
        // this parameter fixes the menu style. By default,
        // the style used is the one used in the search view
        this.dropdownStyle = dropdownHeader.style || {
                el: {class: 'btn-group o_dropdown', attrs: {}},
                mainButton: {class: 'o_filters_menu_button o_dropdown_toggler_btn btn btn-secondary dropdown-toggle' + (this.dropdownSymbol ? ' o-no-caret' : '')},
            };
        this.items = items;
    },


    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------


    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------


    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

});

return DropdownMenu;

});