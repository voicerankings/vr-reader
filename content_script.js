/**
 * content_script.js
 * 
 * OPEN SOURCE ARCHITECTURE NOTE:
 * This script is injected into all matched web pages.
 * 
 * 1. DOM INJECTION & ISOLATION:
 *    - Uses Shadow DOM to isolate the TTS reader UI from the host page's CSS.
 *    - The global `VR_Reader` object orchestrates the reading experience (highlighting text,
 *      managing selection events, and communicating with the background script).
 * 
 * 2. HIGHLIGHTING SYSTEM:
 *    - Intercepts text selection and injects span wrappers to visually track reading progress.
 *    - Ensures the host page layout is not broken during the highlighting process.
 */

"use strict";
import './css/style.css';
import './js/utils/fragment-generation-and-text-fragment-utils.js'
import './js/vendor/Readability-readerable.js'

import {
    getFormattedSelection,
    saveToLocalStorage,
    readLocalStorage,
    getHostName,
    isNotEqualToNullorUndefined,
} from './js/utils/helpers.js';

import { CONSTANTS } from './js/constants/constants.js';

// Modularized features
import './js/content/modalFactories.js';
import './js/content/readingMode.js';
import './js/content/textTracking.js';
import './js/content/spaObserver.js';
import './js/content/messageListeners.js';
import './js/content/selectionHintPopup.js';
import { openContentScriptPort } from './js/content/messageListeners.js';
import { checkReadLaterStatus, triggerReadLaterOverlay } from './js/content/readLater.js';
import { initializeLinkRouting } from './js/content/uiEvents.js';
import { initDebugConsole } from './js/utils/debug.js';
import { initTabKeepAlive } from './js/content/tabKeepAlive.js';

initDebugConsole();
initTabKeepAlive();

/**
 * ============================================================================
 * GLOBAL STATE OBJECT (VR_Reader)
 * ============================================================================
 * This extends the `window.VR_Reader` object, acting as the central state 
 * manager for the extension within the webpage context. 
 * 
 * Future Architecture Note: In a fully modern ES Modules architecture, these 
 * properties could be extracted into an exported `state.js` or a Pinia/Redux store.
 */
