import { CONSTANTS } from "../../constants/constants";
import { sleep, removeHiglightOnPage } from "../../utils/helpers";

import AudioEngine from "./external-voice-player/AudioEngine";
import BufferManager from "./external-voice-player/BufferManager";
import WordHighlighter from "./external-voice-player/WordHighlighter";
import ClickToReadHandler from "./tts-voice-player/ClickToReadHandler";
import TimerManager from "./external-voice-player/TimerManager";
import SessionManager from "./external-voice-player/SessionManager";

/**
 * ============================================================================
 * ExternalVoicePlayer (Premium AI TTS Coordinator)
 * ============================================================================
 * Coordinates playback for premium TTS voices (Google TTS, OpenAI TTS, etc.) by
 * communicating with a background offscreen document to play audio files.
 * This player delegates heavy lifting to sub-modules (AudioEngine, BufferManager,
 * SessionManager, WordHighlighter, TimerManager).
 */
export default class ExternalVoicePlayer {
    constructor(type) {
        // --- Core Audio State ---
        this.externalAudio = null;
        this.externalAudioSpeaking = false;
        this.updateTimeInterval;
        this.preloadQueue = [];
        this.voice = {};

        this.lastPlayAttemptTime = null;
        this.lastPlayAttemptIndex = null;
        this.lastTimeUpdateTimestamp = null;

        // Stores the DOM position right after the previous sentence's highlight.
        // Set in onEndedCallback, consumed + cleared in handleOnPlay.
        this.lastHighlightAnchor = null;

        this.lastKnownTotalTime = 0;
        this.lastKnownElapsedTime = 0;
        this.lastKnownRemainingTime = 0;

        this.actualElapsedForCompleted = 0;
        this.currentSentenceRealDurationSeconds = 0;

        this.currentVoiceId = null;
        this.sessionId = null;
        this.sessionStartTime = null;
        this.sessionTotalDuration = 0;

        this.staleDownloads = new Map();
        this.wordTimestampsStorage = {};

        this.preloadPromises = new Map();
        this.lastPlayedIndex = -1;

        this.READING_SPEED_CHARS_PER_SEC = 15;
        this.MIN_BUFFER_SIZE = 2;
        this.MAX_BUFFER_SIZE = 6;
        this.MAX_CONCURRENT_GENERATIONS = CONSTANTS.DEFAULT_MAX_CONCURRENT;

        this.SLOW_PROVIDERS = ['gemini-2-5-flash-tts', 'gemini-2-5-flash-tts-vd'];
        this.SLOW_PROVIDER_INITIAL_BUFFER = 3;
        this.SLOW_PROVIDER_MIN_BUFFER = 3;

        this.activeDownloads = new Set();
        this.completedDownloads = new Set();

        this.manuallyPaused = false;

        this.generationMetrics = {
            recentSamples: [],
            avgTimePerChar: 50,
            sampleCount: 0
        };

        this.wordTimestamps = new Map();
        this.currentWordHighlightInterval = null;
        this.currentHighlightedWords = [];
        this.wordHighlightStylesInjected = false;

        // Preloaded (pending) highlight state for upcoming sentences.
        this.pendingHighlights = new Map();
        this.pendingWordHighlights = new Map();

        // Tracks preloads still awaiting createPreloadedHighlights so two async
        // runs can't register a second pending mark for the same sentence.
        this._preloadInFlight = new Set();
        this.currentHighlightAnchor = null;
        this.highlightPreloadGeneration = 0;

        this.currentAudioTime = 0;
        this.currentSentenceStartTime = null;
        this.currentPlayingIndex = -1;

        this.frameSkipCounter = 0;
        this.currentClipHasOwnKey = false;

        // --- Telemetry & Analytics ---
        this.telemetryBatch = {
            play_duration_seconds: 0,
            character_count: 0,
            sentenceCount: 0
        };
        this._handleUnload = () => {
            // Stop offscreen audio immediately when tab closes
            try {
                if (this.audioEngine) {
                    this.audioEngine.stopPlayingAudioInOffscreen();
                }
            } catch (e) { }

            if (this.sessionManager && typeof this.sessionManager.flushTelemetry === 'function') {
                this.sessionManager.flushTelemetry();
            }

            this._updateReadLaterCache();
        };
        window.addEventListener('beforeunload', this._handleUnload);

        // Initialize sub-modules
        this.audioEngine = new AudioEngine(this);
        this.bufferManager = new BufferManager(this);
        this.wordHighlighter = new WordHighlighter(this);
        this.clickHandler = new ClickToReadHandler(this);
        this.timerManager = new TimerManager(this);
        this.sessionManager = new SessionManager(this);
    }

    setPremiumVoice(voice) {
        console.log("setPremiumVoice", voice);
        this.voice = voice;
        this.currentClipHasOwnKey = false;
    }

    triggerDeveloperLimitOverlay(index) {
        console.log(`⛔ Developer limit reached. Stopping playback at index ${index}`);

        this.audioEngine.stopPlayingAudioInOffscreen();

        if (VR_Reader.ttsWidget) {
            VR_Reader.ttsWidget.changePlayingButtonStatus(false);
        }

        VR_Reader.makeRatingsOverlay({
            sessionId: this.sessionId,
            voice: (this.replayQueue[index]?.voice?.voice_gender || this.voice),
            replayQueue: this.replayQueue,
            index: index,
            callback: null,
            hasOwnKey: true
        });
    }

    triggerDisableUI(index) {
        if (index !== undefined && index !== null && !isNaN(index)) {
            if (VR_Reader.ttsWidget && VR_Reader.ttsWidget.playbackClass) {
                VR_Reader.ttsWidget.playbackClass.disableOptionsFromIndex(index);
            }
        }
    }

    hideRatingOverlay() {
        if (window.VR_Reader && window.VR_Reader.ratingsOverlayClass) {
            console.log('🚫 Hiding rating overlay on manual resume');
            window.VR_Reader.ratingsOverlayClass.close();
        }
    }

    getPreloadAheadCount() {
        return VR_Reader.savedLocalStorageGlobal['DEFAULT_HIGHLIGHT_PRELOAD_SENTENCES']
            ?? CONSTANTS.HIGHLIGHT_PRELOAD_AHEAD_SENTENCES;
    }

