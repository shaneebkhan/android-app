odoo.define('mail.wip.utils', function (require) {
"use strict";

/**
 * Deep diff between two object, using underscore
 * taken from https://stackoverflow.com/questions/38665719/find-difference-in-objects-using-underscore-js
 *
 * May be useful for debug
 *
 * @private
 * @param {Object} object object compared
 * @param {Object} base object to compare with
 * @return {Object} a new object representing the diff
 */
function difference(object, base) {
    const changes = (object, base) => {
        return _.pick(
            _.mapObject(object, (value, key) => {
                if (_.isEqual(value, base[key])) {
                    return null;
                }
                if (_.isObject(value) && _.isObject(base[key])) {
                    return changes(value, base[key]);
                }
                return value;
            }), value => value !== null,
        );
    };
    return changes(object, base);
}

return { difference };

});
