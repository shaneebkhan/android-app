odoo.define('mail.wip.widget.ChatWindowHeader', function (require) {
"use strict";

const Icon = require('mail.wip.widget.ThreadIcon');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {string} ownProps.threadLID
 * @param {Object} state.getters
 * @return {Object}
 */
function mapStateToProps(state, ownProps, getters) {
    const threadLID = ownProps.threadLID;
    return {
        name: getters['thread/name']({ threadLID }),
        thread: state.threads[threadLID],
    };
}

class ChatWindowHeader extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.ChatWindowHeader';
        this.widgets = { Icon };
    }

    //--------------------------------------------------------------------------
    // Getter / Setter
    //--------------------------------------------------------------------------

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
            options.displayExpand = true;
        }
        return options;
    }

    /**
     * @return {mail.wip.model.Thread}
     */
    get thread() {
        return this.props.thread;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        if ('o_select' in ev && !ev.o_select) {
            return;
        }
        this.trigger('select', { threadLID: this.props.threadLID });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickClose(ev) {
        ev.o_select = false;
        this.trigger('close', { threadLID: this.props.threadLID });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickExpand(ev) {
        ev.o_select = false;
        if (['mail.channel', 'mail.box'].includes(this.thread._model)) {
            this.env.do_action('mail.action_wip_discuss', {
                clear_breadcrumbs: false,
                active_id: this.thread.lid,
                on_reverse_breadcrumb: () =>
                    // ideally discuss should do it itself...
                    this.env.store.commit('discuss/update', { open: false }),
            });
        } else {
            this.do_action({
                type: 'ir.actions.act_window',
                res_model: this.thread._model,
                views: [[false, 'form']],
                res_id: this.thread.id,
            });
        }
    }
}

return connect(mapStateToProps, { deep: false })(ChatWindowHeader);

});
