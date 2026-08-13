import { formatTimeMMSS } from '../../../utils/readEstimateCalculator';

/**
 * TimerManager
 * Calculates estimated and actual reading times to update the UI progress bars.
 * Considers words-per-minute (WPM) and current audio timings.
 */
export default class TimerManager {
    constructor(player) {
        this.player = player;
    }

    getTimeData() {
        if (!this.player.replayQueue || this.player.replayQueue.length === 0) {
            return { elapsedFormatted: "00:00", formattedTime: "00:00", totalFormatted: "00:00", totalChars: 0, remainingChars: 0 };
        }

        try {
            const wordsPerMinute = VR_Reader.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_WORDS_PER_MINUTE'];
            const speed = VR_Reader.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_SPEED'];
            const normalizedSpeed = Math.max(0.5, Math.min(2, speed || 1));
            const baseWPM = wordsPerMinute && wordsPerMinute > 0 ? wordsPerMinute : 150;
            const adjustedWPM = baseWPM * normalizedSpeed;
            const ESTIMATE_PADDING_MULTIPLIER = 1.10;

            let completedSeconds = 0;
            let completedChars = 0;
            const maxCompletedIndex = Math.min(Math.max(0, this.player.currentPlayingIndex), this.player.replayQueue.length);
            for (let i = 0; i < maxCompletedIndex; i++) {
                const sentence = this.player.replayQueue[i];
                if (!sentence?.text) continue;

                completedChars += sentence.text.length;

                if (sentence.realDurationSeconds && sentence.realDurationSeconds > 0) {
                    completedSeconds += sentence.realDurationSeconds;
                } else if (sentence.initialEstimateSeconds && sentence.initialEstimateSeconds > 0) {
                    completedSeconds += sentence.initialEstimateSeconds;
                } else {
                    const words = sentence.text.trim().split(/\s+/).filter(w => w.length > 0).length;
                    const estimateSeconds = ((words / adjustedWPM) * 60) * ESTIMATE_PADDING_MULTIPLIER;
                    sentence.initialEstimateSeconds = estimateSeconds;
                    completedSeconds += estimateSeconds;
                }
            }

            let currentSentenceTotalDuration = 0;
            if (this.player.currentPlayingIndex >= 0 && this.player.currentPlayingIndex < this.player.replayQueue.length) {
                const currentSentence = this.player.replayQueue[this.player.currentPlayingIndex];
                if (currentSentence?.text) {
                    if (currentSentence.realDurationSeconds && currentSentence.realDurationSeconds > 0) {
                        currentSentenceTotalDuration = currentSentence.realDurationSeconds;
                    } else if (this.player.currentSentenceRealDurationSeconds > 0) {
                        currentSentenceTotalDuration = this.player.currentSentenceRealDurationSeconds;
                    } else {
                        const words = currentSentence.text.trim().split(/\s+/).filter(w => w.length > 0).length;
                        currentSentenceTotalDuration = ((words / adjustedWPM) * 60) * ESTIMATE_PADDING_MULTIPLIER;
                    }
                }
            }

            let futureSeconds = 0;
            let futureChars = 0;
            for (let i = this.player.currentPlayingIndex + 1; i < this.player.replayQueue.length; i++) {
                const sentence = this.player.replayQueue[i];
                if (!sentence?.text) continue;

                futureChars += sentence.text.length;

                if (sentence.realDurationSeconds && sentence.realDurationSeconds > 0) {
                    futureSeconds += sentence.realDurationSeconds;
                } else if (sentence.initialEstimateSeconds && sentence.initialEstimateSeconds > 0) {
                    futureSeconds += sentence.initialEstimateSeconds;
                } else {
                    const words = sentence.text.trim().split(/\s+/).filter(w => w.length > 0).length;
                    const estimateSeconds = ((words / adjustedWPM) * 60) * ESTIMATE_PADDING_MULTIPLIER;
                    sentence.initialEstimateSeconds = estimateSeconds;
                    futureSeconds += estimateSeconds;
                }
            }

            const totalSeconds = completedSeconds + currentSentenceTotalDuration + futureSeconds;
            const elapsedSeconds = completedSeconds + (this.player.currentAudioTime / 1000);
            const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

            const totalRounded = Math.ceil(totalSeconds);
            const elapsedRounded = Math.ceil(elapsedSeconds);
            const remainingRounded = Math.ceil(remainingSeconds);

            const currentCharCount = (this.player.currentPlayingIndex >= 0 && this.player.currentPlayingIndex < this.player.replayQueue.length && this.player.replayQueue[this.player.currentPlayingIndex]?.text)
                ? this.player.replayQueue[this.player.currentPlayingIndex].text.length : 0;

            const totalChars = completedChars + currentCharCount + futureChars;
            const remainingChars = currentCharCount + futureChars;

            return {
                elapsedSeconds: elapsedRounded,
                elapsedFormatted: formatTimeMMSS(elapsedRounded),
                remainingSeconds: remainingRounded,
                formattedTime: formatTimeMMSS(remainingRounded),
                totalSeconds: totalRounded,
                totalFormatted: formatTimeMMSS(totalRounded),
                totalChars,
                remainingChars
            };
        } catch (e) {
            console.error('Timer calculation error:', e);
            return { elapsedFormatted: "00:00", formattedTime: "00:00", totalFormatted: "00:00", totalChars: 0, remainingChars: 0 };
        }
    }

