odoo.define('website_sale.multirange_price_selector', function (require) {
'use strict';

    var publicWidget = require('web.public.widget');

    publicWidget.registry.testError = publicWidget.Widget.extend({
    selector: '#o_shop_price_range',
    events: {
        'oldRangeValue input[type="range"]': '_onInputFocus',
        'newRangeValue input[type="range"]': '_onPriceRangeSelected',
    },
    //----------------------------------------------------------------------
    // Handlers
    //----------------------------------------------------------------------

    /**
     * Apply the new range
     * @private
     * @param {Event} ev
     * @returns {Promise}
     */
    _onPriceRangeSelected: function (ev) {
        var range = ev.currentTarget;
        var minPrice = range.valueLow;
        var maxPrice = range.valueHigh;
        if (minPrice !== this._previousMinPrice || maxPrice !== this._previousMaxPrice) {
            var params = $.deparam(window.location.search.substring(1));
            params['min_price'] = minPrice;
            params['max_price'] = maxPrice;
            window.location.href = window.location.origin + window.location.pathname + '?' + $.param(params);
        }
    },
    /**
     * Save the old range
     * @private
     * @param {Event} ev
     * @returns {Promise}
     */
    _onInputFocus: function (ev) {
        var range = ev.currentTarget;
        this._previousMinPrice = range.valueLow;
        this._previousMaxPrice = range.valueHigh;
    },
});
});
