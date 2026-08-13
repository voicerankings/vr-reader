/**
 * ============================================================================
 * TTSWidget Module
 * ============================================================================
 * The primary UI controller for the floating "Quick Access" reader widget.
 * This class orchestrates the Shadow DOM rendering, binds the underlying
 * voice engine (TTSVoicePlayer), and manages all sub-components (Playback,
 * Voice List, Settings, etc.).
 */
import {
    isNodeBefore,
    getSelectionText,
    removeHiglightOnPage,
    deleteSettingPropertyInAllDomains,
    setDomainSettings,
    getHostName,
    saveToLocalStorage
} from "../../utils/helpers";

import * as Icons from '../shared/icons.js';
import { createHTML as createWidgetHTML } from './widgetTemplate.js';
import * as WidgetState from './WidgetState.js';
import * as TabController from './TabController.js';
import { initListeners, initVisibilityListeners } from './WidgetEvents.js';

import { CONSTANTS } from "../../../js/constants/constants"
import TTSVoicePlayer from "../speech/TTSVoicePlayer";

import Playback from "./Playback";
import VoiceList from "./VoiceList";
import VoiceSpeedAdjuster from "./VoiceSpeedAdjuster";

const DELAY_LIGHT_DARK_CHECK = 80;
const DELAY_HIDE_ALERT = 950;
const DELAY_TEXTSELECT_DEBOUNCE = 300;
const DELAY_SPEECH_START = 1000;

/**
 * ============================================================================
 * TTSWidget (Text-To-Speech Widget)
 * ============================================================================
 * The primary UI controller for the floating "Quick Access" reader widget.
 * This class orchestrates the Shadow DOM rendering, binds the underlying
 * voice engine (`TTSVoicePlayer`), and manages all sub-components (Playback,
 * Voice List, Settings, etc.).
 */
export default class TTSWidget {
    constructor(readMode = "") {
        // --- Core DOM & State ---
        this.myPort = null;
        this.el = null;                         // Host element (usually div#shadowdom-vr-reader)
        this.overlayDiv = null;
        this.superUltraRoot = null;             // The attached ShadowRoot containing all UI
        this.readMode = readMode || "";         // e.g., "compact", "full", ""
        
        // --- TTS & Playback Components ---
        this.voiceClass = null;                 // Instance of TTSVoicePlayer (the actual audio engine)
        this.playbackClass = null;              // Instance of Playback (manages progress bars & UI controls)
        this.output = "";
        this.previouslyGenerated = false;

        // --- Highlight & Selection State ---
        this.highlighted = false;               // True if user currently has text selected
        this.generateStatus = "OK";
        this.generateStatusMessage = "";
        this.currentPromptElement = null;

        // --- UI Navigation State ---
        // Enum-like object defining the different panels that can slide into view
        this.SWITCH_SECTIONS = {
            DEFAULT: 'DEFAULT',
            OPTIONS: 'OPTIONS',
            PLAYBACK: 'PLAYBACK',
            VOICE_FAVORITES: 'VOICE_FAVORITES',
            VOICE_SPEED: 'VOICE_SPEED'
        }
    }

    /**
     * Initializes the Shadow DOM root to encapsulate the widget's styles from the host page.
     */
    initShadowDOM(DOMElement) {
        this.shadow = DOMElement.attachShadow({ mode: 'open' });
    }

    initDOM(DOMElement) {
        this.el = DOMElement
    }
    getReadMode() {
        return this.readMode
    }
    getShadowDOM() {
        return this.shadow;
    }
    voiceClassA() {
        return this.voiceClass;
    }
    setCurrentPromptElement(element) {
        this.currentPromptElement = element
    }

