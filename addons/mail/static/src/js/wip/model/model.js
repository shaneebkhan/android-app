odoo.define('mail.wip.model.Model', function () {
'use strict';

class Model {
    /**
     * @param {Object} data
     */
    constructor(data) {
        Object.assign(this, data);
        this._compute();
    }

    /**
     * @param {Object} data
     */
    update(data) {
        Object.assign(this, data);
        this._compute();
    }

    /**
     * @abstract
     * @private
     */
    _compute() {}
}

return Model;

});
