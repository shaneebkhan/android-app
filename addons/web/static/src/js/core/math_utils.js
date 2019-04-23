odoo.define('web.mathUtils', function (require) {
"use strict";

function binaryProduct (array1, array2) {
    var product = [];
    array1.forEach(function (elem1) {
        array2.forEach(function (elem2) {
            product.push([elem1, elem2]);
        });
    });
    return product;
}

function cartesian () {
    var args =  Array.prototype.slice.call(arguments);
    if (args.length === 0) {
        return [undefined];
    } else if (args.length === 1) {
        return args[0];
    } else {
        return cartesian.apply(null, [binaryProduct(args[0], args[1])].concat(args.slice(2)));
    }
}

function sections (array) {
    var sections = [];
    for (var i = 0; i < array.length + 1; i++) {
        sections.push(array.slice(0, i));
    }
    return sections;
}

return {
    cartesian: cartesian,
    sections: sections,
};

});