    removePendingHighlightDom(pending) {
        if (!pending) return;
        const marks = pending?.marks || [];
        marks.forEach((mark) => {
            if (mark && mark.parentNode) {
                const range = document.createRange();
                range.selectNodeContents(mark);
                const fragment = range.extractContents();
                mark.parentNode.insertBefore(fragment, mark);
                mark.remove();
            }
        });
        const overlays = pending?.overlayElements || [];
        overlays.forEach((el) => {
            if (el && el.parentNode) el.remove();
        });
    }

    clearPendingHighlights() {
        this.highlightPreloadGeneration++;

        // Remove any preloaded but not-yet-activated sentence marks plus the
        // hidden pending sentence overlays pre-painted alongside them.
        this.pendingHighlights.forEach((pending) => {
            this.removePendingHighlightDom(pending);
        });
        this.pendingHighlights.clear();

        // Remove preloaded word spans so they don't leak into the page.
        this.pendingWordHighlights.forEach((state) => {
            const bar = state?.highlightBar;
            if (bar && bar.parentNode) bar.remove();
            const wrapped = state?.wrappedWords || [];
            wrapped.forEach((span) => {
                if (span && span.parentNode) {
                    const text = document.createTextNode(span.textContent);
                    span.parentNode.replaceChild(text, span);
                }
            });
        });
        this.pendingWordHighlights.clear();
    }

    async preloadUpcomingHighlights(currentIndex) {
        const preloadCount = this.getPreloadAheadCount();
        if (preloadCount <= 0) return;

        const highlightMode = VR_Reader.savedLocalStorageGlobal['DEFAULT_HIGHLIGHT_MODE_STATE'] || 'smooth';
        const highlightEnabled = this.voicePrefs?.highlightReadingEnabled;
        const scrollEnabled = this.voicePrefs?.autoscrollReadingEnabled;
        if (!highlightEnabled && !scrollEnabled) return;

        const anchor = this.currentHighlightAnchor || null;
        const generation = this.highlightPreloadGeneration;

        for (let i = 1; i <= preloadCount; i++) {
            const index = currentIndex + i;
            if (index >= this.replayQueue.length) break;
            if (this.pendingHighlights.has(index)) continue;

            const clip = this.replayQueue[index];
            if (!clip || clip.status === 'skipped' || clip.status === 'no_credits') continue;

            // Word-level modes pre-wrap word spans from timestamps, so they
            // must wait for audio (timestamps) to be available. Sentence-only
            // highlighting only needs the clip text + anchor and can preload as
            // soon as the sentence is parsed — waiting for audio here is what
            // made the second sentence fall through to the live search.
            const isWordMode = highlightMode !== 'sentence';
            if (isWordMode && !clip.audioData && !this.completedDownloads.has(index)) continue;

            const utteranceText = this.cleanUtteranceText(clip.text);
            if (!utteranceText || utteranceText === ',') continue;

            // Dedup in-flight preloads so two concurrent runs can't each await
            // createPreloadedHighlights for the same sentence and register a
            // second pending mark (the nesting race).
            if (this._preloadInFlight.has(index)) continue;
            this._preloadInFlight.add(index);

            try {
                const pending = await this.textHighlighter.createPreloadedHighlights(utteranceText, index, anchor);
                if (!pending) continue;

                // If a jump happened while we were matching, discard this stale work.
                if (generation !== this.highlightPreloadGeneration) {
                    this.removePendingHighlightDom(pending);
                    continue;
                }

                // If the sentence started playing (or finished) while we were
                // matching, its highlight is owned by the active highlight path
                // now. Discard the pending marks instead of letting them wrap
                // the active ones.
                if (index <= this.currentPlayingIndex) {
                    this.removePendingHighlightDom(pending);
                    continue;
                }

                this.pendingHighlights.set(index, pending);

                // Pre-wrap word spans if timestamps are available and not in sentence-only mode.
                if (highlightMode !== 'sentence' && this.wordTimestamps.has(index)) {
                    const wordState = this.wordHighlighter.prepareWordHighlights(index);
                    if (wordState && generation !== this.highlightPreloadGeneration) {
                        this.pendingWordHighlights.delete(index);
                        if (wordState.highlightBar && wordState.highlightBar.parentNode) {
                            wordState.highlightBar.remove();
                        }
                        (wordState.wrappedWords || []).forEach((span) => {
                            if (span && span.parentNode) {
                                const text = document.createTextNode(span.textContent);
                                span.parentNode.replaceChild(text, span);
                            }
                        });
                    }
                }
            } catch (e) {
                console.warn(`Failed to preload highlights for sentence ${index}:`, e);
            } finally {
                this._preloadInFlight.delete(index);
            }
        }
    }

    activatePendingHighlight(index) {
        const pending = this.pendingHighlights.get(index);
        if (!pending) return false;

        // If every pending mark was already unwrapped/removed from the DOM
        // (e.g. a createHighlights cleanup cycle pulled them out), activating
        // would register detached nodes into savedMarkElements and poison the
        // next anchor capture. Discard and fall back to the active path.
        const marksAlive = Array.isArray(pending.marks)
            && pending.marks.length > 0
            && pending.marks.every(mark => mark && mark.isConnected);
        if (!marksAlive) {
            this.removePendingHighlightDom(pending);
            this.pendingHighlights.delete(index);
            return false;
        }

        const highlightMode = VR_Reader.savedLocalStorageGlobal['DEFAULT_HIGHLIGHT_MODE_STATE'] || 'smooth';
        const isWordMode = highlightMode !== 'sentence' && this.wordTimestamps.has(index);

        // If word-level highlighting is expected but we couldn't pre-wrap the
        // words, fall back to the normal creation path instead of showing a
        // static sentence mark. Fully remove the pending DOM so the invisible
        // marks/overlay don't linger on the page.
        if (isWordMode && !this.pendingWordHighlights.has(index)) {
            this.removePendingHighlightDom(pending);
            this.pendingHighlights.delete(index);
            return false;
        }

        // Reveal the sentence overlay (pre-painted before word wrapping) and
        // start the moving word bar. Both highlights coexist.
        this.textHighlighter.activatePendingHighlight(pending);

        if (isWordMode) {
            const wordState = this.pendingWordHighlights.get(index);
            if (wordState) {
                this.wordHighlighter.activateWordHighlights(wordState, highlightMode);
                this.pendingWordHighlights.delete(index);
            }
        }

        this.pendingHighlights.delete(index);
        return true;
    }

