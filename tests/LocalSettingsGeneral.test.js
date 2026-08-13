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
        maxAutoReadLimit: ref(5000)
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

    it('renders general settings options correctly', () => {
        const wrapper = mount(LocalSettingsGeneral, {
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

        const text = wrapper.text();
        expect(text).toContain('Custom domain filters');
    });
});