    changePlayingButtonStatus(playing) {
        if (playing) {
            this.superUltraRoot.querySelector("#PlayAndStopAudio").classList.add("playing");
            if (window.VR_Reader && VR_Reader.startTabKeepAlive) {
                VR_Reader.startTabKeepAlive();
            }
        } else {
            this.superUltraRoot.querySelector("#PlayAndStopAudio").classList.remove("playing");
            if (window.VR_Reader && VR_Reader.stopTabKeepAlive) {
                VR_Reader.stopTabKeepAlive();
            }
        }
    }

    async createVoicePlayer() {
        this.voiceClass = new TTSVoicePlayer({})
        await this.voiceClass.render(this.superUltraRoot.querySelector("#VoicePlayerContainer"));
    }

    /**
     * Main bootstrapping sequence. 
     * Runs after `render()` has injected the base HTML into the Shadow DOM.
     * Initializes child components, applies user defaults, and binds events.
     */
    async init() {
        try {
            this.superUltraRoot = document.querySelector('#shadowdom-vr-reader').shadowRoot;

            // 1. Sync settings and attach listeners
            await VR_Reader.storeDefaults();
            this.setDefaultCompactMode();
            await initListeners(this);
            this.initVisibilityListeners();

            // 2. Initialize the audio engine (TTSVoicePlayer)
            await this.createVoicePlayer();
            const textSelectorState = WidgetState.getReadTextAreaSelectorState(VR_Reader);
            if (this.voiceClass) {
                // If textSelectorState is true, this turns it on.
                this.voiceClass.toggleTextSelection(textSelectorState);
            }

            // 3. Apply saved UI state preferences
            this.setDefaultReader();
            this.setPinButtonState();
            this.setDefaultVoice();
            this.setDefaultReadTextAreaSelector();

            // 4. Load specialized sub-panels (Playback, Voices, Speed)
            this.loadPlaybackComponent();
            this.loadVoiceFavoritesComponent();
            this.loadVoiceSpeedComponent()

            // 5. Visual polishing
            this.checkForLightOrDarkMode()

            if (this.readMode === "") {
                this.openPlaybackList()
                this.handleHighlightFunc = this.handleHighlight.bind(this);
                document.addEventListener('mouseup', this.handleHighlightFunc);
            }
        } catch (e) {
            console.error("Error in TTSWidget init:", e)
        }
    }

    checkForLightOrDarkMode() {
        setTimeout(() => {
            if (document.querySelector("html").className.indexOf("light") > -1) {
                this.superUltraRoot.querySelector("#VR-Reader").classList.add("light-mode")
            } else {
                this.superUltraRoot.querySelector("#VR-Reader").classList.add("dark-mode")
            }
        }, DELAY_LIGHT_DARK_CHECK)
    }
    closeMiniAlertMessagePopup(idName) {
        this.superUltraRoot.querySelector("#" + idName).classList.add("clicked");

        setTimeout(() => {
            this.superUltraRoot.querySelector("#" + idName).classList.remove("clicked");
            this.superUltraRoot.querySelector("#" + idName).classList.remove("highlighted")
        }, DELAY_HIDE_ALERT);

    }
    handleHighlight() {

        // Check if any text is currently selected
        const selectedText = window.getSelection().toString();

        // Update the highlight state based on whether text is selected or not
        this.highlighted = selectedText.length > 0;

        // Perform any other actions based on the highlight state
        if (this.highlighted) {
            if (this.voiceClass.speaking()
                && VR_Reader.savedLocalStorageGlobal['DEFAULT_HIGHLIGHT_READING_STATE'])
                return false;

            this.superUltraRoot.querySelector("#HighlightAudioMessage").classList.add("highlighted")
        } else {
            this.closeMiniAlertMessagePopup("HighlightAudioMessage")
        }

        setTimeout(() => {
            if (window.getSelection().toString().length === 0) {
                this.closeMiniAlertMessagePopup("HighlightAudioMessage")
            }
        }, DELAY_TEXTSELECT_DEBOUNCE);
    }
    showExternalLoader(show = false) {
        if (show) {
            this.superUltraRoot.querySelector("#LoaderExternalPlayer").classList.add("show");
            this.showIssueLoader(false)
        } else {
            this.superUltraRoot.querySelector("#LoaderExternalPlayer").classList.remove("show");
        }
    }
    showIssueLoader(show = false, tooltip = "") {
        if (show) {
            this.superUltraRoot.querySelector("#LoaderIssue").setAttribute('data-tooltip', tooltip);
            this.superUltraRoot.querySelector("#LoaderIssue").classList.add("show");
            this.showExternalLoader(false);
        } else {
            this.superUltraRoot.querySelector("#LoaderIssue").classList.remove("show");
        }
    }