    handleTextElementClick(e) {
        if (this.clickHandler) {
            this.clickHandler.handleTextElementClick(e);
        }
    }

    toggleTextSelection(enable) {
        if (this.clickHandler) {
            this.clickHandler.toggleTextSelection(enable);
        }
    }

    manualPauseWithRating() {
        this.sessionManager.flushTelemetry();
        console.log(`🛑 Manual pause at index ${this.currentPlayingIndex}`);

        this.audioEngine.stopPlayingAudioInOffscreen();

        const currentClip = this.replayQueue[this.currentPlayingIndex];
        if (currentClip && currentClip.audioData) {
            const effectiveHasOwnKey = (currentClip.hasOwnKey !== undefined) ? currentClip.hasOwnKey : this.currentClipHasOwnKey;

            VR_Reader.makeRatingsOverlay({
                sessionId: this.sessionId,
                voice: (currentClip.voice?.voice_gender || this.voice),
                replayQueue: this.replayQueue,
                index: this.currentPlayingIndex,
                callback: null,
                hasOwnKey: effectiveHasOwnKey,
                forceTokenDisplay: !effectiveHasOwnKey
            });
        }
    }

    handleNoCreditsResponse(response) {
        let failedIndex = response.index;
        if (failedIndex === undefined || failedIndex === null) failedIndex = this.currentPlayingIndex;

        console.log('Handling No Credits for index:', failedIndex);

        this.audioEngine.stopPlayingAudioInOffscreen();
        if (VR_Reader.ttsWidget) VR_Reader.ttsWidget.changePlayingButtonStatus(false);
        this.triggerDisableUI(failedIndex);

        VR_Reader.makeRatingsOverlay({
            sessionId: this.sessionId,
            voice: (this.replayQueue[failedIndex]?.voice?.voice_gender || this.voice),
            replayQueue: this.replayQueue,
            index: failedIndex,
            callback: null,
            hasOwnKey: false,
            forceTokenDisplay: true
        });
    }

    handleAudioFetchError(failedIndex, currentPlayingIndex = null) {
        this.externalAudioSpeaking = false;
        this.audioEngine.stopPlayingAudioInOffscreen();

        if (VR_Reader.ttsWidget) {
            VR_Reader.ttsWidget.showExternalLoader(false);
        }

        const retryIndex = currentPlayingIndex !== null ? currentPlayingIndex : failedIndex;
        const failedClip = this.replayQueue[failedIndex];
        const failedClipText = failedClip?.text || "this sentence";
        const nextClipExists = this.replayQueue[failedIndex + 1] !== undefined;
        const serviceName = failedClip?.voice?.voice_service || this.voice?.voice_service;
        const isApiKeyError = !!failedClip?.errorMessage && failedClip.errorMessage.includes('API Key required');

        if (isApiKeyError && serviceName) {
            VR_Reader.makePrompt({
                posX: 10,
                posY: 10,
                action: 'vrr-theme',
                title: `API Key Missing: ${serviceName}`,
                message: `We couldn't generate the audio for the sentence: <br><br><em>"${failedClipText}"</em><br><br>This happened because you need to add your <b>${serviceName}</b> API key to generate audio.`,
                actions: [
                    {
                        buttonText: 'Add API Key',
                        callback: () => {
                            chrome.runtime.sendMessage({
                                action: "open-sidepanel",
                                route: "/settings",
                                data: {
                                    tab: 'byok',
                                    provider: serviceName
                                }
                            });
                        }
                    },
                    {
                        buttonText: 'Get API Key Guide',
                        callback: () => {
                            chrome.runtime.sendMessage({
                                action: "open-byok-guide",
                                serviceName
                            });
                        }
                    },
                    {
                        buttonText: 'Community help',
                        callback: () => {
                            chrome.runtime.sendMessage({
                                action: "open-sidepanel",
                                route: "/main-menu",
                                data: {
                                    openCommunityHelpModal: true
                                }
                            });
                        }
                    }
                ]
            });
            return;
        }

        const promptActions = [
            {
                buttonText: 'Try Again',
                callback: () => {
                    if (this.replayQueue[failedIndex]) {
                        delete this.replayQueue[failedIndex].audioData;
                        this.completedDownloads.delete(failedIndex);
                    }
                    this.playbackListNewStartQueue(retryIndex);
                }
            },
            {
                buttonText: 'Error logs',
                callback: () => {
                    chrome.runtime.sendMessage({
                        action: "open-sidepanel-error-logs"
                    });
                }
            }
        ];

        if (nextClipExists) {
            promptActions.push({
                buttonText: 'Skip to Next',
                callback: () => {
                    this.playbackListNewStartQueue(failedIndex + 1);
                }
            });
        }

        VR_Reader.makePrompt({
            posX: 10,
            posY: 10,
            action: 'vrr-theme',
            title: 'Audio Generation Failed',
            message: `We couldn't generate the audio for the sentence: <br><br><em>"${failedClipText}"</em>`,
            cancel: { buttonText: 'Stop Playback' },
            actions: promptActions
        });
    }

