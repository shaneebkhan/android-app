odoo.define('mrp.mrp_slide', function (require) {
"use strict";

var field_registry = require('web.field_registry');
var FieldChar = require('web.basic_fields').FieldChar;


var SlideViewer = FieldChar.extend({

    /**
     * force to set src for iframe when its value has changed
     *
     * @override
     */
    reset: function () {
        var self = this;
        return $.when(this._super.apply(this, arguments)).then(function () {
            var $iframe = self.$el.find('iframe.o_slideview_iframe');
            if ($iframe.length) {
                self._getEmbedURL(self.value);
                if (self.src && $iframe.attr('src') !== self.src) {
                    $iframe.removeClass('o_hidden');
                } else {
                    $iframe.addClass('o_hidden');
                }
                $iframe.attr('src', self.src);
            }
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     *
     * @private
     */
    _getEmbedURL: function (value) {
        var src = false;
        if (value) {
            var googleRegExp = /(^https:\/\/docs.google.com).*(\/d\/e\/|\/d\/)([A-Za-z0-9-_]+)/;
            var google = value.match(googleRegExp);
            if (google && google[3]) {
                src = 'https://docs.google.com/presentation' + google[2] + google[3] + '/preview';
            }
        }
        this.src = src || value || this.value;
    },

    /**
     * append iframe for embed view
     *
     * @override
     * @private
     */
    _render: function ()  {
        this._super.apply(this, arguments);
        this._getEmbedURL(this.value);
        this.mode === 'readonly' ? this.$el.hide() : this.$el.show();
        this.setElement(this.$el.wrap('<div class="o_slide_viewer"/>').parent());
        this.$el.append($('<iframe>', {
            src: this.src || 'about:blank',
            class: this.src ? 'o_slideview_iframe' : 'o_slideview_iframe o_hidden',
            width: '100%',
            height: '30rem',
            css: {
                border: '0',
            },
            allowfullscreen: true,
        }));
    },
});
field_registry.add('slide_viewer', SlideViewer);
return SlideViewer;
});
