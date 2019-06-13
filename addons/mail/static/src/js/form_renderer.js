odoo.define('mail.form_renderer', function (require) {
"use strict";

var Chatter = require('mail.Chatter');
const ChatterWIP = require('mail.wip.widget.Chatter');
const EnvMixin = require('mail.wip.old_widget.EnvMixin');

var FormRenderer = require('web.FormRenderer');

FormRenderer.include(EnvMixin);

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
        this.chatterWIP = undefined;
    },
    willStart: function () {
        return Promise.all([
            this._super.apply(this, arguments),
            this.getEnv(),
        ]);
    },
    on_attach_callback: function () {
        this._super.apply(this, arguments);

        if (this.chatterWIP) {
            this.chatterWIP.mount(this.$temporaryParentDiv[0]).then(() => {
                $(this.chatterWIP.el).unwrap();
                this._handleAttributes($(this.chatterWIP.el), this._chatterNode);
            });
        }
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
                this.chatter.update(state, updatedMailFields);
                this._instanciateChatter(state);
            }
        }
        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _instanciateChatter: function (state) {
        if (this.chatterWIP) {
            this.chatterWIP.destroy();
        }
        this.chatterWIP = new ChatterWIP(this.env, {
            mailFields: this.mailFields,
            parent: this,
            record: state,
        });
    },
    /**
     * Overrides the function that renders the nodes to return the chatter's $el
     * for the 'oe_chatter' div node.
     *
     * @override
     * @private
     */
    _renderNode: function (node) {
        var self = this;
        if (node.tag === 'div' && node.attrs.class === 'oe_chatter') {

            this._chatterNode = node;
            this._instanciateChatter(this.state);
            this.$temporaryParentDiv = $('<div>', {class: 'oe_chatter'});
            // return this.$temporaryParentDiv;

            if (!this.chatter) {
                this.chatter = new Chatter(this, this.state, this.mailFields, {
                    isEditable: this.activeActions.edit,
                    viewType: 'form',
                });

                var $temporaryParentDiv = $('<div>');
                this.defs.push(this.chatter.appendTo($temporaryParentDiv).then(function () {
                    self.chatter.$el.unwrap();
                    self._handleAttributes(self.chatter.$el, node);
                }));
                return $temporaryParentDiv.add(this.$temporaryParentDiv);
            } else {
                this.chatter.update(this.state);
                return this.chatter.$el.add(this.$temporaryParentDiv);
            }
        } else {
            return this._super.apply(this, arguments);
        }
    },
});

});
