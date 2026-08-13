import { readLocalStorage } from "../../../utils/helpers";

/**
 * SessionManager
 * Manages the lifecycle of a TTS reading session, including resetting state,
 * generating session IDs, and flushing telemetry when reading finishes.
 */
export default class SessionManager {
    constructor(player) {
        this.player = player;
    }

    async _checkHasOwnKey(voiceService) {
        if (!voiceService) return false;

        try {
            let storage = await readLocalStorage(['SERVICE_TO_STORAGE_KEY_MAP']);
            let map = storage.SERVICE_TO_STORAGE_KEY_MAP || {};

            const storageKey = map[voiceService];
            if (storageKey) {
                const keyStorage = await readLocalStorage([storageKey]);
                const serviceKey = keyStorage[storageKey];

                if (serviceKey && serviceKey.trim()) {
                    return true;
                }
            }
        } catch (e) {
            console.error("Error checking own key status:", e);
        }
        return false;
    }

    initializePlaySession() {
        if (!this.player.sessionId) {
            this.player.sessionId = crypto.randomUUID();
            this.player.sessionStartTime = new Date().toISOString();
            this.player.sessionTotalDuration = 0;
            console.log(`📊 New play session initialized: ${this.player.sessionId}`);
        }
    }

    resetToDefaults() {
        console.log("🔄 Resetting ExternalVoicePlayer to defaults...");

        this.player.sessionId = null;
        this.player.sessionStartTime = null;
        this.player.sessionTotalDuration = 0;
        this.player.currentVoiceId = null;
        this.player.currentClipHasOwnKey = false;

        this.player.externalAudio = null;
        this.player.externalAudioSpeaking = false;
        this.player.currentAudioTime = 0;
        this.player.currentSentenceRealDurationSeconds = 0;

        if (this.player.updateTimeInterval) {
            clearInterval(this.player.updateTimeInterval);
            this.player.updateTimeInterval = null;
        }

        if (this.player.replayQueue) {
            this.player.replayQueue.forEach(sentence => {
                delete sentence.realDurationSeconds;
                delete sentence.initialEstimateSeconds;
            });
        }

        this.player.preloadQueue = [];
        this.player.voice = {};
        this.player.preloadPromises.clear();
        this.player.lastPlayedIndex = -1;

        this.player.generationMetrics = {
            recentSamples: [],
            avgTimePerChar: 50,
            sampleCount: 0
        };

        this.player.wordTimestamps.clear();
        this.player.wordHighlighter.clearWordHighlights();

        this.player.activeDownloads.clear();
        this.player.completedDownloads.clear();

        this.player.audioEngine.stopPlayingAudioInOffscreen();

        this.player.manuallyPaused = false;

        console.log("✅ ExternalVoicePlayer reset complete");
    }

    resetPlaybackState() {
        this.flushTelemetry();
        if (this.player.playWatchdogTimeout) {
            clearTimeout(this.player.playWatchdogTimeout);
            this.player.playWatchdogTimeout = null;
        }

        this.player.lastPlayedIndex = -1;
        this.player.preloadPromises.clear();
        this.player.activeDownloads.clear();
        console.log("Playback state has been reset.");
    }

    flushTelemetry() {
        if (this.player.telemetryBatch.sentenceCount === 0) return;

        const charCount = this.player.telemetryBatch.character_count;
        const duration = this.player.telemetryBatch.play_duration_seconds;

        this.player.telemetryBatch.character_count = 0;
        this.player.telemetryBatch.play_duration_seconds = 0;
        this.player.telemetryBatch.sentenceCount = 0;

        const currentClip = (this.player.replayQueue && this.player.currentPlayingIndex >= 0) ? this.player.replayQueue[this.player.currentPlayingIndex] : null;

        chrome.runtime.sendMessage({
            action: "recordPlayEvent",
            payload: {
                voice_id: this.player.currentVoiceId || currentClip?.voice?.voice_id || this.player.voice?.voice_id,
                session_id: this.player.sessionId,
                play_duration_seconds: duration,
                platform: 'chrome_extension',
                url_full: window.location.href,
                play_started_at: this.player.sessionStartTime,
                play_finished_at: new Date().toISOString(),
                character_count: charCount,
                has_own_key: this.player.currentClipHasOwnKey
            }
        }).catch(err => console.error("Telemetry flush failed:", err));
    }
}
