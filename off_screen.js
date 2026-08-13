// offscreen.js

// --- MESSAGE CONSTANTS ---
const MSG_UPDATE_INTERVAL = 'update-interval-speed'; // Sent by background to throttle/unthrottle worker
const MSG_PLAY_AUDIO = 'play-audio';                 // Sent by content script to start playing an audio blob
const MSG_PAUSE_AUDIO = 'pause-audio';               // Sent by content script to pause current audio
const MSG_RESUME_AUDIO = 'resume-audio';             // Sent by content script to resume paused audio
const MSG_STOP_AUDIO = 'stop-audio';                 // Sent by content script to stop audio completely
const MSG_LOAD_METADATA = 'load-audio-metadata';     // Sent by content script to preload audio metadata
const MSG_CHECK_PLAYING = 'check-audio-playing';     // Sent by content script to verify if audio is actually playing
const EVENT_TIME_UPDATE = 'timeupdate-audio-eventhandler'; // Sent to content script when audio time updates
const EVENT_LOADED_METADATA = 'loadedmetadata-audio-eventhandler'; // Sent to content script when metadata loads
const EVENT_PLAY_START = 'play-audio-eventhandler';  // Sent to content script when playback begins
const EVENT_PLAY_END = 'play-audio-eventhandler2';   // Sent to content script when playback finishes
const EVENT_PLAY_ERROR = 'play-audio-error-eventhandler'; // Sent to content script when playback fails
const EVENT_CHECK_PLAYING = 'check-audio-playing-eventhandler'; // Sent to content script with audio status result

const RATE_ACTIVE = 50;
const RATE_BACKGROUND = 250;

class OffscreenAudioController {
    constructor() {
        this.externalAudio = null;
        this.pendingStopTimeout = null;
        this.currentUpdateRate = RATE_ACTIVE;
        this.currentPlayState = null;
        this.timerWorker = this.createTimerWorker();

        // Initialize audio elements on load
        document.addEventListener('DOMContentLoaded', () => {
            this.externalAudio = document.getElementById("audio");
        });
        
        this.setupMessageHandlers();
    }

    createTimerWorker() {
        const workerCode = `
            let timer = null;
            self.onmessage = function(e) {
                if (e.data.action === 'start') {
                    if (timer) clearInterval(timer);
                    timer = setInterval(() => {
                        self.postMessage('tick');
                    }, e.data.interval);
                } else if (e.data.action === 'stop') {
                    if (timer) clearInterval(timer);
                    timer = null;
                } else if (e.data.action === 'update-interval') {
                    if (timer) {
                        clearInterval(timer);
                        timer = setInterval(() => {
                            self.postMessage('tick');
                        }, e.data.interval);
                    }
                }
            };
        `;
        const blob = new Blob([workerCode], { type: "application/javascript" });
        const worker = new Worker(URL.createObjectURL(blob));
        
        worker.onmessage = (e) => {
            if (e.data === 'tick') {
                this.handleTimerTick();
            }
        };
        return worker;
    }

    getAudioElement() {
        if (!this.externalAudio) {
            this.externalAudio = document.getElementById("audio");
        }
        return this.externalAudio;
    }

    handleTimerTick() {
        if (!this.currentPlayState) {
            this.stopProgressTimer();
            return;
        }

        const audio = this.getAudioElement();
        
        if (!audio || audio.paused || audio.ended) {
            this.stopProgressTimer();
            return;
        }

        chrome.runtime.sendMessage({
            action: EVENT_TIME_UPDATE,
            callbackID: this.currentPlayState.onTimeUpdateCallbackID,
            tabId: this.currentPlayState.tabId,
            data: {
                deleteFromQueue: false,
                currentTime: audio.currentTime,
                duration: audio.duration,
                index: this.currentPlayState.index,
                ignoreFirstQueue: this.currentPlayState.ignoreFirstQueue,
                timestamp: performance.now()
            }
        });
    }

    startProgressTimer() {
        if (this.timerWorker) {
            this.timerWorker.postMessage({ 
                action: 'start', 
                interval: this.currentUpdateRate 
            });
        }
    }

    stopProgressTimer() {
        if (this.timerWorker) {
            this.timerWorker.postMessage({ action: 'stop' });
        }
    }

    handleUpdateInterval(message) {
        const newRate = message.isFocused ? RATE_ACTIVE : RATE_BACKGROUND;

        if (this.currentUpdateRate !== newRate) {
            this.currentUpdateRate = newRate;
            console.log(`⚙️ Switched interval rate to: ${newRate}ms (${message.isFocused ? 'Focused' : 'Background'})`);

            if (this.timerWorker && this.currentPlayState) {
                this.timerWorker.postMessage({ 
                    action: 'update-interval', 
                    interval: this.currentUpdateRate 
                });
            }
        }
    }

    pauseAudio() {
        const audio = this.getAudioElement();
        if (audio && !audio.paused) {
            audio.pause();
            this.stopProgressTimer();
        }
    }

