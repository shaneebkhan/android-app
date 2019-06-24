odoo.define('website_slides.category_backend', function (require){
"use strict";

var FieldOne2Many = require('web.relational_fields').FieldOne2Many;
var fieldRegistry = require('web.field_registry');
var ListRenderer = require('web.ListRenderer');

var CategoryListRenderer = ListRenderer.extend({
    _renderBodyCell: function (record, node, index, options){
        var $cell = this._super.apply(this, arguments);

        var isSection = record.data.slide_type === 'category';

        if (isSection){
            if (node.attrs.widget === "handle"){
                return $cell;
            } else if (node.attrs.name === "name"){
                var nbrColumns = this._getNumberOfCols();
                if (this.handleField){
                    nbrColumns--;
                }
                if (this.addTrashIcon){
                    nbrColumns--;
                }
                $cell.attr('colspan', nbrColumns);
            } else {
                $cell.removeClass('o_invisible_modifier');
                return $cell.addClass('o_hidden');
            }
            $cell.addClass('o_is_' + record.data.slide_type);
        }
        return $cell;
    },
    _renderRow: function (record, index){
        var $row = this._super.apply(this, arguments);
        if (record.data.slide_type){
            $row.addClass('o_is_' + record.data.slide_type);
        }
        return $row;
    },
    _renderView: function (){
        var def = this._super.apply(this, arguments);
        var self = this;
        return def.then(function () {
            self.$('table.o_list_table').addClass('o_category_list_view');
        });
    },
    _onRowClicked: function (ev){
        if (ev.currentTarget.className.includes('category')){
            if (this.__parentedParent.mode === "edit"){
                this.editable = "bottom";
            } else {
                delete this.editable;
            }
        } else {
            delete this.editable;
        }
        this._super.apply(this, arguments);
        if (this.__parentedParent.mode === "edit"){
            this.editable = "bottom";
        }
    },
    _onCellClick: function (ev){
        if (this.__parentedParent.mode === "edit" && ev.currentTarget.className.includes('category')){
            this.editable = "bottom";
        } else {
            delete this.editable;
            this.unselectRow();
        }
        this._super.apply(this, arguments);
    }
});

var CategoryFieldOne2Many = FieldOne2Many.extend({
    _getRenderer: function (){
        if (this.view.arch.tag === 'tree'){
            return CategoryListRenderer;
        }
        return this._super.apply(this, arguments);
    },
    _onAddRecord: function (ev) {
        var context = "";
        if (ev.data.context){
            context = ev.data.context[0];
        }
        if (context.includes('category')){
            this.editable = "bottom";
        } else {
            delete this.editable;
        }
        this._super.apply(this, arguments);
    },
});

fieldRegistry.add('category_one2many', CategoryFieldOne2Many);
});