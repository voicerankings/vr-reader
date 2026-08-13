import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { mount } from '@vue/test-utils';
import LocalSettingsDomainFilters from '../src/components/Settings/LocalSettingsDomainFilters.vue';

// Mock the composable (its real module touches `chrome` at import time and is
// only needed here for localSettingsTab).
vi.mock('../src/composables/Composable', () => ({
    default: () => ({
        localSettingsTab: ref('domain-filters')
    })
}));

// Mock Chrome Storage & Runtime API globally for Vitest
let mockStorage = {};

global.chrome = {
    storage: {
        local: {
            get: vi.fn((key) => {
                const data = {};
                if (typeof key === 'string') {
                    data[key] = mockStorage[key] || [];
                }
                return Promise.resolve(data);
            }),
            set: vi.fn((data) => {
                Object.assign(mockStorage, data);
                return Promise.resolve();
            })
        }
    },
    runtime: {
        sendMessage: vi.fn()
    }
};

describe('LocalSettingsDomainFilters.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStorage = {};
    });

    it('renders heading title and description correctly', () => {
        const wrapper = mount(LocalSettingsDomainFilters);
        expect(wrapper.text()).toContain('Custom domain filters');
    });

    it('renders Collapsible Guide with examples and priority -1 section', () => {
        const wrapper = mount(LocalSettingsDomainFilters);
        const guideText = wrapper.text();
        expect(guideText).toContain('How playback filters work & examples');
        expect(guideText).toContain('Priority -1 (Disabling & Remote Overrides)');
        expect(guideText).toContain('stop_exact');
    });

    it('shows empty state text when customFilters list is empty', () => {
        const wrapper = mount(LocalSettingsDomainFilters);
        expect(wrapper.text()).toContain('No custom filters yet.');
    });

    it('renders filters from chrome.storage.local', async () => {
        mockStorage['CUSTOM_DOMAIN_FILTERS'] = [
            { id: '1', domain: 'reddit.com', filter_pattern: 'Created Sep', filter_type: 'stop_startsWith', priority: 0 },
            { id: '2', domain: 'youtube.com', filter_pattern: 'Leave a comment', filter_type: 'contains', priority: -1 }
        ];

        const wrapper = mount(LocalSettingsDomainFilters);
        await new Promise(r => setTimeout(r, 50)); // Wait for onMounted loadFilters

        const text = wrapper.text();
        expect(text).toContain('reddit.com');
        expect(text).toContain('Created Sep');
        expect(text).toContain('youtube.com');
        expect(text).toContain('p(-1) disabled'); // Priority -1 badge
    });

    it('opens add filter modal when clicking Add new filter button', async () => {
        const wrapper = mount(LocalSettingsDomainFilters);
        const addButton = wrapper.findAll('button').find(b => b.text().includes('Add'));
        expect(addButton).toBeDefined();

        await addButton.trigger('click');
        await wrapper.vm.$nextTick();

        expect(wrapper.text()).toContain('Domain Scope');
        expect(wrapper.find('input').exists()).toBe(true);
    });

    it('switches between Playback text and CSS selectors tabs', async () => {
        mockStorage['CUSTOM_DOMAIN_FILTERS'] = [
            { id: '1', domain: 'reddit.com', filter_pattern: 'Created Sep', filter_type: 'stop_startsWith', priority: 0 },
            { id: '2', domain: 'youtube.com', filter_pattern: '.newsletter', type: 'css', priority: 0 }
        ];

        const wrapper = mount(LocalSettingsDomainFilters);
        await new Promise(r => setTimeout(r, 50));

        // Playback tab is shown by default; the CSS rule must be hidden here
        expect(wrapper.text()).toContain('reddit.com');
        expect(wrapper.text()).not.toContain('.newsletter');

        // Switch to the CSS selectors tab
        const cssTab = wrapper.findAll('button').find(b => b.text().includes('CSS selectors'));
        expect(cssTab).toBeDefined();
        await cssTab.trigger('click');
        await new Promise(r => setTimeout(r, 50));

        // CSS rule shown, playback rule hidden
        expect(wrapper.text()).toContain('.newsletter');
        expect(wrapper.text()).not.toContain('Created Sep');
        expect(wrapper.text()).toContain('How CSS selector filters work & examples');
    });

    it('adds new filter and saves to chrome.storage.local on form submission', async () => {
        const wrapper = mount(LocalSettingsDomainFilters);
        const addButton = wrapper.findAll('button').find(b => b.text().includes('Add new filter'));
        await addButton.trigger('click');
        await wrapper.vm.$nextTick();

        const inputs = wrapper.findAll('input');
        await inputs[0].setValue('wikipedia.org'); // Domain
        await inputs[1].setValue('\\[\\d+\\]'); // Pattern

        const select = wrapper.find('select');
        await select.setValue('clean'); // Type

        const modalButtons = wrapper.findAll('.mt-5 button');
        const saveButton = modalButtons.find(b => b.text() === 'Add');
        expect(saveButton).toBeDefined();
        await saveButton.trigger('click');
        await wrapper.vm.$nextTick();

        expect(global.chrome.storage.local.set).toHaveBeenCalled();
    });

    it('deletes a filter item when clicking delete button', async () => {
        mockStorage['CUSTOM_DOMAIN_FILTERS'] = [
            { id: '1', domain: 'reddit.com', filter_pattern: 'Created Sep', filter_type: 'stop_startsWith', priority: 0 }
        ];

        const wrapper = mount(LocalSettingsDomainFilters);
        await new Promise(r => setTimeout(r, 50));

        expect(wrapper.text()).toContain('reddit.com');

        // Click delete button
        const deleteButton = wrapper.find('button.hover\\:text-red-500');
        await deleteButton.trigger('click');

        expect(wrapper.text()).toContain('No custom filters yet.');
        expect(global.chrome.storage.local.set).toHaveBeenCalled();
    });
});
