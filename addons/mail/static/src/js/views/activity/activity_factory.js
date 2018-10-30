odoo.define('mail.ActivityFactory', function (require) {
"use strict";

var ActivityController = require('mail.ActivityController');
var ActivityModel = require('mail.ActivityModel');
var ActivityRenderer = require('mail.ActivityRenderer');
var AbstractFactory = require('web.AbstractFactory');
var core = require('web.core');
var view_registry = require('web.view_registry');

var _lt = core._lt;

var ActivityFactory = AbstractFactory.extend({
    accesskey: "a",
    display_name: _lt('Activity'),
    icon: 'fa-th',
    config: _.extend({}, AbstractFactory.prototype.config, {
        Controller: ActivityController,
        Model: ActivityModel,
        Renderer: ActivityRenderer,
    }),
    viewType: 'activity',
    groupable: false,
});

view_registry.add('activity', ActivityFactory);

return ActivityFactory;

});
