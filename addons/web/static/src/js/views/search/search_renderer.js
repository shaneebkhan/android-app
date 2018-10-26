odoo.define('web.SearchRenderer', function (require) {
"use strict";

var AbstractRenderer = require('web.AbstractRenderer');
// var AutoComplete = require('web.AutoComplete');
var FiltersMenu = require('web.FiltersMenu');

var SearchRenderer = AbstractRenderer.extend({
	template: 'SearchView',


    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _setupFiltersMenu: function () {
        this.filtersMenu = new FiltersMenu(this, this.state.filters, this.state.fields);
        return this.filtersMenu.appendTo(this.$subMenus);
    },

    _render: function () {
    	var defs = [];
        // approx inDom
        if (this.$subMenus) {
            if (this.filtersMenu) {
                this.filtersMenu.update(this.state.filters);
            }
        } else {
            this.$subMenus = document.createDocumentFragment();
        	// defs.push(this._setupAutoCompletion());
            defs.push(this._setupFiltersMenu());
        }
    	return $.when(this, defs);
    },
    // /**
    //  * instantiate auto-completion widget
    //  */
    // _setupAutoCompletion: function () {
    //     this.autoComplete = new AutoComplete(this, {
    //     	// the widget should be changed
    //     	// I have changed source and select for now because I don't want to
    //     	// break things
    //         source: function () {},
    //         select: function () {},
    //         get_search_string: function () {
    //             return this.$('.o_searchview_input').val().trim();
    //         },
    //     });
    //     return this.autoComplete.appendTo(this.$('.o_searchview_input_container'));
    // },
});

return SearchRenderer;
});