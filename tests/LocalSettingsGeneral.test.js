import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import LocalSettingsGeneral from '../src/components/Settings/LocalSettingsGeneral.vue';

// Mock composables & helpers
vi.mock('../src/composables/Composable', () => ({
    default: () => ({
        API_NUXT_DOMAIN: { value: 'voicerankings.com' },
        userProfile: { value: null },
        allowTelemetry: ref(true),
        getFromStorageAllowTelemetry: vi.fn(() => Promise.resolve()),
        localSettingsTab: { value: 'general' }
    })
}));

vi.mock('../src/composables/useLocalSettings', () => ({
    default: () => ({
        maxAutoReadLimitEnabled: ref(true),
        maxAutoReadLimit: ref(5000),
        showVoiceRatingPromptState: ref(true),
        showContinueReadingPromptState: ref(true),
        getFromStorageOverlayPromptSettings: vi.fn(() => Promise.resolve())
    })
}));

vi.mock('../js/utils/helpers', () => ({
    saveToLocalStorage: vi.fn(() => Promise.resolve())
}));

global.chrome = {
    storage: {
        local: {
            get: vi.fn(() => Promise.resolve({ DOMAIN_FILTER_ENABLED: true }))
        }
    },
    runtime: {
        sendMessage: vi.fn()
    }
};

describe('LocalSettingsGeneral.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function mountComponent() {
        return mount(LocalSettingsGeneral, {
            global: {
                directives: { tooltip: () => {} },
                stubs: {
                    QuickAccessControls: true,
                    HighlightControls: true,
                    LocalSettingsKeyboardShortcut: true,
                    LocalSettingsTimestamp: true,
                    VMenu: true
                }
            }
        });
    }

    it('renders general settings options correctly', () => {
        const wrapper = mountComponent();

        const text = wrapper.text();
        expect(text).toContain('Custom domain filters');
    });

    it('renders the reader overlay toggles', () => {
        const wrapper = mountComponent();

        const text = wrapper.text();
        expect(text).toContain('Show voice rating prompt after reading');
        expect(text).toContain('Show "Continue reading the rest of the page" prompt');
    });

    it('persists the reader overlay toggles and broadcasts to the content script', async () => {
        const wrapper = mountComponent();

        const { saveToLocalStorage } = await import('../js/utils/helpers');
        const { sendMessage } = global.chrome.runtime;

        const checkboxes = wrapper.findAll('input[type="checkbox"]');
        // The final two checkboxes are the Reader Overlays toggles.
        const [ratingCheckbox, continueCheckbox] = checkboxes.slice(-2);

        await ratingCheckbox.setValue(false);
        expect(saveToLocalStorage).toHaveBeenCalledWith({ 'DEFAULT_SHOW_VOICE_RATING_PROMPT': false });
        expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
            action: 'update-contentscript-storage',
            key: 'DEFAULT_SHOW_VOICE_RATING_PROMPT',
            value: false
        }));

        await continueCheckbox.setValue(false);
        expect(saveToLocalStorage).toHaveBeenCalledWith({ 'DEFAULT_SHOW_CONTINUE_READING_PROMPT': false });
        expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
            action: 'update-contentscript-storage',
            key: 'DEFAULT_SHOW_CONTINUE_READING_PROMPT',
            value: false
        }));
    });
});
