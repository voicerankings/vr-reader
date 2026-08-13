import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import VoicesApiKeyAlert from '../src/components/Voices/VoicesApiKeyAlert.vue';

const { providersListMock, voiceFilterOptionsMock } = vi.hoisted(() => ({
    providersListMock: { value: [] },
    voiceFilterOptionsMock: { value: { gender: '', service: '', languageCode: 'en', countryCode: 'all' } }
}));

vi.mock('../src/composables/Composable', () => ({
    default: () => ({
        API_NUXT_DOMAIN: { value: 'voicerankings.com' },
        providersList: providersListMock,
        voiceFilterOptions: voiceFilterOptionsMock,
        voiceSwitchOnPremium: { value: true },
        voiceShowFavoritesOn: { value: false },
        voiceShowCollectionsOn: { value: false },
        sidepanelMakeToast: vi.fn()
    })
}));

vi.mock('../js/utils/helpers', () => ({
    saveToLocalStorage: vi.fn(() => Promise.resolve()),
    readLocalStorage: vi.fn()
}));

import { readLocalStorage } from '../js/utils/helpers';

global.chrome = {
    runtime: {
        sendMessage: vi.fn()
    }
};

const openAiProvider = {
    voice_service: 'OpenAI',
    voice_service_alias: 'openai.com',
    storage_key: 'OPENAI_API_KEY',
    api_test_voice: { voice_gender: 'female', voice_speaker_id: 'Nova' }
};

describe('VoicesApiKeyAlert.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        providersListMock.value = [];
        voiceFilterOptionsMock.value = { gender: '', service: '', languageCode: 'en', countryCode: 'all' };
        readLocalStorage.mockResolvedValue({});
    });

    it('shows the alert when a BYOK provider is selected and no API key is stored', async () => {
        providersListMock.value = [openAiProvider];
        voiceFilterOptionsMock.value.service = 'OpenAI';
        readLocalStorage.mockResolvedValue({ OPENAI_API_KEY: '' });

        const wrapper = mount(VoicesApiKeyAlert);
        await flushPromises();

        const text = wrapper.text();
        expect(text).toContain('API key not added for OpenAI');
        const buttons = wrapper.findAll('button').map(b => b.text());
        expect(buttons).toContain('Get Key');
        expect(buttons).toContain('Add Key');
    });

    it('hides the alert when an API key exists for the selected provider', async () => {
        providersListMock.value = [openAiProvider];
        voiceFilterOptionsMock.value.service = 'OpenAI';
        readLocalStorage.mockResolvedValue({ OPENAI_API_KEY: 'sk-test-key' });

        const wrapper = mount(VoicesApiKeyAlert);
        await flushPromises();

        expect(wrapper.text()).not.toContain('API key not added for OpenAI');
    });

    it('does not show the alert when no provider is selected', async () => {
        providersListMock.value = [openAiProvider];
        readLocalStorage.mockResolvedValue({ OPENAI_API_KEY: '' });

        const wrapper = mount(VoicesApiKeyAlert);
        await flushPromises();

        expect(wrapper.text()).not.toContain('API key not added');
    });

    it('does not show the alert for providers without a storage_key', async () => {
        providersListMock.value = [{ voice_service: 'FreeProvider', voice_service_alias: 'free.com' }];
        voiceFilterOptionsMock.value.service = 'FreeProvider';

        const wrapper = mount(VoicesApiKeyAlert);
        await flushPromises();

        expect(wrapper.text()).not.toContain('API key not added');
    });

    it('sends open-byok-guide message when Get Key is clicked', async () => {
        providersListMock.value = [openAiProvider];
        voiceFilterOptionsMock.value.service = 'OpenAI';
        readLocalStorage.mockResolvedValue({ OPENAI_API_KEY: '' });
        global.chrome.runtime.sendMessage.mockClear();

        const wrapper = mount(VoicesApiKeyAlert);
        await flushPromises();

        const getKeyButton = wrapper.findAll('button').find(b => b.text() === 'Get Key');
        await getKeyButton.trigger('click');

        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
            action: 'open-byok-guide',
            serviceName: 'OpenAI'
        });
    });

    it('opens the API key management modal when Add Key is clicked', async () => {
        providersListMock.value = [openAiProvider];
        voiceFilterOptionsMock.value.service = 'OpenAI';
        readLocalStorage.mockResolvedValue({ OPENAI_API_KEY: '' });

        const wrapper = mount(VoicesApiKeyAlert);
        await flushPromises();

        const addKeyButton = wrapper.findAll('button').find(b => b.text() === 'Add Key');
        await addKeyButton.trigger('click');
        await flushPromises();

        const headerText = document.body.textContent || '';
        expect(headerText).toContain('API Key Management');
        expect(headerText).toContain('OpenAI');
        const modalEl = document.body.querySelector('.fixed.inset-0.z-\\[99999\\]');
        expect(modalEl).toBeTruthy();
    });

    it('uses the SERVICE_AND_STORAGE_KEY fallback when providers list is empty', async () => {
        voiceFilterOptionsMock.value.service = 'Azure';
        readLocalStorage.mockResolvedValue({ AZURE_API_KEY: '' });

        const wrapper = mount(VoicesApiKeyAlert);
        await flushPromises();

        const text = wrapper.text();
        expect(text).toContain('API key not added for Azure');
        const buttons = wrapper.findAll('button').map(b => b.text());
        expect(buttons).toContain('Get Key');
        expect(buttons).toContain('Add Key');
    });
});
