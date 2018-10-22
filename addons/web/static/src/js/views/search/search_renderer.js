odoo.define('web.SearchRenderer', function (require) {
"use strict";

var AbstractRenderer = require('web.AbstractRenderer');

var SearchRenderer = AbstractRenderer.extend({
	className: 'o_search_renderer'
});

return SearchRenderer;
});