    /**
     * The core playback orchestrator. Handles buffer validation, requesting missing 
     * audio data, coordinating retries, and finally instructing the AudioEngine to play.
     * @param {Object} utteranceTxt - Contains the index and text of the sentence to play.
     * @param {boolean} ignoreFirstQueue - Flag to skip the first sentence if it's already running.
     */
    async playExternalAudio(utteranceTxt, ignoreFirstQueue = false) {

        this.hideRatingOverlay();

        if (!this.replayQueue[utteranceTxt.index]) return false;

        const currentIndex = utteranceTxt.index;
        const currentClip = this.replayQueue[currentIndex];

        const voiceService = currentClip.voice?.voice_service || this.voice.voice_service;
        this.currentClipHasOwnKey = await this.sessionManager._checkHasOwnKey(voiceService);
        currentClip.hasOwnKey = this.currentClipHasOwnKey;

        const expectedVoiceId = VR_Reader.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_ID'];
        const expectedVoiceSpeed = VR_Reader.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_SPEED'];
        const hasSpeedSupport = VR_Reader.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT'];

        const voiceIdMismatch = this.currentVoiceId !== expectedVoiceId;
        const voiceSpeedMismatch = hasSpeedSupport && this.currentVoiceSpeed !== expectedVoiceSpeed;

        if (voiceIdMismatch || voiceSpeedMismatch) {
            console.log(`⚠️ Voice/speed mismatch detected. Triggering voiceChanged()...`);
            this.voiceChanged();
            return;
        }

        if (currentIndex === 0) window.getSelection().removeAllRanges();

        const isJump = this.lastPlayedIndex !== -1 && currentIndex !== this.lastPlayedIndex + 1;

        this.currentAudioTime = 0;
        this.currentSentenceRealDurationSeconds = 0;
        this.currentSentenceStartTime = null;
        this.currentPlayingIndex = currentIndex;
        this.wordHighlighter.clearWordHighlights();

        if (this.externalAudioSpeaking) {
            this.externalAudioSpeaking = false;
            this.audioEngine.stopPlayingAudioInOffscreen();
        }

        if (isJump) {
            console.log(`🔀 JUMP DETECTED: from ${this.lastPlayedIndex} to ${currentIndex}`);
            for (let i = this.lastPlayedIndex + 1; i < currentIndex; i++) {
                this.activeDownloads.delete(i);
                this.preloadPromises.delete(i);
            }
            this.clearPendingHighlights();
        }

        console.log(`\n▶️  Starting playback for index ${currentIndex}`);

        if (VR_Reader.ttsWidget) {
            VR_Reader.ttsWidget.showExternalLoader(true);
        }

        const initialClip = this.replayQueue[currentIndex];
        if (initialClip.status === 'no_credits') {
            console.log(`🚫 Clip ${currentIndex} already marked as no_credits, aborting`);
            if (VR_Reader.ttsWidget) VR_Reader.ttsWidget.showExternalLoader(false);
            this.handleNoCreditsResponse(initialClip);
            return;
        }
        if (initialClip.status === 'skipped') {
            console.log(`🚫 Clip ${currentIndex} already marked as skipped, aborting`);
            if (VR_Reader.ttsWidget) VR_Reader.ttsWidget.showExternalLoader(false);
            this.triggerDisableUI(currentIndex);

            if (this.currentClipHasOwnKey) {
                this.triggerDeveloperLimitOverlay(currentIndex);
            } else {
                VR_Reader.makeRatingsOverlay({
                    sessionId: this.sessionId,
                    voice: (initialClip.voice?.voice_gender || this.voice),
                    replayQueue: this.replayQueue,
                    index: currentIndex,
                    callback: null,
                    hasOwnKey: false
                });
            }
            return;
        }

        let initialBufferSize = this.bufferManager.getInitialBufferSize();

        const isFreshStartOrJump = (this.lastPlayedIndex === -1 || isJump);
        if (isFreshStartOrJump) {
            let firstClipTextLength = this.replayQueue[currentIndex]?.text?.length || 0;
            let secondClipTextLength = this.replayQueue[currentIndex + 1]?.text?.length || 0;
            if (firstClipTextLength + secondClipTextLength < 250) {
                initialBufferSize = Math.max(initialBufferSize, 3);
            }
        }

        const isSlowProvider = this.bufferManager.isSlowProvider();
        const indicesToPreload = [];

        for (let i = currentIndex; i < Math.min(currentIndex + initialBufferSize, this.replayQueue.length); i++) {
            const clip = this.replayQueue[i];
            if (clip && clip.status !== 'skipped' && !clip.audioData && !this.activeDownloads.has(i) && !this.completedDownloads.has(i)) {
                indicesToPreload.push(i);
            }
        }

        const preloadPromises = [];
        if (indicesToPreload.length > 0) {
            if (isSlowProvider && indicesToPreload.length > 1) {
                for (let i = 0; i < indicesToPreload.length; i++) {
                    const idx = indicesToPreload[i];
                    const delay = i * 350;
                    const staggeredPromise = (async () => {
                        if (delay > 0) await sleep(delay);
                        return this.bufferManager.preloadExternalTTS(idx);
                    })();
                    preloadPromises.push(staggeredPromise);
                }
            } else {
                indicesToPreload.forEach(idx => preloadPromises.push(this.bufferManager.preloadExternalTTS(idx)));
            }
            await Promise.all(preloadPromises);
        }

        const maxWaitTime = 30000;
        const checkInterval = 100;
        let elapsedTime = 0;
        let showedRetryToast = false;

        while (elapsedTime < maxWaitTime) {
            let clip = this.replayQueue[currentIndex];
            let nextClip = this.replayQueue[currentIndex + 1];

            if (clip.status === 'no_credits') {
                if (VR_Reader.ttsWidget) VR_Reader.ttsWidget.showExternalLoader(false);
                this.handleNoCreditsResponse(clip);
                return;
            }
            if (clip.status === 'error') {
                if (!clip.hasAutoRetried) {
                    clip.hasAutoRetried = true;
                    clip.status = 'loading';

                    const errorMsg = clip.errorMessage ? `[${clip.errorMessage}]` : 'Audio error detected.';
                    VR_Reader.makeToast({
                        delay: 4000,
                        posX2: 24, posY2: 20,
                        action: 'purple-blue',
                        title: `<span style="font-size:12px;">${errorMsg}<br>Retrying...</span>`
                    });

                    setTimeout(() => {
                        if (this.replayQueue[currentIndex] === clip) {
                            this.bufferManager.preloadExternalTTS(currentIndex, 1);
                        }
                    }, 1500);
                } else {
                    break;
                }
            }

            const currentReady = clip.audioData || clip.status === 'skipped';
            const nextReady = !nextClip || nextClip.status === 'skipped' || nextClip.status === 'no_credits' || nextClip.audioData;

            let allReady = false;

            if (isFreshStartOrJump) {
                allReady = currentReady && nextReady;

                if (initialBufferSize >= 3 && allReady) {
                    let thirdClip = this.replayQueue[currentIndex + 2];
                    if (thirdClip) {
                        const thirdReady = thirdClip.audioData || thirdClip.status === 'skipped' || thirdClip.status === 'no_credits';
                        allReady = allReady && thirdReady;
                    }
                }
            } else {
                allReady = currentReady;
            }

            if (allReady) break;

            if (elapsedTime >= 10000 && !showedRetryToast) {
                showedRetryToast = true;
                if (VR_Reader.ttsWidget) VR_Reader.ttsWidget.showExternalLoader(true);
                VR_Reader.makeToast({
                    delay: 30000,
                    posX2: 24,
                    posY2: 20,
                    action: 'purple-blue',
                    title: `<span style="font-size:12px;">Audio is slow to generate...<br>Retrying automatically.</span>`
                });

                const failedIndices = [];
                if (!currentReady && clip.status !== 'skipped' && clip.status !== 'no_credits') failedIndices.push(currentIndex);
                if (nextClip && !nextReady && nextClip.status !== 'skipped' && nextClip.status !== 'no_credits') failedIndices.push(currentIndex + 1);

                if (isFreshStartOrJump && initialBufferSize >= 3) {
                    let thirdClip = this.replayQueue[currentIndex + 2];
                    if (thirdClip && !thirdClip.audioData && thirdClip.status !== 'skipped' && thirdClip.status !== 'no_credits') {
                        failedIndices.push(currentIndex + 2);
                    }
                }

                for (const idx of failedIndices) {
                    const c = this.replayQueue[idx];
                    if (c) {
                        this.activeDownloads.delete(idx);
                        this.completedDownloads.delete(idx);
                        this.preloadPromises.delete(idx);
                        delete c.audioData;
                        c.fetching = false;
                    }
                }

                if (failedIndices.length > 0) {
                    const retryPromises = [];
                    failedIndices.forEach(idx => retryPromises.push(this.bufferManager.preloadExternalTTS(idx, 1)));
                    await Promise.all(retryPromises);
                }
            }

            await sleep(checkInterval);
            elapsedTime += checkInterval;
        }

        if (showedRetryToast && VR_Reader.toastClass) VR_Reader.toastClass.close();

        const finalClip = this.replayQueue[currentIndex];

        if (VR_Reader.ttsWidget) VR_Reader.ttsWidget.showExternalLoader(false);

        if (!finalClip) {
            this.handleAudioFetchError(currentIndex, currentIndex);
            return;
        }

        if (finalClip && finalClip.audioData) {
            this.externalAudioSpeaking = true;
            this.lastPlayAttemptTime = performance.now();
            this.lastPlayAttemptIndex = currentIndex;

            const audioBlobURL = this.audioEngine.base64ToBlob(finalClip.audioData, 'audio/mpeg', finalClip);

            let onEndedCallbackID = "onEnded_callback_" + (Math.floor(Math.random() * 1000) + 100);
            VR_Reader.saveRequest(onEndedCallbackID, ({ index }) => this.onEndedCallback(index));

            let onPlayCallbackID = "onPlay_callback_" + (Math.floor(Math.random() * 2000) + 1001);
            VR_Reader.saveRequest(onPlayCallbackID, ({ index }) => this.handleOnPlay(index));

            let onTimeUpdateCallbackID = "onUpdatetime_callback_" + (Math.floor(Math.random() * 2000) + 1001);
            VR_Reader.saveRequest(onTimeUpdateCallbackID, (data) => this.timerManager.onUpdatetimeCallback(data.index, data.duration, data.currentTime));

            let onErrorCallbackID = "onError_callback_" + (Math.floor(Math.random() * 2000) + 1001);
            VR_Reader.saveRequest(onErrorCallbackID, (data) => {
                console.error("Received error from offscreen:", data.error);
                this.handleAudioFetchError(data.index);
            });

            this.audioEngine.playAudioInOffscreen({
                audioBlobURL,
                index: currentIndex,
                onPlayCallbackID,
                onTimeUpdateCallbackID,
                onEndedCallbackID,
                onErrorCallbackID
            });

            if (this.playWatchdogTimeout) clearTimeout(this.playWatchdogTimeout);

            this.playWatchdogTimeout = setTimeout(async () => {
                if (this.externalAudioSpeaking &&
                    this.currentSentenceStartTime === null &&
                    this.currentAudioTime === 0 &&
                    this.currentPlayingIndex === currentIndex) {

                    console.warn(`🚨 Playback Watchdog: Verifying offscreen audio state for index ${currentIndex}...`);

                    let isActuallyPlaying = false;
                    try {
                        isActuallyPlaying = await new Promise((resolve) => {
                            let checkCallbackID = "checkPlaying_callback_" + (Math.floor(Math.random() * 2000) + 1001);
                            let resolved = false;

                            VR_Reader.saveRequest(checkCallbackID, (data) => {
                                if (!resolved) {
                                    resolved = true;
                                    resolve(data && data.isPlaying);
                                }
                            });

                            this.audioEngine.checkAudioPlayingInOffscreen({ index: currentIndex, callbackID: checkCallbackID });

                            setTimeout(() => {
                                if (!resolved) {
                                    resolved = true;
                                    resolve(false);
                                }
                            }, 500);
                        });
                    } catch (e) {
                        isActuallyPlaying = false;
                    }

                    if (isActuallyPlaying) {
                        console.log(`✅ Smart Watchdog Verified: Audio IS playing in offscreen! Clearing false-alarm watchdog for index ${currentIndex}.`);
                        this.currentSentenceStartTime = performance.now();
                        if (VR_Reader.ttsWidget) VR_Reader.ttsWidget.showExternalLoader(false);
                        return;
                    }

                    console.warn(`🚨 Smart Watchdog Confirmed: Audio is NOT playing for index ${currentIndex}. Executing recovery...`);

                    this.audioEngine.stopPlayingAudioInOffscreen();
                    this.externalAudioSpeaking = false;

                    if (!this.watchdogRetryCounts) this.watchdogRetryCounts = {};
                    const currentRetries = this.watchdogRetryCounts[currentIndex] || 0;

                    if (currentRetries < 2) {
                        this.watchdogRetryCounts[currentIndex] = currentRetries + 1;
                        await sleep(300);
                        console.log(`🔄 Watchdog executing auto-retry (${currentRetries + 1}/2) for index ${currentIndex}`);
                        await this.playExternalAudio(utteranceTxt, ignoreFirstQueue);
                    } else {
                        console.error(`❌ Watchdog exceeded max retries (2) for index ${currentIndex}. Showing error prompt.`);
                        this.watchdogRetryCounts[currentIndex] = 0;
                        this.handleAudioFetchError(currentIndex, currentIndex);
                    }
                }
            }, 2500);

        } else {
            console.error(`❌ UNEXPECTED: Reached end of playExternalAudio without playing!`);

            if (finalClip.status === 'no_credits') {
                this.handleNoCreditsResponse(finalClip);
            }
            else if (finalClip.status === "skipped") {
                this.triggerDisableUI(currentIndex);

                if (this.currentClipHasOwnKey) {
                    this.triggerDeveloperLimitOverlay(currentIndex);
                } else {
                    VR_Reader.makeRatingsOverlay({
                        sessionId: this.sessionId,
                        voice: (finalClip.voice?.voice_gender || this.voice),
                        replayQueue: this.replayQueue,
                        index: currentIndex,
                        callback: null,
                        hasOwnKey: false
                    });
                }
            } else {
                this.handleAudioFetchError(currentIndex, currentIndex);
            }
        }
    }

