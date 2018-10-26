odoo.define('web.FiltersMenu', function (require) {
"use strict";

var core = require('web.core');
var Domain = require('web.Domain');
var DropdownMenu = require('web.DropdownMenu');
var time = require('web.time');


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

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * override
     *
     * @private
     */
    _renderMenuItems: function () {
        var self= this;
        this._super.apply(this, arguments);
        // the following code adds tooltip on date options in order
        // to alert the user of the meaning of intervals
        var $options = this.$('.o_item_option');
        $options.each(function () {
            var $option = $(this);
            $option.tooltip({
                delay: { show: 500, hide: 0 },
                title: function () {
                    var itemId = $option.attr('data-item_id');
                    var optionId = $option.attr('data-option_id');
                    var fieldName = _.findWhere(self.items, {id: itemId}).fieldName;
                    var domain = Domain.prototype.constructDomain(fieldName, optionId, 'date', true);
                    var evaluatedDomain = Domain.prototype.stringToArray(domain);
                    var dateFormat = time.getLangDateFormat();
                    var dateStart = moment(evaluatedDomain[1][2], "YYYY-MM-DD", 'en').format(dateFormat);
                    var dateEnd = moment(evaluatedDomain[2][2], "YYYY-MM-DD", 'en').format(dateFormat);
                    if (optionId === 'today' || optionId === 'yesterday') {
                        return dateStart;
                    }
                    return _.str.sprintf(_t('From %s To %s'), dateStart, dateEnd);
                }
            });
        });
    },
});

return FiltersMenu;

});