odoo.define('mail.service.Store', function (require) {
"use strict";

const actions = require('mail.store.actions');
const getters = require('mail.store.getters');
const mutations = require('mail.store.mutations');
const { init: initState } = require('mail.store.state');
const EnvMixin = require('mail.widget.EnvMixin');

const AbstractService = require('web.AbstractService');
const config = require('web.config');
const core = require('web.core');

const { Store } = owl;

const DEBUG = true;

const StoreService = AbstractService.extend(EnvMixin, {
    TEST: {
        active: false,
        initStateAlteration: {},
    },
    dependencies: ['ajax', 'bus_service', 'env', 'local_storage'],
    /**
     * @override {web.AbstractService}
     */
    async start() {
        let state = initState(this.TEST.active ? this.TEST.initStateAlteration : undefined);
        const env = await this.getEnv({ withStore: false });
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

        this.ready = new Promise(resolve =>
            this.store.dispatch('initMessaging', {
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
     * @return {Promise<mail.store>}
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
            this.store.commit('handleGlobalResize', {
                globalInnerHeight: globalInnerHeight || this.store.state.global.innerHeight,
                globalInnerWidth: globalInnerWidth || this.store.state.global.innerWidth,
                isMobile: isMobile || this.store.state.isMobile,
            });
        } else {
            this.store.commit('handleGlobalResize', {
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
