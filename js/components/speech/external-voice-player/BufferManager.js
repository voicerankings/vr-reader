import { sleep } from "../../../utils/helpers";

/**
 * BufferManager
 * Intelligently manages the preloading of TTS audio chunks ahead of the current
 * playback position. Adapts buffer size based on the TTS provider's speed.
 */
export default class BufferManager {
    constructor(player) {
        this.player = player;
    }

    isSlowProvider() {
        const serviceName = this.player.voice?.voice_service;
        if (!serviceName) {
            console.log('⚠️ No voice service defined yet, defaulting to fast provider');
            return false;
        }
        return this.player.SLOW_PROVIDERS.includes(serviceName);
    }

    getInitialBufferSize() {
        return this.isSlowProvider() ? this.player.SLOW_PROVIDER_INITIAL_BUFFER : 2;
    }

    getMinBufferSize() {
        return this.isSlowProvider() ? this.player.SLOW_PROVIDER_MIN_BUFFER : this.player.MIN_BUFFER_SIZE;
    }

    cleanupForJump(fromIndex, toIndex) {
        console.log(`🧹 Cleaning up for jump: ${fromIndex} → ${toIndex}`);
        for (let i = fromIndex + 1; i < toIndex; i++) {
            if (this.player.activeDownloads.has(i)) {
                console.log(`  ❌ Cancelling download for skipped index ${i}`);
                this.player.activeDownloads.delete(i);
                this.player.preloadPromises.delete(i);
            }
        }
        console.log(`✅ Jump cleanup complete`);
    }

    updateGenerationMetrics(generationTime, textLength) {
        if (!textLength || textLength === 0 || !generationTime || generationTime <= 0) {
            console.log('Skipping metrics update: invalid data');
            return;
        }

        const timePerChar = generationTime / textLength;
        const metrics = this.player.generationMetrics;

        if (timePerChar < 1 || timePerChar > 1000) {
            console.log(`Ignoring outlier: ${timePerChar}ms/char`);
            return;
        }

        metrics.recentSamples.push(timePerChar);
        if (metrics.recentSamples.length > 10) {
            metrics.recentSamples.shift();
        }

        const total = metrics.recentSamples.reduce((sum, val) => sum + val, 0);
        metrics.avgTimePerChar = total / metrics.recentSamples.length;
        metrics.sampleCount = metrics.recentSamples.length;

        console.log(`✓ Updated generation metrics: ${(metrics.avgTimePerChar).toFixed(2)}ms/char (${metrics.sampleCount} samples)`);
    }

    calculateRequiredBuffer(currentIndex) {
        const minBuffer = this.getMinBufferSize();
        const lookAheadLimit = 10;
        const startIndex = currentIndex + 1;
        const endIndex = Math.min(startIndex + lookAheadLimit, this.player.replayQueue.length);

        let clipsNeedingGeneration = 0;
        let totalEstimatedPlaybackTime = 0;
        let totalEstimatedGenerationTime = 0;

        console.log(`\n📊 Calculating buffer from index ${currentIndex} (slow provider: ${this.isSlowProvider()}):`);

        for (let i = startIndex; i < endIndex; i++) {
            const clip = this.player.replayQueue[i];

            if (!clip || clip.status === 'skipped') {
                console.log(`  ⛔ Stopping at index ${i} (${!clip ? 'no clip' : 'skipped'})`);
                break;
            }

            if (!clip.audioData && !this.player.preloadPromises.has(i) && !this.player.activeDownloads.has(i) && !this.player.completedDownloads.has(i)) {
                clipsNeedingGeneration++;

                const textLength = clip.text?.length || 0;
                if (textLength === 0) continue;

                const playbackTime = textLength / this.player.READING_SPEED_CHARS_PER_SEC;
                totalEstimatedPlaybackTime += playbackTime;

                const generationTime = (textLength * this.player.generationMetrics.avgTimePerChar) / 1000;
                totalEstimatedGenerationTime += generationTime;

                console.log(`  📝 Index ${i}: ${textLength} chars, ~${playbackTime.toFixed(1)}s playback, ~${generationTime.toFixed(1)}s generation`);
            }
        }

        if (clipsNeedingGeneration === 0) {
            console.log(`  ✓ No clips need buffering`);
            return minBuffer;
        }

        const effectiveGenerationTime = totalEstimatedGenerationTime / this.player.MAX_CONCURRENT_GENERATIONS;

        console.log(`  📈 Total: ${clipsNeedingGeneration} clips, ${totalEstimatedPlaybackTime.toFixed(1)}s playback, ${effectiveGenerationTime.toFixed(1)}s effective generation`);

        if (totalEstimatedPlaybackTime < effectiveGenerationTime) {
            const bufferNeeded = Math.ceil(clipsNeedingGeneration * 1.5);
            const result = Math.max(minBuffer, Math.min(this.player.MAX_BUFFER_SIZE, bufferNeeded));
            console.log(`  ⚠️  Buffer needed: ${result} (playback too short)`);
            return result;
        } else {
            const result = Math.max(minBuffer, Math.min(this.player.MAX_BUFFER_SIZE, clipsNeedingGeneration));
            console.log(`  ✓ Buffer adequate: ${result}`);
            return result;
        }
    }

