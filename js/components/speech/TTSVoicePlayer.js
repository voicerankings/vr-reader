import { CONSTANTS } from "../../constants/constants";
import {
    removeTimeAndAvatarTitleFromSpeech,
    saveToLocalStorage,
    fnBrowserDetect,
    debounce2
} from "../../utils/helpers";

import ExternalVoicePlayer from "./ExternalVoicePlayer";
import VoicePreferences from "./tts-voice-player/VoicePreferences";
import SentenceSplitter from "./tts-voice-player/SentenceSplitter";
import TextHighlighter from "./tts-voice-player/TextHighlighter";
import ClickToReadHandler from "./tts-voice-player/ClickToReadHandler";
import BrowserSpeechPlayer from "./tts-voice-player/BrowserSpeechPlayer";

/**
 * ============================================================================
 * TTSVoicePlayer (Text-to-Speech Engine)
 * ============================================================================
 * The core engine responsible for reading text aloud. It manages the queue of 
 * sentences to be read, handles the browser's SpeechSynthesis API (via BrowserSpeechPlayer), 
 * and orchestrates UI highlighting while reading.
 */
export default class TTSVoicePlayer extends ExternalVoicePlayer {
    constructor({ voicePrefs }) {
        super();
        // --- Dependencies ---
        this.voicePrefs = voicePrefs || new VoicePreferences(VR_Reader);
        this.textHighlighter = new TextHighlighter(this);
        this.clickHandler = new ClickToReadHandler(this);
        this.clickHandler.bind();

        this.browserSpeech = new BrowserSpeechPlayer(this);
        this.defaultVoice = this.browserSpeech.defaultVoice;

        // --- Core Settings ---
        this.maxPreloadCount = 3; // Number of sentences to preload ahead
        this.playerType = "summ_reader";
        this.browser = fnBrowserDetect();

        // --- DOM & UI State ---
        this.el = null;
        this.voicePlayerDiv;
        this.answerElement = null;

        // --- Playback State & Queues ---
        this.sentencePlayCompleteCounter = 0;
        this.output = "";
        this.playbackIndex = 0;
        
        this.queue = [];
        this.replayQueue = []; // Full queue - a copy of the full queue list to be replayed
        this.replayQueue0 = [];
        this.replayQueueVoiceStorage = {};
        
        this.currentVoiceId = null;
        this.currentVoiceSpeed = null;
        this.defaultReaderState = true;

        this.transitionTimeout = null;
        this.audioStatus = CONSTANTS.AUDIO_STATUS_TYPE.OFF // || PLAYING || PAUSED || 
        this.audioStatusOFFTimeout;


        // ==================== FIXED REGEX PATTERNS START ====================
        // A list of common abbreviations to prevent incorrect sentence splitting.
        // Note: i.e. and e.g. have their dots escaped (\\.)
        const abbreviations = 'Dr|Mr|Mrs|Ms|Prof|St|Rev|Fr|Sr|Jr|Hon|Pres|Gov|Sen|Rep|Lt|Col|Gen|Maj|Capt|Sgt|Pvt|Adm|Cpl|Cmdr|Ens|Amb|Asst|Supt|Sec|Treas|Dep|Dir|Adj|Bp|Cpt|Ald|Cl|Pr|Secy|etc|i\\.e|e\\.g|vs';

        // This pattern finds sentence endings (.?!) but ignores them if they follow an abbreviation.
        this.outputRegexPattern = new RegExp(`(?<!\\b(?:${abbreviations})\\.)[.?!。]["'“”]?\\s+`, 'g');

        // This pattern is for splitting and includes newlines as a delimiter.
        this.outputRegexPattern2 = new RegExp(`(?<!\\b(?:${abbreviations})\\.)[.?!。]["'“”]?\\s+|\\n`, 'g');
        // ===================== FIXED REGEX PATTERNS END =====================

        this.outRegexMatch = /[^.?!。]+[.?!。]\s*/g;
        this.backupOutputRegexPattern = /(?<!\..)[.?!。]/g;
        this.endsWithPattern = /(?<!\..)[.?!。]/;

        this.readerMode = "" //readWithVRR || readHighlightedText || voiceChatWithVRR
        this.playerMode = "reader"
        this.playCompleteCallback = null;
        this.playNextCallback = null;

        this.boundHandleTextElementClick = this.clickHandler.boundHandleClick;

    }


