odoo.define('base_setup.ResConfigInviteUsers', function (require) {
    "use strict";

    var Widget = require('web.Widget');
    var widget_registry = require('web.widget_registry');
    var session = require ('web.session');
    var core = require('web.core');
    var framework = require('web.framework');

    var QWeb = core.qweb;
    var _t = core._t;

    var ResConfigInviteUsers = Widget.extend({
        template: 'res_config_invite_users',

       /**
        * @override
        * @param {Widget|null} parent
        * @param {Object} params
        */
        init: function (parent, record, nodeInfo, data) {
            this._super.apply(this, arguments);
            this.var = 5;
            this.data = data;
            this.parent = parent;
            this.emails = [];

            return this._super.apply(this, arguments);
           
        },

        events: {
            'click .o_web_settings_invite': '_onClickInvite',
            'click .o_web_settings_access_rights': 'on_access_rights_clicked',
            'click .o_web_settings_user': 'on_user_clicked',
            'click .o_web_settings_more': 'on_more',
            'click .o_badge_remove': '_onClickBadgeRemove',
            'keydown .o_user_emails': '_onKeydownUserEmails',
        },

       willStart: function(){
        
        var superDef = this._super.apply(this, arguments);
        return Promise.all([superDef, this.load()]);
        },

        load: function (){
            var self = this;
            return new Promise(function (resolve, reject){
                self._rpc({route: '/base_setup/data'})
                .then(function(data){
                    self.active_users = data.users_info.active_users;
                    self.pending_users = data.users_info.pending_users;
                    self.pending_count = data.users_info.pending_count;
                    self.parent = data.parent;
                    self.user_form_view_id = data.user_form_view_id;

                    resolve();
                    

                })      
            }); 
        },

        
    
        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------
    
        /**
         * Creates and appends badges for valid and unique email addresses
         *
         * @private
         */
        _createBadges: function () {
            var $userEmails = this.$('.o_user_emails');
            var value = $userEmails.val().trim();
            if (value) {
                // filter out duplicates
                var emails = _.uniq(value.split(/[ ,;\n]+/));
    
                // filter out invalid email addresses
                var invalidEmails = _.reject(emails, this._validateEmail.bind(this));
                if (invalidEmails.length) {
                    this.do_warn(_.str.sprintf(_t('The following email addresses are invalid: %s.'), invalidEmails.join(', ')));
                }
                emails = _.difference(emails, invalidEmails);
    
                if (!this.resend_invitation) {
                    // filter out already processed or pending addresses
                    var pendingEmails = _.map(this.pending_users, function (info) {
                        return info[1];
                    });
                    var existingEmails = _.intersection(emails, this.emails.concat(pendingEmails));
                    if (existingEmails.length) {
                        this.do_warn(_.str.sprintf(_t('The following email addresses already exist: %s.'), existingEmails.join(', ')));
                    }
                    emails = _.difference(emails, existingEmails);
                }
    
                // add valid email addresses, if any
                if (emails.length) {
                    this.emails = this.emails.concat(emails);
                    $userEmails.before(QWeb.render('EmailBadge', {emails: emails}));
                    $userEmails.val('');
                }
            }
        },
        /**
         * Removes a given badge from the DOM, and its associated email address
         *
         * @private
         * @param {jQueryElement} $badge
         */
        _removeBadge: function ($badge) {
            var email = $badge.text().trim();
            this.emails = _.without(this.emails, email);
            $badge.remove();
        },
        /**
         * @private
         * @param {string} email
         * @returns {boolean} true iff the given email address is valid
         */
        _validateEmail: function (email) {
            var re = /^([a-z0-9][-a-z0-9_\+\.]*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,63}(?:\.[a-z]{2})?)$/i;
            return re.test(email);
        },
        on_access_rights_clicked: function (e) {
            var self = this;
            e.preventDefault();
            this.do_action('base.action_res_users', {
                on_reverse_breadcrumb: function(){ return self.reload();}
            });
        },
        on_user_clicked: function (e) {
            var self = this;
            e.preventDefault();
            var user_id = $(e.currentTarget).data('user-id');
            var action = {
                type: 'ir.actions.act_window',
                view_type: 'form',
                view_mode: 'form',
                res_model: 'res.users',
                views: [[this.user_form_view_id, 'form']],
                res_id: user_id,
            };
            this.do_action(action,{
                on_reverse_breadcrumb: function(){ return self.reload();}
            });
        },
        on_more: function(e) {
            var self = this;
            e.preventDefault();
            var action = {
                name: _t('Users'),
                type: 'ir.actions.act_window',
                view_type: 'form',
                view_mode: 'tree,form',
                res_model: 'res.users',
                domain: [['log_ids', '=', false]],
                context: {search_default_no_share: true},
                views: [[false, 'list'], [false, 'form']],
            };
            this.do_action(action,{
                on_reverse_breadcrumb: function(){ return self.reload();}
            });
        },
        reload:function(){
            var self = this;
            return this.load()
            .then(function (){
                self.renderElement();
            });
        },
    
        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------
    
        /**
         * @private
         * @param {MouseEvent} ev
         */
        _onClickBadgeRemove: function (ev) {
            var $badge = $(ev.target).closest('.badge');
            this._removeBadge($badge);
        },
        /**
         * @private
         * @param {MouseEvent} ev
         */
        _onClickInvite: function (ev) {
            var self = this;
            this._createBadges();
            if (this.emails.length) {
                var $button = $(ev.target);
                $button.button('loading');
                this._rpc({
                    model: 'res.users',
                    method: 'web_dashboard_create_users',
                    args: [this.emails],
                })
                .then(function () {
                    self.reload();
                })
                .guardedCatch(function () {
                    $button.button('reset');
                });
            }
        },
        /**
         * @private
         * @param {KeyboardEvent} ev
         */
         _onKeydownUserEmails: function (ev) {
            var $userEmails = this.$('.o_user_emails');
            var keyCodes = [$.ui.keyCode.TAB, $.ui.keyCode.COMMA, $.ui.keyCode.ENTER, $.ui.keyCode.SPACE];
            if (_.contains(keyCodes, ev.which)) {
                ev.preventDefault();
                this._createBadges();
            }
            // remove last badge on backspace
            if (ev.which === $.ui.keyCode.BACKSPACE && this.emails.length && !$userEmails.val()) {
                this._removeBadge(this.$('.o_web_settings_invitation_form .badge:last'));
            }
        },
    });
    

   widget_registry.add('res_config_invite_users', ResConfigInviteUsers);
    
});