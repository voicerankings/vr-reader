import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SearchVoices from '../src/components/MainMenu/SearchVoices.vue';

// Mock localStorage for JSDOM
const localStorageMock = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

// Mock composables & helpers
vi.mock('../src/composables/Composable', () => ({
    default: () => ({
        API_NUXT_DOMAIN: { value: 'voicerankings.com' },
        isUserLogged: { value: true },
        sidepanelMakeToast: vi.fn(),
        saveVoiceDefaultOnServer: vi.fn(() => Promise.resolve()),
        voiceDefaultPayload: { value: {} },
        userProfile: { value: { user_rank: { total_play_duration_seconds: 120 } } },
        saveVoiceDefaultToLocalStorage: vi.fn(),
        pageRoute: { value: 'home' },
        localSettingsTab: { value: 'general' }
    })
}));

vi.mock('../js/utils/helpers', () => ({
    saveToLocalStorage: vi.fn(() => Promise.resolve()),
    readLocalStorage: vi.fn(() => Promise.resolve({ CONTEXT_MENU_VOICES: [] }))
}));

global.chrome = {
    storage: {
        local: {
            get: vi.fn(() => Promise.resolve({ DEFAULT_PREMIUM_VOICE_ID: 'v1' })),
            set: vi.fn(() => Promise.resolve())
        }
    },
    runtime: {
        sendMessage: vi.fn()
    }
};

describe('SearchVoices.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders search input field with placeholder', () => {
        const wrapper = mount(SearchVoices, {
            global: {
                directives: { tooltip: () => {} },
                stubs: { VoiceCollectionManager: true }
            }
        });

        const input = wrapper.find('input[type="text"]');
        expect(input.exists()).toBe(true);
        expect(input.attributes('placeholder')).toBe('Search voices by name...');
    });

    it('updates searchQuery when user types into input', async () => {
        const wrapper = mount(SearchVoices, {
            global: {
                directives: { tooltip: () => {} },
                stubs: { VoiceCollectionManager: true }
            }
        });

        const input = wrapper.find('input[type="text"]');
        await input.setValue('Alloy');
        expect(input.element.value).toBe('Alloy');
    });
});
