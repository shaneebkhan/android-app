odoo.define('website_privacy.animation', function (require) {
'use strict';

    var snippet_animation = require('web_editor.snippets.animation');

    snippet_animation.registry.website_privacy_cookie_bar = snippet_animation.Class.extend({
        selector: '.cookie_bar',

        start: function(editable_mode) {
            if (editable_mode) {
                this.stop();
                return;
            }
            var self = this;
            this.$target.find('.btn_cookies').on('click',function(e) {
                document.cookie='cookies_consent=1';
                self.$target.fadeOut('slow', function() {
                    $(this).attr("style", "display: none !important");
                });
            });
        },
        stop: function() {
            this.$target.find('.btn_cookies').off('click');
        },
    });
});
