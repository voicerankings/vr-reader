/**
 * ============================================================================
 * Start_VRR Module (Core Entry Point)
 * ============================================================================
 * This module defines the `Start_VRR` class, which represents the initial 
 * floating "Start" button or quick-access bubble injected into the 
 * host webpage. 
 * 
 * Responsibilities:
 * - Serves as the primary user-facing entry point to launch the main TTS Reader widget 
 *   (implemented in `js/components/tts-widget/TTSWidget.js`).
 * - Manages its own isolated Shadow DOM to prevent CSS conflicts with the host page.
 * - Handles rendering of quick-access voice selections, tooltips, and character thumbnails.
 * - Manages cleanup and destruction of its DOM elements when the main widget is opened 
 *   or the page state changes.
 * 
 * For open-source contributors:
 * If you are looking to modify how the initial floating bubble looks, behaves on hover, 
 * or how it transitions into opening the full reader, this is the core file to modify.
 */
import {
    saveToLocalStorage,
    saveVoiceDefaultToLocalStorage,
    getCharacterThumbnail,
    readLocalStorage,
    getInnerText_pageReader,
    setDomainSettings,
    getHostName,
    getFormattedSelection
} from "../../utils/helpers";
import {
    getOpenGraphImageWithFallbacks
} from "../../utils/opengraph.js";
import Readability from "../../vendor/Readability.js";
import {
    defaultCSS
} from "../../config/defaultCSS";
import {
    APP_WEB_DOMAIN
} from "../../background/config.js";
import { CONSTANTS } from "../../constants/constants";

// Minimum highlighted-text length before the "Press Enter / Play" hint panel
// shows. Keeps the hint reserved for real reading, not quick copy/paste.
const SELECTION_HINT_MIN_CHARS = 170;

export default class Start_VRR {
    constructor() {
        this.buddy = {};
        this.shadow = null;
        this.STAR_SVG_PATH = "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z";
        this.langDisplay = new Intl.DisplayNames(['en'], { type: 'language' });
        this.regionDisplay = new Intl.DisplayNames(['en'], { type: 'region' });
        this.tooltipCache = new Map();
        this.ratingHtmlCache = new Map();
        this.tagsHtmlCache = new Map(); 
        this.globalTooltip = null;
        this.currentHoveredItem = null;
        this.tooltipUpdateRAF = null;
        
        // ADD THESE NEW PROPERTIES:
        this.defaultVoiceId = null;
        this.toastTimeout = null;
    }

    initShadowDOM(DOMElement) {
        this.shadow = DOMElement.attachShadow({
            mode: 'open'
        });
    }

    destroy() {
        VR_Reader.toggleTextSelector(false,true)
        if (this.selectionChangeHandler) {
            document.removeEventListener('selectionchange', this.selectionChangeHandler);
            this.selectionChangeHandler = null;
        }
        if (this.enterKeyHandler) {
            document.removeEventListener('keydown', this.enterKeyHandler);
            this.enterKeyHandler = null;
        }
        const elem = document.querySelector('#vrr-quick-access-host');
        if (elem) elem.remove();
        this.shadow = null;
        this.buddy = null;
    }

    close(deleteClass = true) {
        this.destroy();
        if (deleteClass) delete VR_Reader.vrrQuickAccessButton;
    }

    /**
     * Fades the selection hint out downward before closing the widget.
     * Used when a read is starting from the hint (Enter or play button) so the
     * hint gets a chance to animate out instead of vanishing instantly.
     * When no hint is visible it closes immediately.
     */
    fadeOutHintAndClose() {
        // Returns a promise that resolves once the quick-access button has
        // finished its click animation and been closed, so the caller can open
        // the TTS widget right after — instead of overlapping it.
        return new Promise((resolve) => {
            const wrapper = this.shadow && this.shadow.querySelector('.wrapper');
            const mainBtn = this.shadow && this.shadow.querySelector('#simple-reader-btn');
            const closeNow = () => {
                this.close(true);
                resolve();
            };

            // Let the quick press-release animation finish before fading out,
            // so the click feels like one fast tactile push.
            const isSpringing = mainBtn && mainBtn.classList.contains('springing');
            const springDelay = isSpringing ? 160 : 0;

            const fadeBtn = () => {
                if (mainBtn) {
                    mainBtn.classList.add('fading');
                }
            };

            if (isSpringing) {
                setTimeout(fadeBtn, springDelay);
            } else {
                fadeBtn();
            }

            if (wrapper && wrapper.classList.contains('hint-mode')) {
                if (this._hintLeaveTimer) {
                    clearTimeout(this._hintLeaveTimer);
                    this._hintLeaveTimer = null;
                }
                wrapper.classList.add('hint-leaving');
                setTimeout(() => {
                    wrapper.classList.remove('hint-leaving');
                    wrapper.classList.remove('hint-mode');
                    closeNow();
                }, 260 + springDelay);
            } else {
                setTimeout(closeNow, 180 + springDelay);
            }
        });
    }

    init() {
        if (!this.shadow) return;

        // Capture any user-highlighted text on mousedown (before the browser
        // collapses the selection when the button gains focus) and keep the
        // native highlight visible by preventing the default mousedown action.
        const mainBtn = this.shadow.querySelector("#simple-reader-btn");
        mainBtn.addEventListener("mousedown", (e) => {
            const selText = getFormattedSelection();
            if (selText && selText.trim().length > 0) {
                this._pendingSelection = selText;
                e.preventDefault();
            } else {
                this._pendingSelection = "";
            }
            // Squash the button for instant tactile feedback.
            mainBtn.classList.add('pressing');
            mainBtn.classList.remove('springing');
        });

        // If the pointer leaves the button before release, undo the squash
        // without triggering the spring bounce.
        mainBtn.addEventListener("mouseleave", () => {
            mainBtn.classList.remove('pressing');
        });
        mainBtn.addEventListener("pointercancel", () => {
            mainBtn.classList.remove('pressing');
        });
        mainBtn.addEventListener("animationend", (e) => {
            if (e.animationName === 'vrr-spring') {
                mainBtn.classList.remove('springing');
            }
        });

        mainBtn.addEventListener("click", async() => {
            // Spring back with a satisfying bounce when released.
            mainBtn.classList.remove('pressing');
            mainBtn.classList.add('springing');

            const defaultVoiceData = {}

            defaultVoiceData['ACTIVE_PREMIUM_VOICE_SERVICE'] = VR_Reader.savedLocalStorageGlobal['DEFAULT_PREMIUM_VOICE_SERVICE']
            

            defaultVoiceData['ACTIVE_PREMIUM_VOICE_ID'] = VR_Reader.savedLocalStorageGlobal['DEFAULT_PREMIUM_VOICE_ID']
            defaultVoiceData['ACTIVE_PREMIUM_VOICE_NAME'] = VR_Reader.savedLocalStorageGlobal['DEFAULT_PREMIUM_VOICE_NAME']
            defaultVoiceData['ACTIVE_PREMIUM_VOICE_GENDER'] = VR_Reader.savedLocalStorageGlobal['DEFAULT_PREMIUM_VOICE_GENDER']
            defaultVoiceData['ACTIVE_PREMIUM_VOICE_INSTRUCTIONS'] = VR_Reader.savedLocalStorageGlobal['DEFAULT_PREMIUM_VOICE_INSTRUCTIONS']
            defaultVoiceData['ACTIVE_PREMIUM_VOICE_LANGUAGE_CODE'] = VR_Reader.savedLocalStorageGlobal['DEFAULT_PREMIUM_VOICE_LANGUAGE_CODE']
            defaultVoiceData['ACTIVE_PREMIUM_VOICE_SPEAKER_ID'] = VR_Reader.savedLocalStorageGlobal['DEFAULT_PREMIUM_VOICE_SPEAKER_ID']
            defaultVoiceData['ACTIVE_PREMIUM_VOICE_WORDS_PER_MINUTE'] = VR_Reader.savedLocalStorageGlobal['DEFAULT_PREMIUM_VOICE_WORDS_PER_MINUTE']

            
            defaultVoiceData['ACTIVE_PREMIUM_VOICE_SPEED'] = VR_Reader.savedLocalStorageGlobal['DEFAULT_PREMIUM_VOICE_SPEED']

            defaultVoiceData['ACTIVE_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT'] = VR_Reader.savedLocalStorageGlobal['DEFAULT_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT']
            defaultVoiceData['ACTIVE_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT'] = VR_Reader.savedLocalStorageGlobal['DEFAULT_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT']


            await saveToLocalStorage(defaultVoiceData, true);
            await VR_Reader.changeActiveVoice();

            const pendingSelection = this._pendingSelection || "";
            this._pendingSelection = "";

            if (pendingSelection) {
                VR_Reader.readHighlightedTextSelection = pendingSelection;
                VR_Reader.readHighlightedText(pendingSelection);
            } else {
                setTimeout(() => {
                    VR_Reader.readWithVRR();
                }, 10);
            }

        });

        this.shadow.querySelector("#switch-hosts-btn").addEventListener("click", () => {
            const hostsOverlay = this.createHostsListOverlay({
                parentElement: this.shadow.querySelector('.wrapper'),
                containerCSS: `
                    position:absolute;
                    bottom:0px;
                    right:110%;
                `,
            });
            hostsOverlay.show();
        });
        
        this.shadow.querySelector("#read-later-btn").addEventListener("click", (e) => {
            this.handleReadLater(e.currentTarget);
        });

        this.shadow.querySelector("#page-reader-options-btn").addEventListener("click", () => {
            chrome.runtime.sendMessage({
                action: "open-sidepanel",
                route:"/settings",
                data:{
                    tab:'general'
                }
            });
        });

    this.shadow.querySelector("#text-selector-btn").addEventListener("click", () => {

        const isActive = !VR_Reader.isTextSelectorActive;
        VR_Reader.toggleTextSelector(isActive);
        this.updateTextSelectorButton(isActive);
    });

        this.shadow.querySelector("#sidepanel-btn").addEventListener("click", () => {
            chrome.runtime.sendMessage({
                action: "open-sidepanel",
                route:"/main-menu",
            });
        });

        this.shadow.querySelector("#close-btn").addEventListener("click", () => this.closeModal());

        // Make the selection hint popup itself clickable: capture the
        // highlighted text on mousedown (before the click would collapse the
        // selection) and play it on click — same behavior as pressing Enter.
        const hintElement = this.shadow.querySelector(".selection-hint");
        if (hintElement) {
            hintElement.addEventListener("mousedown", (e) => {
                const selText = getFormattedSelection();
                if (selText && selText.trim().length > 0) {
                    this._hintPendingSelection = selText;
                    e.preventDefault();
                } else {
                    this._hintPendingSelection = "";
                }
            });

            hintElement.addEventListener("click", async (e) => {
                const text = this._hintPendingSelection || "";
                this._hintPendingSelection = "";
                if (!text) return;

                e.preventDefault();
                e.stopPropagation();

                VR_Reader.readHighlightedTextSelection = text;
                VR_Reader.readHighlightedText(text);
                if (typeof VR_Reader.changeActiveVoice === 'function') {
                    VR_Reader.changeActiveVoice();
                }
            });
        }

        // Highlight the play button purple whenever the user has text selected
        // on the page, and keep it purple until the selection is cleared.
        // Also wire/unwire the Enter-to-play shortcut and the selection hint
        // panel based on the current selection state.
        this.enterKeyHandler = (e) => {
            if (e.key !== 'Enter' || e.repeat) return;

            // The Enter-to-play shortcut can be disabled from settings.
            if (VR_Reader.savedLocalStorageGlobal['DEFAULT_ENTER_KEY_PLAY_STATE'] === false) {
                return;
            }

            // Never hijack Enter inside editable fields (inputs, textareas,
            // contenteditable) where Enter has real meaning.
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
                return;
            }

            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;

            // Guard: selection must be outside editable content too.
            const container = selection.getRangeAt(0).commonAncestorContainer;
            const node = container && container.nodeType === 1 ? container : (container && container.parentElement);
            if (node && node.closest && node.closest('input, textarea, [contenteditable="true"]')) {
                return;
            }

            const text = selection.toString().trim();
            if (!text) return;

            e.preventDefault();

            VR_Reader.readHighlightedTextSelection = text;
            VR_Reader.readHighlightedText(text);
            if (typeof VR_Reader.changeActiveVoice === 'function') {
                VR_Reader.changeActiveVoice();
            }
        };