    initializeVoiceQueue(voiceId) { this.browserSpeech.initializeVoiceQueue(voiceId); }

    voiceChanged() { this.browserSpeech.voiceChanged(); }


    resetAllReplayAudioData() {
        this.replayQueue.forEach((item) => {
            delete item.audioData;
        })
    }

    setReaderMode(mode) {
        console.log("mode", mode)
        this.readerMode = mode;
    }
    setPlayNextCallback() {
        this.playNextCallback = null;
    }
    setPlayCompleteCallback() {
        this.playCompleteCallback = null;
    }
    getLastOutput() {
        return this.lastOutput
    }
    setOutput(output) {
        this.output = output;
    }
    getQueueList() {
        return this.replayQueue
    }
    getPlaybackIndex() {
        return this.playbackIndex
    }

    setAnswerElement(answerElement) {
        this.answerElement = answerElement;
    }
    setInputElement(inputElement) {
        this.inputElement = inputElement;
    }
    resetOutputNextStartPos() {
        this.outputNextStartPos = 0;
    }
    initDOM(DOMElement) {
        this.el = DOMElement
    }
    voiceActions() { return this.browserSpeech.voiceActions(); }

    /**
     * Initializes the player, populates available voices, and cancels any lingering audio.
     */
    async init() {
        this.initListeners();
        await this.populateVoiceList();
        this.browserSpeech.synthesis.cancel();
    }

    setSpeech() { return this.browserSpeech.setSpeech(); }

    /**
     * Binds events to the Play/Stop controls inside the widget.
     */
    initListeners() {
        this.voicePlayerDiv.querySelector("#PlayButton").addEventListener("click", async () => {
            if (this.audioStatus === CONSTANTS.AUDIO_STATUS_TYPE.PLAYING) {
                this.stop(true); // Pass true for manual stop
            } else {
                // Hide rating overlay when manually resuming
                this.hideRatingOverlay();
                this.makePlayUtteranceList();
            }
        });

        this.voicePlayerDiv.querySelector("#StopButton").addEventListener("click", () => {
            this.stop(true); // Pass true for manual stop
        });

    }
    destroy() {
        // 1. Remove the click listener using the bound reference
        if (this.boundHandleTextElementClick) {
            document.removeEventListener('click', this.boundHandleTextElementClick);
        }

        // 2. Remove the visual styles (Cursor pointer)
        const styleTag = document.getElementById('vrrClickableStyles');
        if (styleTag) {
            styleTag.remove();
        }

        // 3. Stop any playing audio
        if (this.externalAudioSpeaking) {
            this.stopPlayingAudioInOffscreen();
        }

        console.log("🧹 TTSVoicePlayer destroyed and listeners removed.");
    }

    handleTextElementClick(e) {
        this.clickHandler.handleTextElementClick(e);
    }

    toggleTextSelection(enable) {
        this.clickHandler.toggleTextSelection(enable);
    }

    getAudioStatus() {
        return this.audioStatus;
    }

    speaking() {
        // 1. PRIMARY: Check the engine's official audio status.
        // This is the most reliable source of truth because it stays PLAYING
        // across inter-sentence gaps and transitions.
        if (this.audioStatus === CONSTANTS.AUDIO_STATUS_TYPE.PLAYING) return true;

        // 2. FALLBACK: Check if external audio is actively emitting.
        if (this.externalAudioSpeaking) return true;

        return false;
    }
    pause() { this.browserSpeech.pause(); }
    play() {
        this.voicePlayerDiv.querySelector("#PlayButton").click()
    }
    playSpeechEndAudio(endSentence = false) {

        this.stop(false, false, true);

        this.playbackListSelectOption(this.el.parentNode.parentNode.querySelector("#SelectPlayback").length)
    }

