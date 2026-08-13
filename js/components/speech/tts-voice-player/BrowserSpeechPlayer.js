import { fnBrowserDetect, debounce2 } from "../../../utils/helpers";
import { CONSTANTS } from "../../../constants/constants";

/**
 * ============================================================================
 * BrowserSpeechPlayer (Native TTS Fallback Engine)
 * ============================================================================
 * Handles text-to-speech fallback using the native `window.speechSynthesis` API
 * when external premium voices fail, or for users relying strictly on built-in OS voices.
 */
export default class BrowserSpeechPlayer {
    constructor(voicePlayer) {
        this.player = voicePlayer;

        this.voices = {};
        this.synthesis = window.speechSynthesis;
        this.sythInterval = "";
        this.voiceList = {};
        this.speechUtteranceList = [];
        this.currentUtterance = null;

        this.BROWSER_VOICE = {
            GOOGLE_CHROME: 'en-GB-Google UK English Female',
            MICROSOFT_EDGE: 'en-GB-Microsoft Ryan Online (Natural) - English (United Kingdom)',
            OTHERS: 'en-CA-Microsoft Richard - English (Canada)',
        };

        this.BROWSER_VOICE_RATE = {
            GOOGLE_CHROME: 1.1,
            MICROSOFT_EDGE: 1,
            OTHERS: 1,
        };

        this.defaultVoice = {
            name: 'en-CA-Microsoft Richard - English (Canada)',
            filler: ' ',
            rate: 1
        };
    }

    initializeVoiceQueue(voiceId) {
        if (!this.player.replayQueueVoiceStorage[voiceId]) {
            this.player.replayQueueVoiceStorage[voiceId] = [];
        }

        this.player.currentVoiceId = voiceId;
        this.player.currentVoiceSpeed = this.player.voicePrefs.activeVoiceSpeed;
        this.player.replayQueue = this.player.replayQueueVoiceStorage[voiceId];
    }

    voiceChanged() {
        const newVoiceId = this.player.voicePrefs.activeVoiceId;
        const newVoiceSpeed = this.player.voicePrefs.activeVoiceSpeed;
        const hasSpeedSupport = this.player.voicePrefs.hasVoiceSpeedSupport;

        const voiceIdChanged = this.player.currentVoiceId !== newVoiceId;
        const voiceSpeedChanged = hasSpeedSupport && this.player.currentVoiceSpeed !== newVoiceSpeed;

        if (!voiceIdChanged && !voiceSpeedChanged) {
            console.log(`Voice unchanged: ${newVoiceId} @ ${newVoiceSpeed}x`);
            return;
        }

        if (VR_Reader.ttsWidget && VR_Reader.ttsWidget.playbackClass) {
            VR_Reader.ttsWidget.playbackClass.enableAllOptions();
        }

        if (this.player.externalAudioSpeaking) {
            this.player.stopPlayingAudioInOffscreen();
        }

        this.player.externalAudioSpeaking = false;

        this.player.audioStatus = CONSTANTS.AUDIO_STATUS_TYPE.OFF;

        const previousVoiceId = this.player.currentVoiceId;
        const currentPlayingIndex = this.player.currentPlayingIndex;

        if (this.player.activeDownloads.size > 0) {
            if (!this.player.staleDownloads) this.player.staleDownloads = new Map();
            this.player.activeDownloads.forEach(idx => this.player.staleDownloads.set(idx, previousVoiceId));
        }
        this.player.activeDownloads.clear();
        this.player.preloadPromises.clear();
        this.player.completedDownloads.clear();

        if (!this.player.wordTimestampsStorage) this.player.wordTimestampsStorage = {};
        if (previousVoiceId && this.player.wordTimestamps.size > 0) {
            this.player.wordTimestampsStorage[previousVoiceId] = new Map(this.player.wordTimestamps);
        }
        this.player.wordTimestamps.clear();
        this.player.clearWordHighlights();

        if (voiceIdChanged) {
            if (this.player.replayQueueVoiceStorage[newVoiceId]) {
                this.player.currentVoiceId = newVoiceId;
                this.player.currentVoiceSpeed = newVoiceSpeed;
                this.player.replayQueue = this.player.replayQueueVoiceStorage[newVoiceId];

                if (this.player.wordTimestampsStorage[newVoiceId]) {
                    this.player.wordTimestamps = new Map(this.player.wordTimestampsStorage[newVoiceId]);
                }
            } else {
                this.player.replayQueueVoiceStorage[newVoiceId] = this.player.replayQueue.map(item => ({
                    ...item,
                    audioData: null,
                    fetching: false,
                    audioBlobURL: null,
                    status: null
                }));
                this.player.currentVoiceId = newVoiceId;
                this.player.currentVoiceSpeed = newVoiceSpeed;
                this.player.replayQueue = this.player.replayQueueVoiceStorage[newVoiceId];
            }
        } else if (voiceSpeedChanged) {
            this.player.replayQueue.forEach((item) => {
                delete item.audioData;
                item.fetching = false;
                item.audioBlobURL = null;
                item.status = null;
            });
            this.player.currentVoiceSpeed = newVoiceSpeed;
        }

        this.player.setPremiumVoice({
            ...this.player.voicePrefs.voiceSettings,
            voice_id: newVoiceId,
            voice_speed: newVoiceSpeed,
            voice_has_voice_speed_support: hasSpeedSupport,
        });

        if (currentPlayingIndex >= 0 && this.player.replayQueue.length > 0) {
            this.player.recalculateTotalTime();
        }

        if (currentPlayingIndex >= 0 && this.player.replayQueue[currentPlayingIndex]) {
            console.log(`Restarting playback from index ${currentPlayingIndex}`);

            if (this.player.replayQueue[currentPlayingIndex]) {
                delete this.player.replayQueue[currentPlayingIndex].audioData;
                this.player.replayQueue[currentPlayingIndex].fetching = false;
            }

            setTimeout(() => {
                this.player.playExternalAudio({ index: currentPlayingIndex }, false);
                this.player.playbackListSelectOption(currentPlayingIndex);
            }, 500);
        }

    }

