odoo.define('mail.form_renderer', function (require) {
"use strict";

var Chatter = require('mail.wip.widget.Chatter');
const StoreMixin = require('mail.wip.old_widget.StoreMixin');

const core = require('web.core');
var FormRenderer = require('web.FormRenderer');
const session = require('web.session');

const _t = core._t;

FormRenderer.include(StoreMixin);

/**
 * Include the FormRenderer to instanciate the chatter area containing (a
 * subset of) the mail widgets (mail_thread, mail_followers and mail_activity).
 */
FormRenderer.include({
    /**
     * @override
     */
    init: function (parent, state, params) {
        this._super.apply(this, arguments);
        this.mailFields = params.mailFields;
        this.chatter = undefined;
    },
    willStart: function () {
        return Promise.all([
            this._super.apply(this, arguments),
            this.awaitStore(),
        ]);
    },
    on_attach_callback: function () {
        this._super.apply(this, arguments);

        this.chatter.mount(this.$temporaryParentDiv[0]).then(() => {
            $(this.chatter.el).unwrap();
            this._handleAttributes($(this.chatter.el), this._chatterNode);
        });
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Updates the chatter area with the new state if its fields has changed
     *
     * @override
     */
    confirmChange: function (state, id, fields) {
        if (this.chatter) {
            var chatterFields = ['message_attachment_count'].concat(_.values(this.mailFields));
            var updatedMailFields = _.intersection(fields, chatterFields);
            if (updatedMailFields.length) {
                this._instanciateChatter(state);
                // this.chatter.update(state, updatedMailFields);
            }
        }
        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _instanciateChatter: function (state) {
        if (this.chatter) {
            this.chatter.destroy();
        }
        const env = {
            qweb: core.qwebOwl,
            session,
            store: this.store,
            call: (...args) => this.call(...args),
            do_action: (...args) => this.do_action(...args),
            rpc: (...args) => this._rpc(...args),
            _t,
        };

        this.chatter = new Chatter(env, { state });
    },
    /**
     * Overrides the function that renders the nodes to return the chatter's $el
     * for the 'oe_chatter' div node.
     *
     * @override
     * @private
     */
    _renderNode: function (node) {
        if (node.tag === 'div' && node.attrs.class === 'oe_chatter') {
            this._chatterNode = node;
            this._instanciateChatter(this.state);
            this.$temporaryParentDiv = $('<div>');
            return this.$temporaryParentDiv;
        } else {
            return this._super.apply(this, arguments);
        }
    },
});

});
