odoo.define('point_of_sale.PointOfSaleTests', function (require) {
"use strict";

const {Chrome} = require('point_of_sale.chrome');

QUnit.module('Point of Sale');

QUnit.module('Chrome', {}, function () {
    QUnit.test('basic rendering', async function (assert) {
        assert.expect(1);

        assert.ok(true, "sentinel");
    });
});

});