    resumeAudio() {
        const audio = this.getAudioElement();
        if (audio && audio.paused && audio.src) {
            audio.play().catch(e => console.error("Resume failed", e));
            this.startProgressTimer();
        }
    }

    stopAudio() {
        if (this.pendingStopTimeout) clearTimeout(this.pendingStopTimeout);

        this.pendingStopTimeout = setTimeout(() => {
            const audio = this.getAudioElement();
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
            this.pendingStopTimeout = null;
            
            this.stopProgressTimer();
            this.currentPlayState = null;
        }, 250);
    }

    loadAudioMetadata({ audioBlobURL, index, onLoadedMetadataCallbackID, tabId }) {
        const audio = this.getAudioElement();
        audio.onloadedmetadata = null;
        audio.onplay = null;
        audio.onended = null;
        audio.src = audioBlobURL;
        audio.preload = "metadata";

        if (onLoadedMetadataCallbackID) {
            audio.onloadedmetadata = () => {
                chrome.runtime.sendMessage({
                    action: EVENT_LOADED_METADATA,
                    callbackID: onLoadedMetadataCallbackID,
                    tabId,
                    data: { duration: audio.duration, index }
                });
            };
        }
        audio.load();
    }

    playAudio({ audioBlobURL, index, ignoreFirstQueue, onPlayCallbackID, onEndedCallbackID, onTimeUpdateCallbackID, onLoadedMetadataCallbackID, onErrorCallbackID, tabId }) {
        if (this.pendingStopTimeout) {
            clearTimeout(this.pendingStopTimeout);
            this.pendingStopTimeout = null;
        }

        this.currentPlayState = {
            audioBlobURL, index, ignoreFirstQueue, 
            onPlayCallbackID, onEndedCallbackID, onTimeUpdateCallbackID, tabId
        };

        const audio = this.getAudioElement();

        this.stopProgressTimer();
        audio.onloadedmetadata = null;
        audio.onplay = null;
        audio.onended = null;

        audio.src = audioBlobURL;

        if (onLoadedMetadataCallbackID) {
            audio.onloadedmetadata = () => {
                chrome.runtime.sendMessage({
                    action: EVENT_LOADED_METADATA,
                    callbackID: onLoadedMetadataCallbackID,
                    tabId,
                    data: { duration: audio.duration, index }
                });
            };
        }

        if (onPlayCallbackID) {
            audio.onplay = () => {
                chrome.runtime.sendMessage({
                    action: EVENT_PLAY_START,
                    tabId,
                    callbackID: onPlayCallbackID,
                    data: { index, ignoreFirstQueue }
                });
                this.startProgressTimer();
            };

            audio.onended = () => {
                this.stopProgressTimer();
                chrome.runtime.sendMessage({
                    action: EVENT_PLAY_END,
                    tabId,
                    callbackID: onEndedCallbackID,
                    data: { index, ignoreFirstQueue }
                });
            };
        }

        audio.play().catch(e => {
            // Ignore AbortError: this happens when a play() promise is interrupted by a new track loading or a pause command
            if (e.name !== 'AbortError') {
                console.error("Playback failed:", e);
                if (onErrorCallbackID) {
                    chrome.runtime.sendMessage({
                        action: EVENT_PLAY_ERROR,
                        tabId,
                        callbackID: onErrorCallbackID,
                        data: { index, error: e.message }
                    });
                }
            }
        });
    }

    checkAudioState({ callbackID, tabId, index }) {
        const audio = this.getAudioElement();
        const isPlaying = !!(audio && !audio.paused && !audio.ended && audio.currentTime > 0);
        if (callbackID) {
            chrome.runtime.sendMessage({
                action: EVENT_CHECK_PLAYING,
                tabId,
                callbackID,
                data: { isPlaying, index }
            });
        }
    }

    setupMessageHandlers() {
        const MESSAGE_HANDLERS = {
            [MSG_UPDATE_INTERVAL]: (msg) => this.handleUpdateInterval(msg),
            [MSG_PLAY_AUDIO]: (msg) => { if ('data' in msg) this.playAudio(msg.data); },
            [MSG_PAUSE_AUDIO]: () => this.pauseAudio(),
            [MSG_RESUME_AUDIO]: () => this.resumeAudio(),
            [MSG_STOP_AUDIO]: () => this.stopAudio(),
            [MSG_LOAD_METADATA]: (msg) => { if ('data' in msg) this.loadAudioMetadata(msg.data); },
            [MSG_CHECK_PLAYING]: (msg) => { if ('data' in msg) this.checkAudioState(msg.data); }
        };

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            const messageType = message.action || message.type;
            const handler = MESSAGE_HANDLERS[messageType];
            
            if (handler) {
                handler(message);
            }
        });
    }
}

// Initialize the controller
const audioController = new OffscreenAudioController();