Object.assign(window.VR_Reader || {}, {
    // --- Session & Analytics ---
    sessionCharsRead: 0,        // Tracks how many characters the user has read in the current session (used for limits/quotas)
    currentTabId: null,         // The Chrome Tab ID where this script is running
    isUserLogged: true,         // Authentication state sync'd from background
    windowInFocus: true,        // Tracks if the current window is focused for auto-pause features
    readerStopTimestamp: 0,     // Timestamp of the last time playback was stopped
    usageData: {
        voice: null,
        questionTypeTime: null,
        answerResponseTime: null
    },

    myPort: null,               // Chrome runtime port for long-lived background communication

    // --- Highlighting & DOM State ---
    savedMarkElements: [],      // Array of DOM `<mark>` elements currently highlighting text
    currentlyPlayingFragment: "",// The specific text chunk being read aloud right now
    savedHighlightedElements: {},// Map of persistent highlights the user has saved
    savedHighlights: {},
    isTextSelectorActive: false,// Boolean flag: is the user currently using the "Click to Read" selector?

    // --- Local Storage Sync ---
    savedLocalStorageGlobal: {},           // Cache of global settings pulled from Chrome storage
    savedLocalStorageDomainAutoSettings: null,

    /**
     * ============================================================================
     * TEXT SELECTOR MODULE (Point & Click Reading)
     * ============================================================================
     */

    /**
     * Toggles the "Click to Read" text selector mode.
     * When active, hovering over paragraphs highlights them, and clicking reads them.
     */
    toggleTextSelector(active, silent = false) {
        VR_Reader.isTextSelectorActive = active;

        if (active) {
            this.injectSelectorStyles();
            document.addEventListener('click', this._handleGlobalTextClick, true);
            if (silent === false) {
                VR_Reader.makeToast({
                    delay: 8000,
                    posX2: 10,
                    posY: 50,
                    hideProgressBar: true,
                    action: 'purple-blue',
                    title: 'Click to Read Active',
                    message: 'Tap any text to hear it read aloud.'
                });
            }
        } else {
            document.removeEventListener('click', this._handleGlobalTextClick, true);
            this.removeSelectorStyles();
            if (silent === false) {
                VR_Reader.makeToast({
                    posX2: 50,
                    posY: 50,
                    delay: 2000,
                    action: 'normal',
                    title: 'Click to Read Disabled'
                });
            }
        }

        if (VR_Reader.vrrQuickAccessButton) {
            VR_Reader.vrrQuickAccessButton.updateTextSelectorButton(active);
        }
    },

    injectSelectorStyles() {
        if (document.getElementById('vrrGlobalSelectorStyles')) return;
        const style = document.createElement('style');
        style.id = 'vrrGlobalSelectorStyles';
        style.textContent = `
            /* Global Text Selector Hover Effects */
            article p, article li, article h1, article h2, article h3, article h4,
            main p, main li, main h1, main h2, main h3, main h4,
            .prose p, .prose li, blockquote, 
            div[class*="post-body"], div[class*="message-content"], 
            div[class*="comment-body"], div.text-content,
            p, h1, h2, h3, li {
                cursor: pointer !important; 
            }
            p:hover, li:hover, h1:hover, h2:hover, h3:hover, blockquote:hover {
                background-color: rgba(121, 156, 255, 0.15) !important;
                box-shadow: 0 0 0 2px rgba(121, 156, 255, 0.05);
                border-radius: 3px;
            }
            @media (prefers-color-scheme: dark) {
                p:hover, li:hover, h1:hover, h2:hover, h3:hover, blockquote:hover {
                    background-color: rgba(255, 255, 255, 0.15) !important;
                }
            }
        `;
        document.head.appendChild(style);
    },

    removeSelectorStyles() {
        const style = document.getElementById('vrrGlobalSelectorStyles');
        if (style) style.remove();
    },

    _handleGlobalTextClick(e) {
        const target = e.target;

        // 1. Ignore clicks inside our own Shadow DOMs or UI containers
        if (target.closest('.vr-shadowdom') ||
            target.closest('#shadowdom-vr-reader') ||
            target.closest('#shadowdom-vrr-toast') ||
            target.closest('#shadowdom-highlight-prompt') ||
            target.closest("#shadowdom-modal-large") ||
            target.closest("#vrr-quick-access-host") ||
            target.closest('#shadowdom-vk-ratings-overlay')) {
            return;
        }

        // 2. Filter out standard interactive elements
        const tagName = target.tagName;
        if (['BUTTON', 'INPUT', 'TEXTAREA', 'VIDEO', 'AUDIO', 'IMG', 'SVG', 'PATH', 'SELECT', 'LABEL', 'A'].includes(tagName)) return;

        if (target.closest('button, [role="button"], .player-controls')) return;

        // 3. Prevent default click behavior
        e.preventDefault();
        e.stopPropagation();

        // 4. Extract Text
        let textToRead = "";
        const isSemantic = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE'].includes(tagName);

        if (isSemantic) {
            textToRead = target.innerText;
        } else {
            if (target.innerText && target.innerText.length > 2 && target.innerText.length < 1500) {
                textToRead = target.innerText;
            }
        }

        if (!textToRead || textToRead.trim().length < 2) return;

        // ✅ CRITICAL FIX: Programmatically select the clicked node.
        // This ensures VR_Reader.captureSelectionData() finds the correct position,
        // allowing "Continue Reading" to work from this specific paragraph.
        const range = document.createRange();
        range.selectNodeContents(target);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        console.log(`🎯 Global Selector Clicked: "${textToRead.substring(0, 30)}..."`);

        // 5. Determine Action
        if (VR_Reader.ttsWidget && VR_Reader.ttsWidget.voiceClass) {
            VR_Reader.ttsWidget.voiceClass.handleTextElementClick(e);
        }
        else {
            console.log("🆕 Global Selector: Starting fresh read");

            if (VR_Reader.readHighlightedText) {
                VR_Reader.readHighlightedText(textToRead);
            } else {
                chrome.runtime.sendMessage({
                    action: "readHighlightWithVRR",
                    selection: textToRead
                });
            }
        }
    },

    /**
     * ============================================================================
     * STATE SYNCHRONIZATION MODULE (Storage & Preferences)
     * ============================================================================
     */

    /**
     * Broadcasts voice settings payload to all tabs by saving to local storage.
     * This ensures if you change the default voice in one tab, it updates everywhere.
     */
    updateAllContentScriptTabs(voiceDefaultPayload) {
        chrome.storage.local.set({
            'DEFAULT_PREMIUM_VOICE_SERVICE': voiceDefaultPayload.voice_service,
            'DEFAULT_PREMIUM_VOICE_ID': voiceDefaultPayload.voice_id,
            'DEFAULT_PREMIUM_VOICE_NAME': voiceDefaultPayload.voice_name,
            'DEFAULT_PREMIUM_VOICE_GENDER': voiceDefaultPayload.voice_gender,
            'DEFAULT_PREMIUM_VOICE_INSTRUCTIONS': voiceDefaultPayload.voice_instructions,
            'DEFAULT_PREMIUM_VOICE_LANGUAGE_CODE': voiceDefaultPayload.voice_language_code,
            'DEFAULT_PREMIUM_VOICE_SPEAKER_ID': voiceDefaultPayload.voice_speaker_id,
            'DEFAULT_PREMIUM_VOICE_WORDS_PER_MINUTE': voiceDefaultPayload.voice_words_per_minute,
            'DEFAULT_PREMIUM_VOICE_SPEED': voiceDefaultPayload.voice_speed,
            'DEFAULT_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT': voiceDefaultPayload.voice_has_voice_speed_support,
            'DEFAULT_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT': voiceDefaultPayload.voice_has_word_timestamp_support,
        });
    },

    /**
     * Bootstraps local storage settings into the VR_Reader state.
     * Maps `DEFAULT_*` keys to `ACTIVE_*` keys on initial start so that the
     * active reading session uses the user's saved preferences.
     *
     * @param {boolean} initialStart - If true, syncs 'DEFAULT' voice settings into 'ACTIVE' voice settings.
     */
    async storeDefaults(initialStart = false) {
        let storage = await readLocalStorage(CONSTANTS.USER_SETTINGS);

        if (initialStart) {

            storage['ACTIVE_PREMIUM_VOICE_SERVICE'] = storage['DEFAULT_PREMIUM_VOICE_SERVICE']
            storage['ACTIVE_PREMIUM_VOICE_ID'] = storage['DEFAULT_PREMIUM_VOICE_ID']
            storage['ACTIVE_PREMIUM_VOICE_NAME'] = storage['DEFAULT_PREMIUM_VOICE_NAME']
            storage['ACTIVE_PREMIUM_VOICE_GENDER'] = storage['DEFAULT_PREMIUM_VOICE_GENDER']
            storage['ACTIVE_PREMIUM_VOICE_INSTRUCTIONS'] = storage['DEFAULT_PREMIUM_VOICE_INSTRUCTIONS']
            storage['ACTIVE_PREMIUM_VOICE_LANGUAGE_CODE'] = storage['DEFAULT_PREMIUM_VOICE_LANGUAGE_CODE']
            storage['ACTIVE_PREMIUM_VOICE_SPEAKER_ID'] = storage['DEFAULT_PREMIUM_VOICE_SPEAKER_ID']
            storage['ACTIVE_PREMIUM_VOICE_WORDS_PER_MINUTE'] = storage['DEFAULT_PREMIUM_VOICE_WORDS_PER_MINUTE']
            storage['ACTIVE_PREMIUM_VOICE_SPEED'] = storage['DEFAULT_PREMIUM_VOICE_SPEED']

            storage['ACTIVE_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT'] = storage['DEFAULT_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT']
            storage['ACTIVE_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT'] = storage['DEFAULT_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT']

        }

        console.log("storage", storage)

        storage['WIDGET_PIN_EXPANDED'] = isNotEqualToNullorUndefined(storage['WIDGET_PIN_EXPANDED']) ? storage['WIDGET_PIN_EXPANDED'] : false;
        storage['DEFAULT_QUICK_ACCESS_CONTROLS_STATE'] = isNotEqualToNullorUndefined(storage['DEFAULT_QUICK_ACCESS_CONTROLS_STATE']) ? storage['DEFAULT_QUICK_ACCESS_CONTROLS_STATE'] : true;
        storage['DEFAULT_QUICK_ACCESS_CONTROLS_PANEL_PLACEMENT_STATE'] = isNotEqualToNullorUndefined(storage['DEFAULT_QUICK_ACCESS_CONTROLS_PANEL_PLACEMENT_STATE']) ? storage['DEFAULT_QUICK_ACCESS_CONTROLS_PANEL_PLACEMENT_STATE'] : "bottom";
        storage['DEFAULT_ENTER_KEY_PLAY_STATE'] = isNotEqualToNullorUndefined(storage['DEFAULT_ENTER_KEY_PLAY_STATE']) ? storage['DEFAULT_ENTER_KEY_PLAY_STATE'] : true;

        storage['DEFAULT_HIGHLIGHT_READING_STATE'] = isNotEqualToNullorUndefined(storage['DEFAULT_HIGHLIGHT_READING_STATE']) ? storage['DEFAULT_HIGHLIGHT_READING_STATE'] : true;
        storage['DEFAULT_AUTOSCROLL_READING_STATE'] = isNotEqualToNullorUndefined(storage['DEFAULT_AUTOSCROLL_READING_STATE']) ? storage['DEFAULT_AUTOSCROLL_READING_STATE'] : true;
        storage['DEFAULT_AUTO_READ_TITLE_STATE'] = isNotEqualToNullorUndefined(storage['DEFAULT_AUTO_READ_TITLE_STATE']) ? storage['DEFAULT_AUTO_READ_TITLE_STATE'] : true;
        storage['DEFAULT_READER_STRICT_MODE'] = isNotEqualToNullorUndefined(storage['DEFAULT_READER_STRICT_MODE']) ? storage['DEFAULT_READER_STRICT_MODE'] : true;

        storage['DEFAULT_READ_TEXT_AREA_SELECTOR_STATE'] = isNotEqualToNullorUndefined(storage['DEFAULT_READ_TEXT_AREA_SELECTOR_STATE']) ? storage['DEFAULT_READ_TEXT_AREA_SELECTOR_STATE'] : false;

        storage['DEFAULT_HIGHLIGHT_MODE_STATE'] = isNotEqualToNullorUndefined(storage['DEFAULT_HIGHLIGHT_MODE_STATE']) ? storage['DEFAULT_HIGHLIGHT_MODE_STATE'] : 'smooth';
        storage['DEFAULT_HIGHLIGHT_THEME_STATE'] = isNotEqualToNullorUndefined(storage['DEFAULT_HIGHLIGHT_THEME_STATE']) ? storage['DEFAULT_HIGHLIGHT_THEME_STATE'] : 'auto';
        storage['DEFAULT_MAX_AUTO_READ_LIMIT_ENABLED'] = isNotEqualToNullorUndefined(storage['DEFAULT_MAX_AUTO_READ_LIMIT_ENABLED']) ? storage['DEFAULT_MAX_AUTO_READ_LIMIT_ENABLED'] : false;
        storage['DEFAULT_MAX_AUTO_READ_LIMIT'] = isNotEqualToNullorUndefined(storage['DEFAULT_MAX_AUTO_READ_LIMIT']) ? storage['DEFAULT_MAX_AUTO_READ_LIMIT'] : 4000;
        storage['DEFAULT_EXTERNAL_TIMESTAMP_SERVICE'] = isNotEqualToNullorUndefined(storage['DEFAULT_EXTERNAL_TIMESTAMP_SERVICE']) ? storage['DEFAULT_EXTERNAL_TIMESTAMP_SERVICE'] : 'None';
        storage['DEFAULT_SHOW_VOICE_RATING_PROMPT'] = isNotEqualToNullorUndefined(storage['DEFAULT_SHOW_VOICE_RATING_PROMPT']) ? storage['DEFAULT_SHOW_VOICE_RATING_PROMPT'] : true;
        storage['DEFAULT_SHOW_CONTINUE_READING_PROMPT'] = isNotEqualToNullorUndefined(storage['DEFAULT_SHOW_CONTINUE_READING_PROMPT']) ? storage['DEFAULT_SHOW_CONTINUE_READING_PROMPT'] : true;


        Object.assign(VR_Reader.savedLocalStorageGlobal, storage);

        console.log("VR_Reader.savedLocalStorageGlobal", VR_Reader.savedLocalStorageGlobal)
        storage['DOMAIN_SETTINGS'] = (storage['DOMAIN_SETTINGS'] === undefined) ? {} : storage['DOMAIN_SETTINGS'];
        VR_Reader.savedLocalStorageDomainGlobals = storage['DOMAIN_SETTINGS']["global"] || {};
        VR_Reader.savedLocalStorageDomain = storage['DOMAIN_SETTINGS'][getHostName()] || {};

        if (initialStart) {
            const activeVoiceKeys = [
                'ACTIVE_PREMIUM_VOICE_SERVICE',
                'ACTIVE_PREMIUM_VOICE_ID',
                'ACTIVE_PREMIUM_VOICE_NAME',
                'ACTIVE_PREMIUM_VOICE_GENDER',
                'ACTIVE_PREMIUM_VOICE_INSTRUCTIONS',
                'ACTIVE_PREMIUM_VOICE_LANGUAGE_CODE',
                'ACTIVE_PREMIUM_VOICE_SPEAKER_ID',
                'ACTIVE_PREMIUM_VOICE_WORDS_PER_MINUTE',
                'ACTIVE_PREMIUM_VOICE_SPEED',
                'ACTIVE_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT',
                'ACTIVE_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT',
            ];
            let activeDataToPersist = {};
            activeVoiceKeys.forEach(k => {
                if (storage[k] !== undefined) {
                    activeDataToPersist[k] = storage[k];
                }
            });
            if (Object.keys(activeDataToPersist).length > 0) {
                chrome.storage.local.set(activeDataToPersist);
            }
        }

        if (VR_Reader.getAutoSettingsState() && VR_Reader.savedLocalStorageDomainAutoSettings != null) {
            for (const key in VR_Reader.savedLocalStorageDomainAutoSettings) {
                VR_Reader.savedLocalStorageDomain[key] = VR_Reader.savedLocalStorageDomainAutoSettings[key]
            }
        }
    },
    /**
     * Reloads the `ACTIVE_*` voice preferences from Chrome local storage.
     * Triggers the TTS Widget to update its internal voice state if it's currently running.
     */
    async changeActiveVoice() {
        const activeVoice = await readLocalStorage([
            'ACTIVE_PREMIUM_VOICE_SERVICE',
            'ACTIVE_PREMIUM_VOICE_ID',
            'ACTIVE_PREMIUM_VOICE_NAME',
            'ACTIVE_PREMIUM_VOICE_GENDER',
            'ACTIVE_PREMIUM_VOICE_INSTRUCTIONS',
            'ACTIVE_PREMIUM_VOICE_LANGUAGE_CODE',
            'ACTIVE_PREMIUM_VOICE_SPEAKER_ID',
            'ACTIVE_PREMIUM_VOICE_WORDS_PER_MINUTE',
            'ACTIVE_PREMIUM_VOICE_SPEED',
            'ACTIVE_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT',
            'ACTIVE_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT'

        ]);
        console.log("activeVoice", activeVoice)
        Object.assign(VR_Reader.savedLocalStorageGlobal, activeVoice);

        // Notify the VoicePlayer class that the voice has changed, if it's already running
        if (VR_Reader.ttsWidget && VR_Reader.ttsWidget.voiceClass) {
            if (typeof VR_Reader.ttsWidget.voiceClass.voiceChanged === 'function') {
                VR_Reader.ttsWidget.voiceClass.voiceChanged();
            }
        }
    },



    getAutoSettingsState() {
        let state;
        if (VR_Reader.savedLocalStorageDomain['DOMAIN_AUTO_SETTINGS_STATE'] !== undefined && VR_Reader.savedLocalStorageDomain['DOMAIN_AUTO_SETTINGS_STATE'] !== null) {
            state = VR_Reader.savedLocalStorageDomain['DOMAIN_AUTO_SETTINGS_STATE']
        } else {
            state = VR_Reader.savedLocalStorageGlobal['DEFAULT_AUTO_SETTINGS_STATE'] === undefined || VR_Reader.savedLocalStorageGlobal['DEFAULT_AUTO_SETTINGS_STATE'] === null ? true : VR_Reader.savedLocalStorageGlobal['DEFAULT_AUTO_SETTINGS_STATE'];
        }
        return state
    },

    powerOn: true,
    setPowerOn() {
        VR_Reader.powerOn = true;
    },

    setPowerOff() {
        VR_Reader.powerOn = false;
    }
});

