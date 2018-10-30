odoo.define('web.SearchBarInput', function (require) {
"use strict";

var config = require('web.config');
var core = require('web.core');
var Domain = require('web.Domain');
var Widget = require('web.Widget');

var QWeb = core.qweb;
var _t = core._t;


var SearchBarInput = Widget.extend({
    template: 'SearchView.SearchBarInput',
    // events: {
    //     focus: function () { this.trigger('focused', this); },
    //     blur: function () { this.$el.val(''); this.trigger('blurred', this); },
    //     keydown: 'onKeydown',
    // },
    // onKeydown: function (e) {
    //     switch (e.which) {
    //         case $.ui.keyCode.BACKSPACE:
    //             if(this.$el.val() === '') {
    //                 var preceding = this.getParent().siblingSubview(this, -1);
    //                 if (preceding && (preceding instanceof FacetView)) {
    //                     preceding.model.destroy();
    //                 }
    //             }
    //             break;

    //         case $.ui.keyCode.LEFT: // Stop propagation to parent if not at beginning of input value
    //             if(this.el.selectionStart > 0) {
    //                 e.stopPropagation();
    //             }
    //             break;

    //         case $.ui.keyCode.RIGHT: // Stop propagation to parent if not at end of input value
    //             if(this.el.selectionStart < this.$el.val().length) {
    //                 e.stopPropagation();
    //             }
    //             break;
    //     }
    // }
});

return SearchBarInput;

});
