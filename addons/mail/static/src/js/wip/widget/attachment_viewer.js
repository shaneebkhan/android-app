odoo.define('mail.wip.widget.AttachmentViewer', function (require) {
'use strict';

const Attachment = require('mail.wip.model.Attachment');

const { Component, connect } = owl;

const MIN_SCALE = 0.5;
const SCROLL_ZOOM_STEP = 0.1;
const ZOOM_STEP = 0.5;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {Object} ownProps.info
 * @param {string} ownProps.info.attachmentLID
 */
function mapStateToProps(state, ownProps) {
    return {
        attachment: state.attachments[ownProps.info.attachmentLID],
    };
}

class AttachmentViewer extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.MIN_SCALE = MIN_SCALE;
        this.state = {
            angle: 0,
            imageLoading: false,
            scale: 1,
        };
        this._translate = {
            x: 0,
            y: 0,
            dx: 0,
            dy: 0,
        };
        this.template = 'mail.wip.widget.AttachmentViewer';
        this._globalClickEventListener = ev => this._onClickGlobal(ev);
    }

    mounted() {
        this.el.focus();
        this._handleImageLoad();
        this._renderedAttachmentLID = this.props.info.attachmentLID;
        document.addEventListener('click', this._globalClickEventListener);
    }

    patched() {
        this._handleImageLoad();
        this._renderedAttachmentLID = this.props.info.attachmentLID;
    }

    willUnmount() {
        document.removeEventListener('click', this._globalClickEventListener);
    }

    //--------------------------------------------------------------------------
    // Getter / Setter
    //--------------------------------------------------------------------------

    /**
     * @return {string}
     */
    get imageStyle() {
        let style = `transform: ` +
            `scale3d(${this.state.scale}, ${this.state.scale}, 1) ` +
            `rotate(${this.state.angle}deg);`;

        if (this.state.angle % 180 !== 0) {
            style += `` +
                `max-height: ${window.innerWidth}px; ` +
                `max-width: ${window.innerHeight}px;`;
        } else {
            style += `` +
                `max-height: 100%; ` +
                `max-width: 100%;`;
        }
        return style;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @return {boolean}
     */
    isCloseable() {
        return !this._dragging;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} [ev]
     */
    _close(ev) {
        this.trigger('close', { originalEvent: ev });
    }

    /**
     * @private
     */
    _download() {
        window.location = `/web/content/ir.attachment/${this.props.attachment.id}/datas?download=true`;
    }

    /**
     * @private
     */
    _handleImageLoad() {
        if (
            this.props.attachment.$filetype === 'image' &&
            this._renderedAttachmentLID !== this.props.info.attachmentLID
        ) {
            this.state.imageLoading = true;
            this.refs.image.addEventListener('load', ev => this._onLoadImage(ev));
        }
    }

    /**
     * @private
     */
    _next() {
        const index = this.props.info.attachmentLIDs.findIndex(lid =>
            lid === this.props.info.attachmentLID);
        const nextIndex = (index + 1) % this.props.info.attachmentLIDs.length;
        this.env.store.commit('dialog/update_info', {
            id: this.props.dialogID,
            changes: {
                attachmentLID: this.props.info.attachmentLIDs[nextIndex],
            },
        });
    }

    /**
     * @private
     */
    _previous() {
        const index = this.props.info.attachmentLIDs.findIndex(lid =>
            lid === this.props.info.attachmentLID);
        const nextIndex = index === 0
            ? this.props.info.attachmentLIDs.length - 1
            : index - 1;
        this.env.store.commit('dialog/update_info', {
            id: this.props.dialogID,
            changes: {
                attachmentLID: this.props.info.attachmentLIDs[nextIndex],
            },
        });
    }

    /**
     * @private
     */
    _print() {
        var printWindow = window.open('about:blank', '_new');
        printWindow.document.open();
        printWindow.document.write(`
            <html>
                <head>
                    <script>
                        function onloadImage() {
                            setTimeout('printImage()', 10);
                        }
                        function printImage() {
                            window.print();
                            window.close();
                        }
                    </script>
                </head>
                <body onload='onloadImage()'>
                    <img src="${this.src}" alt=""/>
                </body>
            </html>`);
        printWindow.document.close();
    }

    /**
     * @private
     */
    _rotate() {
        this.state.angle += 90;
    }

    /**
     * @private
     */
    _stopDragging() {
        this._dragging = false;
        this._translate.x += this._translate.dx;
        this._translate.y += this._translate.dy;
        this._translate.dx = 0;
        this._translate.dy = 0;
        this._updateZoomerStyle();
    }

    /**
     * @private
     * @return {string}
     */
    _updateZoomerStyle() {
        const tx = this.refs.image.offsetWidth*this.state.scale > this.refs.zoomer.offsetWidth
            ? this._translate.x + this._translate.dx
            : 0;
        const ty = this.refs.image.offsetHeight*this.state.scale > this.refs.zoomer.offsetHeight
            ? this._translate.y + this._translate.dy
            : 0;
        if (tx === 0) {
            this._translate.x = 0;
        }
        if (ty === 0) {
            this._translate.y = 0;
        }
        this.refs.zoomer.style = `transform: ` +
            `translate(${tx}px, ${ty}px)`;
    }

    /**
     * @private
     * @param {Object} [param0={}]
     * @param {boolean} [param0.scroll=false]
     */
    _zoomIn({ scroll=false }={}) {
        this.state.scale = this.state.scale + (scroll ? SCROLL_ZOOM_STEP : ZOOM_STEP);
        this._updateZoomerStyle();
    }

    /**
     * @private
     * @param {Object} [param0={}]
     * @param {boolean} [param0.scroll=false]
     */
    _zoomOut({ scroll=false }={}) {
        if (this.state.scale === MIN_SCALE) { return; }
        this.state.scale = Math.max(MIN_SCALE, this.state.scale - (scroll ? SCROLL_ZOOM_STEP : ZOOM_STEP));
        this._updateZoomerStyle();
    }

    /**
     * @private
     */
    _zoomReset() {
        this.state.scale = 1;
        this._updateZoomerStyle();
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
        if (this._dragging) { return; }
        this._close(ev);
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickClose(ev) {
        if (ev.odooPrevented) { return; }
        this._close(ev);
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickDownload(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this._download();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickGlobal(ev) {
        if (ev.odooPrevented) { return; }
        if (!this._dragging) { return; }
        ev.preventOdoo();
        this._stopDragging();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickHeader(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickImage(ev) {
        if (ev.odooPrevented) { return; }
        if (this._dragging) { return; }
        ev.preventOdoo();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickNext(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this._next();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickPrevious(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this._previous();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickPrint(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this._print();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickRotate(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this._rotate();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickVideo(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickZoomIn(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this._zoomIn();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickZoomOut(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this._zoomOut();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickZoomReset(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this._zoomReset();
    }

    /**
     * @private
     * @param {KeyboardEvent} ev
     */
    _onKeydown(ev) {
        if (ev.odooPrevented) { return; }
        switch (ev.key) {
            case 'ArrowRight':
                this._next();
                break;
            case 'ArrowLeft':
                this._previous();
                break;
            case 'Escape':
                this._close(ev);
                break;
            case 'q':
                this._close(ev);
                break;
            case 'r':
                this._rotate();
                break;
            case '+':
                this._zoomIn();
                break;
            case '-':
                this._zoomOut();
                break;
            case '0':
                this._zoomReset();
                break;
            default:
                return;
        }
        ev.preventOdoo();
        ev.stopPropagation(); // prevent keydown event on fuzzy search in home menu
    }

    /**
     * @private
     * @param {Event} ev
     */
    _onLoadImage(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this.state.imageLoading = false;
    }

    /**
     * @private
     * @param {DragEvent} ev
     */
    _onMousedownImage(ev) {
        if (ev.odooPrevented) { return; }
        if (this._dragging) { return; }
        if (ev.button !== 0) { return; }
        ev.preventOdoo();
        this._dragging = true;
        this._dragstartX = ev.clientX;
        this._dragstartY = ev.clientY;
    }

    /**
     * @private
     * @param {DragEvent}
     */
    _onMousemoveView(ev) {
        if (ev.odooPrevented) { return; }
        if (!this._dragging) { return; }
        this._translate.dx = ev.clientX - this._dragstartX;
        this._translate.dy = ev.clientY - this._dragstartY;
        // $image.css('cursor', 'move');
        this._updateZoomerStyle();
    }

    /**
     * @private
     * @param {Event} ev
     */
    _onWheelImage(ev) {
        if (ev.odooPrevented) { return; }
        if (!this.el) { return; }
        ev.preventOdoo();
        if (ev.deltaY > 0) {
            this._zoomIn({ scroll: true });
        } else {
            this._zoomOut({ scroll: true });
        }
    }
}

/**
 * Props validation
 */
AttachmentViewer.props = {
    attachment: {
        type: Attachment,
    },
    info: {
        type: Object,
        shape: {
            attachmentLID: {
                type: String,
            },
            attachmentLIDs: {
                type: Array,
                element: String,
            }
        },
    },
};

return connect(mapStateToProps, { deep: false })(AttachmentViewer);

});
