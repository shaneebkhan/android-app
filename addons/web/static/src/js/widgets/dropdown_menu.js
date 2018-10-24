odoo.define('web.DropdownMenu', function (require) {
"use strict";

var core = require('web.core');
var Widget = require('web.Widget');

var QWeb = core.qweb;

var DropdownMenu = Widget.extend({
    template: 'web.DropdownMenu',

    events: {
        'click .o_menu_item': '_onItemClick',
    },

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

    update: function (items) {
        this.items = items;
        this._renderMenuItems();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _renderMenuItems: function () {
        var newMenuItems = QWeb.render('DropdownMenu.MenuItems', {widget: this});
        this.$el.find('.o_menu_item, .dropdown-divider[data-removable="1"]').remove();
        this.$('.o_dropdown_menu').prepend(newMenuItems);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} event
     */
    _onItemClick: function (event) {
        event.preventDefault();
        event.stopPropagation();
        const id = $(event.currentTarget).data('id');
        this.trigger_up('menu_item_clicked', {id: id});
    },


});

return DropdownMenu;

});