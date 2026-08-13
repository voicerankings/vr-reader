import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import ErrorLogs from '../src/components/Settings/ErrorLogs.vue';

const sampleLogs = [
    {
        serviceName: 'OpenAI TTS',
        message: 'HTTP 401 Unauthorized API key',
        timestamp: 1700000000000,
        statusCode: 401,
        request: {
            url: 'https://api.openai.com/v1/audio/speech',
            payload: { model: 'tts-1' },
            requestPayload: { model: 'tts-1', input: 'Hello world', voice: 'alloy', speed: 1 }
        },
        response: { error: 'Invalid API key' }
    }
];

const mockLogs = ref([...sampleLogs]);

// Mock composable dependency returning Vue ref
vi.mock('../src/composables/Composable', () => ({
    default: () => ({
        ttsErrorLogs: mockLogs,
        loadErrorLogs: vi.fn()
    })
}));

global.chrome = {
    storage: {
        local: {
            get: vi.fn(() => Promise.resolve({ DEBUG_MODE: false })),
            set: vi.fn(() => Promise.resolve()),
            remove: vi.fn(() => Promise.resolve())
        }
    }
};

describe('ErrorLogs.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLogs.value = [...sampleLogs];
    });

    it('renders error log items from composable state', () => {
        const wrapper = mount(ErrorLogs);
        const text = wrapper.text();
        expect(text).toContain('Error Logs');
        expect(text).toContain('OpenAI TTS');
        expect(text).toContain('HTTP 401 Unauthorized API key');
    });

    it('expands error log details when clicked', async () => {
        const wrapper = mount(ErrorLogs);
        const logItemButton = wrapper.find('button.w-full');
        expect(logItemButton.exists()).toBe(true);

        await logItemButton.trigger('click');
        await wrapper.vm.$nextTick();

        const html = wrapper.html();
        expect(html).toContain('https://api.openai.com/v1/audio/speech');
        expect(html).toContain('Invalid API key');
        expect(html).toContain('VRR Request Payload');
        expect(html).toContain('Provider Request Payload');
        expect(html).toContain('Provider Response Received');
        expect(html).toContain('"input": "Hello world"');
    });

    it('renders the provider request payload for string bodies without quoting', async () => {
        mockLogs.value = [{
            serviceName: 'Azure',
            message: 'TTS error',
            timestamp: 1700000000000,
            statusCode: 429,
            request: { url: 'https://eastus.tts.speech.microsoft.com/cognitiveservices/v1', payload: {}, requestPayload: '<speak>hi</speak>' },
            response: {}
        }];

        const wrapper = mount(ErrorLogs);
        await wrapper.find('button.w-full').trigger('click');
        await wrapper.vm.$nextTick();

        const text = wrapper.text();
        expect(text).toContain('<speak>hi</speak>');
        expect(text).not.toContain('"<speak>');
    });

    it('renders the debug console logs toggle', () => {
        const wrapper = mount(ErrorLogs);
        expect(wrapper.text()).toContain('Enable Debug Console Logs');
    });

    it('saves debug mode to storage when toggled', async () => {
        const wrapper = mount(ErrorLogs);
        const toggle = wrapper.find('input[type="checkbox"]');
        expect(toggle.exists()).toBe(true);

        await toggle.setValue(true);
        await wrapper.vm.$nextTick();

        expect(chrome.storage.local.set).toHaveBeenCalledWith({ DEBUG_MODE: true });
    });
});
