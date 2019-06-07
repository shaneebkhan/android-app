odoo.define ('rating.rating', function (require) {
'use strict';

var publicWidget = require('web.public.widget');

/**
 * Rating
 *
 * widget for rating, allow to change the rating at time of feedback.
 */
publicWidget.registry.rating = publicWidget.Widget.extend({
    selector: '.o_rating_rating',
    events: {
        'click .o_rating': '_onClickSmiley',
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} event
     */
    _onClickSmiley: function (ev) {
        ev.preventDefault();
        var $target = $(ev.currentTarget);
        this.$el.find('img.o_rating_smily').removeClass('o_rating_active');
        $target.find('img.o_rating_smily').addClass('o_rating_active');
        this.$el.find("input[name='rate']").val($target.data('rate'));
    },
});
});
