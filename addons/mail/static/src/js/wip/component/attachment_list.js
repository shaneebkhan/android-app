odoo.define('mail.wip.component.AttachmentList', function (require) {
'use strict';

const Attachment = require('mail.wip.component.Attachment');

const { Component } = owl;

class AttachmentList extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = { Attachment };
        this.template = 'mail.wip.component.AttachmentList';
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
