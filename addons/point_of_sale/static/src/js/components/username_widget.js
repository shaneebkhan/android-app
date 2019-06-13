odoo.define('point_of_sale.UsernameWidget', function (require) {

    /**
     * Displays the current cashier's name
    */
    class UsernameWidget extends owl.Component {
        // TODO: Store
        get name() {
            const {name} = this.env.model.get_cashier();
            return name;
        }
    }

    return UsernameWidget;
});
