import { describe, it, expect, beforeEach } from 'vitest';
import BufferManager from '../js/components/speech/external-voice-player/BufferManager.js';

describe('BufferManager', () => {
    let mockPlayer;
    let bufferManager;

    beforeEach(() => {
        mockPlayer = {
            voice: { voice_service: 'TestFastService' },
            SLOW_PROVIDERS: ['TestSlowService'],
            SLOW_PROVIDER_INITIAL_BUFFER: 1,
            SLOW_PROVIDER_MIN_BUFFER: 2,
            MIN_BUFFER_SIZE: 3,
            MAX_BUFFER_SIZE: 5,
            MAX_CONCURRENT_GENERATIONS: 2,
            READING_SPEED_CHARS_PER_SEC: 20,
            activeDownloads: new Set(),
            preloadPromises: new Map(),
            completedDownloads: new Set(),
            replayQueue: [],
            generationMetrics: {
                avgTimePerChar: 10, // ms
                recentSamples: [],
                sampleCount: 0
            }
        };

        bufferManager = new BufferManager(mockPlayer);
    });

    describe('isSlowProvider', () => {
        it('should return false for fast providers', () => {
            expect(bufferManager.isSlowProvider()).toBe(false);
        });

        it('should return true for slow providers', () => {
            mockPlayer.voice.voice_service = 'TestSlowService';
            expect(bufferManager.isSlowProvider()).toBe(true);
        });

        it('should handle undefined voice gracefully', () => {
            mockPlayer.voice = null;
            expect(bufferManager.isSlowProvider()).toBe(false);
        });
    });

    describe('getMinBufferSize', () => {
        it('should return default min buffer for fast providers', () => {
            expect(bufferManager.getMinBufferSize()).toBe(3);
        });

        it('should return slow provider min buffer for slow providers', () => {
            mockPlayer.voice.voice_service = 'TestSlowService';
            expect(bufferManager.getMinBufferSize()).toBe(2);
        });
    });

    describe('cleanupForJump', () => {
        it('should clear active downloads and promises between fromIndex and toIndex', () => {
            mockPlayer.activeDownloads.add(1);
            mockPlayer.activeDownloads.add(2);
            mockPlayer.activeDownloads.add(3);
            
            mockPlayer.preloadPromises.set(1, Promise.resolve());
            mockPlayer.preloadPromises.set(2, Promise.resolve());
            mockPlayer.preloadPromises.set(3, Promise.resolve());

            bufferManager.cleanupForJump(0, 3); // Should clear index 1 and 2, but not 3

            expect(mockPlayer.activeDownloads.has(1)).toBe(false);
            expect(mockPlayer.activeDownloads.has(2)).toBe(false);
            expect(mockPlayer.activeDownloads.has(3)).toBe(true);

            expect(mockPlayer.preloadPromises.has(1)).toBe(false);
            expect(mockPlayer.preloadPromises.has(2)).toBe(false);
            expect(mockPlayer.preloadPromises.has(3)).toBe(true);
        });
    });

    describe('calculateRequiredBuffer', () => {
        it('should return minBuffer if no clips need generation', () => {
            mockPlayer.replayQueue = [
                { text: 'A' }, // 0
                { text: 'B', audioData: 'base64' }, // 1 (already has audio)
                { text: 'C', audioData: 'base64' }  // 2 (already has audio)
            ];

            const requiredBuffer = bufferManager.calculateRequiredBuffer(0);
            expect(requiredBuffer).toBe(3); // MIN_BUFFER_SIZE
        });

        it('should calculate buffer dynamically based on generation vs playback time', () => {
            // Setup a scenario where generation time > playback time
            // avgTimePerChar = 100ms
            // playback speed = 10 chars / sec (100ms per char playback)
            mockPlayer.generationMetrics.avgTimePerChar = 200; // Generation takes 200ms per char (Very slow!)
            mockPlayer.READING_SPEED_CHARS_PER_SEC = 20; // 50ms per char playback
            
            mockPlayer.replayQueue = [
                { text: 'Clip0' },
                { text: 'This is clip 1 which needs generation' },
                { text: 'This is clip 2 which needs generation' },
                { text: 'This is clip 3 which needs generation' }
            ];

            // It will see that playback time is much faster than generation time, 
            // so it should scale up the buffer!
            const requiredBuffer = bufferManager.calculateRequiredBuffer(0);
            // It uses Math.ceil(clipsNeedingGeneration * 1.5)
            // clipsNeedingGeneration = 3. 3 * 1.5 = 4.5 -> 5
            // max buffer is 5.
            expect(requiredBuffer).toBe(5);
        });
    });
});