    // --- Component Loaders ---

    loadPlaybackComponent() {
        this.playbackClass = new Playback()
        this.playbackClass.initDOM(this.superUltraRoot.querySelector("#PlaybackSwitchTabContainer"))
        this.playbackClass.render();
    }
    
    loadVoiceFavoritesComponent() {
        this.voiceFavoriteClass = new VoiceList()
        this.voiceFavoriteClass.initDOM(this.superUltraRoot.querySelector("#VoiceFavoritesSwitchTabContainer"))
        this.voiceFavoriteClass.render();
    }
    
    loadVoiceSpeedComponent() {
        this.voiceSpeedClass = new VoiceSpeedAdjuster()
        this.voiceSpeedClass.initDOM(this.superUltraRoot.querySelector("#VoiceSpeedSwitchTabContainer"))
        this.voiceSpeedClass.render();
    }
    getReaderState() {
        return WidgetState.getReaderState(VR_Reader);
    }
    getActiveVoiceState() {
        return WidgetState.getActiveVoiceState(VR_Reader);
    }
    getReadTextAreaSelectorState() {
        return WidgetState.getReadTextAreaSelectorState(VR_Reader);
    }
    updateTimerDisplay(elapsed, remaining, total, force) { // ✅ Add 'force' here
        if (this.playbackClass) {
            this.playbackClass.updateTimerDisplay(elapsed, remaining, total, force); // ✅ Pass 'force' here
        }
    }
    async setDefaultCompactMode() {
        if (VR_Reader.savedLocalStorageDomain['DOMAIN_COMPACT_MODE_STATE'] === true) {
            this.superUltraRoot.querySelector("#VR-Reader").classList.add("compact");
        } else {
            this.superUltraRoot.querySelector("#VR-Reader").classList.remove("compact");
        }
    }

    initVisibilityListeners() {
        initVisibilityListeners(this);
    }

    async setDefaultReader() {
        const state = WidgetState.getReaderState(VR_Reader);
        this.voiceClass.updateDefaultReaderState(state);

        this.superUltraRoot.querySelector("#ReadAloudButton > div").className = state ? "ON" : "OFF";
        this.superUltraRoot.querySelector("#ReadAloudButton").setAttribute('data-tooltip', `Read aloud(${state ? 'ON' : 'OFF'})`);

        if (state) {
            this.superUltraRoot.querySelector("#PlayReadButton").classList.remove("audio-state-off");
        } else {
            this.superUltraRoot.querySelector("#PlayReadButton").classList.add("audio-state-off");
        }
    }
    async setPinButtonState(currentState = null) {
        if (currentState == null) {
            currentState = VR_Reader.savedLocalStorageGlobal['WIDGET_PIN_EXPANDED'];
        }
        let pinButton = this.superUltraRoot.querySelector("#PinExpandedButton");

        if (currentState === undefined || currentState === null) {
            currentState = false;
        }
        if (currentState) {
            pinButton.querySelector("div").classList.add("ON");
            pinButton.querySelector("div").classList.remove("OFF");
            pinButton.setAttribute('data-tooltip', `Unpin`);
            this.superUltraRoot.querySelector("#VR-Reader").classList.add("pinned");
            this.superUltraRoot.querySelector("#VR-Reader").classList.remove("hidden");
        } else {
            this.superUltraRoot.querySelector("#VR-Reader").classList.remove("pinned");
            pinButton.querySelector("div").classList.add("OFF");
            pinButton.querySelector("div").classList.remove("ON");
            pinButton.setAttribute('data-tooltip', `Pin`);
        }
    }

