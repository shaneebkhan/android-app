odoo.define('web.SearchPanel', function (require) {
"use strict";

/**
 * This file defines the SearchPanel widget for Kanban. It allows to
 * filter/manage data easily.
 */

var core = require('web.core');
var Domain = require('web.Domain');
var Widget = require('web.Widget');

var qweb = core.qweb;

var SearchPanel = Widget.extend({
    className: 'o_search_panel',
    events: {
        'click .o_search_panel_category_value header': '_onCategoryValueClicked',
        'click .o_search_panel_category_value .o_toggle_fold': '_onToggleFoldCategory',
        'click .o_search_panel_filter_group .o_toggle_fold': '_onToggleFoldFilterGroup',
        'change .o_search_panel_filter_value > div > input': '_onFilterValueChanged',
        'change .o_search_panel_filter_group > div > input': '_onFilterGroupChanged',
    },

    /**
     * @override
     * @param {Object} params
     * @param {Object} [params.defaultCategoryValues={}] the category value to
     *   activate by default, for each category
     * @param {Object} params.fields
     * @param {string} params.model
     * @param {Object} params.sections
     * @param {Array[]} params.searchDomain domain coming from controlPanel
     */
    init: function (parent, params) {
        this._super.apply(this, arguments);

        this.categories = _.pick(params.sections, function (section) {
            return section.type === 'category';
        });
        this.filters = _.pick(params.sections, function (section) {
            return section.type === 'filter';
        });

        this.defaultCategoryValues = params.defaultCategoryValues || {};
        this.fields = params.fields;
        this.model = params.model;
        this.searchDomain = params.searchDomain;
    },
    /**
     * @override
     */
    willStart: function () {
        var self = this;
        var loadProm = this._fetchCategories().then(function () {
            return self._fetchFilters();
        });
        return $.when(loadProm, this._super.apply(this, arguments));
    },
    /**
     * @override
     */
    start: function () {
        return $.when(this._render(), this._super.apply(this, arguments));
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @returns {Array[]} the current searchPanel domain based on active
     *   categories and checked filters
     */
    getDomain: function () {
        return this._getCategoryDomain().concat(this._getFilterDomain());
    },
    /**
     * @param {Object} params
     * @param {Array[]} params.searchDomain domain coming from controlPanel
     * @returns {$.Promise}
     */
    update: function (params) {
        this.searchDomain = params.searchDomain;
        return this._fetchFilters().then(this._render.bind(this));
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {string} categoryId
     * @param {Object[]} values
     */
    _createCategoryTree: function (categoryId, values) {
        var self = this;
        var category = this.categories[categoryId];
        var parentField = category.parentField;

        category.values = {};
        values.forEach(function (value) {
            category.values[value.id] = _.extend({}, value, {
                childrenIds: [],
                folded: true,
                parentId: value[parentField] && value[parentField][0] || false,
            });
        });
        Object.keys(category.values).forEach(function (valueId) {
            var value = category.values[valueId];
            if (value.parentId) {
                category.values[value.parentId].childrenIds.push(value.id);
            }
        });
        Object.keys(category.values).forEach(function (valueId) {
            var value = category.values[valueId];
            value.ancestorIds = self._getParentValueIds(category, valueId);
        });
        category.rootIds = Object.keys(category.values).filter(function (valueId) {
            var value = category.values[valueId];
            return value.parentId === false;
        });

        // set active value
        var validValues = _.pluck(category.values, 'id').concat([false]);
        // set active value from context
        var value = this.defaultCategoryValues[category.fieldName];
        if (!_.contains(validValues, value)) {
            // if not set in context, or set to an unknown value, set active
            // value from localStorage
            var storageKey = this._getLocalStorageKey(category);
            value = this.call('local_storage', 'getItem', storageKey);
        }
        if (!_.contains(validValues, value)) {
            // if not set in localStorage either, pick first value
            value = values.length ? values[0].id : false;
        }
        category.activeValueId = value;

        // unfold ancestor values of active value to make it is visible
        if (category.activeValueId) {
            var parentValueIds = this._getParentValueIds(category, category.activeValueId);
            parentValueIds.forEach(function (parentValue) {
                category.values[parentValue].folded = false;
            });
        }
    },
    /**
     * @private
     * @param {string} filterId
     * @param {Object[]} values
     */
    _createFilterTree: function (filterId, values) {
        var filter = this.filters[filterId];

        // restore checked property
        values.forEach(function (value) {
            var oldValue = filter.values && filter.values[value.id];
            value.checked = oldValue && oldValue.checked || false;
        });

        var sortedValueIds = _.pluck(values, 'id');

        filter.values = {};
        var setGroupIds = [];
        if (filter.groupBy) {
            var groups = {};
            values.forEach(function (value) {
                var groupId = value.group_id;
                if (!groups[groupId]) {
                    if (groupId) {
                        setGroupIds.push(groupId);
                    } else {
                        filter.hasNotSetGroup = true;
                    }
                    groups[groupId] = {
                        folded: false,
                        id: groupId,
                        name: value.group_name,
                        values: {},
                        tooltip: value.group_tooltip,
                        sequence: value.group_sequence,
                        sortedValueIds: [],
                    };
                    // restore former checked and folded state
                    var oldGroup = filter.groups && filter.groups[groupId];
                    groups[groupId].state = oldGroup && oldGroup.state || false;
                    groups[groupId].folded = oldGroup && oldGroup.folded || false;
                }
                groups[groupId].values[value.id] = value;
                groups[groupId].sortedValueIds.push(value.id);
            });
            filter.groups = groups;
            filter.sortedSetGroupIds = _.sortBy(setGroupIds, function (groupId) {
                return groups[groupId].sequence || groups[groupId].name;
            });
            Object.keys(filter.groups).forEach(function (groupId) {
                filter.values = _.extend(filter.values, filter.groups[groupId].values);
            });
        } else {
            values.forEach(function (value) {
                filter.values[value.id] = value;
            });
            filter.sortedValueIds = sortedValueIds;
        }
    },
    /**
     * @private
     * @returns {$.Promise} resolved when all categories have been fetched
     */
    _fetchCategories: function () {
        var self = this;
        var defs = Object.keys(this.categories).map(function (categoryId) {
            var category = self.categories[categoryId];
            var field = self.fields[category.fieldName];
            var def;
            if (field.type === 'many2one') {
                def = self._rpc({
                    route: '/web/kanban/get_search_panel_category',
                    params: {
                        field_name: category.fieldName,
                        model: self.model,
                    }
                }).then(function (result) {
                    category.parentField = result.parent_field;
                    return result.values;
                });
            } else if (field.type === 'selection') {
                var values = field.selection.map(function (value) {
                    return {id: value[0], display_name: value[1]};
                });
                def = $.when(values);
            }
            return def.then(function (values) {
                self._createCategoryTree(categoryId, values);
            });
        });
        return $.when.apply($, defs);
    },
    /**
     * @private
     * @returns {$.Promise} resolved when all filters have been fetched
     */
    _fetchFilters: function () {
        var self = this;
        var evalContext = {};
        Object.keys(this.categories).forEach(function (categoryId) {
            var category = self.categories[categoryId];
            evalContext[category.fieldName] = category.activeValueId;
        });
        var defs = Object.keys(this.filters).map(function (filterId) {
            var filter = self.filters[filterId];
            return self._rpc({
                route: '/web/kanban/get_search_panel_filter',
                params: {
                    category_domain: self._getCategoryDomain(),
                    comodel_domain: Domain.prototype.stringToArray(filter.domain, evalContext),
                    disable_counters: filter.disableCounters,
                    field_name: filter.fieldName,
                    filter_domain: self._getFilterDomain(),
                    group_by: filter.groupBy || false,
                    model: self.model,
                    search_domain: self.searchDomain,
                },
            }).then(function (values) {
                self._createFilterTree(filterId, values);
            });
        });
        return $.when.apply($, defs);
    },
    /**
     * Compute and return the domain based on the current active categories.
     *
     * @private
     * @returns {Array[]}
     */
    _getCategoryDomain: function () {
        var self = this;
        function reducer(domain, categoryId) {
            var category = self.categories[categoryId];
            if (category.activeValueId) {
                domain.push([category.fieldName, '=', category.activeValueId]);
            }
            return domain;
        }
        return Object.keys(this.categories).reduce(reducer, []);
    },
    /**
     * Compute and return the domain based on the current checked filters.
     *
     * @private
     * @returns {Array[]}
     */
    _getFilterDomain: function () {
        var self = this;
        function getCheckedValues(values) {
            function reducer(checkedValues, valueId) {
                var value = values[valueId];
                if (value.checked) {
                    checkedValues.push(value.id);
                }
                return checkedValues;
            }
            return Object.keys(values).reduce(reducer, []);
        }
        function reducer(domain, filterId) {
            var filter = self.filters[filterId];
            if (filter.groups) {
                Object.keys(filter.groups).forEach(function (groupId) {
                    var group = filter.groups[groupId];
                    var checkedValues = getCheckedValues(group.values);
                    if (checkedValues.length) {
                        domain.push([filter.fieldName, 'in', checkedValues]);
                    }
                });
            } else if (filter.values) {
                var checkedValues = getCheckedValues(filter.values);
                if (checkedValues.length) {
                    domain.push([filter.fieldName, 'in', checkedValues]);
                }
            }
            return domain;
        }
        return Object.keys(this.filters).reduce(reducer, []);
    },
    /**
     * The active id of each category is stored in the localStorage, s.t. it
     * can be restored afterwards (when the action is reloaded, for instance).
     * This function returns the key in the sessionStorage for a given category.
     *
     * @param {Object} category
     * @returns {string}
     */
    _getLocalStorageKey: function (category) {
        return 'searchpanel_' + this.model + '_' + category.fieldName;
    },
    /**
     * @private
     * @param {Object} category
     * @param {integer} categoryValueId
     * @returns {integer[]} list of ids of the ancestors of the given value in
     *   the given category
     */
    _getParentValueIds: function (category, categoryValueId) {
        var categoryValue = category.values[categoryValueId];
        var parentId = categoryValue.parentId;
        if (parentId) {
            return [parentId].concat(this._getParentValueIds(category, parentId));
        }
        return [];
    },
    /**
     * @private
     */
    _render: function () {
        var self = this;
        this.$el.empty();

        // sort categories and filters according to their index
        var categories = Object.keys(this.categories).map(function (categoryId) {
            return self.categories[categoryId];
        });
        var filters = Object.keys(this.filters).map(function (filterId) {
            return self.filters[filterId];
        });
        var sections = categories.concat(filters).sort(function (s1, s2) {
            return s1.index - s2.index;
        });

        sections.forEach(function (section) {
            if (Object.keys(section.values).length) {
                if (section.type === 'category') {
                    self.$el.append(self._renderCategory(section));
                } else {
                    self.$el.append(self._renderFilter(section));
                }
            }
        });
    },
    /**
     * @private
     * @param {Object} category
     * @returns {string}
     */
    _renderCategory: function (category) {
        return qweb.render('SearchPanel.Category', {category: category});
    },
    /**
     * @private
     * @param {Object} filter
     * @returns {jQuery}
     */
    _renderFilter: function (filter) {
        var $filter = $(qweb.render('SearchPanel.Filter', {filter: filter}));

        // set group inputs in intermediate state when necessary
        Object.keys(filter.groups || {}).forEach(function (groupId) {
            var state = filter.groups[groupId].state;
            // group 'false' is not displayed
            if (groupId !== 'false' && state === 'intermediate') {
                $filter
                    .find('.o_search_panel_filter_group[data-group-id=' + groupId + '] input')
                    .get(0)
                    .indeterminate = true;
            }
        });

        return $filter;
    },
    /**
     * Compute the current searchPanel domain based on categories and filters,
     * and notify environment of the domain change.
     *
     * Note that this assumes that the environment will update the searchPanel.
     * FIXME: should we change that logic and update directly?
     *
     * @private
     */
    _reportSearchPanelDomain: function () {
        this.trigger_up('search_panel_domain_updated', {
            domain: this.getDomain(),
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onCategoryValueClicked: function (ev) {
        ev.stopPropagation();
        var $item = $(ev.currentTarget).closest('.o_search_panel_category_value');
        var category = this.categories[$item.data('categoryId')];
        var valueId = $item.data('id') || false;
        category.activeValueId = valueId;
        var storageKey = this._getLocalStorageKey(category);
        this.call('local_storage', 'setItem', storageKey, valueId);
        this._reportSearchPanelDomain();
    },
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onFilterGroupChanged: function (ev) {
        ev.stopPropagation();
        var $item = $(ev.target).closest('.o_search_panel_filter_group');
        var filter = this.filters[$item.data('filterId')];
        var groupId = $item.data('groupId');
        var group = filter.groups[groupId];
        group.state = group.state === 'checked' ? 'unchecked' : 'checked';
        Object.keys(group.values).forEach(function (valueId) {
            group.values[valueId].checked = group.state === 'checked';
        });
        this._reportSearchPanelDomain();
    },
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onFilterValueChanged: function (ev) {
        ev.stopPropagation();
        var $item = $(ev.target).closest('.o_search_panel_filter_value');
        var valueId = $item.data('valueId');
        var filter = this.filters[$item.data('filterId')];
        var value = filter.values[valueId];
        value.checked = !value.checked;
        var group = filter.groups && filter.groups[value.group_id];
        if (group) {
            var valuePartition = _.partition(Object.keys(group.values), function (valueId) {
                return group.values[valueId].checked;
            });
            if (valuePartition[0].length && valuePartition[1].length) {
                group.state = 'intermediate';
            } else if (valuePartition[0].length) {
                group.state = 'checked';
            } else {
                group.state = 'unchecked';
            }
        }
        this._reportSearchPanelDomain();
    },
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onToggleFoldCategory: function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var $item = $(ev.currentTarget).closest('.o_search_panel_category_value');
        var category = this.categories[$item.data('categoryId')];
        var valueId = $item.data('id');
        category.values[valueId].folded = !category.values[valueId].folded;
        this._render();
    },
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onToggleFoldFilterGroup: function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var $item = $(ev.currentTarget).closest('.o_search_panel_filter_group');
        var filter = this.filters[$item.data('filterId')];
        var groupId = $item.data('groupId');
        filter.groups[groupId].folded = !filter.groups[groupId].folded;
        this._render();
    },
});

return SearchPanel;

});
