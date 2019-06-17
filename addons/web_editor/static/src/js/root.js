odoo.define('web_editor.wysiwyg.root', function (require) {
'use strict';

var Widget = require('web.Widget');

var assetsLoaded = false;

var WysiwygRoot = Widget.extend({
    assetLibs: ['web_editor.compiled_assets_wysiwyg'],

    publicMethods: ['isDirty', 'save', 'getValue', 'setValue', 'on', 'trigger', 'focus'],

    /**
     *   @see 'web_editor.wysiwyg' module
     **/
    init: function (parent, params) {
        this._super.apply(this, arguments);
        this._params = params;
        this.$editor = null;
    },
    /**
     * Load assets
     *
     * @override
     **/
    start: function () {
        var self = this;
        var params = Object.assign({}, this._params);
        if (!assetsLoaded || this._params.preload) {
            params.test = {
                auto: false,
            };
        }
        this._params = null;

        return this._super().then(function () {
            if (!assetsLoaded) {
                assetsLoaded = true;
            }

            var Wysiwyg = self._getWysiwygContructor();
            var instance = new Wysiwyg(self, params);

            _.each(self.publicMethods, function (methodName) {
                self[methodName] = instance[methodName].bind(instance);
            });

            return instance.attachTo(self.$el).then(function () {
                self.$editor = instance.$el;
            });
        });
    },

    _getWysiwygContructor: function () {
        return odoo.__DEBUG__.services['web_editor.wysiwyg'];
    }
});

return WysiwygRoot;

});