        this.selectionChangeHandler = () => {
            const btn = this.shadow && this.shadow.querySelector("#simple-reader-btn");
            const wrapper = this.shadow && this.shadow.querySelector(".wrapper");
            if (!btn) return;

            const enterKeyEnabled = VR_Reader.savedLocalStorageGlobal['DEFAULT_ENTER_KEY_PLAY_STATE'] !== false;

            const selection = window.getSelection();
            const selectionText = selection ? selection.toString().trim() : '';
            const hasSelection = selectionText.length > 0;

            btn.classList.toggle("selection-active", !!hasSelection && enterKeyEnabled);

            // Wire Enter only while text is selected AND the shortcut is enabled;
            // destroy it once deselected or the shortcut is disabled.
            const shouldBindEnter = enterKeyEnabled && hasSelection;
            if (shouldBindEnter && !this._enterKeyBound) {
                document.addEventListener("keydown", this.enterKeyHandler);
                this._enterKeyBound = true;
            } else if (!shouldBindEnter && this._enterKeyBound) {
                document.removeEventListener("keydown", this.enterKeyHandler);
                this._enterKeyBound = false;
            }

            // Selection hint: only for substantial selections (likely reading).
            const shouldHint = enterKeyEnabled && hasSelection && selectionText.length >= SELECTION_HINT_MIN_CHARS;

            if (!wrapper) return;

            if (shouldHint) {
                if (!wrapper.classList.contains("hint-mode")) {
                    wrapper.classList.add("hint-mode");
                }
                // Cancel any pending fade-out if the user re-selects quickly.
                if (this._hintLeaveTimer) {
                    clearTimeout(this._hintLeaveTimer);
                    this._hintLeaveTimer = null;
                }
                if (wrapper.classList.contains("hint-leaving")) {
                    wrapper.classList.remove("hint-leaving");
                }
            } else {
                if (wrapper.classList.contains("hint-mode") && !wrapper.classList.contains("hint-leaving")) {
                    wrapper.classList.add("hint-leaving");
                    this._hintLeaveTimer = setTimeout(() => {
                        wrapper.classList.remove("hint-leaving");
                        wrapper.classList.remove("hint-mode");
                        this._hintLeaveTimer = null;
                    }, 300);
                }
            }
        };
        document.addEventListener("selectionchange", this.selectionChangeHandler);
        this.selectionChangeHandler();
    }
    updateTextSelectorButton(isActive) {
        const btn = this.shadow.querySelector("#text-selector-btn");
        if (!btn) return;
        
        if (isActive) {
            btn.style.backgroundColor = '#10b981'; // Green when active
            btn.style.color = 'white';
        } else {
            btn.style.backgroundColor = '#e2e8f0'; // Normal gray
            btn.style.color = '#4A5568';
        }
    }

    async makeDefaultVoice(voice, shadow) {
        if (voice.voice_service_extension_active === false) {
            alert(`Sorry, ${voice.voice_service} voices are not available yet for the extension`);
            return;
        }

        // Update local reference
        this.defaultVoiceId = voice.voice_id;

        // Save to chrome storage
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_ID': voice.voice_id });
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_NAME': voice.voice_name });
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_GENDER': voice.voice_gender });
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_INSTRUCTIONS': voice.voice_instructions ?? null });

        const languageCode = voice.voice_language_code || (Array.isArray(voice.voice_language_codes) ? voice.voice_language_codes[0] : null);
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_LANGUAGE_CODE': languageCode });
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_SPEAKER_ID': voice.voice_speaker_id });
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_WORDS_PER_MINUTE': voice.voice_words_per_minute });
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_SERVICE': voice.voice_service });
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT': voice.voice_has_voice_speed_support });
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT': voice.voice_has_word_timestamp_support });

        VR_Reader.updateAllContentScriptTabs(voice)

        // Update all default voice buttons in the UI
        const allDefaultButtons = shadow.querySelectorAll('.default-voice-btn');
        allDefaultButtons.forEach(btn => {
            const btnVoiceId = btn.closest('.list-item')?.dataset.voiceId;
            if (btnVoiceId === voice.voice_id) {
                btn.classList.add('is-default');
                btn.style.color = '#10b981';
            } else {
                btn.classList.remove('is-default');
                btn.style.color = '#9ca3af';
            }
        });

        VR_Reader.makeToast({
            posX2:25,
            posY:50,
            delay: 2000,
            action: 'normal',
            title: `${voice.voice_name} is now your default voice!`
        });

        this.handleVoiceSelection(voice);


    }

    async handleReadLater(buttonEl) {
        if (!VR_Reader.isUserLogged) {
            VR_Reader.makePrompt({
                posX: 50,
                posY: 50,
                action: 'vrr-theme',
                title: 'Sign In Required',
                message: 'Please log in via the side panel to save articles for later.',
                cancel: { buttonText: 'Maybe later' },
                actions: [{
                    buttonText: 'Sign In',
                    callback: () => {
                        chrome.runtime.sendMessage({
                            action: "open-sidepanel",
                            route: "/main-menu",
                            data: { openLoginModal: true }
                        });
                    }
                }]
            });
            return;
        }

        const url = this._cleanUrl(window.location.href);
        let text_fragment_url = url; 
        const page_image_url = getOpenGraphImageWithFallbacks() || "";
        let last_read_text = "";

        // Give visual feedback on the button
        if (buttonEl) {
            // Phase 1: Green checkmark confirmation (2.5s)
            buttonEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            buttonEl.style.backgroundColor = '#10b981';
            buttonEl.style.color = 'white';
            buttonEl.setAttribute('data-tooltip', 'Saved!');
            
            // Phase 2: Settle into a permanent "saved" filled bookmark state
            setTimeout(() => {
                // Filled bookmark icon to show it's been saved
                buttonEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
                buttonEl.style.backgroundColor = '#dbeafe';
                buttonEl.style.color = '#2563eb';
                buttonEl.setAttribute('data-tooltip', 'Saved to Read Later');
                buttonEl.style.cursor = 'default';
                buttonEl.onclick = null; // Prevent double-saving
            }, 2500);
        }

        // Try to find the actual start of the article content for the text fragment
        try {
            const removeJunk = (container) => {
                const junkSelectors = [
                    'footer', 'nav', 'aside', '[class*="ad-"]', '.ad', '.advert', 
                    '[class*="cookie"]', '.social', '.sharing', '.popup', 
                    '[class*="related"]', '[class*="comment"]'
                ];
                container.querySelectorAll(junkSelectors.join(', ')).forEach(element => {
                    if (element !== container) element.remove();
                });
            };

            let documentClone = document.implementation.createHTMLDocument();
            documentClone.documentElement.innerHTML = document.documentElement.innerHTML;
            removeJunk(documentClone.body);

            const article = new Readability(documentClone).parse();
            if (article && article.content) {
                const tempDivElement = document.createElement("div");
                tempDivElement.innerHTML = article.content;
                const documentText = getInnerText_pageReader(tempDivElement);
                
                if (documentText && documentText.trim().length > 50) {
                    const cleanText = documentText.replace(/\s+/g, ' ').trim();

                    // Always start from the very beginning of the article.
                    // Scan forward to find the first sentence-ending punctuation
                    // (.!?) followed by a space or end-of-string, at or past the
                    // minimum anchor length. This avoids the abbreviation problem
                    // where "Co." or "Ltd." would break naive sentence splitting.
                    const MIN_ANCHOR_LENGTH = 50;
                    const MAX_ANCHOR_LENGTH = 300;
                    let cutoff = -1;

                    // Search for sentence boundaries starting from MIN_ANCHOR_LENGTH
                    for (let i = MIN_ANCHOR_LENGTH; i < Math.min(cleanText.length, MAX_ANCHOR_LENGTH); i++) {
                        const ch = cleanText[i];
                        if (ch === '.' || ch === '!' || ch === '?') {
                            const next = cleanText[i + 1];
                            // Only count as a real sentence end if followed by
                            // whitespace, end-of-string, or a quote/paren
                            if (!next || next === ' ' || next === '\n' || next === '"' || next === '\'' || next === ')') {
                                cutoff = i + 1; // include the punctuation
                                break;
                            }
                        }
                    }

                    let anchor;
                    if (cutoff > 0) {
                        anchor = cleanText.substring(0, cutoff).trim();
                    } else {
                        // No sentence boundary found in range — just take up to max
                        anchor = cleanText.substring(0, MAX_ANCHOR_LENGTH).trim();
                    }

                    last_read_text = anchor;
                    text_fragment_url = `${url}#:~:text=${encodeURIComponent(anchor)}`;
                }
            }
        } catch (e) {
            console.warn("Could not extract article text for read later fragment", e);
        }

        window.VR_Reader.isTrackingReadLater = true;

        chrome.runtime.sendMessage({
            action: "saveReadLater",
            payload: {
                url,
                title: document.title,
                text_fragment_url,
                last_read_text,
                total_chars: 0,
                current_char_position: 0,
                percentage_remaining: 100,
                page_image_url
            }
        });
    }

    _cleanUrl(urlString) {
        try {
            const url = new URL(urlString);
            const paramsToDelete = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
            paramsToDelete.forEach(param => url.searchParams.delete(param));
            return url.toString();
        } catch (error) {
            return urlString;
        }
    }

    closeModal() {
        VR_Reader.makeModalLarge({
            styleCSS: `${this.styleTooltip()}`,
            title: `<div style="margin-bottom:10px;text-align:center;">Close Quick Access</div><div style="display: flex; justify-content: center; margin-bottom: 20px;"><svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 2048 2048"><path fill="currentColor" d="M0 384h2048v1152H0V384zm128 128v896h1280V512H128zm1792 896V512h-384v896h384zM989 643l317 317l-317 317l-90-90l162-163H640V896h421L899 733l90-90z"/></svg></div>`,
            message: "This will hide the floating button until you re-enable it in the extension settings.",
            actions: [{
                buttonText: '<b>Hide for ' + getHostName() + '</b>',
                callback: async () => {
                    await setDomainSettings(getHostName(), CONSTANTS.DOMAIN_QUICK_ACCESS_STATE_KEYNAME, false);
                    await VR_Reader.storeDefaults();
                    this.close();
                }
            }, {
                buttonText: '<b>Hide Quick Access</b>',
                callback: async () => {
                    await saveToLocalStorage({ 'DEFAULT_QUICK_ACCESS_CONTROLS_STATE': false }, true);
                    this.close();
                }
            }, {
                buttonText: '<b>Just close for now</b>',
                callback: async () => this.close()
            }]
        });
    }

    // --- NEW: Helper methods for tooltips ---
    getRatingHtml(voice) {
        const cacheKey = `${voice.voice_review_average}-${voice.voice_review_count}`;
        if (this.ratingHtmlCache.has(cacheKey)) {
            return this.ratingHtmlCache.get(cacheKey);
        }

        const average = voice.voice_review_average;
        const count = voice.voice_review_count;
        if (!count || count === 0) return '';
        
        const widthPercentage = (average / 5) * 100;

        const stars = `
            <div style="position: relative; display: inline-flex; align-items: center; gap: 2px;">
                <div style="display: flex; gap: 2px;">
                    <svg style="width: 16px; height: 16px; color: #4b5563;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                    <svg style="width: 16px; height: 16px; color: #4b5563;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                    <svg style="width: 16px; height: 16px; color: #4b5563;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                    <svg style="width: 16px; height: 16px; color: #4b5563;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                    <svg style="width: 16px; height: 16px; color: #4b5563;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                </div>
                <div style="position: absolute; top: 0; left: 0; display: flex; overflow: hidden; width: ${widthPercentage}%; gap: 2px;">
                    <svg style="width: 16px; height: 16px; color: #fbbf24; flex-shrink: 0;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                    <svg style="width: 16px; height: 16px; color: #fbbf24; flex-shrink: 0;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                    <svg style="width: 16px; height: 16px; color: #fbbf24; flex-shrink: 0;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                    <svg style="width: 16px; height: 16px; color: #fbbf24; flex-shrink: 0;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                    <svg style="width: 16px; height: 16px; color: #fbbf24; flex-shrink: 0;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                </div>
            </div>
        `;

        const result = `
            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
                ${stars}
                <span style="color: white; font-weight: 600;">${Number(average).toFixed(1)}</span>
                <span style="color: #d1d5db;">(${count})</span>
            </div>
        `;

        this.ratingHtmlCache.set(cacheKey, result);
        return result;
    }
    getLanguagesTooltipHtml(voice) {
        if (!voice.voice_language_codes || voice.voice_language_codes.length === 0) return '';
        
        return voice.voice_language_codes.slice(0,1).map(code => {
            try {
                const parts = code.split('-');
                const langCode = parts[0];
                const regionCode = parts.length > 1 ? parts[1].toUpperCase() : null;
                let langName = this.langDisplay.of(langCode);
                let regionName = regionCode ? this.regionDisplay.of(regionCode) : '';
                const flagHtml = regionCode ? `<img class="inline-block h-4 w-auto ml-1 rounded-sm" src="https://flagsapi.com/${regionCode}/flat/24.png" alt="${regionCode} flag">` : '';
                return `<span class="inline-flex items-center">${langName} / ${regionName} ${flagHtml}</span>`;
            } catch (e) {
                return code;
            }
        }).join(' <span class="text-gray-400 font-light px-1"></span> ');
    }

    getTagsHtml(voice) {
        // Use filtered tags if available, otherwise fall back to the original.
        const tags = voice.voice_suggested_tags_filtered || voice.voice_suggested_tags;
        const cacheKey = tags ? tags.join(',') : '';

        if (!cacheKey) return '';
        if (this.tagsHtmlCache.has(cacheKey)) {
            return this.tagsHtmlCache.get(cacheKey);
        }

        const tagBadges = tags.map(tag =>
            // Inline styles to match the dark tooltip and Vue component design
            `<span style="display: inline-block; background-color: #4b5563; color: #e5e7eb; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 500;">${tag}</span>`
        ).join('');

        const result = `<div style="display: flex; flex-wrap: wrap; gap: 6px;">${tagBadges}</div>`;
        this.tagsHtmlCache.set(cacheKey, result);
        return result;
    }


    getTooltipContent(voice) {
        if (this.tooltipCache.has(voice.voice_id)) {
            return this.tooltipCache.get(voice.voice_id);
        }

        // 1. Get all individual HTML sections
        const nameHtml = `<div style="text-align:left;"><strong style="font-size: 14px;">${voice.voice_name}</strong></div>`;
        const ratingSection = this.getRatingHtml(voice);
        const languagesSection = this.getLanguagesTooltipHtml(voice);
        const tagsSection = this.getTagsHtml(voice); // <-- New

        // 2. Build the final HTML string with proper spacing
        let finalHtml = nameHtml;

        if (ratingSection) {
            finalHtml += `<div style="margin-top: 6px;">${ratingSection}</div>`;
        }

        // Add a divider if there are ratings AND something to show below them (languages or tags)
        if (ratingSection && (languagesSection || tagsSection)) {
            finalHtml += `<hr style="margin: 8px 0; border: none; border-top: 1px solid #4b5563;">`;
        }
        
        if (languagesSection) {
            finalHtml += `<div style="margin-top: 6px;">${languagesSection}</div>`;
        }
        
        if (tagsSection) {
            // Add slightly more margin if it follows the language section
            const marginTop = languagesSection ? '8px' : '6px';
            finalHtml += `<div style="margin-top: ${marginTop};">${tagsSection}</div>`;
        }

        // 3. Cache and return the result
        this.tooltipCache.set(voice.voice_id, finalHtml);
        return finalHtml;
    }

    getLanguageInfo(languageCodes) {
        if (!languageCodes || !Array.isArray(languageCodes)) return { primaryCountryCode: null, count: 0 };
        const codes = languageCodes;
        const count = codes.length;
        if (count === 0) return { primaryCountryCode: null, count: 0 };
        let primaryCode = codes.find(c => c.toLowerCase() === 'en-us') || codes.find(c => c.toLowerCase().startsWith('en-')) || codes[0];
        const parts = primaryCode.split('-');
        const countryCode = parts.length > 1 ? parts[1].toUpperCase() : null;
        return { primaryCountryCode: countryCode, count: count };
    }

    // --- SVGs --- //
    svgSimplerReader2(size = 28) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48"><g fill="none" stroke-linejoin="round" stroke-width="4"><path fill="#2F88FF" stroke="#000" d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z"/><path fill="#FFF" stroke="#fff" d="M20 24V17.0718L26 20.5359L32 24L26 27.4641L20 30.9282V24Z"/></g></svg>`
    }
    svgClose(size = 22) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="currentColor" d="m12 13.4l-4.9 4.9q-.275.275-.7.275t-.7-.275q-.275-.275-.275-.7t.275-.7l4.9-4.9l-4.9-4.9q-.275-.275-.275-.7t.275-.7q.275-.275.7-.275t.7.275l4.9 4.9l4.9-4.9q-.275-.275.7-.275t.7.275q.275.275.275.7t-.275.7L13.4 12l4.9 4.9q.275.275.275.7t-.275.7q-.275.275-.7.275t-.7-.275z"/></svg>`
    }
    svgDownArrow(size = 22) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>`
    }
    svgDefaultVoice(size = 18) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
        </svg>`;
    }

    svgTextSelector(size = 22){
        return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g fill="none"><path d="M1 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5a2 2 0 0 1-1.164 1.818a1.5 1.5 0 0 0-.275-.379l-.446-.446A1 1 0 0 0 14 10V5a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h4v1H3a2 2 0 0 1-2-2V5z" fill="currentColor"/><path d="M8.854 8.146A.5.5 0 0 0 8 8.5v6a.5.5 0 0 0 .9.3l1.35-1.8h2.25a.5.5 0 0 0 .354-.854l-4-4zM9 13V9.707L11.293 12H10a.5.5 0 0 0-.4.2L9 13z" fill="currentColor"/></g></svg>`   
    }
    svgSwapHosts(size = 22) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.207 15.061L1 11.854v-.707L4.207 7.94l.707.707-2.353 2.354H15v1H2.56l2.354 2.353-.707.707zm7.586-7L15 4.854v-.707L11.793.94l-.707.707L13.439 4H1v1h12.44l-2.354 2.354.707.707z"/></svg>`
    }
    svgPageSettings(size = 22){
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 -960 960 960"><path fill="currentColor" d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5-2-31.5-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266zm42-180q58 0 99-41t41-99-41-99-99-41q-59 0-99.5 41T342-480t40.5 99 99.5 41m-2-140"/></svg>`
    }

    svgSidebar(size = 22){
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256"><path fill="currentColor" d="M216 40H40a16 16 0 0 0-16 16v144a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16M64 152H48a8 8 0 0 1 0-16h16a8 8 0 0 1 0 16m0-32H48a8 8 0 0 1 0-16h16a8 8 0 0 1 0 16m0-32H48a8 8 0 0 1 0-16h16a8 8 0 0 1 0 16m152 112H88V56h128z"/></svg>`
    }

    svgCollections(size = 22) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="currentColor" d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>`
    }
    svgLoading(size = 30) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg" stroke="currentColor"><g fill="none" fill-rule="evenodd"><g transform="translate(1 1)" stroke-width="2"><circle stroke-opacity=".5" cx="18" cy="18" r="18"/><path d="M36 18c0-9.94-8.06-18-18-18"><animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite"/></path></g></g></svg>`;
    }
    svgReadLater(size = 22) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>`;
    }

    createHTML() {
        const savedPlacement = VR_Reader.savedLocalStorageGlobal && VR_Reader.savedLocalStorageGlobal['DEFAULT_QUICK_ACCESS_CONTROLS_PANEL_PLACEMENT_STATE'];
        const panelPlacement = (savedPlacement === 'middle' || savedPlacement === 'bottom') ? savedPlacement : 'bottom';
        return `  
            <div id="quick-access" class="container placement-${panelPlacement}">
                <div class="wrapper">
                    <div id="simple-reader-btn" class="main-btn top-tooltip">
                        ${this.svgSimplerReader2(28)}
                    </div>
                    <div class="controls-menu">
                        <div id="switch-hosts-btn" class="control-btn top-tooltip" data-tooltip="Switch Voice">
                            ${this.svgSwapHosts(22)}
                        </div>

                        <div id="read-later-btn" class="control-btn top-tooltip" data-tooltip="Read Later">
                            ${this.svgReadLater(20)}
                        </div>

                        <div id="text-selector-btn" class="control-btn top-tooltip" data-tooltip="Click to Read">
                            ${this.svgTextSelector(22)}
                        </div>

                        <div id="page-reader-options-btn" class="control-btn top-tooltip" data-tooltip="Reader Settings">
                            ${this.svgPageSettings(22)}
                        </div>

                        <div id="sidepanel-btn" style="display:none" class="control-btn top-tooltip" data-tooltip="Open sidepanel">
                            ${this.svgSidebar(22)}
                        </div>
                        
                        <div id="close-btn" class="control-btn top-tooltip" data-tooltip="Close ">
                            ${this.svgClose(22)}
                        </div>
                    </div>

                    <!-- Selection hint panel: shown instead of the controls menu
                         when a substantial amount of text is highlighted. -->
                    <div class="selection-hint">
                        <div class="selection-hint-text">Press <b>Enter</b> to play</div>
                        <div class="selection-hint-arrow">${this.svgDownArrow(18)}</div>
                    </div>
                </div>
            </div>
            ${this.style()}
            ${this.styleTooltip()}
        `
    }

style() {
        return `
            ${defaultCSS()}
            <style>
                .container { position: fixed; right: 10px; bottom: 122px; z-index: 10000000000; }
                .container.placement-bottom { bottom: 122px; }
                .container.placement-middle { bottom: 50%; transform: translateY(60px); }
                .wrapper { position: relative; display: flex; justify-content: flex-end; align-items: center; }
                
                /* MAIN BUTTON STYLES */
                .main-btn { 
                    width: 40px; 
                    height: 40px; 
                    background-color: #f0f0f054; 
                    border: 1px solid #cccccc61; 
                    border-radius: 50%; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    cursor: pointer; 
                    box-shadow: 0 4px 8px rgba(0,0,0,0.15); 
                    /* PERFORMANCE: Use specific properties instead of 'all' */
                    transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease; 
                    z-index: 10; 
                    position: relative; 
                    overflow: hidden; 
                    /* PERFORMANCE: Hints browser to prepare for animation */
                    will-change: transform;
                }

                /* HOVER: Scale up and solid background */
                .main-btn:hover { 
                    transform: scale(1.08); 
                    background-color: #f0f0f0; 
                    box-shadow: 0 6px 12px rgba(0,0,0,0.25); 
                }

                /* FADE OUT: Applied by fadeOutHintAndClose() so the play button
                   itself fades out immediately when a read is triggered, while
                   the hint popup fades out with its own delayed transition. */
                .main-btn.fading {
                    opacity: 0;
                    transform: scale(0.85);
                    transition: opacity 0.2s ease, transform 0.2s ease;
                }

                /* PRESS: Instant tactile squash while the mouse is down */
                .main-btn.pressing {
                    transform: scale(0.8);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    transition: transform 0.1s ease, box-shadow 0.1s ease;
                }

                /* SPRING: Quick tactile snap back to rest after release */
                .main-btn.springing {
                    animation: vrr-spring 0.16s ease-out;
                }

                @keyframes vrr-spring {
                    0% { transform: scale(0.8); }
                    70% { transform: scale(1.02); }
                    100% { transform: scale(1); }
                }

                /* --- COLOR LOGIC --- */
                .main-btn svg path[fill="#2F88FF"] { 
                    fill: #1C274C; 
                    transition: fill 0.4s cubic-bezier(0.4, 0, 0.2, 1); 
                }
                
                .main-btn:hover svg path[fill="#2F88FF"] { 
                    fill: #7C3AED; 
                }

                /* --- OPTIMIZED SHEEN ANIMATION (GPU BASED) --- */
                .main-btn::after {
                    content: "";
                    position: absolute;
                    top: 0;
                    left: 0; /* Pin to left, we will move it with transform */
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.8), transparent);
                    
                    /* Start position: Moved to the left (-100%) and skewed */
                    transform: translateX(-150%) skewX(-20deg);
                    
                    /* Reset instantly when hover stops */
                    transition: none; 
                }

                /* Trigger sheen on hover */
                .main-btn:hover::after {
                    /* End position: Move to the right */
                    transform: translateX(150%) skewX(-20deg);

                    /* Animate the transform property only */
                    transition: transform 0.5s ease-in-out; 
                }

                /* --- SELECTION-ACTIVE STATE (text highlighted on the page) --- */
                .main-btn.selection-active svg path[fill="#2F88FF"] {
                    fill: #7C3AED;
                    transition: fill 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .main-btn.selection-active::after {
                    animation: vrr-sheen-flash 0.6s ease-in-out;
                }

                @keyframes vrr-sheen-flash {
                    0% { transform: translateX(-150%) skewX(-20deg); }
                    100% { transform: translateX(150%) skewX(-20deg); }
                }

                /* MENU CONTROLS */
                .controls-menu { 
                    position: absolute; 
                    right: 0; 
                    bottom: calc(100% + 10px); 
                    display: flex; 
                    flex-direction: row; 
                    gap: 8px; 
                    
                    opacity: 0; 
                    visibility: hidden; 
                    transform: translateY(10px); 
                    
                    background-color: rgba(255, 255, 255, 0.95); 
                    padding: 6px; 
                    border-radius: 24px; 
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1); 
                    border: 1px solid #ddd; 

                    /* UX: Add a tiny delay (0.1s) so the button reacts first, then menu appears */
                    transition: opacity 0.3s ease, transform 0.3s ease, visibility 0.3s;
                    transition-delay: 0.1s; 
                }

                .wrapper:hover .controls-menu { 
                    opacity: 1; 
                    visibility: visible; 
                    transform: translateY(0); 
                    /* Remove delay on enter if you want it instant, 
                       but keeping it ensures the sheen catches the eye first */
                }

                .control-btn { width: 36px; height: 36px; background-color: #e2e8f0; color: #4A5568; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background-color 0.2s ease, transform 0.2s ease; }
                .control-btn:hover { background-color: #cbd5e0; transform: scale(1.1); }

                /* --- SELECTION HINT PANEL --- */
                .selection-hint {
                    position: absolute;
                    right: 0;
                    bottom: calc(100% + 12px);
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    gap: 10px;
                    min-width: 200px;
                    max-width: 280px;
                    padding: 10px 16px;
                    background-color: rgba(20, 20, 28, 0.96);
                    color: #e5e7eb;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 12px;
                    box-shadow: 0 6px 20px rgba(0,0,0,0.4);
                    font-size: 14px;
                    line-height: 1.4;
                    text-align: left;

                    opacity: 0;
                    visibility: hidden;
                    transform: translateY(10px);

                    transition: opacity 0.3s ease, transform 0.3s ease, visibility 0.3s;
                    transition-delay: 0.1s;

                    cursor: pointer;
                }

                .selection-hint:hover {
                    background-color: rgba(34, 34, 46, 0.98);
                    border-color: rgba(167, 139, 250, 0.45);
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                }

                .selection-hint .selection-hint-text {
                    flex: 1;
                    white-space: nowrap;
                }

                .selection-hint .selection-hint-text b {
                    display: inline-block;
                    padding: 2px 8px;
                    margin: 0 2px;
                    background-color: rgba(167, 139, 250, 0.15);
                    border: 1px solid rgba(167, 139, 250, 0.35);
                    border-radius: 6px;
                    color: #c4b5fd;
                    font-size: 13px;
                    font-weight: 600;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                }

                .selection-hint .selection-hint-arrow {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background-color: rgba(167, 139, 250, 0.18);
                    color: #a78bfa;
                    animation: vrr-hint-bounce 1.4s ease-in-out infinite;
                }

                @keyframes vrr-hint-bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(4px); }
                }

                .wrapper.hint-mode .controls-menu {
                    opacity: 0;
                    visibility: hidden;
                    pointer-events: none;
                }

                /* Auto-shown once the selection threshold is reached (no hover needed) */
                .wrapper.hint-mode .selection-hint {
                    opacity: 1;
                    visibility: visible;
                    transform: translateY(0);
                }

                .wrapper.hint-mode .main-btn {
                    border-color: rgba(167, 139, 250, 0.7);
                    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.25), 0 4px 8px rgba(0,0,0,0.15);
                }

                /* Fade-out downward when the text is deselected */
                .wrapper.hint-mode.hint-leaving .selection-hint {
                    opacity: 0;
                    visibility: hidden;
                    transform: translateY(14px);
                    transition: opacity 0.3s ease, transform 0.3s ease, visibility 0.3s;
                    transition-delay: 0s;
                }

                .wrapper.hint-mode.hint-leaving .main-btn {
                    border-color: #cccccc61;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
                }
                
                /* UTILITIES */
                .flex { display: flex; }
                .inline-flex { display: inline-flex; }
                .items-center { align-items: center; }
                .gap-2 { gap: 8px; }
                .relative { position: relative; }
                .absolute { position: absolute; }
                .top-0 { top: 0; }
                .left-0 { left: 0; }
                .overflow-hidden { overflow: hidden; }
                .flex-shrink-0 { flex-shrink: 0; }
                .w-4 { width: 16px; }
                .h-4 { height: 16px; }
                .text-sm { font-size: 14px; }
                .text-gray-300 { color: #d1d5db; }
                .text-gray-200 { color: #e5e7eb; }
                .text-gray-400 { color: #9ca3af; }
                .text-yellow-400 { color: #fbbf24; }
                .font-semibold { font-weight: 600; }
                .font-light { font-weight: 300; }
                .inline-block { display: inline-block; }
                .ml-1 { margin-left: 4px; }
                .px-1 { padding-left: 4px; padding-right: 4px; }
                .rounded-sm { border-radius: 2px; }
            </style>
        `;
    }

    styleTooltip() {
        return `
        <style>
            [data-tooltip] { position: relative; z-index: 2; cursor: pointer; }
            [data-tooltip]:before, [data-tooltip]:after { visibility: hidden; opacity: 0; pointer-events: none; }
            [data-tooltip]:before { position: absolute; padding: 7px 12px; border-radius: 5px; background-color: hsla(0, 0%, 5%, 0.85); color: #fff; content: attr(data-tooltip); text-align: center; font-size: 14px; line-height: 1.2; transition: all 0.2s ease-in-out; white-space: nowrap; }
            [data-tooltip]:hover:before, [data-tooltip]:hover:after { visibility: visible; opacity: 1; }
            .top-tooltip[data-tooltip]:before { bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 8px; }
            
            /* HTML Tooltip Styles */
            .html-tooltip { position: relative; }

            #global-hosts-tooltip {
                position: fixed;
                background-color: #1f2937;
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 13px;
                line-height: 1.5;
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                white-space: normal;
                display: block;
                width: 215px;
            }

            #global-hosts-tooltip.show-below::after {
                content: '';
                position: absolute;
                bottom: 100%;
                left: var(--arrow-offset, 50%);
                transform: translateX(-50%);
                border-width: 6px;
                border-style: solid;
                border-color: transparent transparent #1f2937 transparent;
            }

            #global-hosts-tooltip.show-above::after {
                content: '';
                position: absolute;
                top: 100%;
                left: var(--arrow-offset, 50%);
                transform: translateX(-50%);
                border-width: 6px;
                border-style: solid;
                border-color: #1f2937 transparent transparent transparent;
            }

        </style>
        `
    }

    createGlobalTooltip(shadow) {
        this.globalTooltip = document.createElement('div');
        this.globalTooltip.id = 'global-hosts-tooltip';
        // Append to the overlay div, NOT to the .list container
        const overlay = shadow.querySelector('.overlay');
        overlay.appendChild(this.globalTooltip);
    }

showTooltip(element, voice, shadow) {
    if (!this.globalTooltip) return;
    
    const content = this.getTooltipContent(voice);
    this.globalTooltip.innerHTML = content;
    this.globalTooltip.style.opacity = '0';
    this.globalTooltip.style.visibility = 'visible';
    
    this.globalTooltip.offsetHeight;
    
    this.updateTooltipPosition(shadow);
    
    setTimeout(() => {
        if (this.currentHoveredItem === element) {
            this.globalTooltip.style.transition = 'opacity 0.2s ease-in-out';
            this.globalTooltip.style.opacity = '1';
        }
    }, 300);
}

hideTooltip() {
    this.currentHoveredItem = null;
    if (this.globalTooltip) {
        this.globalTooltip.style.transition = 'none';
        this.globalTooltip.style.opacity = '0';
        this.globalTooltip.style.visibility = 'hidden';
    }
    if (this.tooltipUpdateRAF) {
        cancelAnimationFrame(this.tooltipUpdateRAF);
        this.tooltipUpdateRAF = null;
    }
}

updateTooltipPosition(shadow) {
    if (!this.currentHoveredItem || !this.globalTooltip) return;
    
    if (this.tooltipUpdateRAF) {
        cancelAnimationFrame(this.tooltipUpdateRAF);
    }
    
    this.tooltipUpdateRAF = requestAnimationFrame(() => {
        const itemRect = this.currentHoveredItem.getBoundingClientRect();
        const tooltipRect = this.globalTooltip.getBoundingClientRect();
        const scrollContainer = shadow.querySelector('.list');
        const containerRect = scrollContainer ? scrollContainer.getBoundingClientRect() : null;
        
        const tooltipWidth = 215;
        const tooltipHeight = tooltipRect.height || 150;
        const offset = 12;
        
        let left = itemRect.left + (itemRect.width / 2) - (tooltipWidth / 2);
        
        const viewportWidth = window.innerWidth;
        if (left < 10) left = 10;
        if (left + tooltipWidth > viewportWidth - 10) {
            left = viewportWidth - tooltipWidth - 10;
        }
        
        let top;
        let showAbove = false;
        
        if (containerRect) {
            const spaceAbove = itemRect.top - containerRect.top;
            const spaceBelow = containerRect.bottom - itemRect.bottom;
            
            if (spaceAbove >= tooltipHeight + offset || spaceAbove > spaceBelow) {
                showAbove = true;
                top = itemRect.top - tooltipHeight - offset;
            } else {
                showAbove = false;
                top = itemRect.bottom + offset;
            }
        } else {
            const spaceAbove = itemRect.top;
            const spaceBelow = window.innerHeight - itemRect.bottom;
            
            if (spaceAbove >= tooltipHeight + offset || spaceAbove > spaceBelow) {
                showAbove = true;
                top = itemRect.top - tooltipHeight - offset;
            } else {
                showAbove = false;
                top = itemRect.bottom + offset;
            }
        }
        
        this.globalTooltip.style.left = `${left}px`;
        this.globalTooltip.style.top = `${top}px`;
        this.globalTooltip.style.width = `${tooltipWidth}px`;
        
        if (showAbove) {
            this.globalTooltip.classList.add('show-above');
            this.globalTooltip.classList.remove('show-below');
        } else {
            this.globalTooltip.classList.add('show-below');
            this.globalTooltip.classList.remove('show-above');
        }
        
        const arrowOffset = (itemRect.left + itemRect.width / 2) - left;
        this.globalTooltip.style.setProperty('--arrow-offset', `${arrowOffset}px`);
    });
}
    
    // --- UPDATED HELPER METHOD WITH COLLECTIONS SUPPORT + FLAGS + TOOLTIPS --- //
    createHostsListOverlay(options = {}) {
        const { parentElement, containerCSS = '' } = options;

        const cleanup = () => {
            const existing = parentElement.querySelector('.hosts-list-overlay-container');
            if (existing) {
                existing.remove();
            }
            
            // Tooltip is inside shadow DOM, so it gets cleaned up automatically
            this.hideTooltip();
            this.globalTooltip = null;
        };
        cleanup(); 

        const overlayContainer = document.createElement('div');
        overlayContainer.className = 'hosts-list-overlay-container';
        
        const shadow = overlayContainer.attachShadow({ mode: 'open' });
        
        shadow.innerHTML = `
            <style>
                #global-hosts-tooltip {
                    position: fixed;
                    background-color: #1f2937;
                    color: white;
                    padding: 12px 16px;
                    border-radius: 8px;
                    font-size: 13px;
                    line-height: 1.5;
                    opacity: 0;
                    visibility: hidden;
                    pointer-events: none;
                    z-index: 10000;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    white-space: normal;
                    display: block;
                    width: 215px;
                }

                #global-hosts-tooltip.show-below::after {
                    content: '';
                    position: absolute;
                    bottom: 100%;
                    left: var(--arrow-offset, 50%);
                    transform: translateX(-50%);
                    border-width: 6px;
                    border-style: solid;
                    border-color: transparent transparent #1f2937 transparent;
                }

                #global-hosts-tooltip.show-above::after {
                    content: '';
                    position: absolute;
                    top: 100%;
                    left: var(--arrow-offset, 50%);
                    transform: translateX(-50%);
                    border-width: 6px;
                    border-style: solid;
                    border-color: #1f2937 transparent transparent transparent;
                }

                .overlay { background: #1f1f1f; border-radius: 8px; width: 320px; color: white; z-index: 1001; display: flex; flex-direction: column; max-height: 400px; ${containerCSS} }
                .header { padding: 8px 12px; border-bottom: 1px solid #333; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
                .title { font-weight: 500; font-size: 16px; flex-grow: 1; }
                .header-controls { display: flex; align-items: center; gap: 4px; }
                .close-button, .back-button, .search-icon, .collections-icon { background: none; border: none; color: #ccc; cursor: pointer; padding: 4px; display:flex; align-items:center; }
                .close-button:hover, .back-button:hover, .search-icon:hover, .collections-icon:hover { color: white; }
                .list { flex: 1; overflow-y: auto; }
                .list-item { display: flex; padding: 10px 12px; align-items: center; justify-content: space-between; cursor: pointer; transition: background 0.2s; gap: 12px; position: relative; }
                .list-item:hover { background: #333; }
                .voice-info { display: flex; align-items: center; gap: 10px; }
                .gender-icon { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
                .male { background-color: #3b82f6; }
                .female { background-color: #a855f7; }
                .voice-name { font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 6px; }
                .voice-service { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #999; }
                .service-icon { height: 16px; width: 16px; border-radius: 3px; }
                .flag-icon { height: 14px; width: auto; border-radius: 2px; }
                .language-count { font-size: 11px; color: #888; font-weight: normal; }
                .loading-state, .no-results { display:flex; justify-content:center; padding:20px; color: #999; }
                .search-container { display: flex; align-items: center; width: 100%; gap: 8px; }
                .search-input { flex: 1; background: transparent; border: none; color: white; font-size: 14px; outline: none; }
                .recent-searches-title { padding: 8px 12px; font-size: 12px; color: #888; background-color: #2a2a2a; }
                
                /* Collection styles */
                .collection-item { margin-bottom: 4px; }
                .collection-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #2a2a2a; border-radius: 4px; cursor: pointer; transition: background 0.2s; }
                .collection-header:hover { background: #333; }
                .collection-info { display: flex; align-items: center; gap: 8px; }
                .collection-name { font-size: 14px; font-weight: 500; }
                .collection-count { font-size: 12px; color: #999; }
                .collection-arrow { transition: transform 0.3s; color: #ccc; }
                .collection-arrow.rotated { transform: rotate(180deg); }
                .collection-voices { padding-left: 12px; margin-top: 4px; display: none; }
                .collection-voices.open { display: block; }
                


                /* Utility classes for tooltip content */
                .flex { display: flex; }
                .inline-flex { display: inline-flex; }
                .items-center { align-items: center; }
                .gap-2 { gap: 8px; }
                .relative { position: relative; }
                .absolute { position: absolute; }
                .top-0 { top: 0; }
                .left-0 { left: 0; }
                .overflow-hidden { overflow: hidden; }
                .flex-shrink-0 { flex-shrink: 0; }
                .w-4 { width: 16px; }
                .h-4 { height: 16px; }
                .text-sm { font-size: 14px; }
                .text-gray-300 { color: #d1d5db; }
                .text-gray-200 { color: #e5e7eb; }
                .text-gray-400 { color: #9ca3af; }
                .text-yellow-400 { color: #fbbf24; }
                .font-semibold { font-weight: 600; }
                .font-light { font-weight: 300; }
                .inline-block { display: inline-block; }
                .ml-1 { margin-left: 4px; }
                .px-1 { padding-left: 4px; padding-right: 4px; }
                .rounded-sm { border-radius: 2px; }

                .details-button {
                    align-items: center;
                    gap: 4px;
                    padding: 5px 9px;
                    background: #2a2a2a;
                    color: #d1d5db;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 500;
                    text-decoration: none;
                    transition: all 0.2s;
                    display:flex;
          
                }
                .details-button:hover {
                    background: #333333;
                    border-color: #4b5563;
                    color: #ffffff;
                }


                .default-voice-btn {
              
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    background: #2a2a2a;
                    color: #9ca3af;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                  
                }
                .default-voice-btn:hover {
                    background: #333333;
                    border-color: #4b5563;
                    color: #ffffff;
                }
                .default-voice-btn.is-default {
                    color: #10b981;
                    border-color: #10b981;
                }
                .list-item .hover-action-buttons{
                    display:none;
                    z-index:10;
                    top: 5px;
                    right:8px;
                    position:absolute;

                }
                .list-item:hover .hover-action-buttons {
                    display: flex;
                }
            </style>
            <div class="overlay">
                <div class="header"></div>
                <div class="list"></div>
            </div>
        `;

        // Create global tooltip
        this.createGlobalTooltip(shadow);

        const listEl = shadow.querySelector('.list');
        const headerEl = shadow.querySelector('.header');
        
        // Declare variables FIRST
        let currentVoiceList = [];
        let collectionsData = [];
        let openCollections = new Set();

        // Add hover listeners AFTER variables are declared
        listEl.addEventListener('mouseover', (e) => {
            const listItem = e.target.closest('.list-item');
            if (listItem && listItem !== this.currentHoveredItem) {
                this.currentHoveredItem = listItem;
                const voiceId = listItem.dataset.voiceId;
                
                let voice = null;
                for (const collection of collectionsData) {
                    voice = collection.voices.find(v => v.voice_id === voiceId);
                    if (voice) break;
                }
                if (!voice) {
                    voice = currentVoiceList.find(v => v.voice_id === voiceId);
                }
                
                if (voice) {
                    this.showTooltip(listItem, voice, shadow);
                }
            }
        });

        listEl.addEventListener('mouseout', (e) => {
            const listItem = e.target.closest('.list-item');
            if (listItem && !listItem.contains(e.relatedTarget)) {
                this.hideTooltip();
            }
        });

        listEl.addEventListener('scroll', () => this.updateTooltipPosition(shadow));



        const renderVoiceList = (voices, emptyMessage = 'No voices found.') => {
            currentVoiceList = voices;
            if (!voices || voices.length === 0) {
                listEl.innerHTML = `<div class="no-results">${emptyMessage}</div>`;
                return;
            }

            const tempContainer = document.createElement('div');
            const chunkSize = 20;
            let currentIndex = 0;

            const renderChunk = () => {
                const chunk = voices.slice(currentIndex, currentIndex + chunkSize);
                
                const html = chunk.map(voice => {
                    if(voice.voice_name === null || voice.voice_id === null || voice.voice_gender === null) return '';
                    const genderClass = voice.voice_gender.toLowerCase() === 'male' ? 'male' : 'female';
                    const langInfo = this.getLanguageInfo(voice.voice_language_codes);
                    const detailsUrl = `https://${APP_WEB_DOMAIN}/voice/${voice.voice_service}/${voice.voice_gender}/${voice.voice_speaker_id}`;
                    const isDefault = this.defaultVoiceId === voice.voice_id;
                    
                    return `
                        <div class="list-item" data-voice-id="${voice.voice_id}">
                            <div class="hover-action-buttons">
                                <button class="default-voice-btn ${isDefault ? 'is-default' : ''}" data-voice-id="${voice.voice_id}" title="${isDefault ? 'This is your default voice' : 'Make default voice'}">
                                    ${this.svgDefaultVoice(18)}
                                </button>
                                <a href="${detailsUrl}" target="_blank" class="details-button">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                    </svg>
                                    Details
                                </a>
                            </div>
      

                            <div class="voice-info">
                                <div class="gender-icon ${genderClass}"></div>
                                <div class="voice-name">
                                    ${voice.voice_name}
                                    ${langInfo.primaryCountryCode ? `
                                        <img class="flag-icon" src="https://flagsapi.com/${langInfo.primaryCountryCode}/flat/24.png" alt="${langInfo.primaryCountryCode} flag" onerror="this.style.display='none'" />
                                        ${langInfo.count > 1 ? `<span class="language-count">(+${langInfo.count - 1})</span>` : ''}
                                    ` : ''}
                                    ${voice.voice_speed && voice.voice_speed != 1 ? `
                                        [${voice.voice_speed}x]
                                    ` : ''}
                                </div>
                            </div>
                            <div class="voice-service">
                                <span>${voice.voice_service}</span>
                                ${voice.voice_service_alias ? `<img class="service-icon" src="https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${voice.voice_service_alias}&size=32" onerror="this.style.display='none'" />` : ''}
                            </div>
                        </div>
                    `;
                }).join('');

                tempContainer.innerHTML = html;
                while (tempContainer.firstChild) {
                    listEl.appendChild(tempContainer.firstChild);
                }

                currentIndex += chunkSize;

                if (currentIndex < voices.length) {
                    requestAnimationFrame(renderChunk);
                }
            };

            listEl.innerHTML = '';
            requestAnimationFrame(renderChunk);
        };

        const renderChunk = () => {
            const chunk = collection.voices.slice(currentIndex, currentIndex + chunkSize);
            
            const html = chunk.map(voice => {
                const genderClass = voice.voice_gender.toLowerCase() === 'male' ? 'male' : 'female';
                const langInfo = this.getLanguageInfo(voice.voice_language_codes);
                const detailsUrl = `https://${APP_WEB_DOMAIN}/voice/${voice.voice_service}/${voice.voice_gender}/${voice.voice_speaker_id}`;
                const isDefault = this.defaultVoiceId === voice.voice_id;
                
                return `
                    <div class="list-item" data-voice-id="${voice.voice_id}">
                        <button class="default-voice-btn ${isDefault ? 'is-default' : ''}" data-voice-id="${voice.voice_id}" title="${isDefault ? 'This is your default voice' : 'Make default voice'}">
                            ${this.svgDefaultVoice(18)}
                        </button>
                        <a href="${detailsUrl}" target="_blank" class="details-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                            </svg>
                            Details
                        </a>
                        <div class="voice-info">
                            <div class="gender-icon ${genderClass}"></div>
                            <div class="voice-name">
                                ${voice.voice_name}
                                ${langInfo.primaryCountryCode ? `
                                    <img class="flag-icon" src="https://flagsapi.com/${langInfo.primaryCountryCode}/flat/24.png" alt="${langInfo.primaryCountryCode} flag" onerror="this.style.display='none'" />
                                    ${langInfo.count > 1 ? `<span class="language-count">(+${langInfo.count - 1})</span>` : ''}
                                ` : ''}
                            </div>
                        </div>
                        <div class="voice-service">
                            <span>${voice.voice_service}</span>
                            ${voice.voice_service_alias ? `<img class="service-icon" src="https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${voice.voice_service_alias}&size=32" onerror="this.style.display='none'" />` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            tempContainer.innerHTML = html;
            while (tempContainer.firstChild) {
                voicesContainer.appendChild(tempContainer.firstChild);
            }

            currentIndex += chunkSize;

            if (currentIndex < collection.voices.length) {
                requestAnimationFrame(renderChunk);
            }
        };

        const renderCollections = (collections) => {
            collectionsData = collections.map(collection => ({
                ...collection,
                voices: [],
                voicesLoaded: false,
                loadingVoices: false
            }));

            if (collections && collections.length > 0) {
                listEl.innerHTML = collections.map((collection, index) => `
                    <div class="collection-item">
                        <div class="collection-header" data-collection-id="${collection.collection_id}" data-collection-index="${index}">
                            <div class="collection-info">
                                <span class="collection-name">${collection.collection_name}</span>
                                <span class="collection-count">(${collection.voice_count || 0})</span>
                            </div>
                            <svg class="collection-arrow" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M7 10l5 5 5-5z"/>
                            </svg>
                        </div>
                        <div class="collection-voices" data-collection-id="${collection.collection_id}">
                            <div class="loading-state" style="padding: 10px; font-size: 12px;">Click to load voices...</div>
                        </div>
                    </div>
                `).join('');
            } else {
                listEl.innerHTML = '<div class="no-results">No collections found.</div>';
            }
        };

        const loadCollectionVoices = async (collectionId, collectionIndex) => {
            const collection = collectionsData[collectionIndex];
            
            if (collection.voicesLoaded || collection.loadingVoices) return;
            
            collection.loadingVoices = true;
            const voicesContainer = shadow.querySelector(`.collection-voices[data-collection-id="${collectionId}"]`);
            if (voicesContainer) {
                voicesContainer.innerHTML = `<div class="loading-state" style="padding: 10px;">${this.svgLoading(20)}</div>`;
            }

            const callbackID = `getCollectionVoices_${Date.now()}`;
            VR_Reader.saveRequest(callbackID, (data) => {
                collection.voices = data.voices || [];
                collection.voicesLoaded = true;
                collection.loadingVoices = false;
                
                if (voicesContainer && collection.voices.length > 0) {
                    voicesContainer.innerHTML = '';
                    
                    const chunkSize = 15;
                    let currentIndex = 0;
                    const tempContainer = document.createElement('div');

                    const renderChunk = () => {
                        const chunk = collection.voices.slice(currentIndex, currentIndex + chunkSize);
                        
                        const html = chunk.map(voice => {
                            const genderClass = voice.voice_gender.toLowerCase() === 'male' ? 'male' : 'female';
                            const langInfo = this.getLanguageInfo(voice.voice_language_codes);
                            const detailsUrl = `https://${APP_WEB_DOMAIN}/voice/${voice.voice_service}/${voice.voice_gender}/${voice.voice_speaker_id}`;
                            const isDefault = this.defaultVoiceId === voice.voice_id;
                            
                            return `
                                <div class="list-item" data-voice-id="${voice.voice_id}">
                                    <button class="default-voice-btn ${isDefault ? 'is-default' : ''}" data-voice-id="${voice.voice_id}" title="${isDefault ? 'This is your default voice' : 'Make default voice'}">
                                        ${this.svgDefaultVoice(18)}
                                    </button>
                                    <a href="${detailsUrl}" target="_blank" class="details-button">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                        </svg>
                                        Details
                                    </a>
                                    <div class="voice-info">
                                        <div class="gender-icon ${genderClass}"></div>
                                        <div class="voice-name">
                                            ${voice.voice_name}
                                            ${langInfo.primaryCountryCode ? `
                                                <img class="flag-icon" src="https://flagsapi.com/${langInfo.primaryCountryCode}/flat/24.png" alt="${langInfo.primaryCountryCode} flag" onerror="this.style.display='none'" />
                                                ${langInfo.count > 1 ? `<span class="language-count">(+${langInfo.count - 1})</span>` : ''}
                                            ` : ''}
                                        </div>
                                    </div>
                                    <div class="voice-service">
                                        <span>${voice.voice_service}</span>
                                        ${voice.voice_service_alias ? `<img class="service-icon" src="https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${voice.voice_service_alias}&size=32" onerror="this.style.display='none'" />` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('');

                        tempContainer.innerHTML = html;
                        while (tempContainer.firstChild) {
                            voicesContainer.appendChild(tempContainer.firstChild);
                        }

                        currentIndex += chunkSize;

                        if (currentIndex < collection.voices.length) {
                            requestAnimationFrame(renderChunk);
                        }
                    };

                    requestAnimationFrame(renderChunk);
                } else if (voicesContainer) {
                    voicesContainer.innerHTML = '<div class="no-results" style="padding: 10px; font-size: 12px;">No voices in this collection.</div>';
                }
            });

            chrome.runtime.sendMessage({
                action: "getVoiceList",
                callbackID,
                payload: {
                    collection_id: collectionId,
                    limit: 1000,
                    offset: 0
                }
            });
        };

        const toggleCollection = (collectionId, collectionIndex) => {
            const voicesContainer = shadow.querySelector(`.collection-voices[data-collection-id="${collectionId}"]`);
            const arrow = shadow.querySelector(`.collection-header[data-collection-id="${collectionId}"] .collection-arrow`);

            if (openCollections.has(collectionId)) {
                openCollections.delete(collectionId);
                if (voicesContainer) voicesContainer.classList.remove('open');
                if (arrow) arrow.classList.remove('rotated');
            } else {
                openCollections.add(collectionId);
                if (voicesContainer) voicesContainer.classList.add('open');
                if (arrow) arrow.classList.add('rotated');
                loadCollectionVoices(collectionId, collectionIndex);
            }
        };
        
        listEl.addEventListener('click', (event) => {
            const detailsButton = event.target.closest('.details-button');
            if (detailsButton) {
                event.stopPropagation();
                event.preventDefault();
                window.open(detailsButton.href, '_blank');
                return;
            }
            
            const defaultButton = event.target.closest('.default-voice-btn');
            if (defaultButton) {
                event.stopPropagation();
                event.preventDefault();
                const voiceId = defaultButton.dataset.voiceId;
                let selectedVoice = null;

                // Check in collections first
                for (const collection of collectionsData) {
                    selectedVoice = collection.voices.find(v => v.voice_id === voiceId);
                    if (selectedVoice) break;
                }

                // If not in collections, check current voice list
                if (!selectedVoice) {
                    selectedVoice = currentVoiceList.find(v => v.voice_id === voiceId);
                }
                
                if (selectedVoice) {
                    this.makeDefaultVoice(selectedVoice, shadow);
                }
                return;
            }
            
            const listItem = event.target.closest('.list-item');
            const collectionHeader = event.target.closest('.collection-header');
            
            if (listItem) {
                const voiceId = listItem.dataset.voiceId;
                let selectedVoice = null;

                // Check in collections first
                for (const collection of collectionsData) {
                    selectedVoice = collection.voices.find(v => v.voice_id === voiceId);
                    if (selectedVoice) break;
                }

                // If not in collections, check current voice list
                if (!selectedVoice) {
                    selectedVoice = currentVoiceList.find(v => v.voice_id === voiceId);
                }
                
                if (selectedVoice) {
                    this.handleVoiceSelection(selectedVoice);
                } else {
                    console.error("Could not find selected voice:", voiceId);
                }
            } else if (collectionHeader) {
                const collectionId = collectionHeader.dataset.collectionId;
                const collectionIndex = parseInt(collectionHeader.dataset.collectionIndex);
                toggleCollection(collectionId, collectionIndex);
            }
        });

        const fetchAndRender = (requestAction, payload, title, isCollections = false, emptyMessage = 'No voices found.') => {
            listEl.innerHTML = `<div class="loading-state">${this.svgLoading(24)}</div>`;
            return new Promise((resolve) => {
                const callbackID = `${requestAction}_${Date.now()}`;
                VR_Reader.saveRequest(callbackID, (data) => {
                    if (isCollections) {
                        renderCollections(data.collections || []);
                    } else {
                        const voiceData = data.favorites || data.voices || [];
                        renderVoiceList(voiceData, emptyMessage);
                        if(title && voiceData.length > 0) {
                            listEl.insertAdjacentHTML('afterbegin', `<div class="recent-searches-title">${title}</div>`);
                        }
                    }
                    resolve();
                });
                chrome.runtime.sendMessage({ action: requestAction, callbackID, payload });
            });
        };

        const activateSearchMode = async () => {
            headerEl.innerHTML = `
                <button class="back-button"><svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M15.41 16.58L10.83 12l4.58-4.59L14 6l-6 6l6 6z"/></svg></button>
                <div class="search-container">
                    <input type="text" class="search-input" placeholder="Search all voices...">
                </div>
            `;
            const searchInput = headerEl.querySelector('.search-input');
            searchInput.focus();
            headerEl.querySelector('.back-button').addEventListener('click', activateFavoritesMode);
            
            const storage = await readLocalStorage(['voiceRecentSearches']);
            const recentSearches = storage.voiceRecentSearches || [];
                
            renderVoiceList(recentSearches, 'No recent voices played');
            if(recentSearches.length > 0) listEl.insertAdjacentHTML('afterbegin', `<div class="recent-searches-title">Recent</div>`);

            let debounceTimeout;
            let lastQuery = '';
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimeout);
                const query = e.target.value.trim();
                lastQuery = query;
                if (!query) {
                    renderVoiceList(recentSearches, 'No recent voices played');
                    if(recentSearches.length > 0) listEl.insertAdjacentHTML('afterbegin', `<div class="recent-searches-title">Recent</div>`);
                    return;
                }
                debounceTimeout = setTimeout(() => {
                    fetchAndRender('getVoiceSearch', { search: query }, null, false, `No results for "${query}"`);
                }, 300);
            });
        };

        const activateCollectionsMode = () => {
            headerEl.innerHTML = `
                <button class="back-button"><svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M15.41 16.58L10.83 12l4.58-4.59L14 6l-6 6l6 6z"/></svg></button>
                <div class="title">Collections</div>
                <div class="header-controls">
                    <button class="close-button"><svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"/></svg></button>
                </div>
            `;
            headerEl.querySelector('.close-button').addEventListener('click', cleanup);
            headerEl.querySelector('.back-button').addEventListener('click', activateFavoritesMode);
            fetchAndRender('getVoiceCollections', {}, null, true);
        };

        const activateFavoritesMode = () => {
            headerEl.innerHTML = `
                <div class="title">Favorite Voices</div>
                <div class="header-controls">
                    <button class="collections-icon"><svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg></button>
                    <button class="search-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></button>
                    <button class="close-button"><svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"/></svg></button>
                </div>
            `;
            headerEl.querySelector('.close-button').addEventListener('click', cleanup);
            headerEl.querySelector('.search-icon').addEventListener('click', activateSearchMode);
            headerEl.querySelector('.collections-icon').addEventListener('click', activateCollectionsMode);
            fetchAndRender('getVoiceFavorites', {}, null, false, 'No favorite voices saved');
        };

        const show = () => {
            activateFavoritesMode();
        };

        parentElement.appendChild(overlayContainer);
        return { show };
    }

    async handleVoiceSelection(voice){
            try {
                if(voice.voice_service_extension_active === false) {
                    alert(`Sorry, ${voice.voice_service} voices are not available yet for the extension`);
                    return;
                }

                const storage = await readLocalStorage(['voiceRecentSearches']);
                let recentSearches = storage.voiceRecentSearches || [];
                
                const existingIndex = recentSearches.findIndex(item => item.voice_id === voice.voice_id);
                if (existingIndex > -1) {
                    recentSearches.splice(existingIndex,1);
                }
                recentSearches.unshift(voice);
                if (recentSearches.length > 6) {
                    recentSearches = recentSearches.slice(0, 6);
                }
                await saveToLocalStorage({ 'voiceRecentSearches': recentSearches }, true);
            } catch (e) {
                console.error("Failed to update recent searches:", e);
            }

            const defaultVoiceData = {
                'ACTIVE_PREMIUM_VOICE_ID': voice.voice_id,
                'ACTIVE_PREMIUM_VOICE_NAME': voice.voice_name,
                'ACTIVE_PREMIUM_VOICE_GENDER': voice.voice_gender,
                'ACTIVE_PREMIUM_VOICE_INSTRUCTIONS': voice.voice_instructions,
                'ACTIVE_PREMIUM_VOICE_LANGUAGE_CODE': voice.voice_language_codes ? voice.voice_language_codes[0] : null,
                'ACTIVE_PREMIUM_VOICE_SPEAKER_ID': voice.voice_speaker_id,
                'ACTIVE_PREMIUM_VOICE_SERVICE': voice.voice_service,
                'ACTIVE_PREMIUM_VOICE_WORDS_PER_MINUTE': voice.voice_words_per_minute,
                'ACTIVE_PREMIUM_VOICE_SPEED': (voice.voice_speed)? voice.voice_speed : 1,
                'ACTIVE_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT': voice.voice_has_voice_speed_support,
                'ACTIVE_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT': voice.voice_has_word_timestamp_support,
            };
            await saveToLocalStorage(defaultVoiceData, true);
            await VR_Reader.changeActiveVoice();

            setTimeout(() => {
                VR_Reader.readWithVRR();
            }, 10);

            cleanup();
        };

    render() {
        const quickAccessEnabled = VR_Reader.savedLocalStorageGlobal['DEFAULT_QUICK_ACCESS_CONTROLS_STATE'];
        const quickAccessHiddenOnDomain = VR_Reader.savedLocalStorageDomain && VR_Reader.savedLocalStorageDomain[CONSTANTS.DOMAIN_QUICK_ACCESS_STATE_KEYNAME] === false;
        const href = window.location.href;
        const isPdfPage = /\.pdf(\?|#|$)/i.test(href) || document.contentType === 'application/pdf';
        if (!this.buddy || quickAccessEnabled === false || quickAccessHiddenOnDomain || href.includes("youtube.com") || isPdfPage) {
            return false;
        }

        if(href.indexOf("/extension/tour") > -1
        || href.indexOf("docs.google.com") > -1){
            return false;
        }

        this.shadow.innerHTML = this.createHTML();
        chrome.storage.local.get(['DEFAULT_PREMIUM_VOICE_ID'], (result) => {
            this.defaultVoiceId = result.DEFAULT_PREMIUM_VOICE_ID || null;
        });

        this.init();
    }
}
