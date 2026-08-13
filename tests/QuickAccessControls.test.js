import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import QuickAccessControls from '../src/components/Settings/QuickAccessControls.vue';

vi.mock('../src/composables/useLocalSettings', () => ({
    default: () => ({
        quickAccessState: ref(true),
        quickAccessPanelPlacementState: ref('bottom'),
        enterKeyPlayState: ref(true),
        getFromStorageQuickAccessControls: vi.fn(() => Promise.resolve())
    })
}));

vi.mock('../js/utils/helpers', () => ({
    saveToLocalStorage: vi.fn(() => Promise.resolve()),
    readLocalStorage: vi.fn()
}));

import { readLocalStorage } from '../js/utils/helpers';
import { saveToLocalStorage } from '../js/utils/helpers';

global.chrome = {
    storage: {
        local: {
            get: vi.fn(() => Promise.resolve({}))
        }
    },
    runtime: {
        sendMessage: vi.fn()
    }
};

describe('QuickAccessControls.vue hidden sites', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        readLocalStorage.mockResolvedValue({});
        saveToLocalStorage.mockResolvedValue(undefined);
    });

    it('renders the hidden sites management link when no sites are hidden', async () => {
        readLocalStorage.mockResolvedValue({ DOMAIN_SETTINGS: {} });

        const wrapper = mount(QuickAccessControls);
        await flushPromises();

        expect(wrapper.text()).toContain('Manage hidden sites (0)');
    });

    it('reveals the list of hidden domains when toggled', async () => {
        readLocalStorage.mockResolvedValue({
            DOMAIN_SETTINGS: {
                'reddit.com': { DOMAIN_QUICK_ACCESS_STATE: false },
                'news.ycombinator.com': { DOMAIN_QUICK_ACCESS_STATE: false },
                'wikipedia.org': { DOMAIN_READER_STATE: false }
            }
        });

        const wrapper = mount(QuickAccessControls);
        await flushPromises();

        expect(wrapper.text()).toContain('Manage hidden sites (2)');

        const toggleButton = wrapper.findAll('button').find(b => b.text().includes('Manage hidden sites'));
        await toggleButton.trigger('click');
        await flushPromises();

        expect(wrapper.text()).toContain('reddit.com');
        expect(wrapper.text()).toContain('news.ycombinator.com');
        // Sites hidden for a different setting type must not appear
        expect(wrapper.text()).not.toContain('wikipedia.org');
    });

    it('removes a hidden site and broadcasts the updated DOMAIN_SETTINGS', async () => {
        readLocalStorage.mockResolvedValue({
            DOMAIN_SETTINGS: {
                'reddit.com': { DOMAIN_QUICK_ACCESS_STATE: false },
                'example.com': { DOMAIN_QUICK_ACCESS_STATE: false }
            }
        });

        const wrapper = mount(QuickAccessControls);
        await flushPromises();

        const toggleButton = wrapper.findAll('button').find(b => b.text().includes('Manage hidden sites'));
        await toggleButton.trigger('click');
        await flushPromises();

        const removeButtons = wrapper.findAll('button').filter(b => b.attributes('aria-label') === 'Remove reddit.com');
        expect(removeButtons.length).toBe(1);
        await removeButtons[0].trigger('click');
        await flushPromises();

        expect(saveToLocalStorage).toHaveBeenCalledWith(
            { DOMAIN_SETTINGS: { 'example.com': { DOMAIN_QUICK_ACCESS_STATE: false } } },
            true
        );
        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
            action: 'update-contentscript-storage',
            key: 'DOMAIN_SETTINGS',
            value: { 'example.com': { DOMAIN_QUICK_ACCESS_STATE: false } }
        });
        expect(wrapper.text()).not.toContain('reddit.com');
        expect(wrapper.text()).toContain('example.com');
    });

    it('cleans up the domain entry entirely when the last setting is removed', async () => {
        readLocalStorage.mockResolvedValue({
            DOMAIN_SETTINGS: {
                'reddit.com': { DOMAIN_QUICK_ACCESS_STATE: false }
            }
        });

        const wrapper = mount(QuickAccessControls);
        await flushPromises();

        const toggleButton = wrapper.findAll('button').find(b => b.text().includes('Manage hidden sites'));
        await toggleButton.trigger('click');
        await flushPromises();

        const removeButton = wrapper.findAll('button').find(b => b.attributes('aria-label') === 'Remove reddit.com');
        await removeButton.trigger('click');
        await flushPromises();

        expect(saveToLocalStorage).toHaveBeenCalledWith(
            { DOMAIN_SETTINGS: {} },
            true
        );
        expect(wrapper.text()).toContain('No hidden sites.');
    });

    it('renders the Enable [Enter] to play shortcut checkbox', async () => {
        readLocalStorage.mockResolvedValue({ DOMAIN_SETTINGS: {} });

        const wrapper = mount(QuickAccessControls);
        await flushPromises();

        const checkbox = wrapper.find('#EnterKeyPlayCheckbox');
        expect(checkbox.exists()).toBe(true);
        expect(checkbox.element.checked).toBe(true);
        expect(wrapper.text()).toContain('Enable [Enter] to play highlight shortcut');
    });

    it('broadcasts and saves when the Enter key shortcut is toggled off', async () => {
        readLocalStorage.mockResolvedValue({ DOMAIN_SETTINGS: {} });

        const wrapper = mount(QuickAccessControls);
        await flushPromises();

        const checkbox = wrapper.find('#EnterKeyPlayCheckbox');
        await checkbox.setValue(false);
        await flushPromises();

        expect(saveToLocalStorage).toHaveBeenCalledWith(
            { DEFAULT_ENTER_KEY_PLAY_STATE: false },
            true
        );
        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
            action: 'update-contentscript-storage',
            key: 'DEFAULT_ENTER_KEY_PLAY_STATE',
            value: false
        });
    });
});