    voiceActions() {
        let voice_name;
        let voice_lang;
        let voice_speed;
        voice_name = this.player.voicePrefs.defaultVoiceName;
        voice_lang = this.player.voicePrefs.defaultVoiceLanguageCode;
        voice_speed = this.player.voicePrefs.defaultVoiceSpeed;

        return {
            voice_name,
            voice_lang,
            voice_speed,
            browser: this.player.browser
        }
    }

    setSpeech() {
        return new Promise(
            function (resolve, reject) {
                let synth = window.speechSynthesis;
                let id;

                id = setInterval(() => {
                    if (synth.getVoices().length !== 0) {
                        resolve(synth.getVoices());
                        clearInterval(id);
                    }
                }, 10);
            }
        )
    }

    pause() {
        this.synthesis.pause();
    }

    resume() {
        this.synthesis.resume();
    }

    stop(manual = false, clearQueue = false, endSentence = false, selectChange = false) {
        if (this.player.playWatchdogTimeout) {
            clearTimeout(this.player.playWatchdogTimeout);
            this.player.playWatchdogTimeout = null;
        }

        if (selectChange) {
            this.player.stopPlayingAudioInOffscreen();
        } else if (manual && this.player.externalAudioSpeaking && this.player.currentPlayingIndex >= 0) {
            this.player.manualPauseWithRating();
        } else {
            this.player.stopPlayingAudioInOffscreen();
        }

        if (endSentence) {
            this.player.audioStatus = CONSTANTS.AUDIO_STATUS_TYPE.TRANSITION;

            this.player.transitionTimeout = setTimeout(() => {
                this.player.audioStatus = CONSTANTS.AUDIO_STATUS_TYPE.OFF;
            }, 2000);
        } else {
            this.player.audioStatus = CONSTANTS.AUDIO_STATUS_TYPE.OFF;
        }

        this.player.removeSpeechBeatsAnimation();



        console.log("CLEAR VOICE PLAYER", manual, clearQueue)
        if (clearQueue) {
            this.player.playbackListDeleteAllOptions()
        }

        this.synthesis.cancel();
        VR_Reader.readerStopTimestamp = Math.floor((new Date()).getTime());

        if (manual && clearQueue) {
            this.player.sentencePlayCompleteCounter = 0;
        }

        if (manual) {
            VR_Reader.ttsWidget.changePlayingButtonStatus(false)
        }

        if (manual) return false;

        this.player.queue = [];
        this.player.outputArray = [];
        this.player.output = "";
        this.player.lastElementIndex = null;
        this.player.lastOutput = "";
        this.player.lastOutput2 = "";
        this.player.lastOutputRepeated = 0;
        this.player.incomingIndex = 0;
        this.player.outputNextStartPos = 0;
        this.player.alreadyPlayedSpeechList = [];
        VR_Reader.currentlyPlayingFragment = "";
        this.player.playbackIndex = 0;
    }