    maintainIntelligentBuffer(currentPlayingIndex) {
        const dynamicBufferSize = this.calculateRequiredBuffer(currentPlayingIndex);
        console.log(`\n🎯 Dynamic buffer target: ${dynamicBufferSize} clips ahead of index ${currentPlayingIndex}`);

        const startIndex = currentPlayingIndex + 1;
        const endIndex = Math.min(startIndex + dynamicBufferSize, this.player.replayQueue.length);

        let currentlyGenerating = 0;
        for (let i = startIndex; i < endIndex; i++) {
            if (this.player.activeDownloads.has(i)) {
                currentlyGenerating++;
            }
        }

        console.log(`  📡 Currently generating: ${currentlyGenerating}/${this.player.MAX_CONCURRENT_GENERATIONS}`);

        for (let i = startIndex; i < endIndex && currentlyGenerating < this.player.MAX_CONCURRENT_GENERATIONS; i++) {
            const clip = this.player.replayQueue[i];

            if (!clip) {
                console.log(`  ⛔ No clip at index ${i}, stopping buffer`);
                break;
            }

            if (clip.status === 'skipped') {
                console.log(`  ⛔ Skipped clip at index ${i}, stopping buffer`);
                break;
            }

            if (!clip.audioData && !this.player.activeDownloads.has(i) && !this.player.completedDownloads.has(i) && !clip.fetching) {
                console.log(`  🔄 Starting generation for index ${i} (${currentlyGenerating + 1}/${this.player.MAX_CONCURRENT_GENERATIONS})`);
                this.preloadExternalTTS(i);
                currentlyGenerating++;
            } else if (clip.audioData || this.player.completedDownloads.has(i)) {
                console.log(`  ✓ Index ${i} already has audio`);
            } else if (this.player.activeDownloads.has(i) || clip.fetching) {
                console.log(`  ⏳ Index ${i} already loading`);
            }
        }
    }

    maintainRollingBuffer(currentPlayingIndex) {
        const nextIndex = currentPlayingIndex + 1;
        const bufferIndices = [nextIndex, nextIndex + 1, nextIndex + 2];

        console.log(`Maintaining buffer for playing index ${currentPlayingIndex}`);

        bufferIndices.forEach(indexToPreload => {
            const clip = this.player.replayQueue[indexToPreload];
            if (clip && !clip.audioData && !this.player.preloadPromises.has(indexToPreload)) {
                console.log(`Buffering index: ${indexToPreload}`);
                this.preloadExternalTTS(indexToPreload);
            }
        });
    }

    preloadMultipleAudio(startIndex) {
        console.log(`Preloading buffer from index: ${startIndex}`);
        const preloadCount = Math.min(2, this.player.replayQueue.length - startIndex);

        for (let i = 0; i < preloadCount; i++) {
            const indexToPreload = startIndex + i;
            const clip = this.player.replayQueue[indexToPreload];

            if (clip && !clip.audioData && !this.player.preloadPromises.has(indexToPreload)) {
                console.log(`Background preloading index: ${indexToPreload}`);
                this.preloadExternalTTS(indexToPreload);
            }
        }
    }