    async setDisplayAutoPlayEnterKey() {
        const state = VR_Reader.getAutoPlayWithKeyboardEnterKeyState();

        this.superUltraRoot.querySelector("#AutoPlayEnterKeyIcon").className = state ? "ON" : "OFF";

    }
    openSwitchTab(open, tabName) {
        TabController.openSwitchTab(this.superUltraRoot, this.SWITCH_SECTIONS, open, tabName);
    }
    isSwitchTabOpen(tabName) {
        return TabController.isSwitchTabOpen(this.superUltraRoot, this.SWITCH_SECTIONS, tabName);
    }


    async setDefaultVoice() {
        const state = WidgetState.getActiveVoiceState(VR_Reader);
        this.superUltraRoot.querySelector("#VoiceFavoritesButton").setAttribute('data-tooltip', `Voices (${(!state.voice_name) ? `Select a default voice` : `${state.voice_name} / ${state.voice_lang}`} )(${state.voice_service})`);
    }


    updateReadEstimateTime(estimateTime) {
        this.superUltraRoot.querySelector("#ReadAloudEstimateTime").innerText = estimateTime;
    }

    async setDefaultReadTextAreaSelector() {
        const state = WidgetState.getReadTextAreaSelectorState(VR_Reader);

        this.superUltraRoot.querySelector("#ReadTextAreaSelectorButton > div").className = state ? "ON" : "OFF";
        this.superUltraRoot.querySelector("#ReadTextAreaSelectorButton").setAttribute('data-tooltip', `Click to Read(${state ? 'ON' : 'OFF'})`);
    }

    notSupportedBrowser() {
        this.superUltraRoot.querySelector("#VR-Reader").classList.add("not-supported-browser");
        delete this.voiceClass
    }
    action(action) {
        chrome.runtime.sendMessage({
            action: "action",
            payload: Object.assign({
                url: window.location.href,
                action,
                speech_on: this.superUltraRoot.querySelector("#PlayReadButton").classList.contains("audio-state-off") === false
            }, this.voiceClass.voiceActions())
        });
    }


    isAnswerElementsBelowPromptElement(answerElements) {
        const list = Array.from(answerElements);
        for (const element of list) {
            if (isNodeBefore(this.currentPromptElement, element)) {
                return true
            }
        }
        return false;
    }