VR_Reader.siteFilterStringList = [];
VR_Reader.cssSelectorList = [];

/**
 * ============================================================================
 * BACKGROUND REQUEST QUEUE
 * ============================================================================
 * When the content script needs data from the background (like API fetches),
 * it generates a callbackID, saves the callback here, and sends a message.
 * The background responds with the same callbackID, triggering `completeRequest`.
 */
VR_Reader.pendingRequests = {};

VR_Reader.saveRequest = function (callbackID, callback) {
    VR_Reader.pendingRequests[callbackID] = callback;
};

VR_Reader.completeRequest = function (callbackID, payload, deleteFromQueue = true) {
    if (VR_Reader.pendingRequests[callbackID]) {
        if (payload.status === 'error' && payload.message && payload.customErrorMessage === undefined) {

            VR_Reader.makeToast({
                delay: 10000,
                posX2: 10,
                posY2: 10,
                action: 'error',
                icon: payload.icon,
                title: payload.title,

                message: payload.message,
            });
            if (VR_Reader.ttsWidget) {
                VR_Reader.ttsWidget.showIssueLoader(true, payload.title || payload.tooltip);
            }
            VR_Reader.pendingRequests[callbackID](Object.assign(payload, { callbackID }));
        } else {
            if (VR_Reader.ttsWidget && payload.tooltip) {
                VR_Reader.ttsWidget.showIssueLoader(true, payload.tooltip);
            }
            VR_Reader.pendingRequests[callbackID](Object.assign(payload, { callbackID }));
        }

        if (deleteFromQueue)
            delete VR_Reader.pendingRequests[callbackID];
    }
}

