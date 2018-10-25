odoo.define('web.FiltersMenu', function (require) {
"use strict";

var core = require('web.core');
var DropdownMenu = require('web.DropdownMenu');

var _t = core._t;

var FiltersMenu = DropdownMenu.extend({

    init: function (parent, filters) {
    	// this.category = ..., ... plus propre
    	var dropdownHeader = {
            category: 'filterCategory',
            title: _t('Filters'),
            icon: 'fa fa-filter',
            symbol: this.isMobile ? 'fa fa-chevron-right float-right mt4' : false,
        };
        this._super(parent, dropdownHeader, filters);
    },
});

return FiltersMenu;

});