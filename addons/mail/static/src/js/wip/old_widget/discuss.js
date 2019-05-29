odoo.define('mail.wip.old_widget.Discuss', function (require) {
"use strict";

const InvitePartnerDialog = require('mail.wip.old_widget.DiscussInvitePartnerDialog');
const EnvMixin = require('mail.wip.old_widget.EnvMixin');
const DiscussOwl = require('mail.wip.widget.Discuss');

const AbstractAction = require('web.AbstractAction');
const core = require('web.core');

const _t = core._t;
const qweb = core.qweb;


const Discuss = AbstractAction.extend(EnvMixin, {
    DEBUG: true,
    template: 'mail.wip.old_widget.Discuss',
    hasControlPanel: true,
    loadControlPanel: true,
    withSearchBar: true,
    searchMenuTypes: ['filter', 'favorite'],
    custom_events: {
        search: '_onSearch',
    },
    /**
     * @override {web.AbstractAction}
     * @param {web.ActionManager} parent
     * @param {Object} action
     * @param {Object} [action.context]
     * @param {string} [action.context.active_id]
     * @param {Object} [action.params]
     * @param {string} [action.params.default_active_id]
     * @param {Object} [options={}]
     */
    init(parent, action, options={}) {
        this._super.apply(this, arguments);

        // render buttons in control panel
        this.$buttons = $(qweb.render('mail.wip.old_widget.discuss.ControlButtons'));
        this.$buttons.find('button').css({ display:'inline-block' });
        this.$buttons.on('click', '.o_invite', ev => this._onClickInvite(ev));
        this.$buttons.on('click', '.o_mark_all_read', ev => this._onClickMarkAllAsRead(ev));
        this.$buttons.on('click', '.o_unstar_all', ev => this._onClickUnstarAll(ev));

        // control panel attributes
        this.action = action;
        this.actionManager = parent;
        this.controlPanelParams.modelName = 'mail.message';
        this.options = options;

        // owl components
        this.component = undefined;

        this._initThreadLID = this.options.active_id ||
            (this.action.context && this.action.context.active_id) ||
            (this.action.params && this.action.params.default_active_id) ||
            'mail.box_inbox';

        if (this.DEBUG) {
            window.old_discuss = this;
        }
    },
    /**
     * @override {web.AbstractAction}
     * @return {Promise}
     */
    willStart() {
        return Promise.all([
            this._super.apply(this, arguments),
            this.getEnv()
        ]);
    },
    /**
     * @override {web.AbstractAction}
     */
    destroy() {
        if (this.component) {
            this.component.destroy();
            this.component = undefined;
        }
        if (this.$buttons) {
            this.$buttons.off().remove();
        }
        this._super.apply(this, arguments);
    },
    /**
     * @override {web.AbstractAction}
     */
    on_attach_callback() {
        this._super.apply(this, arguments);
        if (this.component) {
            // prevent twice call to on_attach_callback (FIXME)
            return;
        }
        Object.assign(this.env, {
            discuss: {
                initThreadLID: this._initThreadLID,
            },
        });
        this.component = new DiscussOwl(this.env);
        this.component.mount(this.$el[0]);
        this._pushStateActionManagerEventListener = ev => {
            ev.preventOdoo();
            this._pushStateActionManager(ev.detail.threadLID);
        };
        this._updateControlPanelEventListener = ev => {
            ev.preventOdoo();
            this._updateControlPanel();
        };
        this.el.addEventListener('push_state_action_manager', this._pushStateActionManagerEventListener);
        this.el.addEventListener('update_control_panel', this._updateControlPanelEventListener);
    },
    /**
     * @override {web.AbstractAction}
     */
    on_detach_callback() {
        this._super.apply(this, arguments);
        if (this.component) {
            this.component.destroy();
        }
        this.component = undefined;
        this.el.removeEventListener('push_state_action_manager', this._pushStateActionManagerEventListener);
        this.el.removeEventListener('update_control_panel', this._updateControlPanelEventListener);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {string} threadLID
     */
    _pushStateActionManager(threadLID) {
        this.actionManager.do_push_state({
            action: this.action.id,
            active_id: threadLID,
        });
    },
    /**
     * @private
     */
    _updateControlPanel() {
        const threadLID = this.component.props.threadLID;
        const hasMessages = this.component.hasThreadMessages;
        const isMobile = this.component.props.isMobile;
        const thread = this.component.props.thread;
        // Invite
        if (threadLID && thread.channel_type === 'channel') {
            this.$buttons
                .find('.o_invite')
                .removeClass('o_hidden');
        } else {
            this.$buttons
                .find('.o_invite')
                .addClass('o_hidden');
        }
        // Mark All Read
        if (threadLID === 'mail.box_inbox') {
            this.$buttons
                .find('.o_mark_all_read')
                .removeClass('o_hidden')
                .prop('disabled', !hasMessages);
        } else {
            this.$buttons
                .find('.o_mark_all_read')
                .addClass('o_hidden');
        }
        // Unstar All
        if (threadLID === 'mail.box_starred') {
            this.$buttons
                .find('.o_unstar_all')
                .removeClass('o_hidden')
                .prop('disabled', !hasMessages);
        } else {
            this.$buttons
                .find('.o_unstar_all')
                .addClass('o_hidden');
        }
        // Add channel
        if (isMobile && this.component.state.mobileNavbarTab === 'channel') {
            this.$buttons
                .find('.o_new_channel')
                .removeClass('o_hidden');
        } else {
            this.$buttons
                .find('.o_new_channel')
                .addClass('o_hidden');
        }
        // Add message
        if (isMobile && this.component.state.mobileNavbarTab === 'chat') {
            this.$buttons
                .find('.o_new_message')
                .removeClass('o_hidden');
        } else {
            this.$buttons
                .find('.o_new_message')
                .addClass('o_hidden');
        }
        if (isMobile) {
            this._setTitle(_t("Discuss"));
        } else {
            let title;
            if (threadLID) {
                const threadName = this.env.store.getters['thread/name']({ threadLID });
                const prefix = thread.channel_type === 'channel' && thread.public !== 'private' ? '#' : '';
                title = `${prefix}${threadName}`;
            } else {
                title = _t("Discuss");
            }
            this._setTitle(title);
        }
        this.updateControlPanel({
            cp_content: {
                $buttons: this.$buttons,
            },
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onClickInvite() {
        new InvitePartnerDialog(this, {
            store: this.env.store,
            threadLID: this.component.props.threadLID,
        }).open();
    },
    /**
     * @private
     */
    _onClickMarkAllAsRead() {
        this.env.store.dispatch('messages/mark_all_as_read', { domain: this.domain });
    },
    /**
     * @private
     */
    _onClickUnstarAll() {
        this.env.store.dispatch('message/unstar_all');
    },
    /**
     * @private
     * @param {OdooEvent} ev
     * @param {Array} ev.data.domain
     */
    _onSearch(ev) {
        ev.stopPropagation();
        this.component.updateDomain(ev.data.domain);
    },
});

core.action_registry.add('mail.wip.discuss', Discuss);

return Discuss;

});
