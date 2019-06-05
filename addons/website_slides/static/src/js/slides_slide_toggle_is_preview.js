odoo.define('website_slides.slide.preview', function (require) {
    'use strict';

    var publicWidget = require('web.public.widget');
    var Dialog = require('web.Dialog');
    var core = require('web.core');
    var _t = core._t;

    var SlideToggleIsPreviewDialog = Dialog.extend({
        template: 'slides.slide.preview',

        /**
         * @override
         */
        init: function (parent, options) {
            options = _.defaults(options || {}, {
                title: _t('Preview Slide'),
                size: 'medium',
                buttons: [{
                    text: _t('Yes'),
                    classes: 'btn-primary',
                    click: this._onClickPreview.bind(this)
                }, {
                    text: _t('No'),
                    close: true
                }]
            });

            this.$slideTarget = options.slideTarget;
            this.is_preview = this.$slideTarget.hasClass('badge-success');
            this.slideId = this.$slideTarget.data('slideId');
            this._super(parent, options);
        },

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        _onClickPreview: function () {
            var self = this;

            this._rpc({
                route: '/slides/slide/toggle_is_preview',
                params: {
                    slide_id: this.slideId
                },
            }).then(function (isPreview) {
                if (isPreview) {
                    self.$slideTarget.removeClass('badge-light badge-hide border');
                    self.$slideTarget.addClass('badge-success');
                } else {
                    self.$slideTarget.removeClass('badge-success');
                    self.$slideTarget.addClass('badge-light badge-hide border');
                }
                self.close();
            });
        }
    });

    publicWidget.registry.websiteSlidesSlideToggleIsPreview = publicWidget.Widget.extend({
        selector: '.o_wslides_js_slide_toggle_is_preview',
        xmlDependencies: ['/website_slides/static/src/xml/slide_management.xml'],
        events: {
            'click': '_onPreviewSlideClick',
        },

        _openDialog: function ($slideTarget) {
            new SlideToggleIsPreviewDialog(this, {slideTarget: $slideTarget}).open();
        },

        _onPreviewSlideClick: function (ev) {
            ev.preventDefault();
            var $slideTarget = $(ev.currentTarget);
            this._openDialog($slideTarget);
        },
    });

    return {
        slideToggleIsPreviewDialog: SlideToggleIsPreviewDialog,
        websiteSlidesSlideToggleIsPreview: publicWidget.registry.websiteSlidesSlideToggleIsPreview
    };

});