    updateLiveTimer() {
        const data = this.getTimeData();
        this.player.lastKnownTotalTime = data.totalSeconds;
        this.player.lastKnownElapsedTime = data.elapsedSeconds;
        this.player.lastKnownRemainingTime = data.remainingSeconds;
        this.updateTimerDisplay(data.elapsedFormatted, data.formattedTime, data.totalFormatted, false, data.totalChars, data.remainingChars);
    }

    recalculateTotalTime() {
        this.updateLiveTimer();
    }

    updateTimerDisplay(elapsed, remaining, total, force, totalChars = null, remainingChars = null) {
        if (totalChars === null || remainingChars === null) {
            const data = this.getTimeData();
            if (totalChars === null) totalChars = data.totalChars || 0;
            if (remainingChars === null) remainingChars = data.remainingChars || 0;
        }

        if (VR_Reader.ttsWidget && VR_Reader.ttsWidget.updateTimerDisplay) {
            console.log("⏰ updateTimerDisplay:", { elapsed, remaining, total, force, totalChars, remainingChars });
            VR_Reader.ttsWidget.updateTimerDisplay(elapsed, remaining, total, force);
            if (VR_Reader.ttsWidget.playbackClass && VR_Reader.ttsWidget.playbackClass.updateCharDisplay) {
                const sessionChars = VR_Reader.sessionCharsRead || 0;
                VR_Reader.ttsWidget.playbackClass.updateCharDisplay(sessionChars, remainingChars, totalChars);
            }
        }
    }

    onUpdatetimeCallback(index, duration, currentTime, callbackID) {
        if (!duration || isNaN(duration) || isNaN(currentTime)) {
            console.warn('⚠️ Invalid time data:', { duration, currentTime });
            return false;
        }

        if (index !== this.player.currentPlayingIndex) {
            console.warn(`⚠️ Time update for index ${index} but currently playing ${this.player.currentPlayingIndex}`);
            return false;
        }

        // If audio is actively playing, clear watchdog and ensure playback state is marked active
        if (currentTime > 0) {
            if (this.player.playWatchdogTimeout) {
                clearTimeout(this.player.playWatchdogTimeout);
                this.player.playWatchdogTimeout = null;
            }
            if (this.player.currentSentenceStartTime === null) {
                this.player.handleOnPlay(index);
            }
        }

        const newTime = currentTime * 1000;

        if (newTime >= this.player.currentAudioTime) {
            this.player.currentAudioTime = newTime;
        } else {
            console.warn(`⚠️ Skipping backwards time jump: ${this.player.currentAudioTime.toFixed(0)}ms → ${newTime.toFixed(0)}ms`);
        }

        if (duration > 0) {
            this.player.currentSentenceRealDurationSeconds = duration;

            if (this.player.replayQueue[index]) {
                const sentence = this.player.replayQueue[index];
                if (!sentence.realDurationSeconds) {
                    sentence.realDurationSeconds = duration;
                    console.log(`⏱️ Stored real duration for sentence ${index}: ${duration.toFixed(2)}s`);
                }
            }
        }

        this.player.lastTimeUpdateTimestamp = performance.now();

        const futureDate = new Date();
        if (this.player.queue.length === 0) return false;

        return true;
    }
}