/**
 * Helper for generic DOM event listeners. 
 * Stores handlers so they can be cleaned up later if needed.
 */
VR_Reader._eventHandlers = {};
VR_Reader.addListener = (node, event, handler, capture = false) => {
    if (!(event in VR_Reader._eventHandlers)) {
        VR_Reader._eventHandlers[event] = []
    }
    VR_Reader._eventHandlers[event].push({ node: node, handler: handler, capture: capture })
    node.addEventListener(event, handler, capture)
}


/**
 * ============================================================================
 * SCRIPT INITIALIZATION
 * ============================================================================
 */

// Bind Read Later trigger to global object so it can be called from message listeners
VR_Reader.triggerReadLaterOverlay = triggerReadLaterOverlay;

// 1. Open persistent port to background script (handles sync & state messages)
openContentScriptPort();

// 2. Attach global click listener for extension UI elements (.voicerankings-link)
initializeLinkRouting();

/**
 * ============================================================================
 * DATA FETCHERS
 * ============================================================================
 */

/**
 * Fetches the user's saved domain-specific filter rules from the background script.
 * Rules define which elements to hide/skip when reading on specific websites.
 */
function loadDomainFilters() {
    try {
        const chat_url = window.location.href;
        const currentDomain = (new URL(chat_url)).hostname.replace(/^www\./i, "");

        chrome.storage.local.get(['CUSTOM_DOMAIN_FILTERS', 'DOMAIN_FILTER_ENABLED'], (result) => {
            let rawCustom = result.CUSTOM_DOMAIN_FILTERS || [];
            if (!Array.isArray(rawCustom) && typeof rawCustom === 'object' && rawCustom !== null) {
                rawCustom = Object.values(rawCustom);
            }
            const customFilters = Array.isArray(rawCustom) ? rawCustom : [];
            const remoteEnabled = result.DOMAIN_FILTER_ENABLED !== false;

            // Local rules are split by kind. Entries stored before the CSS-selector
            // feature (no `type` field) are playback-text filters.
            const getKind = (f) => (f && f.type === 'css') ? 'css' : 'playback';

            // Separate custom filters into active vs override (priority -1)
            const matchedCustom = customFilters.filter(f => {
                if (!f || !f.filter_pattern) return false;
                const d = (f.domain || '').trim().toLowerCase().replace(/^www\./i, '');
                const cur = currentDomain.toLowerCase();
                return !d || d === '*' || d === cur;
            });

            // Priority -1 filters act as overrides to suppress matching remote filters and are disabled for playback.
            // Overrides are computed per kind so a playback override can never suppress a CSS rule (or vice-versa).
            const playbackOverrideFilters = matchedCustom.filter(f => getKind(f) === 'playback' && Number(f.priority) === -1);
            const cssOverrideFilters = matchedCustom.filter(f => getKind(f) === 'css' && Number(f.priority) === -1);

            // Active custom filters (priority != -1) applied to playback
            const activeCustom = matchedCustom
                .filter(f => getKind(f) === 'playback' && Number(f.priority) !== -1)
                .map(f => ({
                    type: f.filter_type || 'clean',
                    pattern: f.filter_pattern
                }));

            // Active local CSS-selector rules (priority != -1), ordered by priority
            const activeLocalCss = matchedCustom
                .filter(f => getKind(f) === 'css' && Number(f.priority) !== -1)
                .sort((a, b) => Number(a.priority) - Number(b.priority))
                .map(f => f.filter_pattern);

            // Crucial: Set lists synchronously first so active custom filters are active immediately!
            VR_Reader.siteFilterStringList = activeCustom;
            VR_Reader.cssSelectorList = activeLocalCss;

            if (!remoteEnabled) {
                return;
            }

            let callbackID = "domain_filters_" + Math.floor(Math.random() * 1000) + 100;

            VR_Reader.saveRequest(callbackID, async ({
                domain_filters = null,
                css_selectors = null,
            } = {}) => {
                if (domain_filters && Array.isArray(domain_filters)) {
                    domain_filters.forEach(f => {
                        if (f && f.pattern) {
                            f.pattern = f.pattern.replace(/\\\\/g, '\\');
                        }
                    });

                    // Filter out any remote filter matching a priority -1 custom override filter (Domain + Pattern + Type)
                    const activeRemote = domain_filters.filter(rf => {
                        const rPattern = (rf.pattern || rf.filter_pattern || '').trim().toLowerCase();
                        const rType = (rf.type || rf.filter_type || 'clean').trim().toLowerCase();
                        const rDomain = (rf.domain || '').trim().toLowerCase().replace(/^www\./i, '');

                        const isOverridden = playbackOverrideFilters.some(of => {
                            const oPattern = (of.filter_pattern || '').trim().toLowerCase();
                            const oType = (of.filter_type || 'clean').trim().toLowerCase();
                            const oDomain = (of.domain || '').trim().toLowerCase().replace(/^www\./i, '');

                            const domainMatches = !oDomain || oDomain === '*' || !rDomain || rDomain === '*' || oDomain === rDomain;
                            return domainMatches && rPattern === oPattern && rType === oType;
                        });

                        return !isOverridden;
                    });

                    VR_Reader.siteFilterStringList = [...activeRemote, ...activeCustom];
                }

                // Remote CSS-selector rules for this domain, after removing any
                // suppressed by a local priority -1 CSS override (domain + selector).
                let activeRemoteCss = [];
                if (css_selectors && Array.isArray(css_selectors)) {
                    activeRemoteCss = css_selectors
                        .filter(rf => {
                            if (!rf || !rf.pattern) return false;
                            const rPattern = (rf.pattern || '').trim().toLowerCase();
                            const rDomain = (rf.domain || '').trim().toLowerCase().replace(/^www\./i, '');

                            const isOverridden = cssOverrideFilters.some(of => {
                                const oPattern = (of.filter_pattern || '').trim().toLowerCase();
                                const oDomain = (of.domain || '').trim().toLowerCase().replace(/^www\./i, '');

                                const domainMatches = !oDomain || oDomain === '*' || !rDomain || rDomain === '*' || oDomain === rDomain;
                                return domainMatches && rPattern === oPattern;
                            });

                            return !isOverridden;
                        })
                        .map(rf => rf.pattern);
                }

                VR_Reader.cssSelectorList = [...activeRemoteCss, ...activeLocalCss];
            });

            chrome.runtime.sendMessage({
                action: "getDomainFilters",
                callbackID,
                payload: { domain: currentDomain }
            });
        });
    } catch (e) {
        console.error("Error loading domain filters:", e);
    }
}
VR_Reader.loadDomainFilters = loadDomainFilters;

