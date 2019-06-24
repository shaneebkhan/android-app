odoo.define('mail.component.ChatWindowHeader', function (require) {
"use strict";

const Icon = require('mail.component.ThreadIcon');

const { Component, connect } = owl;

class ChatWindowHeader extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = { Icon };
        this.id = `chat_window_header_${this.props.item}`;
        this.template = 'mail.component.ChatWindowHeader';
    }

    //--------------------------------------------------------------------------
    // Getter / Setter
    //--------------------------------------------------------------------------

    get name() {
        if (this.props.thread) {
            return this.props.threadName;
        }
        return this.env._t("New message");
    }

    /**
     * @return {Object}
     */
    get options() {
        let options = { ...this.props.options };
        if (!('expand' in options)) {
            options.expand = false;
        }
        if (!('shiftLeft' in options)) {
            options.shiftLeft = false;
        }
        if (!('shiftRight' in options)) {
            options.shiftRight = false;
        }
        return options;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        this.trigger('clicked', {
            item: this.props.item,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickClose(ev) {
        this.trigger('close', {
            item: this.props.item,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickExpand(ev) {
        if (!this.props.thread) {
            return;
        }
        if (['mail.channel', 'mail.box'].includes(this.props.thread._model)) {
            this.env.do_action('mail.action_owl_discuss', {
                clear_breadcrumbs: false,
                active_id: this.props.thread.localID,
                on_reverse_breadcrumb: () =>
                    // ideally discuss should do it itself...
                    this.env.store.commit('closeDiscuss'),
            });
        } else {
            this.do_action({
                type: 'ir.actions.act_window',
                res_model: this.props.thread._model,
                views: [[false, 'form']],
                res_id: this.props.thread.id,
            });
        }
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickShiftLeft(ev) {
        this.trigger('shift-left');
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickShiftRight(ev) {
        this.trigger('shift-right');
    }
}

ChatWindowHeader.props = {
    item: {
        type: String,
    },
    options: {
        type: Object,
        default: {},
        shape: {
            expand: {
                type: Boolean,
                default: false,
            },
            shiftLeft: {
                type: Boolean,
                default: false,
            },
            shiftRight: {
                type: Boolean,
                default: false,
            },
        },
    },
    thread: {
        type: Object, // {mail.store.model.Thread}
        optional: true,
    },
    threadName: {
        type: String,
        optional: true,
    },
};

return connect(
    ChatWindowHeader,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.item
     * @param {Object} state.getters
     * @return {Object}
     */
    (state, ownProps, getters) => {
        const item = ownProps.item;
        const thread = state.threads[item];
        const threadName = thread
            ? getters.threadName({ threadLocalID: item })
            : undefined;
        return {
            thread,
            threadName,
        };
    },
    { deep: false }
);

});