    handleOnPlay(index) {
        if (this.watchdogRetryCounts) {
            this.watchdogRetryCounts[index] = 0;
        }

        if (this.playWatchdogTimeout) {
            clearTimeout(this.playWatchdogTimeout);
            this.playWatchdogTimeout = null;
        }

        if (this.lastPlayAttemptIndex !== index) {
            console.warn(`⚠️ Unexpected play event for index ${index}`);
        }

        if (this.currentPlayingIndex === index &&
            this.externalAudioSpeaking &&
            this.currentSentenceStartTime !== null) {
            return;
        }

        // Positional half of the hybrid duplicate-disambiguation: only trust
        // the forward-seek anchor for the sentence that immediately follows the
        // previous one. On a jump (dropdown, skip) fall back to document-first.
        const isLinearNext = this.lastPlayedIndex === -1 || index === this.lastPlayedIndex + 1;
        const searchStartAnchor = isLinearNext ? (this.lastHighlightAnchor || null) : null;
        this.lastHighlightAnchor = null;

        this.externalAudioSpeaking = true;
        this.currentSentenceStartTime = performance.now();
        this.currentPlayingIndex = index;
        this._updateReadLaterCache(index);

        if (Math.abs(this.currentAudioTime - 0) > 100) {
            this.currentAudioTime = 0;
        }

        this.timerManager.recalculateTotalTime();

        const utteranceText = this.cleanUtteranceText(this.replayQueue[index].text);

        if (utteranceText !== "" && utteranceText !== ",") {
            VR_Reader.ttsWidget.changePlayingButtonStatus(true);
            this.playSpeechBeatsAnimation();

            // Cap the highlighted-elements cache so long sessions don't grow
            // the object without bound.
            const cache = window.VR_Reader.savedHighlightedElements;
            const cacheKeys = Object.keys(cache);
            if (cacheKeys.length > 200) {
                for (let i = 0; i < 50; i++) {
                    delete cache[cacheKeys[i]];
                }
            }
            if (!cache[utteranceText]) {
                cache[utteranceText] = utteranceText;
            }

            const highlightMode = VR_Reader.savedLocalStorageGlobal['DEFAULT_HIGHLIGHT_MODE_STATE'] || 'smooth';

            // Heavy DOM work (clearing old highlights, painting new ones,
            // capturing the anchor, and preloading upcoming sentences) is
            // deferred to the next animation frame so the play event returns
            // immediately and audio starts without jank.
            requestAnimationFrame(async () => {
                if (this.currentPlayingIndex !== index || !this.externalAudioSpeaking) return;

                removeHiglightOnPage();
                this.wordHighlighter.clearWordHighlights();

                if (this.wordTimestamps.has(index)) {
                    this.wordHighlighter.injectWordHighlightStyles(highlightMode);
                }

                const wasPreloaded = this.activatePendingHighlight(index);

                if (!wasPreloaded) {
                    if (this.wordTimestamps.has(index)) {
                        await this.textHighlighter.createWordByWordHighlights(utteranceText, index, searchStartAnchor);
                    } else {
                        await this.textHighlighter.createHighlights(utteranceText, index, searchStartAnchor);
                    }

                    // The highlight search is async; if a jump happened while we
                    // were matching, bail before capturing an anchor for a
                    // sentence that is no longer current.
                    if (this.currentPlayingIndex !== index || !this.externalAudioSpeaking) return;
                }

                // Capture the end of the current sentence so the next preload
                // can start searching from here. This must run AFTER the
                // highlight marks exist — otherwise the anchor is null and the
                // preloads fall back to a document-first search, snapping
                // duplicate metadata lines to their first occurrence on the page.
                this.currentHighlightAnchor = this.textHighlighter.captureHighlightAnchor();

                // Preload highlights for upcoming sentences while this one plays.
                this.preloadUpcomingHighlights(index);
            });
        }

        clearTimeout(this.stopNextSpeechCheckIntervalWithTimeout);
        this.bufferManager.maintainIntelligentBuffer(index);
    }

