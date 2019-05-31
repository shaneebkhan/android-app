odoo.define('sale_product_configurator.OptionalProductsModal', function (require) {
    "use strict";

var ajax = require('web.ajax');
var Dialog = require('web.Dialog');
var ServicesMixin = require('web.ServicesMixin');
var VariantMixin = require('sale.VariantMixin');

var OptionalProductsModal = Dialog.extend(ServicesMixin, VariantMixin, {
    events:  _.extend({}, Dialog.prototype.events, VariantMixin.events, {
        'click a.js_add, a.js_remove': '_onAddOrRemoveOption',
        'click button.js_add_cart_json': 'onClickAddCartJSON',
        'change .in_cart input.js_quantity': '_onChangeQuantity',
        'change .js_raw_price': '_computePriceTotal'
    }),
    /**
     * Initializes the optional products modal
     *
     * @override
     * @param {$.Element} parent The parent container
     * @param {Object} params
     * @param {integer} params.pricelistId
     * @param {string} params.okButtonText The text to apply on the "ok" button, typically
     *   "Add" for the sale order and "Proceed to checkout" on the web shop
     * @param {string} params.cancelButtonText same as "params.okButtonText" but
     *   for the cancel button
     * @param {integer} params.previousModalHeight used to configure a min height on the modal-content.
     *   This parameter is provided by the product configurator to "cover" its modal by making
     *   this one big enough. This way the user can't see multiple buttons (which can be confusing).
     * @param {Object} params.rootProduct The root product of the optional products window
     * @param {integer} params.rootProduct.product_id
     * @param {integer} params.rootProduct.quantity
     * @param {Array} params.rootProduct.variant_values
     * @param {Array} params.rootProduct.product_custom_attribute_values
     * @param {Array} params.rootProduct.no_variant_attribute_values
     */
    init: function (parent, params) {
        var self = this;

        var options = _.extend({
            size: 'large',
            buttons: [{
                text: params.okButtonText,
                click: this._onConfirmButtonClick,
                classes: 'btn-primary'
            }, {
                text: params.cancelButtonText,
                click: this._onCancelButtonClick
            }],
            technical: !params.isWebsite,
        }, params || {});

        this._super(parent, options);

        this.context = params.context;
        this.rootProduct = params.rootProduct;
        this.container = parent;
        this.pricelistId = params.pricelistId;
        this.previousModalHeight = params.previousModalHeight;
        this.dialogClass = 'oe_optional_products_modal';
        this._productImageField = 'image_medium';

        this._opened.then(function () {
            if (self.previousModalHeight) {
                self.$el.closest('.modal-content').css('min-height', self.previousModalHeight + 'px');
            }
        });
    },
     /**
     * @override
     */
    willStart: function () {
        var self = this;

        var uri = this._getUri("/sale_product_configurator/show_optional_products");
        var getModalContent = ajax.jsonRpc(uri, 'call', {
            product_id: self.rootProduct.product_id,
            variant_values: self.rootProduct.variant_values,
            pricelist_id: self.pricelistId || false,
            add_qty: self.rootProduct.quantity,
            kwargs: {
                context: _.extend({
                    'quantity': self.rootProduct.quantity
                }, this.context),
            }
        })
        .then(function (modalContent) {
            if (modalContent) {
                var $modalContent = $(modalContent);
                $modalContent = self._postProcessContent($modalContent);
                self.$content = $modalContent;
            } else {
                self.trigger('options_empty');
                self.preventOpening = true;
            }
        });

        var parentInit = self._super.apply(self, arguments);
        return Promise.all([getModalContent, parentInit]);
    },

    /**
     * This is overridden to append the modal to the provided container (see init("parent")).
     * We need this to have the modal contained in the web shop product form.
     * The additional products data will then be contained in the form and sent on submit.
     *
     * @override
     */
    open: function (options) {
        $('.tooltip').remove(); // remove open tooltip if any to prevent them staying when modal is opened

        var self = this;
        this.appendTo($('<div/>')).then(function () {
            if (!self.preventOpening) {
                self.$modal.find(".modal-body").replaceWith(self.$el);
                self.$modal.attr('open', true);
                self.$modal.removeAttr("aria-hidden");
                self.$modal.modal().appendTo(self.container);
                self.$modal.focus();
                self._openedResolver();
            }
        });
        if (options && options.shouldFocusButtons) {
            self._onFocusControlButton();
        }

        return self;
    },
    /**
     * Will update quantity input to synchronize with previous window
     *
     * @override
     */
    start: function () {
        var def = this._super.apply(this, arguments);
        var self = this;

        this.$el.find('input[name="add_qty"]').val(this.rootProduct.quantity);

        // set a unique id to each row for options hierarchy
        var $products = this.$el.find('tr.js_product');
        $products.each(function () {
            var $el = $(this);
            var uniqueId = self._getUniqueId($el);
            $el.find('input.unique_id').val(uniqueId);

            var productId = parseInt($el.find('input.product_id').val());
            if (productId === self.rootProduct.product_id) {
                self.rootProduct.unique_id = uniqueId;
            } else {
                $el.find('input.parent_unique_id').val(self.rootProduct.unique_id);
            }
        });

        return def.then(function () {
            // This has to be triggered to compute the "out of stock" feature
            self._opened.then(function () {
                self.triggerVariantChange(self.$el);
            });
        });
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Returns the list of selected products.
     * The root product is added on top of the list.
     *
     * @returns {Array} products
     *   {integer} product_id
     *   {integer} quantity
     *   {Array} product_custom_variant_values
     *   {Array} no_variant_attribute_values
     * @public
     */
    getSelectedProducts: function () {
        var self = this;
        var products = [this.rootProduct];
        this.$modal.find('.js_product.in_cart:not(.main_product)').each(function () {
            var $item = $(this);
            var quantity = parseInt($item.find('input[name="add_qty"]').val());
            var parentUniqueId = parseInt($item.find('input.parent_unique_id').val());
            var uniqueId = parseInt($item.find('input.unique_id').val());
            var productCustomVariantValues = self.getCustomVariantValues($(this));
            var noVariantAttributeValues = self.getNoVariantAttributeValues($(this));
            products.push({
                product_id: parseInt($item.find('input.product_id').val()),
                product_template_id: parseInt($item.find('input.product_template_id').val()),
                quantity: quantity,
                parent_unique_id: parentUniqueId,
                unique_id: uniqueId,
                product_custom_attribute_values: productCustomVariantValues,
                no_variant_attribute_values: noVariantAttributeValues
            });
        });

        return products;
    },

    // ------------------------------------------
    // Private
    // ------------------------------------------

    /**
     * Adds the product image and updates the product description
     * based on attribute values that are either "no variant" or "custom".
     *
     * @private
     */
    _postProcessContent: function ($modalContent) {
        var productId = this.rootProduct.product_id;
        $modalContent
            .find('img:first')
            .attr("src", "/web/image/product.product/" + productId + "/image_medium");

        if (this.rootProduct &&
                (this.rootProduct.product_custom_attribute_values ||
                 this.rootProduct.no_variant_attribute_values)) {
            var $productDescription = $modalContent
                .find('.main_product')
                .find('td.td-product_name div.text-muted.small');
            var description = $productDescription.html();

            $.each(this.rootProduct.product_custom_attribute_values, function () {
                description += '<br/>' + this.attribute_value_name + ': ' + this.custom_value;
            });

            $.each(this.rootProduct.no_variant_attribute_values, function () {
                if (this.is_custom !== 'True') {
                    description += '<br/>' + this.attribute_name + ': ' + this.attribute_value_name;
                }
            });

            $productDescription.html(description);
        }

        return $modalContent;
    },

    /**
     * @private
     */
    _onConfirmButtonClick: function () {
        this.trigger('confirm');
        this.close();
    },

    /**
     * @private
     */
    _onCancelButtonClick: function () {
        this.trigger('back');
        this.close();
    },

    /**
     * Will add/remove the option, that includes:
     * - Moving it to the correct DOM section
     *   and possibly under its parent product
     * - Hiding attribute values selection and showing the quantity
     * - Creating the product if it's in "dynamic" mode (see product_attribute.create_variant)
     * - Updating the description based on custom/no_create attribute values
     * - Removing optional products if parent product is removed
     * - Computing the total price
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onAddOrRemoveOption: function (ev) {
        ev.preventDefault();
        var self = this;
        var $target = $(ev.currentTarget);
        var $modal = $target.parents('.oe_optional_products_modal');
        var $parent = $target.parents('.js_product:first');
        $parent.find("a.js_add, span.js_remove").toggleClass('d-none');
        $parent.find(".js_remove");

        var productTemplateId = $parent.find(".product_template_id").val();
        if ($target.hasClass('js_add')) {
            self._onAddOption($modal, $parent, productTemplateId);
        } else {
            self._onRemoveOption($modal, $parent);
        }

        self._computePriceTotal();
    },

    /**
     * @private
     * @see _onAddOrRemoveOption
     * @param {$.Element} $modal
     * @param {$.Element} $parent
     * @param {integer} productTemplateId
     */
    _onAddOption: function ($modal, $parent, productTemplateId) {
        var self = this;
        var $main_product = $modal.find('.js_product:first');
        var $selectOptionsText = $modal.find('.o_select_options');

        // remove attribute values selection and show quantity input
        $parent.addClass('in_cart');
        $parent.find('.td-product_name').removeAttr("colspan");
        $parent.find('.td-qty').removeClass('d-none');

        var productCustomVariantValues = self.getCustomVariantValues($parent);
        var noVariantAttributeValues = self.getNoVariantAttributeValues($parent);
        if (productCustomVariantValues || noVariantAttributeValues) {
            var $productDescription = $parent
                .find('td.td-product_name div.float-left');

            var description = '';
            $.each(productCustomVariantValues, function () {
                description += '<br/>' + this.attribute_value_name + ': ' + this.custom_value;
            });

            $.each(noVariantAttributeValues, function () {
                if (this.is_custom !== 'True') {
                    description += '<br/>' + this.attribute_name + ': ' + this.attribute_value_name;
                }
            });

            var $customAttributeValuesDescription = $('<div>', {
                class: 'custom_attribute_values_description text-muted small',
                html: description
            });

            $productDescription.append($customAttributeValuesDescription);
        }

        // if it's an optional product of an optional product, place it after it's parent
        var parentUniqueId = $parent.find('input.parent_unique_id').val();

        if (parentUniqueId) {
            $modal.find('input.unique_id').filter(function () {
                return parentUniqueId === $(this).val();
            }).parents('.js_product:first').after($parent);
        } else {
            // else, place it after the main product
            $main_product.after($parent);
        }

        this.selectOrCreateProduct(
            $parent,
            $parent.find('.product_id').val(),
            productTemplateId,
            true
        ).then(function (productId) {
            $parent.find('.product_id').val(productId);

            ajax.jsonRpc(self._getUri("/sale_product_configurator/optional_product_items"), 'call', {
                'product_id': productId,
                'pricelist_id': self.pricelistId || false,
            }).then(function (addedItem) {
                var $addedItem = $(addedItem);
                $modal.find('tr:last').after($addedItem);

                self.$el.find('input[name="add_qty"]').trigger('change');
                self.triggerVariantChange($addedItem);

                // add a unique id to the new products
                var parentUniqueId = $parent.find('input.unique_id').val();
                var parentQty = $parent.find('input[name="add_qty"]').val();
                $addedItem.filter(".js_product").each(function () {
                    var $el = $(this);
                    var uniqueId = self._getUniqueId($el);
                    $el.find('input.unique_id').val(uniqueId);
                    $el.find('input.parent_unique_id').val(parentUniqueId);
                    $el.find('input[name="add_qty"]').val(parentQty);
                });

                if ($selectOptionsText.nextAll('.js_product').length === 0) {
                    // no more optional products to select -> hide the header
                    $selectOptionsText.hide();
                }
            });
        });
    },

    /**
     * @private
     * @see _onAddOrRemoveOption
     * @param {$.Element} $modal
     * @param {$.Element} $parent
     */
    _onRemoveOption: function ($modal, $parent) {
        // restore attribute values selection
        var uniqueId = $parent.find('input.parent_unique_id').val();
        var qty = $modal.find('tr.js_product.in_cart:has(input.unique_id[value="' + uniqueId + '"]) input[name="add_qty"]').val();
        $parent.removeClass('in_cart');
        $parent.find('.td-product_name').attr("colspan", 2);
        $parent.find('.td-qty').addClass('d-none');
        $parent.find('input[name="add_qty"]').val(qty);
        $parent.find('.custom_attribute_values_description').remove();

        var $select_options_text = $modal.find('.o_select_options');
        $select_options_text.show();

        var productUniqueId = $parent.find('input.unique_id').val();
        this._removeOptionOption($modal, productUniqueId);

        $modal.find('tr:last').after($parent);
    },

    /**
     * If the removed product had optional products, remove them as well
     *
     * @private
     * @param {$.Element} $modal
     * @param {integer} optionUniqueId The removed optional product id
     */
    _removeOptionOption: function ($modal, optionUniqueId) {
        var self = this;
        $modal.find('input.parent_unique_id').filter(function () {
            return optionUniqueId === $(this).val();
        }).each(function () {
            var $el = $(this);
            var uniqueId = $el.find('input.unique_id').val();
            $el.parents('.js_product:first').remove();
            self._removeOptionOption($modal, uniqueId);
        });
    },
    /**
     * @override
     */
    _onChangeCombination: function (ev, $parent, combination) {
        $parent
            .find('.td-product_name .product-name')
            .first()
            .text(combination.display_name);

        VariantMixin._onChangeCombination.apply(this, arguments);

        this._computePriceTotal();
    },
    /**
     * When the quantity of a product is updated, we need to update
     * the quantity of all the related optional products wich are not in the cart.
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onChangeQuantity: function (ev) {
        var $product = $(ev.target.closest('tr'));
        var $quantity = $(ev.currentTarget);
        var qty = parseFloat($quantity.val());
        var uniqueId = $product.find('input.unique_id').val();
        var relatedOptions = this.$el.find('tr.js_product:not(.in_cart):has(input.parent_unique_id[value="' + uniqueId + '"]) input[name="add_qty"]');

        relatedOptions.each(function () {
            $(this).val(qty);
        });

        if (this._triggerPriceUpdateOnChangeQuantity()) {
            this.onChangeAddQuantity(ev);
        }
        if ($product.hasClass('main_product')) {
            this.rootProduct.quantity = qty;
            this.trigger('update_quantity', qty);
        }
    },

    /**
     * When a product is added or when the quantity is changed,
     * we need to refresh the total price row
     */
    _computePriceTotal: function () {
        if (this.$modal.find('.js_price_total').length) {
            var price = 0;
            this.$modal.find('.js_product.in_cart').each(function () {
                var quantity = parseInt($(this).find('input[name="add_qty"]').first().val());
                price += parseFloat($(this).find('.js_raw_price').html()) * quantity;
            });

            this.$modal.find('.js_price_total .oe_currency_value').text(
                this._priceToStr(parseFloat(price))
            );
        }
    },

    /**
     * Extension point for website_sale
     *
     * @private
     */
    _triggerPriceUpdateOnChangeQuantity: function () {
        return true;
    },

        /**
     * Returns a unique id for `$el`.
     *
     * @private
     * @param {$.Element} $el
     * @returns {string}
     */
    _getUniqueId: function ($el) {
        if (!$el.data('uniqueId')) {
            $el.data('uniqueId', _.uniqueId());
        }
        return parseInt($el.data('uniqueId'));
    },
});

return OptionalProductsModal;

});
