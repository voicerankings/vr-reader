import { describe, it, expect, beforeEach, vi } from 'vitest';
import RatingsOverlay from '../js/components/modals/RatingsOverlay.js';

function setupVRReader() {
    if (!globalThis.VR_Reader) {
        globalThis.VR_Reader = {
            sessionCharsRead: 0,
            hasContinuedReading: false,
            storedSelectionData: null,
            savedLocalStorageGlobal: {},
            developerModeDailyUsage: 0,
            developerModeDailyLimit: 15000,
            calculateRemainingText: vi.fn(async () => null)
        };
    } else {
        globalThis.VR_Reader.sessionCharsRead = 0;
        globalThis.VR_Reader.hasContinuedReading = false;
        globalThis.VR_Reader.storedSelectionData = null;
        globalThis.VR_Reader.savedLocalStorageGlobal = globalThis.VR_Reader.savedLocalStorageGlobal || {};
        globalThis.VR_Reader.developerModeDailyUsage = 0;
        globalThis.VR_Reader.developerModeDailyLimit = 15000;
        globalThis.VR_Reader.calculateRemainingText = vi.fn(async () => null);
    }
    return globalThis.VR_Reader;
}

function buildOverlay(options = {}) {
    const overlay = new RatingsOverlay({
        voice: { voice_name: 'Test Voice' },
        generation_credits: 5,
        replayQueue: [{ text: 'Hello.', audioData: 'audio', voice: {} }],
        index: 0,
        callback: null,
        ...options
    });

    const host = document.createElement('div');
    host.id = 'shadowdom-vk-ratings-overlay';
    document.body.appendChild(host);

    overlay.initShadowDOM(host);
    overlay.render();
    return { overlay, host };
}

describe('RatingsOverlay global overlay toggles', () => {
    beforeEach(() => {
        setupVRReader();
        document.body.innerHTML = '';
    });

    it('renders the rating section and continue bar by default', () => {
        const { overlay } = buildOverlay();

        expect(overlay.shadow.querySelectorAll('.star-button').length).toBe(5);
        expect(overlay.shadow.querySelector('.stars-container')).not.toBeNull();
        expect(overlay.shadow.querySelector('.continue-reading-bar')).not.toBeNull();
        expect(overlay.shadow.querySelector('.read-later-btn')).not.toBeNull();
        expect(overlay.shadow.querySelector('.share-btn')).not.toBeNull();
        expect(overlay.shadow.querySelector('.close-button')).not.toBeNull();
    });

    it('hides the entire rating bar when showRatingUI is disabled', () => {
        const { overlay } = buildOverlay({ showRatingUI: false, showContinueUI: true });

        expect(overlay.shadow.querySelectorAll('.star-button').length).toBe(0);
        expect(overlay.shadow.querySelector('.stars-container')).toBeNull();
        expect(overlay.shadow.querySelector('.read-later-btn')).toBeNull();
        expect(overlay.shadow.querySelector('.share-btn')).toBeNull();
        expect(overlay.shadow.querySelector('.progress-bar-container')).toBeNull();
        expect(overlay.shadow.querySelector('.samples-counter')).toBeNull();

        // Continue bar stays available, rendered in standalone mode.
        expect(overlay.shadow.querySelector('.continue-reading-bar')).not.toBeNull();
        expect(overlay.shadow.querySelector('.continue-reading-bar').classList.contains('standalone')).toBe(true);

        // Close button must remain so warning bars can be dismissed.
        expect(overlay.shadow.querySelector('.close-button')).not.toBeNull();
    });

    it('still renders the credit warning bar when the rating UI is hidden but continue is enabled', () => {
        const { overlay } = buildOverlay({ showRatingUI: false, showContinueUI: true, showCreditWarning: true });

        expect(overlay.shadow.querySelector('.credit-warning-bar')).not.toBeNull();
        expect(overlay.shadow.querySelectorAll('.star-button').length).toBe(0);
    });

    it('does not render the continue bar when showContinueUI is disabled', () => {
        const { overlay } = buildOverlay({ showRatingUI: true, showContinueUI: false });

        expect(overlay.shadow.querySelector('.continue-reading-bar')).toBeNull();
        expect(overlay.shadow.querySelectorAll('.star-button').length).toBe(5);
    });

    it('never renders an overlay when both prompts are disabled', () => {
        const { overlay, host } = buildOverlay({ showRatingUI: false, showContinueUI: false, showCreditWarning: true });

        // render() destroys itself; the host element is removed from the DOM.
        expect(host.parentNode).toBeNull();
        expect(overlay.shadow).toBeNull();
        expect(document.getElementById('shadowdom-vk-ratings-overlay')).toBeNull();
    });

    it('skips remaining-text calculation when the continue prompt is disabled', async () => {
        const { overlay } = buildOverlay({ showRatingUI: true, showContinueUI: false });

        await overlay._calculateRemainingText();

        expect(globalThis.VR_Reader.calculateRemainingText).not.toHaveBeenCalled();
        expect(overlay.showContinueReading).toBe(false);
    });

    it('live-applies setting changes: turning both prompts off closes an open overlay', () => {
        const { overlay, host } = buildOverlay({ showRatingUI: true, showContinueUI: true });

        globalThis.VR_Reader.savedLocalStorageGlobal['DEFAULT_SHOW_VOICE_RATING_PROMPT'] = false;
        globalThis.VR_Reader.savedLocalStorageGlobal['DEFAULT_SHOW_CONTINUE_READING_PROMPT'] = false;

        overlay.applyGlobalOverlaySettings();

        expect(host.parentNode).toBeNull();
        expect(document.getElementById('shadowdom-vk-ratings-overlay')).toBeNull();
    });

    it('live-applies setting changes: turning the rating prompt off keeps the continue bar', () => {
        const { overlay } = buildOverlay({ showRatingUI: true, showContinueUI: true });

        globalThis.VR_Reader.savedLocalStorageGlobal['DEFAULT_SHOW_VOICE_RATING_PROMPT'] = false;
        globalThis.VR_Reader.savedLocalStorageGlobal['DEFAULT_SHOW_CONTINUE_READING_PROMPT'] = true;

        overlay.applyGlobalOverlaySettings();

        expect(overlay.showRatingUI).toBe(false);
        expect(overlay.showContinueUI).toBe(true);
        expect(overlay.shadow.querySelectorAll('.star-button').length).toBe(0);
        expect(overlay.shadow.querySelector('.continue-reading-bar')).not.toBeNull();
    });

    it('live-applies setting changes: re-enabling the rating prompt restores the bar', () => {
        const { overlay } = buildOverlay({ showRatingUI: false, showContinueUI: true });

        globalThis.VR_Reader.savedLocalStorageGlobal['DEFAULT_SHOW_VOICE_RATING_PROMPT'] = true;
        globalThis.VR_Reader.savedLocalStorageGlobal['DEFAULT_SHOW_CONTINUE_READING_PROMPT'] = true;

        overlay.applyGlobalOverlaySettings();

        expect(overlay.showRatingUI).toBe(true);
        expect(overlay.shadow.querySelectorAll('.star-button').length).toBe(5);
        expect(overlay.shadow.querySelector('.continue-reading-bar')).not.toBeNull();
    });
});