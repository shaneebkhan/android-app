odoo.define('hr.fields', function (require) {
    "use strict";

    var Widget = require('web.Widget');
    var basic_fields = require('web.basic_fields');
    var core = require('web.core');
    var registry = require('web.field_registry');
    var session = require('web.session');
    var field_utils = require('web.field_utils');

    require("website.content.zoomodoo");

    var qweb = core.qweb;
    var _lt = core._lt;

    var FieldImageWithZoom = basic_fields.FieldBinaryImage.extend({
        description: _lt("Image with zoom"),

        _render: function () {
            this._super();

            if (this.mode === 'readonly') {
                var url = session.url('/web/image', {
                    model: this.model,
                    id: JSON.stringify(this.res_id),
                    field: 'image',
                    unique: field_utils.format.datetime(this.recordData.__last_update).replace(/[^0-9]/g, ''),
                });

                var $img = this.$el.find('img');

                $img.attr('data-zoom', 1);
                $img.attr('data-zoom-image', url);

                $img.zoomOdoo({ event: 'mouseenter', attach: '.o_action_manager' });
            }
        }
    });

    var BackgroundImage = Widget.extend({
        tagName: 'span',

        init: function (parent, name, record, options) {
            this._super.apply(this, arguments);

            this.record = record;
            this.options = options || {};

            if('tag' in options.attrs)
                this.tagName = options.attrs['tag'];

            console.log('init');
        },
        start: function () {
            console.log('start');
            this._render();
        },
        _render: function() {
            if(this.options && 'class' in this.options.attrs)
                this.$el.addClass(this.options.attrs['class']);

            var url = session.url('/web/image', {
                model: this.record.model,
                id: JSON.stringify(this.record.res_id),
                field: 'image',
            });
            var url_thumb = session.url('/web/image', {
                model: this.record.model,
                id: JSON.stringify(this.record.res_id),
                field: 'image_medium',
            });

            this.$el.css('backgroundImage', 'url(' + url_thumb + ')');
            this.$el.attr('data-zoom', 1);
            this.$el.attr('data-zoom-image', url);

            this.$el.zoomOdoo({ event: 'mouseenter', attach: '.o_action_manager' });
        }
    });

    registry.add('image_zoom', FieldImageWithZoom);
    registry.add('bgimage', BackgroundImage);

    return {
        FieldImageWithZoom: FieldImageWithZoom,
        BackgroundImage: BackgroundImage
    }
});