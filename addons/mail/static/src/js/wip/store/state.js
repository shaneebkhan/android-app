odoo.define('mail.wip.store.state', function (require) {
"use strict";

const Partner = require('mail.wip.model.Partner');

const config = require('web.config');
const core = require('web.core');

const _t = core._t;

function init() {
    const odoobot = new Partner({ id: 'odoobot', name: _t("OdooBot") });

    return {
        //----------------------------------------------------------------------
        // Misc.
        //----------------------------------------------------------------------
        MESSAGE_FETCH_LIMIT: 30,
        cannedResponses: {},
        commands: {},
        //----------------------------------------------------------------------
        // Discuss
        //----------------------------------------------------------------------
        /**
         * State slice related to the Discuss app
         */
        discuss: {
            /**
             * Current thread set on discuss app
             */
            threadLID: null,
            /**
             * Domain of the messages in the thread. Determine the thread cache
             * to use with provided thread LID.
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
             * Stringified domain is used to determine the thread cache LID, so
             * that components can connect on store to read on thread cache
             * changes.
             */
            stringifiedDomain: '[]',
        },
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
             * minimized thread LID) that should be auto-focus. If this value is
             * set and differs from locally value tracked by chat window
             * manager, it should auto-focus the corresponding item. For
             * instance, if this value is 'new_message', it should auto-focus
             * the 'new_message' chat window autocomplete input.
             */
            autofocusItem: undefined,
            /**
             * Tracked available amount of visible slots for chat windows.
             * Notified by chat window manager, as store may have dedicated
             * behaviour based on that. For instance, it has to remove
             * 'new_message' chat window in case there is only 1 available slot
             * while opening a thread.
             */
            notifiedAvailableVisibleSlots: undefined,
            /**
             * Tracked autofocus internal autofocus counter of chat window
             * manager. This is used to dismiss autofocus on chat window manager
             * in case it is mounted and the autofocus counter has not changed.
             */
            notifiedAutofocusCounter: undefined,
            /**
             * Whether the 'new_message' chat window is visible or not. This
             * chat window is always the right-most one.
             */
            showNewMessage: false,
            /**
             * Ordered list of minimized threads, from right to left.
             */
            threadLIDs: [],
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
        messageLIDs: {},
        // other
        outOfFocusUnreadMessageCounter: 0,
        mailFailures: {},
        //----------------------------------------------------------------------
        // Partners
        //----------------------------------------------------------------------
        // data
        partners: { odoobot },
        // list
        pinnedDmPartnerIDs: [],
        //----------------------------------------------------------------------
        // Threads
        //----------------------------------------------------------------------
        // data
        threads: {},
        threadCaches: {},
        // lists
        threadChannelLIDs: [],
        threadChatLIDs: [],
        threadLIDs: [],
        threadMailboxLIDs: [],
        threadMailChannelLIDs: [],
        threadPinnedLIDs: [],
        // other
        isMyselfModerator: false,
        moderatedChannelIDs: [],
    };
}

return { init };

});
