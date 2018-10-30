odoo.define('web.SearchBarInput', function (require) {
"use strict";

var Widget = require('web.Widget');


var SearchBarInput = Widget.extend({
    template: 'SearchView.SearchBarInput',
    events: _.extend({}, Widget.prototype.events, {
        'keydown': '_onKeydown',
    }),
    _onKeydown: function (e) {
        switch (e.which) {
            case $.ui.keyCode.BACKSPACE:
                if (this.$el.val() === '') {
                    this.trigger_up('facet_removed');
                }
                break;
        }
    },
});

return SearchBarInput;

});
