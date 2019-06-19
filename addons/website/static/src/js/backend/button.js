odoo.define('website.backend.button', function (require) {
'use strict';

var AbstractField = require('web.AbstractField');
var core = require('web.core');
var field_registry = require('web.field_registry');

var _t = core._t;

var WidgetWebsiteButton = AbstractField.extend({
    template: 'WidgetWebsiteButton',

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    isSet: function () {
        return true;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     * @private
     */
    _render: function () {
        this._super.apply(this, arguments);

        var $value = this.$('.o_value');
        var published = this.value;
        $value.html(published ? _t("Published") : _t("Unpublished"))
              .toggleClass('text-danger', !published)
              .toggleClass('text-success', published);
    },
});

var WidgetWebsiteButtonIcon = AbstractField.extend({
    template: 'WidgetWebsiteButtonIcon',
    fieldDependencies: {
        website_url: {type: 'string'},
    },
    events: {
        'click': '_onClick',
    },

    /**
    * @override
    */
    start: function () {
        this.$icon = this.$('.o_button_icon');
        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    isSet: function () {
        return true;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _render: function () {
        this._super.apply(this, arguments);

        var published = this.value;
        var info = published ? _t("Published") : _t("Unpublished");
        this.$el.attr('aria-label', info)
                .prop('title', info);
        this.$icon.toggleClass('text-danger', !published)
                .toggleClass('text-success', published);
    },

    //--------------------------------------------------------------------------
    // Handler
    //--------------------------------------------------------------------------

    /**
     * Redirects to the website page of the record.
     *
     * @private
     */
    _onClick: function () {
        this.do_action({
            'type': 'ir.actions.act_url',
            'url': this.recordData.website_url,
            'target': 'self',
        });
    },
});

field_registry.add('website_button', WidgetWebsiteButton);
field_registry.add('website_button_icon', WidgetWebsiteButtonIcon);
});
