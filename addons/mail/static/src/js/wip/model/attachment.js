odoo.define('mail.wip.model.Attachment', function (require) {
'use strict';

const Model = require('mail.wip.model.Model');

class Attachment extends Model {
    /**
     * @override {mail.wip.model.Model}
     * @private
     */
    _compute() {
        const {
            checksum,
            filename,
            id,
            mimetype,
            name,
            type,
            url,
        } = this;

        const $filename = filename || name;
        const $filetype = this._computeFiletype({ mimetype, type, url });
        const $isTextFile = ($filetype && $filetype.indexOf('text') !== -1) || false;

        const mediaType = mimetype && mimetype.split('/').shift();
        Object.assign(this, {
            $ext: $filename && $filename.split('.').pop(),
            $filename,
            $filetype,
            $isTextFile,
            $name: name || filename,
            $src: this._computeSrc({ $filetype, checksum, id, url }),
            $viewable: mediaType === 'image' ||
                mediaType === 'video' ||
                mimetype === 'application/pdf' ||
                $isTextFile,
            _model: 'ir.attachment',
            lid: `ir.attachment_${id}`,
        });
    }

    /**
     * @private
     * @param {Object} param0
     * @param {string} [param0.mimetype]
     * @param {string} [param0.type]
     * @param {string} [param0.url]
     * @return {string|undefined}
     */
    _computeFiletype({ mimetype, type, url }) {
        if (type === 'url' && !url) {
            return undefined;
        } else if (!mimetype) {
            return undefined;
        }
        const match = type === 'url'
            ? url.match('(youtu|.png|.jpg|.gif)')
            : mimetype.match('(image|video|application/pdf|text)');
        if (!match) {
            return undefined;
        }
        if (match[1].match('(.png|.jpg|.gif)')) {
            return 'image';
        }
        return match[1];
    }

    /**
     * @private
     * @param {Object} param0
     * @param {string|undefined} param0.$filetype
     * @param {string|undefined} [param0.checksum]
     * @param {integer} param0.id
     * @param {string} [param0.url]
     * @return {string|undefined}
     */
    _computeSrc({ $filetype, id, checksum, url }) {
        if ($filetype === 'image') {
            return `/web/image/${id}?unique=1&amp;signature=${checksum}&amp;model=ir.attachment`;
        }
        if ($filetype === 'application/pdf') {
            return `/web/static/lib/pdfjs/web/viewer.html?file=/web/content/${id}?model%3Dir.attachment`;
        }
        if ($filetype && $filetype.indexOf('text') !== -1) {
            return `/web/content/${id}?model%3Dir.attachment`;
        }
        if ($filetype === 'youtu') {
            const token = this._computeSrcYoutubeToken({ $filetype, url });
            return `https://www.youtube.com/embed/${token}`;
        }
        if ($filetype === 'video') {
            return `/web/image/${id}?model=ir.attachment`;
        }
        return undefined;
    }

    /**
     * @private
     * @param {Object} param0
     * @param {string|undefined} param0.$filetype
     * @param {string} param0.url
     * @return {string|undefined}
     */
    _computeSrcYoutubeToken({ $filetype, url }) {
        if ($filetype !== 'youtu') {
            return undefined;
        }
        const urlArr = url.split('/');
        let token = urlArr[urlArr.length-1];
        if (token.indexOf('watch') !== -1) {
            token = token.split('v=')[1];
            const amp = token.indexOf('&');
            if (amp !== -1){
                token = token.substring(0, amp);
            }
        }
        return token;
    }
}

return Attachment;

});
