odoo.define('mail.wip.widget.AttachmentList', function (require) {
'use strict';

const Attachment = require('mail.wip.widget.Attachment');

const { Component } = owl;

class AttachmentList extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.wip.widget.AttachmentList';
        this.widgets = { Attachment };
    }
}

/**
 * Props validation
 */
AttachmentList.props = {
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

return AttachmentList;

});