    cleanUtteranceText(utteranceText) {
        utteranceText = utteranceText.trim();
        return utteranceText;
    }

    async playUtterance(utteranceTxt, { pitch = 1, rate = 1.00 } = {}, finalUtterance = false, ignoreFirstQueue = false) {
        clearTimeout(this.player.audioStatusOFFTimeout);

        if (!utteranceTxt) {
            console.warn("playUtterance: utteranceTxt is undefined or null");
            return false;
        }

        let index = null;
        let text = "";

        if (typeof utteranceTxt === "string") {
            text = utteranceTxt;
        } else {
            text = utteranceTxt.text;
            index = utteranceTxt.index;
        }

        if (index !== null) this.player.playbackListSelectOption(index);

        this.player.setPremiumVoice(this.player.voicePrefs.voiceSettings);

        this.player.playExternalAudio(utteranceTxt, ignoreFirstQueue);

        return false;
    }

    synthesisEventListeners(utterThis, txt, finalUtterance = false, ignoreFirstQueue = false) {
        console.log("hello world")
        let tooLongTalkTimeout;

        utterThis.addEventListener('error', (event) => {
            clearInterval(tooLongTalkTimeout);
            console.log(`An error has occurred with the speech synthesis: ${event.error}`);

            setTimeout(() => {
                setTimeout(() => {
                    this.synthesis.resume();
                }, 20)
            }, 20);
        });

        this.currentUtterance = utterThis;

        const boundEndHandler = (event) => {
            clearInterval(tooLongTalkTimeout);
            clearInterval(this.sythInterval);

            this.player.sentencePlayCompleteCounter++;

            let isLastSpeechInQueue = this.player.queue[0] === undefined;
            let utteranceText = this.cleanUtteranceText(event.utterance.text);

            if (utteranceText !== "") this.player.removeSpeechBeatsAnimation();
            if (ignoreFirstQueue) this.player.queue.shift();

            console.log("end event fired", { isLastSpeechInQueue, queueLength: this.player.queue.length });

            if (this.player.queue.length > 0) {
                let nextSpeechUtteranceText = this.player.queue.shift();
                this.synthesis.cancel();
                this.playUtterance(nextSpeechUtteranceText, { pitch: 1, rate: this.defaultVoice.rate }, false);
            }

            this.player.removeSpeechBeatsAnimation();

            if (isLastSpeechInQueue || this.player.replayQueue.length === 1) {
                setTimeout(() => this.player.playSpeechEndAudio(true), 10);
                this.player.audioStatusOFFTimeout = setTimeout(() => {
                    this.player.audioStatus = CONSTANTS.AUDIO_STATUS_TYPE.OFF;
                }, 2000);
            }

            utterThis.removeEventListener('end', boundEndHandler);
        };

        utterThis.addEventListener('end', boundEndHandler);

        utterThis.addEventListener('pause', (event) => {
        });

        utterThis.addEventListener('resume', (event) => {
        });

        utterThis.addEventListener('start', (event) => {
            this.player.audioStatus = CONSTANTS.AUDIO_STATUS_TYPE.PLAYING;

            let utteranceText = this.cleanUtteranceText(event.utterance.text)

            if (utteranceText !== "" && utteranceText !== ",") {
                this.player.playSpeechBeatsAnimation()
                let elementSaved = window.VR_Reader.savedHighlightedElements[utteranceText];

                if (elementSaved) { }
                else {
                    window.VR_Reader.savedHighlightedElements[utteranceText] = utteranceText
                }
                this.player.textHighlighter.createHighlights(utteranceText)
            }

            if (utteranceText !== undefined && utteranceText.trim() !== "" && this.player.browser === "chrome") {
                tooLongTalkTimeout = setInterval(() => {
                    this.synthesis.pause();
                    setTimeout(() => {
                        this.synthesis.resume();
                    }, 20)
                }, 12000);
            }
        });
    }

