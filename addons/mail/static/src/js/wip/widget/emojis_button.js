odoo.define('mail.wip.widget.EmojisButton', function (require) {
'use strict';

const Popover = require('mail.wip.widget.EmojisPopover');

const { Component } = owl;

class EmojisButton extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.EmojisButton';
        this._$popover = undefined;
        this._id = _.uniqueId('emojis_button');
        this._popover = undefined;
        this._popoverID = undefined;
    }

    mounted() {
        this._popover = new Popover(this.env);
        this._popover.mount(document.createElement('div')).then(() => {
            const self = this;
            this._popover.el.outerHTML = this._popover.el;
            this._$popover = $(this.el).popover({
                html: true,
                boundary: 'viewport',
                placement: 'top',
                trigger: 'click',
                offset: '0, 1',
                content() {
                    const $this = $(this);
                    self._popoverID = $this.attr('aria-describedby');
                    return self._popover.el;
                }
            });
        });
        this._popover.on('selection', this, ({ source }) => this._onEmojiSelection({ source }));
        $(document).on(`click.${this._id}`, ev => this._onDocumentClick(ev));
    }

    willUnmount() {
        this._hidePopover();
        this._popover.destroy();
        $(document).off(`click.${this._id}`);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _hidePopover() {
        this._$popover.popover('hide');
        this._popoverID = undefined;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onDocumentClick(ev) {
        if (ev.target === this.el) {
            return;
        }
        if (!this._popoverID) {
            return;
        }
        if (ev.target.closest(`#${this._popoverID}`)) {
            return;
        }
        this._$popover.popover('hide');
    }

    /**
     * @private
     * @param {Object} param0
     * @param {string} param0.source
     */
    _onEmojiSelection({ source }) {
        this._hidePopover();
        this.trigger('emoji-selection', { source });
    }
}

return EmojisButton;

});