    async preloadExternalTTS(index, attemptNumber = 0) {
        const clip = this.player.replayQueue[index];

        if (!clip) {
            console.warn(`❌ No clip at index ${index}`);
            return Promise.resolve();
        }

        if (this.player.completedDownloads.has(index)) {
            console.log(`✓ Index ${index} already completed successfully, skipping`);
            return Promise.resolve();
        }

        if (this.player.activeDownloads.has(index)) {
            console.log(`⏳ Index ${index} already downloading, waiting for existing promise`);
            const existingPromise = this.player.preloadPromises.get(index);
            return existingPromise || Promise.resolve();
        }

        if (clip.audioData) {
            console.log(`✓ Index ${index} already has audio, marking as completed`);
            this.player.completedDownloads.add(index);
            return Promise.resolve();
        }

        const cleanedText = clip.text;
        if (!cleanedText) {
            console.warn(`❌ Empty text for index ${index}`);
            clip.audioData = null;
            return Promise.resolve();
        }

        this.player.activeDownloads.add(index);
        delete clip.audioData;
        clip.fetching = true;

        const requestID = `${index}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const callbackID = `preload_external_tts_${requestID}`;
        const requestVoiceId = this.player.currentVoiceId;

        console.log(`🚀 Starting preload for index ${index} (attempt ${attemptNumber + 1}) with voice ${requestVoiceId}`);

        const preloadPromise = new Promise((resolve) => {
            VR_Reader.saveRequest(callbackID, (response) => {
                const currentClip = this.player.replayQueue[response.index];

                if (requestVoiceId !== this.player.currentVoiceId) {
                    console.warn(`🚫 Voice changed during download (${requestVoiceId} → ${this.player.currentVoiceId}), discarding index ${response.index}`);

                    if (!this.player.staleDownloads) {
                        this.player.staleDownloads = new Map();
                    }
                    this.player.staleDownloads.set(response.index, requestVoiceId);

                    this.player.activeDownloads.delete(response.index);
                    this.player.preloadPromises.delete(response.index);
                    this.player.completedDownloads.delete(response.index);

                    if (currentClip) {
                        delete currentClip.audioData;
                        currentClip.fetching = false;
                    }

                    resolve();
                    return;
                }

                if (this.player.staleDownloads && this.player.staleDownloads.has(response.index)) {
                    const staleVoiceId = this.player.staleDownloads.get(response.index);
                    if (staleVoiceId === requestVoiceId) {
                        console.warn(`🚫 IGNORING stale download for index ${response.index} (was for voice ${requestVoiceId}, now using ${this.player.currentVoiceId})`);
                        this.player.staleDownloads.delete(response.index);

                        this.player.activeDownloads.delete(response.index);
                        this.player.preloadPromises.delete(response.index);

                        resolve();
                        return;
                    }
                }

                this.player.activeDownloads.delete(response.index);
                this.player.preloadPromises.delete(response.index);

                if (!currentClip) {
                    console.warn(`❌ Clip missing for response index ${response.index}`);
                    resolve();
                    return;
                }

                if (response.requestID !== requestID) {
                    console.warn(`⚠️  RequestID mismatch for index ${response.index}`);
                    resolve();
                    return;
                }

                currentClip.fetching = false;

                if (response.status === 'no_credits') {
                    console.log(`🚫 No credits for index ${response.index}`);
                    currentClip.audioData = null;
                    currentClip.accountStatus = response.accountStatus;
                    currentClip.status = response.status;
                    currentClip.generation_wait_time_minutes = response.generation_wait_time_minutes;
                    this.player.handleNoCreditsResponse(response);
                    resolve();
                    return;
                }

                if (requestVoiceId !== this.player.currentVoiceId) {
                    console.warn(`🚫 Voice changed RIGHT BEFORE storing data for index ${response.index}, discarding`);
                    delete currentClip.audioData;
                    this.player.completedDownloads.delete(response.index);
                    resolve();
                    return;
                }

                currentClip.audioData = response.audioData || null;
                currentClip.accountStatus = response.accountStatus || null;
                currentClip.status = response.status || null;
                currentClip.errorMessage = response.message || null;

                if (response.audioData && requestVoiceId) {
                    currentClip.generatedWithVoiceId = requestVoiceId;
                }

                if (response.audioData) {
                    this.player.completedDownloads.add(response.index);
                    console.log(`✅ Preload SUCCESS for index ${response.index} with voice ${requestVoiceId} - marked as completed`);
                } else {
                    console.log(`❌ Preload FAILED for index ${response.index}: ${response.status}`);
                }

                if (response.wordTimestamps && Array.isArray(response.wordTimestamps)) {
                    console.log(`Received ${response.wordTimestamps.length} word timestamps for index ${response.index}`);
                    this.player.wordHighlighter.parseWordTimestamps(response.wordTimestamps, response.index);
                }

                // Audio for an upcoming sentence is ready; pre-create its highlight
                // marks and word spans while the current sentence is still playing.
                if (response.audioData && this.player.currentPlayingIndex !== undefined) {
                    this.player.preloadUpcomingHighlights(this.player.currentPlayingIndex);
                }

                if (response.status === 'success' && response.generationTime && response.textLength) {
                    this.updateGenerationMetrics(response.generationTime, response.textLength);
                }

                if (response.audioData && this.player.currentPlayingIndex !== undefined) {
                    this.maintainIntelligentBuffer(this.player.currentPlayingIndex);
                }

                resolve();
            });
        });

        this.player.preloadPromises.set(index, preloadPromise);

        chrome.runtime.sendMessage({
            action: "getAudioDataFromExternalTTS",
            callbackID,
            tabId: VR_Reader.currentTabId,
            payload: {
                serviceName: clip.voice?.voice_service || this.player.voice.voice_service,
                serviceOptions: {
                    gender: clip.voice?.voice_gender || this.player.voice.voice_gender,
                    speaker_id: clip.voice?.voice_speaker_id || this.player.voice.voice_speaker_id,
                    voice_instructions: clip.voice?.voice_instructions || this.player.voice.voice_instructions,
                    languageCode: clip.voice?.voice_language_codes?.[0] || this.player.voice?.voice_language_codes?.[0] || this.player.voice.voice_language_code,
                    voiceSpeedSetting: clip.voice?.voice_speed || this.player.voice.voice_speed || 1,
                    includeAudioTimestamps: (
                        (VR_Reader.savedLocalStorageGlobal?.['DEFAULT_HIGHLIGHT_READING_STATE'] !== false && VR_Reader.savedLocalStorageGlobal?.['DEFAULT_HIGHLIGHT_READING_STATE'] !== 'false') &&
                        (VR_Reader.savedLocalStorageGlobal?.['DEFAULT_HIGHLIGHT_MODE_STATE'] !== 'sentence') &&
                        (
                            clip.voice?.voice_has_word_timestamp_support ||
                            this.player.voice.voice_has_word_timestamp_support ||
                            VR_Reader.savedLocalStorageGlobal?.['DEFAULT_EXTERNAL_TIMESTAMP_SERVICE'] === 'Whisper' ||
                            VR_Reader.savedLocalStorageGlobal?.['DEFAULT_EXTERNAL_TIMESTAMP_SERVICE'] === 'Deepgram' ||
                            VR_Reader.savedLocalStorageGlobal?.['DEFAULT_EXTERNAL_TIMESTAMP_SERVICE'] === 'OpenRouter'
                        )
                    ) ? true : false
                },
                text: this.player.audioEngine.fixProcessBugsForService(cleanedText, clip.voice?.voice_service || this.player.voice.voice_service),
                index: index,
                requestID: requestID,
                sessionId: this.player.sessionId,
                attemptNumber: attemptNumber,
                voiceId: requestVoiceId
            }
        });

        return preloadPromise;
    }
}
