odoo.define('hr_attendance.widget', function (require) {
    "use strict";

    var basic_fields = require('web.basic_fields');
    var registry = require('web.field_registry');

    var RelativeTime = basic_fields.FieldDateTime.extend({
        _formatValue: function(val) {
            if(!this.value)
                return;
            return this.value.fromNow(true);
        },
    });

    registry.add('relative_time', RelativeTime);

    return { RelativeTime: RelativeTime }
});