/**
 * Bootstraps the entire user session.
 * 1. Checks login status from the background script.
 * 2. Fetches global and domain-specific settings.
 * 3. Syncs settings into local storage and the `VR_Reader` state object.
 * 4. Determines if the Quick Access widget should auto-start on this page.
 */
function loadUserAndAutoSettings(callback = null) {
    let callbackID = "auto_settings_" + Math.floor(Math.random() * 1000) + 100;

    VR_Reader.saveRequest(callbackID, async ({
        status,
        user_settings = null,
        isUserLogged,

    }) => {
        VR_Reader.isUserLogged = isUserLogged;

        if (isUserLogged === false && callback) {
            callback();
        }

        if (status === "success") {
            if (user_settings) {
                await saveToLocalStorage(user_settings, false);
            }
        } else {

        }
        await VR_Reader.storeDefaults(true);

        if (window.location.pathname !== '/' && VR_Reader.savedLocalStorageGlobal['DEFAULT_QUICK_ACCESS_CONTROLS_STATE']) {
            VR_Reader.start_VRR()
        }
    });

    let id, updated = null;
    if (VR_Reader.savedLocalStorageGlobal['SAVED_SETTINGS']) {
        id = VR_Reader.savedLocalStorageGlobal['SAVED_SETTINGS']['id'];
        updated = VR_Reader.savedLocalStorageGlobal['SAVED_SETTINGS']['updated']
    }

    chrome.runtime.sendMessage({
        action: "getUserAndAutoSettings",
        callbackID,
        payload: {
            id,
            updated
        }
    });
}

VR_Reader.loadUserAndAutoSettings = loadUserAndAutoSettings;
VR_Reader._handleGlobalTextClick = VR_Reader._handleGlobalTextClick.bind(VR_Reader);
loadUserAndAutoSettings();






chrome.runtime.sendMessage({
    action: "getCurrentTabId",
    url: window.location.href
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    checkReadLaterStatus();
} else {
    window.addEventListener('DOMContentLoaded', checkReadLaterStatus);
}