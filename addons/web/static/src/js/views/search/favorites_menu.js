odoo.define('web.FavoritesMenu', function (require) {
"use strict";

var config = require('web.config');
var core = require('web.core');
var DropdownMenu = require('web.DropdownMenu');

var _t = core._t;
var QWeb = core.qweb;

var FavoritesMenu = DropdownMenu.extend({
    events: _.extend({}, DropdownMenu.prototype.events,
    {
        'click .o_add_favorite': '_onAddFavoriteClick',
        'click .o_save_favorite': '_onSaveFavoriteClick',
        'keyup .o_save_name input': '_onKeyUp',
    }),
    /*
     * override
     *
     * @param {Widget} parent
     * @param {Object[]} favorites
     */
    init: function (parent, favorites) {
        this._super(parent, favorites || []);
        this.generatorMenuIsOpen = false;
        this.isMobile = config.device.isMobile;
        this.dropdownCategory = 'favorite';
        this.dropdownTitle = _t('Favorites');
        this.dropdownIcon = 'fa fa-star';
        this.dropdownSymbol = this.isMobile ? 'fa fa-chevron-right float-right mt4' : false;
        this.dropdownStyle.mainButton.class = 'o_favorites_menu_button ' +
                                                this.dropdownStyle.mainButton.class;
    },
    /**
     * render the template used to register a new favorite and append it
     * to the basic dropdown menu
     *
     * @private
     */
    start: function () {
        this.$menu = this.$('.o_dropdown_menu');
        this.$menu.addClass('o_favorites_menu');
        var generatorMenu = QWeb.render('FavoritesMenuGenerator', {widget: this});
        this.$menu.append(generatorMenu);
        this.$favoriteName = this.$('.o_favorite_name');
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object[]} items, new list of favorites
     */
    update: function (favorites) {
        this._super.apply(this, arguments);
        this._renderGeneratorMenu();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _renderGeneratorMenu: function () {
        this.$el.find('.o_generator_menu').remove();
        var $generatorMenu = QWeb.render('FavoritesMenuGenerator', {widget: this});
        this.$menu.append($generatorMenu);
        this.$favoriteName = this.$('.o_favorite_name');
    },
    /**
     * @private
     */
    _saveFavorite: function () {
        var self = this;
        var $inputs = this.$('input');
        var description = $inputs[0].value;
        var isDefault = $inputs[1].checked;
        var isShared = $inputs[2].checked;
        if (!description.length){
            this.do_warn(_t("Error"), _t("A name for your favorite is required."));
            $inputs[0].focus();
            return;
        }
        var descriptionAlreadyExists = !!this.items.find(function (favorite) {
            return favorite.description === description;
        });
        if (descriptionAlreadyExists) {
            this.do_warn(_t("Error"), _t("Filter with same name already exists."));
            $inputs[0].focus();
            return;
        }

        this.trigger_up('new_favorite', {
            type: 'favorite',
            description: description,
            isDefault: isDefault,
            isShared: isShared,
            on_success: function () {self.generatorMenuIsOpen = false;},
        });
    },
    /**
     * @private
     */
    _toggleAddFavoriteMenu: function () {
        this.generatorMenuIsOpen = !this.generatorMenuIsOpen;
        this._renderGeneratorMenu();
        if (this.generatorMenuIsOpen) {
            this.$favoriteName.focus();
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------
    /**
     * @private
     * @param {jQueryEvent} event
     */
    _onAddFavoriteClick: function (event) {
        event.preventDefault();
        event.stopPropagation();
        this._toggleAddFavoriteMenu();
    },
    /*
     * override
     *
     * @private
     * @param {jQueryEvent} event
     */
    _onBootstrapClose: function () {
        this._super.apply(this, arguments);
        this.generatorMenuIsOpen = false;
        this._renderGeneratorMenu();
    },
    /**
     * @private
     * @param {jQueryEvent} event
     */
    _onKeyUp: function (event) {
        if (event.which === $.ui.keyCode.ENTER) {
            this.saveFavorite();
        }
    },
    /**
     * @private
     * @param {jQueryEvent} event
     */
    _onSaveFavoriteClick: function (event) {
        event.stopPropagation();
        this._saveFavorite();
    },
    /*
     * override
     *
     * @private
     * @param {jQueryEvent} event
     */
    _onTrashButtonClick: function (event) {
        event.preventDefault();
        event.stopPropagation();
        var id = $(event.currentTarget).data('id');
        var favorite = this.items.find(function (favorite) {
            return favorite.id === id;
        });
        var globalWarning = _t("This filter is global and will be removed for everybody if you continue.");
        var warning = _t("Are you sure that you want to remove this filter?");
        if (!confirm(favorite.userId ? warning : globalWarning)) {
            return;
        }
        this.trigger_up('item_trashed', {id: id});
    },
});

return FavoritesMenu;

});