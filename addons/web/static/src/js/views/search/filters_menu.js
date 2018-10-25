odoo.define('web.FiltersMenu', function (require) {
"use strict";

var core = require('web.core');
var DropdownMenu = require('web.DropdownMenu');

var _t = core._t;

var FiltersMenu = DropdownMenu.extend({

    init: function (parent, filters) {
        this._super(parent, filters);
        this.dropdownCategory = 'filter';
        this.dropdownTitle = _t('Filters');
        this.dropdownIcon = 'fa fa-filter';
        this.dropdownSymbol = this.isMobile ?
                                'fa fa-chevron-right float-right mt4' :
                                false;
        this.dropdownStyle.mainButton.class = 'o_filters_menu_button ' +
                                                this.dropdownStyle.mainButton.class;
    },
});

return FiltersMenu;

});