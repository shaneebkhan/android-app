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
        this.state = { open: false };
        this.template = 'mail.wip.widget.EmojisButton';
        this._$popover = undefined;
        this._globalCaptureEventListener = ev => this._onClickCaptureGlobal(ev);
        this._popover = undefined;
        this._popoverID = undefined;
    }

    async mounted() {
        this._popover = new Popover(this.env);
        await this._popover.mount(document.createElement('div')).then(() => {
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
        this._popover.el.addEventListener('selection', ev => this._onEmojiSelection(ev));
        document.addEventListener('click', this._globalCaptureEventListener, true);
    }

    willUnmount() {
        this._hidePopover();
        this._popover.destroy();
        document.removeEventListener('click', this._globalCaptureEventListener, true);
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
        this.state.open = false;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickCaptureGlobal(ev) {
        if (ev.odooPrevented) { return; }
        if (ev.target === this.el) {
            this.state.open = true;
            return;
        }
        if (!this._popoverID) {
            return;
        }
        if (ev.target.closest(`#${this._popoverID}`)) {
            this.state.open = true;
            return;
        }
        this._hidePopover();
    }

    /**
     * @private
     * @param {CustomEvent} ev
     */
    _onEmojiSelection(ev) {
        if (ev.odooPrevented) { return; }
        this._hidePopover();
    }
}

return EmojisButton;

});
