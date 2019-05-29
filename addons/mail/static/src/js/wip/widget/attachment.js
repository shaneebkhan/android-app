odoo.define('mail.wip.widget.Attachment', function (require) {
'use strict';

const Attachment = require('mail.wip.model.Attachment');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {string} ownProps.attachmentLID
 */
function mapStateToProps(state, ownProps) {
    return {
        attachment: state.attachments[ownProps.attachmentLID],
    };
}

class AttachmentWidget extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.Attachment';
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
        if (!this.props.attachment.$viewable) {
            return;
        }
        this.trigger('view', {
            attachmentLID: this.props.attachmentLID,
            originalEvent: ev,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickUnlink(ev) {
        this.trigger('unlink', {
            attachmentLID: this.props.attachmentLID,
            originalEvent: ev,
        });
    }
}

/**
 * Props validation
 */
AttachmentWidget.props = {
    attachment: {
        type: Attachment,
    },
    attachmentLID: {
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

return connect(mapStateToProps, { deep: false })(AttachmentWidget);

});
