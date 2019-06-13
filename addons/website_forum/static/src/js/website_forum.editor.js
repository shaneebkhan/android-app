odoo.define('website_forum.editor', function (require) {
"use strict";

var core = require('web.core');
var WebsiteNewMenu = require('website.newMenu');
var wUtils = require('website.utils');

var _t = core._t;

WebsiteNewMenu.include({
    actions: _.extend({}, WebsiteNewMenu.prototype.actions || {}, {
        new_forum: '_createNewForum',
    }),
    xmlDependencies: ['/website_forum/static/src/xml/website_forum_templates.xml'],

    //--------------------------------------------------------------------------
    // Actions
    //--------------------------------------------------------------------------

    /**
     * Asks the user information about a new forum to create, then creates it
     * and redirects the user to this new forum.
     *
     * @private
     * @returns {Promise} Unresolved if there is a redirection
     */
    _createNewForum: function () {
        var self = this;
        return wUtils.prompt({
            id: "editor_new_forum",
            window_title: _t("New Forum"),
            input: _t("Forum Name"),
            init: function () {
                var $group = this.$dialog.find("div.form-group");
                $group.removeClass("mb0");

                var $add = $(core.qweb.render('website_forum.add_to_menu'));
                var $radio = $(core.qweb.render('website_forum.select_forum_mode'));
                $add.find('label').append(_t("Add to menu"));
                $group.after($add, $radio);
            }
        }).then(function (result) {
            var forum_name = result.val;
            var $dialog = result.dialog;
            if (!forum_name) {
                return;
            }
            var add_menu = ($dialog.find('input[type="checkbox"]').is(':checked'));
            var forumMode = $dialog.find('input[type="radio"]:checked').val();
            return self._rpc({
                route: '/forum/new',
                params: {
                    forum_name: forum_name,
                    forum_mode: forumMode,
                    add_menu: add_menu || "",
                },
            }).then(function (url) {
                window.location.href = url;
                return new Promise(function () {});
            });
        });
    },
});
});
