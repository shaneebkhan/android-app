odoo.define('point_of_sale.PointOfSaleTests', function (require) {
"use strict";

const {createActionManager} = require('web.test_utils');

QUnit.module('Point of Sale');

QUnit.module('pos.ui', {
    beforeEach() {
        this.data = {
            'res.users': {
                fields: {
                    name: {string: 'Name', type: 'char'},
                    company_id: {string: "Company", type: 'many2one', relation: 'res.company'},
                },
                records: [
                    {id: 1, name: "Mitchell Admin", company_id: 1},
                ],
            },
            'res.company': {
                fields: {
                    display_name: {string: "Displayed name", type: 'char'},
                    currency_id: {string: 'Currency', type: 'many2one', relation: 'res.currency'},
                },
                records: [
                    {id: 1, display_name: "company 1", currency_id: 1},
                ],
            },
            'decimal.precision': {
                fields: {},
                records: [],
            },
            'uom.uom': {
                fields: {},
                records: [],
            },
            'res.partner': {
                fields: {},
                records: [],
            },
            'res.country.state': {
                fields: {},
                records: [],
            },
            'res.country': {
                fields: {},
                records: [],
            },
            'account.tax': {
                fields: {},
                records: [],
            },
            'pos.session': {
                fields: {
                    journal_ids: {string: 'Journals', type: 'many2many', relation: 'account.journal'},
                    name: {string: 'Name', type: 'char'},
                    user_id: {string: 'User', type: 'many2one', relation: 'res.users'},
                    config_id: {string: 'Config', type: 'many2one', relation: 'pos.config'},
                    start_at: {name: 'Start at', type: 'datetime'},
                    stop_at: {name: 'Stop at', type: 'datetime'},
                    sequence_number: {name: 'Sequence', type: 'integer'},
                    login_number: {name: 'Login', type: 'integer'},
                    state: {string: 'State', type: 'selection', selection: ['opened', 'closed']},
                },
                records: [
                    {id: 1, name: "Session 1", config_id: 1, user_id: 1, state: 'opened'},
                ],
            },
            'pos.config': {
                fields: {
                    pricelist_id: {string: 'Default pricelist', type: 'many2one', relation: 'product.pricelist'},
                    currency_id: {string: 'Currency', type: 'many2one', relation: 'res.currency'},
                    company_id: {string: "Company", type: 'many2one', relation: 'res.company'},
                },
                records: [
                    {id: 1, pricelist_id: 1, currency_id: 1, company_id: 1},
                ],
            },
            'product.pricelist': {
                fields: {},
                records: [
                    {id: 1},
                ],
            },
            'product.pricelist.item': {
                fields: {},
                records: [],
            },
            'product.category': {
                fields: {},
                records: [],
            },
            'res.currency': {
                fields: {},
                records: [
                    {id: 1},
                ],
            },
            'pos.category': {
                fields: {},
                records: [],
            },
            'product.product': {
                fields: {},
                records: [],
            },
            'account.bank.statement': {
                fields: {},
                records: [],
            },
            'account.journal': {
                fields: {},
                records: [],
            },
            'account.fiscal.position': {
                fields: {},
                records: [],
            },
            'account.fiscal.position.tax': {
                fields: {},
                records: [],
            },
        };
        this.session = {
            uid: 1,
        };
    },
}, function () {
    QUnit.test('basic rendering', async function (assert) {
        assert.expect(9);

        const actionManager = await createActionManager({
            data: this.data,
            session: this.session,
        });
        await actionManager.doAction('pos.ui');

        assert.containsOnce(actionManager, '.pos',
            "should have a Point of Sale container");
        assert.containsOnce(actionManager, '.loader',
            "should have a loading screen");
        assert.isVisible(actionManager, '.loader .progressbar',
            "should have a loading screen with a progress bar");

        // FIXME: this is hacky and shouldn't be exposed that way...
        await window.posmodel.chrome.ready;

        assert.isNotVisible(actionManager.$('.loader .progressbar'),
            "should have hidden the progress bar when loading is complete");

        // Chrome main parts
        assert.containsOnce(actionManager, '.pos-topheader',
            "should have a top navbar");
        assert.containsOnce(actionManager, '.pos-topheader .username',
            "should have a UsernameWidget in the top navbar");
        assert.containsOnce(actionManager, '.pos-topheader .order-selector',
            "should have an OrderSelectorWidget in the top navbar");
        assert.containsOnce(actionManager, '.pos-content .screens',
            "should have a screens container");
        assert.containsOnce(actionManager, '.pos-content .keyboard_frame',
            "should have a virtual keyboard container");

        actionManager.destroy();
    });
});

});
