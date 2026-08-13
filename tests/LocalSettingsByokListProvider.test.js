import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import LocalSettingsByokListProvider from '../src/components/Settings/LocalSettingsByokListProvider.vue';
import { saveToLocalStorage } from '../js/utils/helpers';

// Mock composable
const { saveRequestCallback, saveRequestMock } = vi.hoisted(() => {
    const saveRequestCallback = { current: null };
    const saveRequestMock = vi.fn((callbackID, callback) => {
        saveRequestCallback.current = callback;
    });
    return { saveRequestCallback, saveRequestMock };
});

vi.mock('../src/composables/Composable', () => ({
    default: () => ({
        sidepanelMakeToast: vi.fn(),
        saveRequest: saveRequestMock,
        pageRoute: { value: 'general' },
        API_NUXT_DOMAIN: { value: 'voicerankings.com' }
    })
}));

// Mock helpers
vi.mock('../js/utils/helpers', () => ({
    saveToLocalStorage: vi.fn(() => Promise.resolve()),
    readLocalStorage: vi.fn(() => Promise.resolve({}))
}));

global.chrome = {
    runtime: {
        sendMessage: vi.fn()
    }
};

describe('LocalSettingsByokListProvider.vue', () => {
    const mockService = {
        voice_service: 'OpenAI',
        voice_service_alias: 'openai.com',
        storage_key: 'OPENAI_API_KEY'
    };

    const mockServiceWithConcurrentOption = {
        ...mockService,
        custom_api_options: [
            {
                name: 'rate',
                type: 'slider',
                label: 'Speed',
                min: 0.5,
                max: 2.0,
                step: 0.1,
                default: 1.0,
                tooltip: 'Speaking speed'
            },
            {
                name: 'max_concurrent',
                type: 'slider',
                label: 'Max Concurrent Requests',
                min: 1,
                max: 5,
                step: 1,
                default: 3,
                tooltip: 'Maximum simultaneous requests'
            }
        ]
    };

    async function openAdvanced(wrapper) {
        const advancedButton = wrapper.findAll('button').find(b => b.text().trim() === 'Advanced');
        await advancedButton.trigger('click');
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders provider title and input field', () => {
        const wrapper = mount(LocalSettingsByokListProvider, {
            props: { service: mockService },
            global: { directives: { tooltip: () => {} } }
        });

        expect(wrapper.text()).toContain('OpenAI');
        expect(wrapper.text()).toContain('openai.com');
        expect(wrapper.find('input[type="password"]').exists()).toBe(true);
    });

    it('toggles password visibility when toggle button is clicked', async () => {
        const wrapper = mount(LocalSettingsByokListProvider, {
            props: { service: mockService, initialValue: 'sk-proj-testkey123' },
            global: { directives: { tooltip: () => {} } }
        });

        const toggleButton = wrapper.find('button[type="button"]');
        expect(toggleButton.exists()).toBe(true);

        // Initially password type
        expect(wrapper.find('input').attributes('type')).toBe('password');

        await toggleButton.trigger('click');
        expect(wrapper.find('input').attributes('type')).toBe('text');
    });

    it('emits api-key-saved and saves to storage on save button click', async () => {
        const wrapper = mount(LocalSettingsByokListProvider, {
            props: { service: mockService },
            global: { directives: { tooltip: () => {} } }
        });

        const input = wrapper.find('input');
        await input.setValue('sk-proj-testkey123');

        const saveButton = wrapper.findAll('button').find(b => b.text().includes('Save'));
        await saveButton.trigger('click');

        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
            action: 'update-contentscript-storage',
            key: 'OPENAI_API_KEY',
            value: 'sk-proj-testkey123'
        });
        expect(wrapper.emitted('api-key-saved')).toBeTruthy();
    });

    it('renders the max concurrent requests slider with the app default when no limit is set', async () => {
        const wrapper = mount(LocalSettingsByokListProvider, {
            props: { service: mockService },
            global: { directives: { tooltip: () => {} } }
        });
        await flushPromises();
        await openAdvanced(wrapper);

        const slider = wrapper.find('[data-testid="max-concurrent-slider"]');
        expect(slider.exists()).toBe(true);
        expect(slider.element.value).toBe('2');
    });

    it('uses the custom_api_options max_concurrent default as the slider default', async () => {
        const wrapper = mount(LocalSettingsByokListProvider, {
            props: { service: mockServiceWithConcurrentOption },
            global: { directives: { tooltip: () => {} } }
        });
        await flushPromises();
        await openAdvanced(wrapper);

        expect(wrapper.find('[data-testid="max-concurrent-slider"]').element.value).toBe('3');
    });

    it('does not render max_concurrent inside the generic custom options list', async () => {
        const wrapper = mount(LocalSettingsByokListProvider, {
            props: { service: mockServiceWithConcurrentOption },
            global: { directives: { tooltip: () => {} } }
        });
        await flushPromises();

        // Generic fields (e.g. Speed) render, but max_concurrent is excluded there
        expect(wrapper.text()).toContain('Speed');
        expect(wrapper.text()).not.toContain('Max Concurrent Requests');
        const genericSliders = wrapper.findAll('input[type="range"]');
        expect(genericSliders.length).toBe(1);
        expect(genericSliders[0].element.value).toBe('1');
    });

    it('auto-saves the max concurrent value to options storage', async () => {
        const wrapper = mount(LocalSettingsByokListProvider, {
            props: { service: mockService },
            global: { directives: { tooltip: () => {} } }
        });
        await flushPromises();
        await openAdvanced(wrapper);

        vi.useFakeTimers();
        const slider = wrapper.find('[data-testid="max-concurrent-slider"]');
        slider.element.value = '4';
        await slider.trigger('input');
        await vi.advanceTimersByTimeAsync(350);
        vi.useRealTimers();

        expect(saveToLocalStorage).toHaveBeenCalledWith(
            expect.objectContaining({
                OPENAI_API_KEY_options: expect.objectContaining({ max_concurrent: 4 })
            })
        );
    });

    it('resets the max concurrent slider back to the server default', async () => {
        const wrapper = mount(LocalSettingsByokListProvider, {
            props: { service: mockServiceWithConcurrentOption },
            global: { directives: { tooltip: () => {} } }
        });
        await flushPromises();
        await openAdvanced(wrapper);

        const slider = wrapper.find('[data-testid="max-concurrent-slider"]');
        slider.element.value = '5';
        await slider.trigger('input');
        expect(slider.element.value).toBe('5');

        const resetButton = wrapper.findAll('button').find(b => b.text().trim() === 'Reset');
        await resetButton.trigger('click');

        expect(wrapper.find('[data-testid="max-concurrent-slider"]').element.value).toBe('3');
    });

    it('shows a Not saved indicator when the typed key differs from the saved key', async () => {
        const wrapper = mount(LocalSettingsByokListProvider, {
            props: { service: mockService, initialValue: 'sk-saved-key' },
            global: { directives: { tooltip: () => {} } }
        });
        await flushPromises();

        expect(wrapper.text()).not.toContain('Not saved');

        const input = wrapper.find('input[type="password"]');
        await input.setValue('sk-new-key-123');

        expect(wrapper.text()).toContain('Not saved');
    });

    it('tests with the typed key via testKeyOptions and shows Save Key in modal when an existing key is saved', async () => {
        saveRequestCallback.current = null;
        global.chrome.runtime.sendMessage.mockClear();

        const wrapper = mount(LocalSettingsByokListProvider, {
            props: {
                service: mockService,
                initialValue: 'sk-old-key',
                serviceOptions: { voice_gender: 'male', voice_speaker_id: 'x' }
            },
            global: { directives: { tooltip: () => {} } }
        });
        await flushPromises();

        const input = wrapper.find('input[type="password"]');
        await input.setValue('sk-typed-new-key');

        const testButton = wrapper.findAll('button').find(b => b.text().includes('Test Key'));
        expect(testButton.exists()).toBe(true);

        await testButton.trigger('click');

        const sentMessage = global.chrome.runtime.sendMessage.mock.calls[0][0];
        expect(sentMessage.payload.testKeyOptions.apiKey).toBe('sk-typed-new-key');
        expect(sentMessage.payload.serviceName).toBe('OpenAI');

        // Simulate the background test callback succeeding
        saveRequestCallback.current({ audioData: 'AAAA', status: 'success' });
        await flushPromises();

        // With an existing saved key, do NOT auto-save; instead surface Save Key in the modal
        expect(saveToLocalStorage).not.toHaveBeenCalled();
        const bodyButtons = Array.from(document.body.querySelectorAll('button'));
        const modalSaveButton = bodyButtons.find(b => b.textContent.includes('Save Key'));
        expect(modalSaveButton).toBeTruthy();

        // Clicking Save Key persists the typed key
        modalSaveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await flushPromises();

        expect(saveToLocalStorage).toHaveBeenCalledWith(
            expect.objectContaining({ OPENAI_API_KEY: 'sk-typed-new-key' }),
            true
        );
        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'update-contentscript-storage',
                key: 'OPENAI_API_KEY',
                value: 'sk-typed-new-key'
            })
        );
        expect(wrapper.text()).not.toContain('Not saved');
    });

    it('auto-saves a brand new key on successful test when no key existed before', async () => {
        saveRequestCallback.current = null;
        global.chrome.runtime.sendMessage.mockClear();

        const wrapper = mount(LocalSettingsByokListProvider, {
            props: {
                service: mockService,
                initialValue: '',
                serviceOptions: { voice_gender: 'male', voice_speaker_id: 'x' }
            },
            global: { directives: { tooltip: () => {} } }
        });
        await flushPromises();

        const input = wrapper.find('input[type="password"]');
        await input.setValue('sk-fresh-key');

        const testButton = wrapper.findAll('button').find(b => b.text().includes('Test Key'));
        expect(testButton.exists()).toBe(true);

        await testButton.trigger('click');

        // Simulate the background test callback succeeding
        saveRequestCallback.current({ audioData: 'AAAA', status: 'success' });
        await flushPromises();

        expect(saveToLocalStorage).toHaveBeenCalledWith(
            expect.objectContaining({ OPENAI_API_KEY: 'sk-fresh-key' }),
            true
        );
        // No Save Key button needed since it was auto-saved
        const modalSaveButton = wrapper.findAll('button').find(b => b.text().includes('Save Key'));
        expect(modalSaveButton).toBeUndefined();
        expect(wrapper.text()).not.toContain('Not saved');
    });
});
