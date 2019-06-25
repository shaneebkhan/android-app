odoo.define('mail.component.Composer', function (require) {
'use strict';

const AttachmentList = require('mail.component.AttachmentList');
const Input = require('mail.component.ComposerTextInput');
const EmojisButton = require('mail.component.EmojisButton');

const core = require('web.core');

const { Component } = owl;

class Composer extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = { AttachmentList, EmojisButton, Input };
        this.fileuploadID = _.uniqueId('o_composer_fileupload');
        this.id = _.uniqueId('o_mail_component_Composer');
        this.state = {
            attachmentLocalIDs: [],
            showAllSuggestedRecipients: false,
        };
        this.template = 'mail.component.Composer';
    }

    mounted() {
        this._attachmentUploadedEventListener = (...args) => this._onAttachmentUploaded(...args);
        this._globalClickCaptureEventListener = (...args) => this._onClickCaptureGlobal(...args);
        document.addEventListener('click', this._globalClickCaptureEventListener, true);
        $(window).on(this.fileuploadID, this._attachmentUploadedEventListener);
    }

    willUnmount() {
        document.removeEventListener('click', this._globalClickCaptureEventListener, true);
        $(window).off(this.fileuploadID, this._attachmentUploadedEventListener);
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
        return this.state.attachmentLocalIDs.length > 0;
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
        this.refs.textInput.focus();
    }

    focusout() {
        this.refs.textInput.focusout();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _postMessage() {
        // TODO: take suggested recipients into account
        this.env.store.dispatch('postMessageOnThread', {
            data: {
                attachmentLocalIDs: this.state.attachmentLocalIDs,
                content: this.refs.textInput.getValue(),
            },
            threadLocalID: this.props.threadLocalID,
        });
        this.refs.textInput.resetValue();
        this.state.attachmentLocalIDs = [];
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
            const tempLocalID = this.env.store.state.attachmentTempLocalIDs[filename];
            const index = this.state.attachmentLIDs.findIndex(localID =>
                localID === tempLocalID);
            this.state.attachmentLocalIDs.splice(index, 1);
            this.env.store.commit('deleteAttachment', { attachmentLocalID: tempLocalID });
            if (error || !id) {
                this.env.do_warn(error);
                return;
            }
            const attachmentLocalID = `ir.attachment_${id}`;
            if (index >= this.state.attachmentLocalIDs.length) {
                this.state.attachmentLocalIDs.push(attachmentLocalID);
            } else {
                this.state.attachmentLocalIDs.splice(index, 0, attachmentLocalID);
            }
            this.env.store.commit('createAttachment', {
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
            const attachment = this.state.attachmentLocalIDs
                .map(localID => this.env.store.state.attachments[localID])
                .find(attachment => attachment.name === file.name && attachment.size === file.size);
            // if the files already exits, delete the file before upload
            if (attachment) {
                const attachmentLocalID = attachment.localID;
                this.state.attachmentLocalIDs = this.state.attachmentLocalIDs.filter(localID =>
                    localID !== attachmentLocalID);
                this.env.store.dispatch('unlinkAttachment', { attachmentLocalID: attachment.localID });
            }
        }
        for (const file of files) {
            const attachmentLocalID = this.env.store.commit('createAttachment', {
                name: file.name,
                temp: true,
                uploading: true,
            });
            this.state.attachmentLocalIDs.push(attachmentLocalID);
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
    _onClickCaptureGlobal(ev) {
        if (ev.target.closest(`[data-id="${this.id}"]`)) {
            this.refs.textInput.saveRange();
        }
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickSend(ev) {
        if (!this.refs.textInput.getValue()) {
            return;
        }
        ev.stopPropagation();
        this._postMessage();
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.unicode
     */
    _onEmojiSelection(ev) {
        this.refs.textInput.insert(ev.detail.unicode);
    }

    /**
     * @private
     * @param {CustomEvent} ev
     */
    _onPostMessageTextInput(ev) {
        this._postMessage();
    }

    /**
     * @private
     */
    _onShowLessSuggestedRecipients() {
        this.state.showAllSuggestedRecipients = false;
    }

    /**
     * @private
     */
    _onShowMoreSuggestedRecipients() {
        this.state.showAllSuggestedRecipients = true;
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.attachmentLocalID
     */
    _onUnlinkAttachment(ev) {
        const { attachmentLocalID } = ev.detail;
        this.env.store.dispatch('unlinkAttachment', { attachmentLocalID });
        const index = this.state.attachmentLocalIDs.findIndex(localID =>
            localID === attachmentLocalID);
        this.state.attachmentLocalIDs.splice(index, 1);
        this.refs.fileInput.value = '';
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.attachmentLocalID
     */
    _onViewAttachment(ev) {
        this.env.store.commit('viewAttachments', {
            attachmentLocalID: ev.detail.attachmentLocalID,
            attachmentLocalIDs: this.state.attachmentLocalIDs.filter(localID => {
                const attachment = this.env.store.state.attachments[localID];
                return attachment.isViewable;
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
    threadLocalID: {
        type: String,
        optional: true,
    },
    suggestedRecipients: {
        type: Array,
        optional: true,
    },
};

return Composer;

});
