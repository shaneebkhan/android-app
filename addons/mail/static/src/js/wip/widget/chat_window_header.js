odoo.define('mail.wip.widget.ChatWindowHeader', function (require) {
"use strict";

const Icon = require('mail.wip.widget.ThreadIcon');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {string} ownProps.item
 * @param {Object} state.getters
 * @return {Object}
 */
function mapStateToProps(state, ownProps, getters) {
    const item = ownProps.item;
    const thread = state.threads[item];
    if (!thread) {
        return {};
    }
    return {
        thread,
        threadName: getters['thread/name']({ threadLID: item }),
    };
}

class ChatWindowHeader extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.id = `chat_window_header_${this.props.item}`;
        this.template = 'mail.wip.widget.ChatWindowHeader';
        this.widgets = { Icon };
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
        let options;
        if (this.props.options) {
            options = { ...this.props.options };
        } else {
            options = {};
        }
        if (!('displayExpand' in options)) {
            options.displayExpand = false;
        }
        if (!('displayLeftShift' in options)) {
            options.displayLeftShift = false;
        }
        if (!('displayRightShift' in options)) {
            options.displayRightShift = false;
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
        if (ev.odooPrevented) { return; }
        this.trigger('select', ev, { item: this.props.item });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickClose(ev) {
        if (ev.odooPrevented) { return; }
        this.trigger('close', ev, { item: this.props.item });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickExpand(ev) {
        if (ev.odooPrevented) { return; }
        ev.odooPrevented = true;
        if (!this.props.thread) {
            return;
        }
        if (['mail.channel', 'mail.box'].includes(this.props.thread._model)) {
            this.env.do_action('mail.action_wip_discuss', {
                clear_breadcrumbs: false,
                active_id: this.props.thread.lid,
                on_reverse_breadcrumb: () =>
                    // ideally discuss should do it itself...
                    this.env.store.commit('discuss/close'),
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
        if (ev.odooPrevented) { return; }
        this.trigger('shift-left', ev);
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickShiftRight(ev) {
        if (ev.odooPrevented) { return; }
        this.trigger('shift-right', ev);
    }
}

return connect(mapStateToProps, { deep: false })(ChatWindowHeader);

});
