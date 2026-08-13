import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import LocalSettingsTimestamp from '../src/components/Settings/LocalSettingsTimestamp.vue';

// Mock composables & helpers
vi.mock('../src/composables/useLocalSettings', () => ({
    default: () => ({
        externalTimestampServiceState: ref('Whisper'),
        openAiSttApiKeyState: ref('sk-test12345'),
        deepgramSttApiKeyState: ref(''),
        openRouterSttApiKeyState: ref(''),
        openRouterSttModelState: ref('openai/whisper-large-v3'),
        getFromStorageExternalTimestampSettings: vi.fn(() => Promise.resolve())
    })
}));

vi.mock('../src/composables/Composable', () => ({
    default: () => ({
        sidepanelMakeToast: vi.fn()
    })
}));

vi.mock('../js/utils/helpers', () => ({
    saveToLocalStorage: vi.fn(() => Promise.resolve())
}));

describe('LocalSettingsTimestamp.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders timestamp service dropdown and OpenAI transcription fields when Whisper selected', () => {
        const wrapper = mount(LocalSettingsTimestamp);
        const text = wrapper.text();

        expect(text).toContain('Timestamp Word Highlighting Service');
        expect(text).toContain('OpenAI Transcription API Key');
    });

    it('toggles password visibility for OpenAI transcription API key', async () => {
        const wrapper = mount(LocalSettingsTimestamp);
        const toggleButton = wrapper.find('button[type="button"]');
        expect(toggleButton.exists()).toBe(true);

        expect(wrapper.find('input').attributes('type')).toBe('password');
        await toggleButton.trigger('click');
        expect(wrapper.find('input').attributes('type')).toBe('text');
    });

    it('includes OpenRouter option in the service dropdown', () => {
        const wrapper = mount(LocalSettingsTimestamp);
        const options = wrapper.findAll('select option').map(o => o.text().trim());

        expect(options).toContain('OpenRouter (STT)');
    });

    it('renders OpenRouter key field and model dropdown when OpenRouter selected', async () => {
        const wrapper = mount(LocalSettingsTimestamp);

        const select = wrapper.find('select');
        const selectElement = select.element;
        selectElement.value = 'OpenRouter';
        await select.trigger('change');

        expect(wrapper.text()).toContain('OpenRouter API Key');
        expect(wrapper.text()).toContain('OpenRouter STT Model');
        expect(wrapper.find('select option[value="openai/whisper-large-v3"]').exists()).toBe(true);
        expect(wrapper.find('select option[value="x-ai/grok-stt-1.0"]').exists()).toBe(true);
        expect(wrapper.find('select option[value="mistralai/voxtral-mini-transcribe"]').exists()).toBe(true);
        expect(wrapper.find('select option[value="qwen/qwen3-asr-flash-2026-02-10"]').exists()).toBe(true);
    });
});