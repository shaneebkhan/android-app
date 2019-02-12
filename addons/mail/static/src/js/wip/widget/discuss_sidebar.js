odoo.define('mail.wip.widget.DiscussSidebar', function (require) {
'use strict';

const AutocompleteInput = require('mail.wip.widget.AutocompleteInput');
const SidebarItem = require('mail.wip.widget.DiscussSidebarItem');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {Object} getters
 * @return {Object}
 */
function mapStateToProps(state, ownProps, getters) {
    return {
        channels: getters['threads/pinned_channel'](),
        chats: getters['threads/pinned_chat'](),
        mailboxes: getters['threads/mailbox'](),
        mailChannelAmount: getters['threads/pinned_mail_channel_amount'](),
    };
}

class Sidebar extends Component {

    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.DiscussSidebar';
        this.state = {
            isAddingChannel: false,
            isAddingChat: false,
            quickSearchValue: '',
        };
        this.widgets = {
            AutocompleteInput,
            SidebarItem
        };
        this._channelAutocompleteLastSearchVal = undefined;

        // bind since passed as props
        this._onChannelAutocompleteSource = this._onChannelAutocompleteSource.bind(this);
        this._onChatAutocompleteSource = this._onChatAutocompleteSource.bind(this);
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {mail.wip.model.Thread[]}
     */
    get quickSearchChannels() {
        if (!this.state.quickSearchValue) {
            return this.props.channels;
        }
        const qsVal = this.state.quickSearchValue.toLowerCase();
        return this.props.channels.filter(channel => {
            const name = this.env.store.getters['thread/name']({
                threadLID: channel.lid,
            });
            const nameVal = name.toLowerCase();
            return nameVal.indexOf(qsVal) !== -1;
        });
    }

    /**
     * @return {mail.wip.model.Thread[]}
     */
    get quickSearchChats() {
        if (!this.state.quickSearchValue) {
            return this.props.chats;
        }
        const qsVal = this.state.quickSearchValue.toLowerCase();
        return this.props.chats.filter(chat => {
            const name = this.env.store.getters['thread/name']({
                threadLID: chat.lid,
            });
            const nameVal = name.toLowerCase();
            return nameVal.indexOf(qsVal) !== -1;
        });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} item
     * @param {intege} item.id
     * @param {string} [item.special]
     */
    _onChannelAutocompleteSelect(item) {
        if (!this._channelAutocompleteLastSearchVal) {
            return;
        }
        if (item.special) {
            this.env.store.dispatch('channel/create', {
                name: this._channelAutocompleteLastSearchVal,
                public: item.special,
                type: 'channel'
            });
        } else {
            this.env.store.dispatch('channel/join', { channelID: item.id });
        }
        this.state.isAddingChannel = false;
    }

    /**
     * @private
     * @param {Object} req
     * @param {string} req.term
     * @param {function} res
     */
    async _onChannelAutocompleteSource(req, res) {
        this._channelAutocompleteLastSearchVal = _.escape(req.term);
        const result = await this.env.rpc({
            model: 'mail.channel',
            method: 'channel_search_to_join',
            args: [this._channelAutocompleteLastSearchVal],
        });
        const items = result.map(data => {
            let escapedName = _.escape(data.name);
            return Object.assign(data, {
                label: escapedName,
                value: escapedName
            });
        });
        items.push({
            label: this.env._t(
                `<strong>Create <em><span class="fa fa-hashtag"/>${
                    this._channelAutocompleteLastSearchVal
                }</em></strong>`
            ),
            value: this._channelAutocompleteLastSearchVal,
            special: 'public'
        }, {
            label: this.env._t(
                `<strong>Create <em><span class="fa fa-lock"/>${
                    this._channelAutocompleteLastSearchVal
                }</em></strong>`
            ),
            value: this._channelAutocompleteLastSearchVal,
            special: 'private'
        });
        res(items);
    }

    /**
     * @private
     * @param {Object} item
     * @param {integer} item.id
     */
    _onChatAutocompleteSelect(item) {
        const partnerID = item.id;
        const chat = this.env.store.getters['thread/chat_from_partner']({
            partnerLID: `res.partner_${partnerID}`,
        });
        if (chat) {
            this.trigger('select-thread', { threadLID: chat.lid });
        } else {
            this.env.store.dispatch('channel/create', {
                autoselect: true,
                partnerID,
                type: 'chat'
            });
        }
        this.state.isAddingChat = false;
    }

    /**
     * @private
     * @param {Object} req
     * @param {string} req.term
     * @param {function} res
     */
    _onChatAutocompleteSource(req, res) {
        return this.env.store.dispatch('partner/search', {
            callback: res,
            limit: 10,
            value: _.escape(req.term)
        });
    }

    /**
     * @private
     */
    _onClickChannelAdd() {
        this.state.isAddingChannel = true;
    }

    /**
     * @private
     */
    _onClickChannelTitle() {
        return this.env.do_action({
            name: this.env._t("Public Channels"),
            type: 'ir.actions.act_window',
            res_model: 'mail.channel',
            views: [[false, 'kanban'], [false, 'form']],
            domain: [['public', '!=', 'private']]
        });
    }

    /**
     * @private
     */
    _onClickChatAdd() {
        return (this.state.isAddingChat = true);
    }

    /**
     * @private
     * @param {Object} param0
     * @param {string} threadLID
     */
    _onClickItem({ threadLID }) {
        return this.trigger('select-thread', { threadLID });
    }

    /**
     * @private
     */
    _onHideAddChannel() {
        return (this.state.isAddingChannel = false);
    }

    /**
     * @private
     */
    _onHideAddChat() {
        return (this.state.isAddingDm = false);
    }

    /**
     * @private
     */
    _onInputQuickSearch() {
        this.state.quickSearchValue = this.refs.quickSearch.value;
    }
}

return connect(mapStateToProps, { deep: false })(Sidebar);

});