    playSpeechBeatsAnimation() {
        this.audioStatus = CONSTANTS.AUDIO_STATUS_TYPE.PLAYING;
        this.el.parentNode.querySelector("#PlayReadButton").classList.remove("ending");
        this.el.parentNode.querySelector("#PlayReadButton").classList.add("pulse");
        clearTimeout(this.pulseTimeout)
        clearTimeout(this.transitionTimeout)
    }
    removeSpeechBeatsAnimation() {
        this.el.parentNode.querySelector("#PlayReadButton").classList.remove("pulse");
        this.el.parentNode.querySelector("#PlayReadButton").classList.add("ending");
        this.pulseTimeout = setTimeout(() => {
            this.el.parentNode.querySelector("#PlayReadButton").classList.remove("ending");
        }, 2500)
    }

    resume() { this.browserSpeech.resume(); }
    stop(...args) { this.browserSpeech.stop(...args); }

    // --- Queue Management ---

    playbackListBatchQueueList(queueList) {
        let select = this.el.parentNode.parentNode.querySelector("#SelectPlayback");
        const currentLength = select.options.length;

        queueList.forEach((text, idx) => {
            let option = document.createElement("option");
            option.text = (currentLength + idx + 1) + ". " + text;
            option.title = text;
            option.value = currentLength + idx;
            select.add(option);
        });

    }
    playbackListQueueAdd(text) {
        let select = this.el.parentNode.parentNode.querySelector("#SelectPlayback");
        let option = document.createElement("option");
        option.text = (select.options.length + 1) + ". " + text;
        option.title = text;
        option.value = this.incomingIndex - 1;
        select.add(option);
    }

    playbackListDeleteAllOptions(resetTimer = true) {
        this.replayQueue = [];
        this.replayQueue0 = [];
        // Get a reference to the select element
        let select = this.el.parentNode.parentNode.querySelector("#SelectPlayback");

        // Remove all options in a loop
        while (select.options.length > 0) {
            select.remove(0);
        }
        this.progressBarUpdate(0);

        // ✅ FIX: Only reset timer if explicitly requested. 
        // When loading a new article, we pass false so the 'Estimated Time' stays visible.
        if (resetTimer && VR_Reader.ttsWidget && VR_Reader.ttsWidget.playbackClass) {
            VR_Reader.ttsWidget.playbackClass.updateTimerDisplay("00:00", "00:00", "00:00", true);
        }
    }

    playbackListSelectOption(index) {
        console.log("reader playback changed", index);

        if (isNaN(index)) index = 0;

        let select = this.el.parentNode.parentNode.querySelector("#SelectPlayback");
        select.selectedIndex = index;
        this.playbackIndex = index;
        if (select.options.length === 0) return false;

        this.progressBarUpdate(Math.ceil(((index) / select.options.length) * 100))
    }

    progressBarUpdate(percentNumber) {

        var val = parseInt(percentNumber);
        var $circle = this.el.parentNode.parentNode.querySelector("#svg #bar");

        if (isNaN(val)) {
            val = 0;
        }
        else {
            var r = $circle.getAttribute('r');
            var c = Math.PI * (r * 2);

            if (val < 0) { val = 0; }
            if (val > 100) { val = 100; }

            var pct = ((100 - val) / 100) * c;

            $circle.style.strokeDashoffset = pct;

            this.el.parentNode.parentNode.querySelector('#cont').setAttribute('data-pct', val);
        }

    }

    playbackListNewStartQueue(...args) { this.browserSpeech.playbackListNewStartQueue(...args); }



    // ============================================================================
    // MAIN PLAYBACK LOGIC
    // ============================================================================