    onPlayCallback(index, ignoreFirstQueue) {
        this.externalAudioSpeaking = true;

        const utteranceText = this.cleanUtteranceText(this.replayQueue[index].text);

        if (utteranceText !== "" && utteranceText !== ",") {
            VR_Reader.ttsWidget.changePlayingButtonStatus(true);
            this.playSpeechBeatsAnimation();

            if (!window.VR_Reader.savedHighlightedElements[utteranceText]) {
                window.VR_Reader.savedHighlightedElements[utteranceText] = utteranceText;
            }

            this.textHighlighter.createHighlights(utteranceText);
        }

        clearTimeout(this.stopNextSpeechCheckIntervalWithTimeout);

        console.log(`\n🎵 Audio playing at index ${index}, now maintaining intelligent buffer...`);
        this.bufferManager.maintainIntelligentBuffer(index);
    }

    async onEndedCallback(index, ignoreFirstQueue) {
        // Capture the just-finished sentence's end BEFORE clearing the marks so
        // the next linear sentence can forward-seek past it. Combined with the
        // prefix/suffix context, this is the positional half of the hybrid
        // duplicate-disambiguation strategy.
        this.lastHighlightAnchor = this.textHighlighter.captureHighlightAnchor();
        removeHiglightOnPage();
        this.wordHighlighter.clearWordHighlights();

        this.lastPlayedIndex = index;
        this.sentencePlayCompleteCounter++;

        const currentClip = this.replayQueue[index];
        let actualDuration = 0;

        if (this.currentAudioTime > 0) actualDuration = this.currentAudioTime / 1000;
        else if (this.currentSentenceRealDurationSeconds > 0) actualDuration = this.currentSentenceRealDurationSeconds;

        if (currentClip && !currentClip.realDurationSeconds && actualDuration > 0) {
            currentClip.realDurationSeconds = actualDuration;
        }

        if (currentClip && currentClip.audioData && actualDuration > 0) {
            this.sessionTotalDuration += actualDuration;

            const charCount = currentClip.text ? currentClip.text.length : 0;
            const isOwnKey = currentClip.hasOwnKey || this.currentClipHasOwnKey;

            if (isOwnKey && charCount > 0) {
                if (typeof VR_Reader.developerModeDailyUsage === 'number') {
                    VR_Reader.developerModeDailyUsage += charCount;
                    console.log(`📈 Updated Local Developer Usage: +${charCount} (Total: ${VR_Reader.developerModeDailyUsage}/${VR_Reader.developerModeDailyLimit})`);
                }
            }

            if (charCount > 0) {
                VR_Reader.sessionCharsRead += charCount;
                console.log(`📖 Auto-Read session chars: ${VR_Reader.sessionCharsRead}`);
            }

            const allowTelemetry = VR_Reader.savedLocalStorageGlobal?.['ALLOW_TELEMETRY'] !== false;

            if (allowTelemetry) {
                this.telemetryBatch.play_duration_seconds += actualDuration;
                this.telemetryBatch.character_count += charCount;
                this.telemetryBatch.sentenceCount += 1;

                if (this.telemetryBatch.sentenceCount >= 10) {
                    this.sessionManager.flushTelemetry();
                }
            }
        }

        const nextIndex = index + 1;

        const autoReadEnabled = VR_Reader.savedLocalStorageGlobal?.['DEFAULT_MAX_AUTO_READ_LIMIT_ENABLED'] === true;
        const autoReadLimit = VR_Reader.savedLocalStorageGlobal?.['DEFAULT_MAX_AUTO_READ_LIMIT'] || 4000;

        if (autoReadEnabled && VR_Reader.sessionCharsRead >= autoReadLimit) {
            console.log(`🛑 Auto-Read limit of ${autoReadLimit} characters reached. Pausing.`);

            this.currentPlayingIndex = nextIndex;
            this.externalAudioSpeaking = false;
            this.audioStatus = CONSTANTS.AUDIO_STATUS_TYPE.OFF;
            this.playbackIndex = 0;
            this.removeSpeechBeatsAnimation();

            if (VR_Reader.ttsWidget) VR_Reader.ttsWidget.changePlayingButtonStatus(false);

            this.playbackListSelectOption(nextIndex < this.replayQueue.length ? nextIndex : index);

            VR_Reader.makeRatingsOverlay({
                sessionId: this.sessionId,
                voice: (this.replayQueue[nextIndex]?.voice?.voice_gender || this.voice),
                replayQueue: this.replayQueue,
                index: nextIndex < this.replayQueue.length ? nextIndex : index,
                callback: null,
                hasOwnKey: this.currentClipHasOwnKey
            });
            return;
        }

        this.cleanObject(VR_Reader.pendingRequests);
        clearInterval(this.updateTimeInterval);
        this.externalAudioSpeaking = false;

        let utteranceText = this.cleanUtteranceText(this.replayQueue[index].text);
        this.removeSpeechBeatsAnimation();

        if (ignoreFirstQueue) this.queue.shift();

        this.currentAudioTime = 0;
        this.currentSentenceRealDurationSeconds = 0;
        this.currentSentenceStartTime = null;

        if (this.audioStatus === CONSTANTS.AUDIO_STATUS_TYPE.OFF) {
            console.log('⏹️ Manual stop detected in onEndedCallback; aborting auto-advance.');
            this.externalAudioSpeaking = false;
            this.removeSpeechBeatsAnimation();
            if (VR_Reader.ttsWidget) VR_Reader.ttsWidget.changePlayingButtonStatus(false);
            return;
        }

        if (nextIndex < this.replayQueue.length) {
            const nextClip = this.replayQueue[nextIndex];

            if (nextClip) {
                if (nextClip.status === "skipped") {
                    this.triggerDisableUI(nextIndex);
                    this.audioStatus = CONSTANTS.AUDIO_STATUS_TYPE.OFF;
                    this.playbackIndex = 0;
                    if (VR_Reader.ttsWidget) VR_Reader.ttsWidget.changePlayingButtonStatus(false);
                    this.currentPlayingIndex = this.replayQueue.length;

                    VR_Reader.makeRatingsOverlay({
                        sessionId: this.sessionId,
                        voice: (nextClip.voice?.voice_gender || this.voice),
                        replayQueue: this.replayQueue,
                        index: nextIndex,
                        callback: null,
                        hasOwnKey: this.currentClipHasOwnKey
                    });
                    return;
                }

                this.currentPlayingIndex = nextIndex;
                this.timerManager.recalculateTotalTime();

                await sleep(50);
                await this.playExternalAudio({ index: nextIndex }, false);
                this.playbackListSelectOption(nextIndex);
                return;
            }
        }

        this.currentPlayingIndex = this.replayQueue.length;
        this.timerManager.updateTimerDisplay("00:00", "00:00", "00:00", true);

        if (nextIndex >= this.replayQueue.length || !this.replayQueue[nextIndex]) {
            const lastClip = this.replayQueue[index];
            if (lastClip && lastClip.audioData) {
                this.audioStatus = CONSTANTS.AUDIO_STATUS_TYPE.OFF;
                this.playbackIndex = 0;
                if (VR_Reader.ttsWidget) VR_Reader.ttsWidget.changePlayingButtonStatus(false);

                VR_Reader.makeRatingsOverlay({
                    sessionId: this.sessionId,
                    voice: (lastClip.voice?.voice_gender || this.voice),
                    replayQueue: this.replayQueue,
                    index: index,
                    callback: null,
                    hasOwnKey: this.currentClipHasOwnKey
                });
                this.playbackListSelectOption(nextIndex);
                return;
            }
        }

        if (nextIndex < this.replayQueue.length) {
            const remainingClips = this.replayQueue.slice(nextIndex);
            const hasSkippedClips = remainingClips.some(clip => clip.status === "skipped");
            if (hasSkippedClips) {
                const firstSkippedClip = remainingClips.find(clip => clip.status === "skipped");
                this.triggerDisableUI(nextIndex);
                this.audioStatus = CONSTANTS.AUDIO_STATUS_TYPE.OFF;
                this.playbackIndex = 0;
                VR_Reader.makeRatingsOverlay({
                    voice: (firstSkippedClip?.voice?.voice_gender || this.voice),
                    replayQueue: this.replayQueue,
                    index: nextIndex,
                    callback: null,
                });
                return;
            }
        }

        let isLastSpeechInQueue = this.queue.length === 0;
        if (!isLastSpeechInQueue) {
            let nextSpeechUtteranceText = this.queue[0];
            const isAlreadyInReplayQueue = this.replayQueue.some(clip => clip.text === nextSpeechUtteranceText ||
                (typeof nextSpeechUtteranceText === "string" && this.cleanUtteranceText(clip.text).includes(this.cleanUtteranceText(nextSpeechUtteranceText)))
            );
            if (!isAlreadyInReplayQueue) {
                nextSpeechUtteranceText = this.queue.shift();
                if (this.playNextCallback) this.playNextCallback();
                this.playUtterance(nextSpeechUtteranceText, { pitch: 1, rate: this.defaultVoice.rate }, false);
            } else {
                this.queue = [];
                isLastSpeechInQueue = true;
            }
        }

        if (isLastSpeechInQueue) {
            this.removeSpeechBeatsAnimation();
            this.audioStatus = CONSTANTS.AUDIO_STATUS_TYPE.OFF;
            this.playbackIndex = 0;
            setTimeout(() => this.playSpeechEndAudio(true), 10);
        }

        if (isLastSpeechInQueue) {
            VR_Reader.ttsWidget.changePlayingButtonStatus(false);
            VR_Reader.readerStopTimestamp = Math.floor((new Date()).getTime());
            if (this.playCompleteCallback) this.playCompleteCallback();
        }
    }

