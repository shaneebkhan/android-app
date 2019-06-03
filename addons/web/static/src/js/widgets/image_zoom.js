odoo.define('web.ImageZoom', function (require) {
    "use strict";

    var Widget = require('web.Widget');
    var basic_fields = require('web.basic_fields');
    var core = require('web.core');
    var registry = require('web.field_registry');
    var session = require('web.session');
    var field_utils = require('web.field_utils');

    require("web.zoomodoo");

    var qweb = core.qweb;
    var _lt = core._lt;

    function getImageUrl(model, res_id, field) {
        return session.url('/web/image', {
            model: model,
            id: JSON.stringify(res_id),
            field: field,
        });
    }

    var FieldImageWithZoom = basic_fields.FieldBinaryImage.extend({
        description: _lt("Image with zoom"),

        _render: function () {
            this._super();

            if (this.mode === 'readonly') {
                var url = getImageUrl(this.model, this.res_id, 'image');

                var $img = this.$el.find('img');
                $img.attr('data-zoom', 1);
                $img.attr('data-zoom-image', url);

                $img.zoomOdoo({ event: 'mouseenter', attach: '.o_content', attachToTarget: true});
            }
        }
    });

    var BackgroundImage = Widget.extend({
        tagName: 'div',

        init: function (parent, name, record, options) {
            this._super.apply(this, arguments);
            this.record = record;
            this.options = options || {};
            this.attrs = this.options.attrs || {};

            if('tag' in this.attrs.options)
                this.tagName = this.attrs.options['tag'];
        },
        start: function () {
            this._render();
        },
        _render: function() {
            if('class' in this.attrs.options)
                this.$el.addClass(this.attrs.options['class']);

            var url = getImageUrl(this.record.model, this.record.res_id, 'image');
            var url_thumb = getImageUrl(this.record.model, this.record.res_id, 'image_medium');

            this.$el.css('backgroundImage', 'url(' + url_thumb + ')');
            this.$el.attr('data-zoom', 1);
            this.$el.attr('data-zoom-image', url);
            
            this.$el.zoomOdoo({ event: 'mouseenter', attach: '.o_content', preventClicks: this.attrs.options.preventClicks, attachToTarget: true });
        }
    });

    registry.add('image_zoom', FieldImageWithZoom);
    registry.add('image_zoom_bg', BackgroundImage);

    return {
        FieldImageWithZoom: FieldImageWithZoom,
        BackgroundImage: BackgroundImage
    }
});