    async populateVoiceList() {
        if (typeof speechSynthesis === 'undefined') return;
        let voices = await this.setSpeech();

        voices.forEach((voice) => {
            this.voices[`${voice.lang}-${voice.name}`] = voice;
            this.voiceList[`${voice.lang}-${voice.name}`] = { voice_name: voice.name, voice_lang: voice.lang }
        })

        if (voices.find((voice) => `${voice.lang}-${voice.name}` === this.BROWSER_VOICE.MICROSOFT_EDGE)) {

            if (this.player.voicePrefs.defaultSpeakerId) { }
            else {
                this.player.voicePrefs.defaultSpeakerId = this.player.voicePrefs.defaultVoiceNameFallback || this.BROWSER_VOICE.MICROSOFT_EDGE;

                chrome.storage.local.set({ 'DEFAULT_VOICE_SPEAKER_ID': this.player.voicePrefs.defaultSpeakerId });

                chrome.runtime.sendMessage({
                    action: "update-contentscript-storage",
                    key: 'DEFAULT_VOICE_SPEAKER_ID',
                    value: this.player.voicePrefs.defaultSpeakerId
                });
            }

        } else if (voices.find((voice) => `${voice.lang}-${voice.name}` === this.BROWSER_VOICE.GOOGLE_CHROME)) {

            if (this.player.voicePrefs.defaultSpeakerId) { }
            else {
                this.player.voicePrefs.defaultSpeakerId = this.player.voicePrefs.defaultVoiceNameFallback || this.BROWSER_VOICE.GOOGLE_CHROME;

                chrome.storage.local.set({ 'DEFAULT_VOICE_SPEAKER_ID': this.player.voicePrefs.defaultSpeakerId });

                chrome.runtime.sendMessage({
                    action: "update-contentscript-storage",
                    key: 'DEFAULT_VOICE_SPEAKER_ID',
                    value: this.player.voicePrefs.defaultSpeakerId
                });
            }

        } else {
            console.log("test3")
            this.player.browser = "others";
            if (this.player.voicePrefs.defaultSpeakerId) { }
            else {
                this.player.voicePrefs.defaultSpeakerId = this.player.voicePrefs.defaultVoiceNameFallback || this.BROWSER_VOICE.OTHERS;
            }

        }
    }

    playbackListNewStartQueue(index) {
        this.synthesis.cancel();

        this.player.hideRatingOverlay();

        if (!this.player.replayQueue || this.player.replayQueue.length === 0) {
            console.warn("playbackListNewStartQueue: ReplayQueue is empty.");
            return;
        }

        if (index === undefined || index === null) index = 0;
        index = parseInt(index, 10);

        if (index >= this.player.replayQueue.length) {
            console.warn(`playbackListNewStartQueue: Index ${index} out of bounds (len: ${this.player.replayQueue.length})`);
            return;
        }

        let queueClone = [...this.player.replayQueue];
        queueClone = queueClone.slice(index);
        this.player.queue = [...queueClone];

        this.player.currentAudioTime = 0;
        this.player.currentSentenceStartTime = null;
        this.player.currentPlayingIndex = index;
        this.player.recalculateTotalTime();

        if (this.player.queue.length > 0) {
            this.playUtterance(this.player.queue.shift(), { pitch: 1, rate: this.defaultVoice.rate }, false);
        } else {
            console.warn("playbackListNewStartQueue: Queue empty after slice.");
        }
    }
}