    clearWordHighlights() {
        if (this.wordHighlighter) this.wordHighlighter.clearWordHighlights();
    }

    resetToDefaults() {
        if (this.sessionManager) this.sessionManager.resetToDefaults();
    }

    initializePlaySession() {
        if (this.sessionManager) this.sessionManager.initializePlaySession();
    }

    resetPlaybackState() {
        if (this.sessionManager) this.sessionManager.resetPlaybackState();
    }

    stopPlayingAudioInOffscreen() {
        if (this.audioEngine) this.audioEngine.stopPlayingAudioInOffscreen();
    }

    injectWordHighlightStyles(highlightMode) {
        if (this.wordHighlighter) this.wordHighlighter.injectWordHighlightStyles(highlightMode);
    }

    findAllTextNodesForUtterance(utteranceText) {
        if (this.wordHighlighter) return this.wordHighlighter.findAllTextNodesForUtterance(utteranceText);
        return [];
    }

    highlightWordsWithTiming(allTextNodes, wordTimestamps, utteranceText, sentenceIndex, highlightMode) {
        if (this.wordHighlighter) this.wordHighlighter.highlightWordsWithTiming(allTextNodes, wordTimestamps, utteranceText, sentenceIndex, highlightMode);
    }

    recalculateTotalTime() {
        if (this.timerManager) this.timerManager.recalculateTotalTime();
    }

