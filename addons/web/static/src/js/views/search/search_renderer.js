odoo.define('web.SearchRenderer', function (require) {
"use strict";

var AbstractRenderer = require('web.AbstractRenderer');
// var AutoComplete = require('web.AutoComplete');
var FavoritesMenu = require('web.FavoritesMenu');
var FiltersMenu = require('web.FiltersMenu');
var GroupByMenu = require('web.GroupByMenu');
var SearchBar = require('web.SearchBar');

var SearchRenderer = AbstractRenderer.extend({
	template: 'SearchView',
    events: _.extend({}, AbstractRenderer.prototype.events, {
        'click .o_searchview_more': '_onMore',
    }),
    init: function () {
        this._super.apply(this, arguments);

        // TODO
        this.displayMore = false;
    },


    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _setupFiltersMenu: function () {
        this.filtersMenu = new FiltersMenu(this, this.state.filters, this.state.fields);
        return this.filtersMenu.appendTo(this.$subMenus);
    },
    _setupGroupByMenu: function () {
        this.groupByMenu = new GroupByMenu(this, this.state.groupBys, this.state.fields);
        return this.groupByMenu.appendTo(this.$subMenus);
    },
    _setupFavoritesMenu: function () {
        // this.favoritesMenu = new FavoritesMenu(this, this.state.favorites, this.state.fields);
        // return this.favoritesMenu.appendTo(this.$subMenus);
        return $.when();
    },

    _render: function () {
    	var defs = [];

        // approx inDom
        if (this.$subMenus) {
            if (this.filtersMenu) {
                this.filtersMenu.update(this.state.filters);
            }
            if (this.groupByMenu) {
                this.groupByMenu.update(this.state.groupBys);
            }
            // if (this.favoritesMenu) {
            //     this.favoritesMenu.update(this.state.favorites);
            // }
        } else {
            this.$subMenus = document.createDocumentFragment();
            defs.push(this._setupFiltersMenu());
            defs.push(this._setupGroupByMenu());
            defs.push(this._setupFavoritesMenu());
        }
        defs.push(this._renderSearchBar());

        this.$('.o_searchview_more')
            .toggleClass('fa-search-plus', this.displayMore)
            .toggleClass('fa-search-minus', !this.displayMore);

    	return $.when(this, defs);
    },
    _renderSearchBar: function () {
        // TODO: might need a reload instead of a destroy/instatiate
        var oldSearchBar = this.searchBar;
        this.searchBar = new SearchBar(this, this.state.facets);
        return this.searchBar.appendTo(this.$el).then(function () {
            if (oldSearchBar) {
                oldSearchBar.destroy();
            }
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onMore: function () {
        // TODO
    },
});

return SearchRenderer;
});