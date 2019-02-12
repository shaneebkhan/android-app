odoo.define('mail.wip.service.Store', function (require) {
"use strict";

const actions = require('mail.wip.store.actions');
const getters = require('mail.wip.store.getters');
const mutations = require('mail.wip.store.mutations');
const { init: initState } = require('mail.wip.store.state');

const AbstractService = require('web.AbstractService');
const core = require('web.core');

const { Store } = owl;

const DEBUG = true;
const _t = core._t;

const StoreService = AbstractService.extend({
    dependencies: ['ajax', 'bus_service', 'local_storage'],
    /**
     * @override {web.AbstractService}
     */
    init() {
        this._super.apply(this, arguments);
        let env = {
            _t,
            call: (...args) => this.call(...args),
            do_notify: (...args) => this.do_notify(...args),
            rpc: (...args) => this._rpc(...args),
        };
        this.store = new Store({
            actions,
            env,
            getters,
            mutations,
            state: initState()
        });
        if (DEBUG) {
            window.store = this.store;
        }
    },
    /**
     * @override {web.AbstractService}
     */
    start() {
        this.ready = new Promise(resolve =>
            this.store.dispatch('init', {
                ready: () => {
                    this.store.commit('resize');
                    resolve();
                }
            })
        );
        window.addEventListener('resize', _.debounce(() => {
            this.store.commit('resize');
        }), 100);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @return {Promise<mail.wip.Store>}
     */
    async get() {
        await this.ready;
        return this.store;
    }
});

core.serviceRegistry.add('store', StoreService);

return StoreService;

});
