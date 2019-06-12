odoo.define('mail.wip.widget.Composer', function (require) {
'use strict';

const AttachmentList = require('mail.wip.widget.AttachmentList');
const Input = require('mail.wip.widget.ComposerInput');
const EmojisButton = require('mail.wip.widget.EmojisButton');

const core = require('web.core');

const { Component } = owl;

class Composer extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.fileuploadID = _.uniqueId('o_composer_fileupload');
        this.state = { attachmentLIDs: [] };
        this.template = 'mail.wip.widget.Composer';
        this.widgets = { AttachmentList, EmojisButton, Input };
    }

    mounted() {
        this._onAttachmentUploadedEventListener = (...args) => this._onAttachmentUploaded(...args);
        $(window).on(this.fileuploadID, this._onAttachmentUploadedEventListener);
    }

    willUnmount() {
        $(window).off(this.fileuploadID, this._onAttachmentUploadedEventListener);
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {Object}
     */
    get attachmentOptions() {
        return {
            editable: this.options.attachmentEditable,
            layout: this.options.attachmentLayout,
            layoutCardLabel: this.options.attachmentLayoutCardLabel,
        };
    }

    /**
     * @return {Object}
     */
    get inputOptions() {
        return {
            minHeight: 30,
        };
    }

    /**
     * @return {Object}
     */
    get options() {
        let options = { ...this.props.options };
        _.defaults(options, {
            avatar: true,
            sendButton: true,
        });
        return options;
    }

    /**
     * @return {boolean}
     */
    get showFooter() {
        return this.state.attachmentLIDs.length > 0;
    }

    /**
     * @return {string}
     */
    get userAvatar() {
        const avatar = this.env.session.uid > 0
            ? this.env.session.url('/web/image', {
                    model: 'res.users',
                    field: 'image_small',
                    id: this.env.session.uid
                })
            : '/web/static/src/img/user_menu_avatar.png';
        return avatar;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    focus() {
        this.refs.input.focus();
    }

    focusout() {
        this.refs.input.focusout();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _postMessage() {
        this.env.store.dispatch('thread/post_message', {
            data: {
                attachmentLIDs: this.state.attachmentLIDs,
                content: this.refs.input.getValue(),
            },
            threadLID: this.props.threadLID,
        });
        this.refs.input.resetValue();
        this.state.attachmentLIDs = [];
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {jQuery.Event} ev
     * @param {...Object} fileData
     */
    _onAttachmentUploaded(ev, ...filesData) {
        for (const fileData of filesData) {
            const {
                error,
                filename,
                id,
                mimetype,
                name,
                size,
            } = fileData;
            const tempLID = this.env.store.state.attachmentTempLIDs[filename];
            const index = this.state.attachmentLIDs.findIndex(lid => lid === tempLID);
            this.state.attachmentLIDs.splice(index, 1);
            this.env.store.commit('attachment/delete', { attachmentLID: tempLID });
            if (error || !id) {
                this.env.do_warn(error);
                return;
            }
            const attachmentLID = `ir.attachment_${id}`;
            if (index >= this.state.attachmentLIDs.length) {
                this.state.attachmentLIDs.push(attachmentLID);
            } else {
                this.state.attachmentLIDs.splice(index, 0, attachmentLID);
            }
            this.env.store.commit('attachment/create', {
                filename,
                id,
                mimetype,
                name,
                size,
                uploaded: true,
            });
        }
    }

    /**
     * @private
     * @param {Event} ev
     */
    async _onChangeAttachment(ev) {
        const files = ev.target.files;
        for (const file of files) {
            const attachment = this.state.attachmentLIDs
                .map(attachmentLID => this.env.store.state.attachments[attachmentLID])
                .find(attachment => attachment.name === file.name && attachment.size === file.size);
            // if the files already exits, delete the file before upload
            if (attachment) {
                const attachmentLID = attachment.lid;
                this.state.attachmentLIDs = this.state.attachmentLIDs.filter(lid =>
                    lid !== attachmentLID);
                this.env.store.dispatch('attachment/unlink', { attachmentLID: attachment.lid });
            }
        }
        for (const file of files) {
            const attachmentLID = this.env.store.commit('attachment/create', {
                name: file.name,
                temp: true,
                uploading: true,
            });
            this.state.attachmentLIDs.push(attachmentLID);
        }
        let formData = new window.FormData();
        formData.append('callback', this.fileuploadID);
        formData.append('csrf_token', core.csrf_token);
        formData.append('id', '0');
        formData.append('model', 'mail.compose.message');
        for (const file of files) {
            // removing existing key with blank data and appending again with file info
            // In safari, existing key will not be updated when append with new file.
            formData.delete('ufile');
            formData.append('ufile', file, file.name);
            const response = await window.fetch('/web/binary/upload_attachment', {
                method: 'POST',
                body: formData,
            });
            let html = await response.text();
            const template = document.createElement('template');
            template.innerHTML = html.trim();
            window.eval.call(window, template.content.firstChild.textContent);
        }
    }

    /**
     * @private
     */
    _onClickAddAttachment() {
        this.refs.fileInput.click();
        this.focus();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickSend(ev) {
        if (ev.odooPrevented) { return; }
        if (!this.refs.input.getValue()) {
            return;
        }
        ev.preventOdoo();
        this._postMessage();
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.unicode
     */
    _onEmojiSelection(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this.refs.input.insert(ev.detail.unicode);
    }

    /**
     * @private
     * @param {CustomEvent} ev
     */
    _onPostMessageInput(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this._postMessage();
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.attachmentLID
     */
    _onUnlinkAttachment(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        const { attachmentLID } = ev.detail;
        this.env.store.dispatch('attachment/unlink', { attachmentLID });
        const index = this.state.attachmentLIDs.findIndex(lid => lid === attachmentLID);
        this.state.attachmentLIDs.splice(index, 1);
        this.refs.fileInput.value = '';
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.attachmentLID
     */
    _onViewAttachment(ev) {
        if (ev.odooPrevented) { return; }
        ev.preventOdoo();
        this.env.store.commit('attachments/view', {
            attachmentLID: ev.detail.attachmentLID,
            attachmentLIDs: this.state.attachmentLIDs.filter(attachmentLID => {
                const attachment = this.env.store.state.attachments[attachmentLID];
                return attachment.$viewable;
            }),
        });
    }
}

/**
 * Props validation
 */
Composer.props = {
    options: {
        type: Object,
        default: {},
        shape: {
            attachmentEditable: {
                type: Boolean,
                optional: true,
            },
            attachmentLayout: {
                type: String,
                optional: true,
            },
            attachmentLayoutCardLabel: {
                type: Boolean,
                optional: true,
            },
            avatar: {
                type: Boolean,
                default: true,
            },
            sendButton: {
                type: Boolean,
                default: true,
            },
        },
    },
    threadLID: {
        type: String,
        optional: true,
    },
};

return Composer;

});
