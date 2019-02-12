odoo.define('mail.wip.store.state', function (require) {
"use strict";

const config = require('web.config');
const core = require('web.core');

const _t = core._t;

/**
 * @param {Object} [alteration] used for tests to partially alter state initially
 * @return {Object}
 */
function init(alteration) {
    let state = {
        //----------------------------------------------------------------------
        // Misc.
        //----------------------------------------------------------------------
        MESSAGE_FETCH_LIMIT: 30,
        cannedResponses: {},
        commands: {},

        //----------------------------------------------------------------------
        // Attachments
        //----------------------------------------------------------------------
        attachments: {},
        attachmentNextTempID: -1,
        attachmentTempLocalIDs: {}, // key: displayFilename, value: attachmentTempLocalID

        //----------------------------------------------------------------------
        // Chat Window Manager
        //----------------------------------------------------------------------
        /**
         * State slice related to the chat window manager
         */
        chatWindowManager: {
            /**
             * Counter used to determine when an autofocus behaviour should
             * occur. This is necessary in case the autofocusItem does not
             * change, but we want to autofocus it nonetheless.
             */
            autofocusCounter: 0,
            /**
             * Reference to chat window manager item (either 'new_message' or a
             * minimized thread local ID) that should be auto-focus. If this
             * value is set and differs from locally value tracked by chat
             * window manager, it should auto-focus the corresponding item. For
             * instance, if this value is 'new_message', it should auto-focus
             * the 'new_message' chat window.
             */
            autofocusItem: undefined,
            /**
             * Computed data from items and their screen position. To be used
             * by the chat window manager to draw chat windows on screen.
             * This property should only be modified by the mutation
             * `chat_window_manager/_compute`. New object is assigned on
             * changes.
             */
            computed: {
                /**
                 * Amount of visible slots available for items.
                 */
                availableVisibleSlots: 0,
                /**
                 * Data related to the hidden menu.
                 */
                hidden: {
                    /**
                     * List of hidden items. Useful to compute counter. Items are
                     * ordered by their `items` order.
                     */
                    items: [],
                    /**
                     * Offset of hidden menu starting point from the starting point
                     * of chat window manager. Makes only sense if it is visible.
                     */
                    offset: 0,
                    /**
                     * Whether hidden menu is visible or not
                     */
                    showMenu: false,
                },
                /**
                 * Data related to visible chat windows. Index determine order of
                 * items. Value: { item, offset }.
                 * Offset is offset of starting point of chat window from starting
                 * point of chat window manager. Items are ordered by their `items`
                 * order.
                 */
                visible: [],
            },
            /**
             * Ordered list of items, from right to left.
             */
            items: [],
            /**
             * Tracked internal autofocus counter of chat window manager.
             * This is used to dismiss autofocus on chat window manager in case
             * it is mounted and the autofocus counter has not changed.
             */
            notifiedAutofocusCounter: 0,
        },
        //----------------------------------------------------------------------
        // Dialog
        //----------------------------------------------------------------------
        /**
         * State slice related to Dialogs & Dialog Manager
         */
        dialogManager: {
            /**
             * Ordered list of dialogs data, from bottom to top.
             * Each item is an object with format { Component, id, info },
             * where Component is an owl component class, id is the ID of the
             * dialog, and info is an object with props provided to dialog item.
             */
            dialogs: [],
        },
        //----------------------------------------------------------------------
        // Discuss
        //----------------------------------------------------------------------
        /**
         * State slice related to the Discuss app
         */
        discuss: {
            /**
             * Domain of the messages in the thread. Determine the thread cache
             * to use with provided thread local ID.
             */
            domain: [],
            /**
             * The menu_id of discuss app, received on mail/init_messaging and
             * used to open discuss from elsewhere.
             */
            menu_id: null,
            /**
             * Whether the discuss app is open or not. Useful to determine
             * whether the discuss or chat window logic should be applied.
             */
            open: false,
            /**
             * Stringified domain. This is computed once in order to avoid
             * making JSON.stringify whenever we need the stringified domain.
             * Stringified domain is used to determine the thread cache local
             * ID, so that components can connect on store to read on thread
             * cache changes.
             */
            stringifiedDomain: '[]',
            /**
             * Current thread set on discuss app
             */
            threadLocalID: null,
        },
        //----------------------------------------------------------------------
        // Global
        //----------------------------------------------------------------------
        /**
         * State slice related to global window object dynamic properties.
         *
         * This is useful for components that have some computation relying on
         * those data, like the chat window manager that uses the global width
         * to determine the chat windows to display on screen.
         */
        global: {
            innerHeight: window.innerHeight,
            innerWidth: window.innerWidth,
        },
        isMobile: config.device.isMobile,
        //----------------------------------------------------------------------
        // Messages
        //----------------------------------------------------------------------
        // data
        messages: {},
        // list
        messageLocalIDs: [],
        // other
        outOfFocusUnreadMessageCounter: 0,
        mailFailures: {},
        //----------------------------------------------------------------------
        // Partners
        //----------------------------------------------------------------------
        // data
        partners: {},
        // list
        pinnedDmPartnerIDs: [],
        //----------------------------------------------------------------------
        // Threads
        //----------------------------------------------------------------------
        // data
        threads: {},
        threadCaches: {},
        // lists
        threadChannelLocalIDs: [],
        threadChatLocalIDs: [],
        threadLocalIDs: [],
        threadMailboxLocalIDs: [],
        threadMailChannelLocalIDs: [],
        threadPinnedLocalIDs: [],
        // other
        isMyselfModerator: false,
        moderatedChannelIDs: [],
    };
    if (alteration) {
        state = Object.assign(state, alteration);
    }
    return state;
}

return { init };

});
