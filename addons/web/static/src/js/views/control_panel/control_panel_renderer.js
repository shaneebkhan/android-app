odoo.define('web.ControlPanelRenderer', function (require) {
"use strict";

var data = require('web.data');
var FavoritesMenu = require('web.FavoritesMenu');
var FiltersMenu = require('web.FiltersMenu');
var GroupByMenu = require('web.GroupByMenu');
var TimeRangeMenu = require('web.TimeRangeMenu');
var mvc = require('web.mvc');
var SearchBar = require('web.SearchBar');
var viewUtils = require('web.viewUtils');

var Renderer = mvc.Renderer;

var ControlPanelRenderer = Renderer.extend({
    template: 'ControlPanel',
    events: _.extend({}, Renderer.prototype.events, {
        'click.bs.dropdown .o_search_options .dropdown-menu': '_onDropdownClicked',
        'click .o_searchview_more': '_onMore',
    }),

    /**
     * @override
     * @param {Object[]} [params.controls=[]] list of nodes to render in the
     *   buttons area.
     * @param {Object[]} [params.breadcrumbs=[]] list of breadcrumbs elements
     * @param {String} [params.template] the QWeb template to render the
     *   ControlPanel. By default, the template 'ControlPanel' will be used.
     */
    init: function (parent, state, params) {
        this._super.apply(this, arguments);
        this.controls = params.controls || [];
        this._breadcrumbs = params.breadcrumbs || [];
        if (params.template) {
            this.template = params.template;
        }

        // TODO
        this.displayMore = false;
    },
    /**
     * Renders the control panel and creates a dictionnary of its exposed
     * elements
     *
     * @override
     */
    start: function () {
        var self = this;

        // exposed jQuery nodesets
        this.nodes = {
            $buttons: this.$('.o_cp_buttons'),
            $pager: this.$('.o_cp_pager'),
            $sidebar: this.$('.o_cp_sidebar'),
            $switch_buttons: this.$('.o_cp_switch_buttons'),
        };

        this.$controls = $('<div>', {class: 'o_cp_custom_buttons'});
        var hasCustomButtons = false;
        this.controls.forEach(function (node) {
            if (node.tag === 'button') {
                hasCustomButtons = true;
                self.$controls.append(self._renderButton(node));
            }
        });
        if (!hasCustomButtons) {
            this.$controls = $(); // fixme: this is to prevent the controlpanel
                                  // bottom row to take 5px height due to padding
        }

        this.render({});

        return $.when(this._super.apply(this, arguments), this._render());
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @returns {Object}
     */
    getLastFacet: function () {
        return this.state.facets.slice(-1)[0];
    },
    /**
     * @param {Object} [status.active_view] the current active view
     * @param {Array} [status.breadcrumbs] the breadcrumbs to display (see _render_breadcrumbs() for
     * precise description)
     * @param {Object} [status.cp_content] dictionnary containing the new ControlPanel jQuery elements
     * @param {Boolean} [status.hidden] true if the ControlPanel should be hidden
     * @param {Boolean} [status.search_view_hidden] true if the searchview is hidden, false otherwise
     * @param {Boolean} [options.clear] set to true to clear from control panel
     * elements that are not in status.cp_content
     */
    render: function (status, options) {
        this._toggleVisibility(!status.hidden);

        // Don't update the ControlPanel in headless mode as the views have
        // inserted themselves the buttons where they want, so inserting them
        // again in the ControlPanel will remove them from where they should be
        if (!status.hidden) {
            options = _.defaults({}, options, {
                clear: true, // clear control panel by default
            });
            var new_cp_content = status.cp_content || {};

            // Detach special controls
            this.$controls.detach();

            // Render the breadcrumbs
            this._renderBreadcrumbs(status.title);

            if ('search_view_hidden' in status) {
                if (status.search_view_hidden) {
                    this.$('.o_searchview').hide();
                    this.$('.o_search_options').hide();
                } else {
                    this.$('.o_searchview').show();
                    this.$('.o_search_options').show();
                }
            }

            // Detach control_panel old content and attach new elements
            var toDetach = this.nodes;
            if (options.clear) {
                this._detachContent(toDetach);
            } else {
                this._detachContent(_.pick(toDetach, _.keys(new_cp_content)));
            }
            this._attachContent(new_cp_content);
            if (status.active_view_selector) {
                this._updateSwitchButtons(status.active_view_selector);
            }

            // Attach special controls
            this.$controls.prependTo(this.nodes.$buttons);
        }
    },
    updateState: function (state) {
        this.state = state;
        return this._render();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} content dictionnary of jQuery elements to attach, whose
     *   keys are jQuery nodes identifiers in this.nodes
     */
    _attachContent: function (content) {
        for (var $element in content) {
            var $nodeset = content[$element];
            if ($nodeset && this.nodes[$element]) {
                this.nodes[$element].append($nodeset);
            }
        }
    },
    /**
     * @private
     * @param {Object} content subset of this.nodes to detach
     */
    _detachContent: function (content) {
        for (var $element in content) {
            content[$element].contents().detach();
        }
    },
    /**
     * @private
     * @param {string} title
     */
    _renderBreadcrumbs: function (title) {
        var self = this;
        var breadcrumbsDescriptors = this._breadcrumbs.concat({
            title: title,
        });
        var breadcrumbs = breadcrumbsDescriptors.map(function (bc, index) {
            return self._renderBreadcrumbsItem(bc, index, breadcrumbsDescriptors.length);
        });
        this.$('.breadcrumb').html(breadcrumbs);
    },
    /**
     * Renders a button to display in the buttons area, given an arch's node.
     *
     * @private
     * @param {Object} node
     */
    _renderButton: function (node) {
        var self = this;
        var $button = viewUtils.renderButtonFromNode(node);
        $button.on('click', function () {
            self.trigger_up('button_clicked', {
                attrs: node.attrs,
            });
        });
        return $button;
    },
    /**
     * Renders a breadcrumbs' li Jquery element
     *
     * @private
     */
    _renderBreadcrumbsItem: function (bc, index, length) {
        var self = this;
        var is_last = (index === length-1);
        var li_content = bc.title && _.escape(bc.title.trim()) || data.noDisplayContent;
        var $bc = $('<li>', {class: 'breadcrumb-item'})
            .append(is_last ? li_content : $('<a>', {href: '#'}).html(li_content))
            .toggleClass('active', is_last);
        if (!is_last) {
            $bc.click(function (ev) {
                ev.preventDefault();
                self.trigger_up('breadcrumb_clicked', {controllerID: bc.controllerID});
            });
        }
        return $bc;
    },
    /**
     * Toggles the visibility of the ControlPanel and detaches or attaches its
     * contents to clean the DOM
     *
     * @private
     * @param {boolean} visible true to show the control panel, false to hide it
     */
    _toggleVisibility: function (visible) {
        this.do_toggle(visible);
        if (!visible && !this.$content) {
            this.$content = this.$el.contents().detach();
        } else if (this.$content) {
            this.$content.appendTo(this.$el);
            this.$content = null;
        }
    },
    /**
     * Removes active class on all switch-buttons and adds it to the one of the
     * active view
     *
     * @private
     * @param {string} selector the selector of the div to activate
     */
    _updateSwitchButtons: function (selector) {
        this.nodes.$switch_buttons.find('button').removeClass('active');
        this.$(selector).addClass('active');
    },




    _setupFiltersMenu: function () {
        this.filtersMenu = new FiltersMenu(this, this.state.filters, this.state.fields);
        return this.filtersMenu.appendTo(this.$subMenus);
    },
    _setupGroupByMenu: function () {
        this.groupByMenu = new GroupByMenu(this, this.state.groupBys, this.state.fields);
        return this.groupByMenu.appendTo(this.$subMenus);
    },
    _setupFavoritesMenu: function () {
        this.favoritesMenu = new FavoritesMenu(this, this.state.favorites);
        return this.favoritesMenu.appendTo(this.$subMenus);
    },
    _setupTimeRangeMenu: function () {
        this.timeRangeMenu = new TimeRangeMenu(this, this.state.timeRanges);
        return this.timeRangeMenu.appendTo(this.$subMenus);
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
            if (this.favoritesMenu) {
                this.favoritesMenu.update(this.state.favorites);
            }
            if (this.timeRangeMenu) {
                this.timeRangeMenu.update(this.state.timeRanges);
            }
        } else {
            this.$subMenus = this.$('.o_search_options');
            defs.push(this._setupFiltersMenu());
            defs.push(this._setupGroupByMenu());
            defs.push(this._setupTimeRangeMenu());
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
        return this.searchBar.appendTo(this.$('.o_searchview')).then(function () {
            if (oldSearchBar) {
                oldSearchBar.destroy();
            }
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onButtonClicked: function (ev) {
        this.trigger_up('button_clicked', {});
    },
    /**
     * Prevents the search dropdowns from closing when clicking inside them.
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onDropdownClicked: function (ev) {
        ev.stopPropagation();
    },
    _onMore: function () {
        // TODO
    },
});

return ControlPanelRenderer;

});