    cleanUtteranceText(text) {
        if (!text) return "";
        return text.trim();
    }

    cleanObject(obj) {
        for (let key in obj) {
            if (typeof obj[key] === 'string' && obj[key].startsWith('onUpdatetime_')) {
                delete obj[key];
            }
        }
    }

    parseScoreString(text) {
        const scorePattern = /\[Score\s*=\s*(\d+)\s*\|\s*CategoryId\s*=\s*(\d+)\s*\|\s*CategoryName\s*=\s*([^\]]+)\]/i;
        const match = text.match(scorePattern);
        if (match) {
            return { score: parseInt(match[1], 10), category_id: parseInt(match[2], 10), category_name: match[3].trim() };
        }
        return null;
    }

    _updateReadLaterCache(index, saveToServer = false) {
        if (window.VR_Reader && window.VR_Reader.isTrackingReadLater && this.replayQueue && this.replayQueue.length > 0) {
            try {
                const currentIndex = index !== undefined ? index : (this.currentPlayingIndex >= 0 ? this.currentPlayingIndex : 0);
                const currentSentence = (this.replayQueue[currentIndex]?.text || "").trim();
                const textFragment = currentSentence ? `#:~:text=${encodeURIComponent(currentSentence)}` : "";

                let url = window.location.href;
                try {
                    const urlObj = new URL(url);
                    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid']
                        .forEach(p => urlObj.searchParams.delete(p));
                    url = urlObj.toString();
                } catch (e) { }

                const text_fragment_url = `${url}${textFragment}`;

                let total_chars = this.replayQueue.reduce((acc, curr) => acc + (curr.text?.length || 0), 0);
                let current_char_position = 0;
                for (let i = 0; i < currentIndex; i++) {
                    current_char_position += this.replayQueue[i]?.text?.length || 0;
                }
                if (current_char_position > total_chars && total_chars > 0) {
                    current_char_position = total_chars;
                }

                const percentage_remaining = total_chars > 0
                    ? Math.max(0, 100 - Math.round((current_char_position / total_chars) * 100))
                    : 0;

                chrome.runtime.sendMessage({
                    action: saveToServer ? "saveReadLater" : "updateReadLaterCache",
                    payload: {
                        url,
                        title: document.title,
                        text_fragment_url,
                        last_read_text: currentSentence.trim(),
                        total_chars,
                        current_char_position,
                        percentage_remaining
                    }
                });
            } catch (e) {
                console.warn("Failed to update Read Later cache:", e);
            }
        }
    }

    voiceChanged() {
        console.log("⚠️ Voice changed during playback. Stopping current session.");
        this.sessionManager.resetToDefaults();
        this.voiceChangedCallback?.();
    }
}
