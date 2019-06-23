odoo.define('mail.component.Attachment', function (require) {
'use strict';

const { Component, connect } = owl;

class AttachmentWidget extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.component.Attachment';
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @return {string}
     */
    get attachmentUrl() {
        if (this.props.attachment.temp) {
            return '';
        }
        return this.env.session.url('/web/content', {
            id: this.props.attachment.id,
            download: true,
        });
    }

    /**
     * @return {Object}
     */
    get options() {
        let options = { ...this.props.options };
        _.defaults(options, {
            downloadable: false,
            editable: false,
            layout: 'basic',
            layoutBasicImageSize: 'medium',
            layoutCardLabel: true,
        });
        return options;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickImage(ev) {
        if (!this.props.attachment.isViewable) {
            return;
        }
        this.trigger('view', {
            attachmentLocalID: this.props.attachmentLocalID,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickUnlink(ev) {
        this.trigger('unlink', {
            attachmentLocalID: this.props.attachmentLocalID,
        });
    }
}

/**
 * Props validation
 */
AttachmentWidget.props = {
    attachment: {
        type: Object, // {mail.store.model.Attachment}
    },
    attachmentLocalID: {
        type: String,
    },
    options: {
        type: Object,
        default: {},
        shape: {
            downloadable: {
                type: Boolean,
                default: false,
            },
            editable: {
                type: Boolean,
                default: false,
            },
            layout: {
                type: String,
                default: 'basic', // ['basic', 'card']
            },
            layoutBasicImageSize: {
                type: String,
                default: 'medium', // ['small', 'medium', 'large']
            },
            layoutCardLabel: {
                type: Boolean,
                default: true,
            },
        },
    }
};

return connect(
    AttachmentWidget,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.attachmentLocalID
     */
    (state, ownProps) => {
        return {
            attachment: state.attachments[ownProps.attachmentLocalID],
        };
    },
    { deep: false }
);

});
