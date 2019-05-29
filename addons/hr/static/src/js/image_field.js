odoo.define('hr.fields', function (require) {
    "use strict";

    var basic_fields = require('web.basic_fields');
    var core = require('web.core');
    var registry = require('web.field_registry');
    var session = require('web.session');
    var field_utils = require('web.field_utils');


    require("website.content.zoomodoo");

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

    registry.add('image_zoom', FieldImageWithZoom);

    return {
        FieldImageWithZoom: FieldImageWithZoom
    }
});