    /**
     * Splits the text stored in `this.output` into a queue of readable sentences, 
     * applies site-specific text filters, cleans whitespace, and starts playback.
     * @param {boolean} autoRead - If true, playback starts immediately after processing.
     */
    async makePlayUtteranceList(autoRead = true) {
        // 1. Reset
        this.replayQueueVoiceStorage = {};
        this.resetToDefaults();

        const currentVoiceId = this.voicePrefs.activeVoiceId;
        this.initializeVoiceQueue(currentVoiceId);
        this.initializePlaySession();

        if (this.output === "") return false;

        // 2. Split
        let queueList = SentenceSplitter.splitTextIntoSentences(this.output);

        // 3. DYNAMIC Site-Specific Cleanup
        queueList = SentenceSplitter.applyFilterList(queueList, VR_Reader.siteFilterStringList || []);

        // 4. ULTRA-STRICT Merge Logic
        let mergedQueueList = SentenceSplitter.mergeSentences(queueList);

        // 5. CLEANUP: Remove empty lines and lines with only &nbsp;
        mergedQueueList = mergedQueueList.filter(text => {
            if (!text) return false;
            // Replace &nbsp; with nothing, trim whitespace, check if anything remains
            const cleanText = text.replace(/&nbsp;/g, '').trim();
            return cleanText.length > 0;
        });

        console.log(`📊 Original lines: ${queueList.length}, After merge & clean: ${mergedQueueList.length}`);

        this.playbackListDeleteAllOptions(false);
        this.playbackListBatchQueueList(mergedQueueList);

        let queueTextAndIndexList = [];
        mergedQueueList.forEach((text, index) => queueTextAndIndexList.push({ text, index }));

        this.queue = queueTextAndIndexList;
        this.replayQueue = [...queueTextAndIndexList];

        let startIndex = 0;
        if (window.VR_Reader && window.VR_Reader.resumeSentenceText) {
            const targetText = window.VR_Reader.resumeSentenceText.trim().toLowerCase();
            const foundIdx = this.replayQueue.findIndex(item => {
                const itemText = (item.text || "").trim().toLowerCase();
                return itemText === targetText || itemText.includes(targetText) || targetText.includes(itemText);
            });
            if (foundIdx >= 0) {
                startIndex = foundIdx;
                console.log(`🎯 Found resume sentence match at index ${startIndex}: "${this.replayQueue[startIndex].text.substring(0, 40)}..."`);
            }
            window.VR_Reader.resumeSentenceText = null;
        }

        if (autoRead && this.replayQueue.length > 0) {
            this.queue = this.replayQueue.slice(startIndex + 1);
            this.playbackListSelectOption(startIndex);
            this.playUtterance(this.replayQueue[startIndex], { pitch: 1, rate: this.defaultVoice.rate }, false);
        }
    }

    /**
     * Resumes reading from the last unread sentence after the user 
     * finishes a highlight reading session.
     */
    async continueReadingAfterHighlight() {
        if (!VR_Reader.remainingTextResult || !VR_Reader.remainingTextResult.remainingText) {
            console.warn('No remaining text available to continue');
            return;
        }

        const remainingText = VR_Reader.remainingTextResult.remainingText;
        console.log(`📖 Continuing reading with ${remainingText.length} characters remaining`);

        // Store the current queue length to know where new content starts
        const startIndex = this.replayQueue.length;

        // 1. Split Text
        let queueList = SentenceSplitter.splitTextIntoSentences(remainingText);

        // 2. DYNAMIC Site-Specific Cleanup
        queueList = SentenceSplitter.applyFilterList(queueList, VR_Reader.siteFilterStringList || []);

        // 3. ULTRA-STRICT Merge Logic
        let mergedQueueList = SentenceSplitter.mergeSentences(queueList);

        // 4. CLEANUP: Remove empty lines and lines with only &nbsp;
        mergedQueueList = mergedQueueList.filter(text => {
            if (!text) return false;
            // Replace &nbsp; with nothing, trim whitespace, check if anything remains
            const cleanText = text.replace(/&nbsp;/g, '').trim();
            return cleanText.length > 0;
        });

        console.log(`📊 Continue reading - Original: ${queueList.length}, After merge & clean: ${mergedQueueList.length}`);

        // Create queue items with proper global indices
        let queueTextAndIndexList = [];
        mergedQueueList.forEach((text, localIndex) => {
            const globalIndex = startIndex + localIndex;
            queueTextAndIndexList.push({
                text,
                index: globalIndex
            });
        });

        // Add to existing playback dropdown
        this.playbackListBatchQueueList(mergedQueueList);

        // Append to replayQueue
        this.replayQueue.push(...queueTextAndIndexList);

        // Clear temp queue
        this.queue = [];

        console.log(`✅ Added ${mergedQueueList.length} new sentences to queue`);

        // Start playing from the first new sentence
        this.playExternalAudio({ index: startIndex }, false);
        this.playbackListSelectOption(startIndex);

        // Clear stored selection data
        VR_Reader.clearStoredSelection();
    }