    /**
     * Reads aloud the text that the user currently has highlighted/selected
     * with their mouse cursor.
     */
    playAudioHighlightedText() {
        const selection = window.getSelection();

        if (selection.toString().length > 0) {
            this.voiceClass.stop(true, true)
            //play audio        
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const parentElement = range.commonAncestorContainer.parentNode;
                this.voiceClass.setAnswerElement(parentElement);
            }

            const highlightText = getSelectionText();

            this.voiceClass.setOutput(highlightText);
            setTimeout(() => {
                this.voiceClass.makePlayUtteranceList()
            }, DELAY_SPEECH_START);


            this.closeMiniAlertMessagePopup("HighlightAudioMessage")
            this.action(1)
        }
    }

    async initListeners() {
        await initListeners(this);
    }
    addHiddenToWidget() {
        if (this.superUltraRoot.querySelector("#VR-Reader").classList.contains("pinned"))
            return false;

        this.superUltraRoot.querySelector("#VR-Reader").classList.add("hidden");
    }

    openPlaybackList() {
        TabController.openPlaybackList(this.superUltraRoot, this.SWITCH_SECTIONS);
    }

    enterKeyModalButton() {
        if (VR_Reader.getAutoPlayWithKeyboardEnterKeyState()) {
            return {
                buttonText: `<b>Disable</b> Enter key auto play on ${getHostName()} ${Icons.svgAutoPlayEnterKey()}`,
                callback: async () => {
                    let btn = this.superUltraRoot.querySelector("#AutoPlayEnterKeyIcon")
                    btn.className = "OFF"

                    await setDomainSettings(getHostName(), CONSTANTS.DOMAIN_AUTO_PLAY_WITH_KEYBOARD_ENTER_KEY_STATE_KEYNAME, false)
                    await VR_Reader.storeDefaults()
                }
            }
        } else {
            return {
                buttonText: `<b>Enable</b>  Enter key auto play on ${getHostName()} ${Icons.svgAutoPlayEnterKey()}`,
                callback: async () => {
                    let btn = this.superUltraRoot.querySelector("#AutoPlayEnterKeyIcon")
                    btn.className = "ON"

                    await setDomainSettings(getHostName(), CONSTANTS.DOMAIN_AUTO_PLAY_WITH_KEYBOARD_ENTER_KEY_STATE_KEYNAME, true)
                    await VR_Reader.storeDefaults()
                }
            }
        }
    }
    /**
     * ============================================================================
     * LIFECYCLE & TEARDOWN
     * ============================================================================
     * Thoroughly cleans up all DOM listeners, shadow root injection, playing audio, 
     * and external dependencies. Called when the user clicks "Close" on the widget.
     */
    close() {
        console.log("close widget")
        VR_Reader.toggleTextSelector(false, true)

        if (this.escKeyHandler) {
            document.removeEventListener("keydown", this.escKeyHandler);
            this.escKeyHandler = null;
        }

        if (this.visibilityHandler) {
            document.removeEventListener("visibilitychange", this.visibilityHandler);
            window.removeEventListener("focus", this.visibilityHandler);
            window.removeEventListener("blur", this.visibilityHandler);
            this.visibilityHandler = null;
        }

        VR_Reader.unwrapSentenceSpans();

        if (this.highlightsClass) {
            this.highlightsClass.clearAllTimestamps();
        }

        // ✅ Save Read Later progress before stopping voice
        if (this.voiceClass) {
            this.voiceClass._updateReadLaterCache(undefined, true);
            this.voiceClass.clearWordHighlights(); // Call the class method
            this.voiceClass.stop(false, true);
        }

        removeHiglightOnPage();

        if (this.voiceClass && typeof this.voiceClass.clearPendingHighlights === 'function') {
            this.voiceClass.clearPendingHighlights();
        }

        // ✅ Fail-safe DOM removal (in case voiceClass is already null)
        document.querySelectorAll('.vrr-floating-highlight, .word-highlight-bar').forEach((bar) => bar.remove());

        // Also remove the specific style tag injected for highlights
        const highlightStyles = document.getElementById('vrrWordHighlightStyles');
        if (highlightStyles) highlightStyles.remove();

        if (this.voiceClass) this.voiceClass.stop(false, true);

        if (this.voiceClass) this.voiceClass.close();
        if (this.voiceClass) this.voiceClass = null;

        // Remove the shadow DOM wrapper entirely from the page
        const elem = document.querySelector('#shadowdom-vr-reader');
        if (elem) elem.parentNode.removeChild(elem);
        
        delete VR_Reader.ttsWidget;

        document.removeEventListener('mouseup', this.handleHighlightFunc);
    }

    /**
     * Injects the actual HTML structure of the widget into the Shadow DOM root,
     * and then begins the `init()` sequence.
     */
    async render() {
        let readMode = this.readMode;
        let panelPlacement = VR_Reader.savedLocalStorageGlobal['DEFAULT_QUICK_ACCESS_CONTROLS_PANEL_PLACEMENT_STATE'] || "bottom";

        this.shadow.innerHTML = createWidgetHTML({
            readMode,
            SWITCH_SECTIONS: this.SWITCH_SECTIONS,
            panelPlacement
        });

        await this.init();
    }
}
