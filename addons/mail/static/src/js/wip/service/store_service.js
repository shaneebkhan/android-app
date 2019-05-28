odoo.define('mail.wip.service.Store', function (require) {
"use strict";

const actions = require('mail.wip.store.actions');
const getters = require('mail.wip.store.getters');
const mutations = require('mail.wip.store.mutations');
const { init: initState } = require('mail.wip.store.state');

const AbstractService = require('web.AbstractService');
const config = require('web.config');
const core = require('web.core');

const { Store } = owl;

const DEBUG = true;
const _t = core._t;

const StoreService = AbstractService.extend({
    TEST: {
        active: false,
        initStateAlteration: {},
    },
    dependencies: ['ajax', 'bus_service', 'local_storage'],
    /**
     * @override {web.AbstractService}
     */
    init() {
        this._super.apply(this, arguments);
        let state = initState(this.TEST.active ? this.TEST.initStateAlteration : undefined);
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
            state,
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
                    this._resize();
                    resolve();
                }
            })
        );
        if (!this.TEST.active) {
            window.addEventListener('resize', _.debounce(() => {
                this._resize();
            }), 100);
        } else {
            this['test:resize'] = this._resize;
        }
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
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} [param0={}] passed data only in test environment
     * @param {integer} [param0.globalInnerHeight]
     * @param {integer} [param0.globalInnerWidth]
     * @param {boolean} [param0.isMobile]
     */
    _resize({ globalInnerHeight, globalInnerWidth, isMobile }={}) {
        if (this.TEST.active) {
            this.store.commit('resize', {
                globalInnerHeight: globalInnerHeight || this.store.state.global.innerHeight,
                globalInnerWidth: globalInnerWidth || this.store.state.global.innerWidth,
                isMobile: isMobile || this.store.state.isMobile,
            });
        } else {
            this.store.commit('resize', {
                globalInnerHeight: window.innerHeight,
                globalInnerWidth: window.innerWidth,
                isMobile: config.device.isMobile,
            });
        }
    },
});

core.serviceRegistry.add('store', StoreService);

return StoreService;

});