    cleanUtteranceText(...args) { return this.browserSpeech.cleanUtteranceText(...args); }

    async playUtterance(...args) { return this.browserSpeech.playUtterance(...args); }

    async populateVoiceList() { return this.browserSpeech.populateVoiceList(); }


    updateDefaultReaderState(defaultReaderState) {
        this.defaultReaderState = defaultReaderState
    }

    updateDefaultRate(defaultVoiceRate) {
        this.defaultVoice.rate = defaultVoiceRate;

        saveToLocalStorage({
            'DEFAULT_VOICE_RATE': defaultVoiceRate
        }, true);
    }
    getDefaultVoiceAndRate() {
        return {
            defaultVoiceRate: this.defaultVoice.rate,
            defaultVoiceName: this.voicePrefs.defaultVoiceNameFallback,
        }
    }
    completedSummary() {
        // Legacy method from old AI streaming chat. Left empty to prevent breaking `ExternalVoicePlayer`.
    }

    /**
     * Stops playback and detaches all listeners, effectively tearing down the player instance.
     */
    close() {
        this.destroy();
        this.documentObserver && this.documentObserver.disconnect();
    }
    createHTML() {
        return ` 
            <div class="voice-container">
                <div style="display:none" id="PlayOrStopButton" class="stopped">
                    <button id="StopButton" class="invisible-button">
                        ${this.svgStop()}
                    </button>
                    <button id="PlayButton" class="invisible-button ">
                        ${this.svgPlay("play")}
                    </button>
                </div>
                <div class="voice-select"  style="display:none">
                    <select id="voiceSelect"></select>
                </div>
            </div>
            ${this.style()}
        `
    }
    svgPlay(className) {
        return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24px" height="24px"><title>play</title><path fill="currentColor" d="M8,5.14V19.14L19,12.14L8,5.14Z" /></svg>`
    }
    svgStop(className) {
        return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24px" height="24px"><title>stop</title><path  fill="currentColor" d="M18,18H6V6H18V18Z" /></svg>`
    }
    style() {
        if (!this.el.querySelector("#StyleVoice")) {
            return `          
            <style id="StyleVoice">
            
            #PlayButton{
                padding:5px;
            }

            #PlayOrStopButton.stopped #PlayButton { display:flex;}
            #PlayOrStopButton.stopped #StopButton { display:none }

            #PlayOrStopButton.playing #PlayButton { display:none }
            #PlayOrStopButton.playing #StopButton { display:flex;}

            .voice-container{
                display:flex;
            }
            .voice-select {
                flex-grow: 1;
                align-items: center;
                display: flex;
                padding:0px 2px;
            }
            #voiceSelect {
                width: -webkit-fill-available;
                box-shadow: rgb(0 94 236 / 40%) 0px 0px 0px 2px, rgb(0 94 236 / 60%) 0px 4px 6px -1px, rgb(255 255 255 / 8%) 0px 1px 0px inset;
                margin: 0;
                border-radius: 4px;
                padding: 7px 10px;
                opacity: 0.9;
                border: 1px solid lightgray;
            }

            </style>`
        }
        return ''
    }
    async render(el) {
        this.el = el;
        this.voicePlayerDiv = document.createElement("div");
        this.voicePlayerDiv.innerHTML = this.createHTML()

        this.el.append(this.voicePlayerDiv);
        await this.init();
    }
}
