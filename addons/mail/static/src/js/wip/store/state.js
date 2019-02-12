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
        discuss: {
            threadLID: null,
            domain: [],
            menu_id: null,
            open: null,
            stringifiedDomain: '[]',
        },
        //----------------------------------------------------------------------
        // Chat Window Manager
        //----------------------------------------------------------------------
        chatWindowManager: {
            items: [], // ordered list of minimized threads and/or 'blank' window.
        },
        //----------------------------------------------------------------------
        // Global
        //----------------------------------------------------------------------
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
