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
            set: vi.fn((data, cb) => {
                Object.assign(mockStorage, data);
                if (cb) cb({});
                return Promise.resolve();
            })
        }
    },
    runtime: {
        sendMessage: vi.fn()
    }
};

async function switchToCssTab(wrapper) {
    const cssTab = wrapper.findAll('button').find(b => b.text().includes('CSS selectors'));
    await cssTab.trigger('click');
    await new Promise(r => setTimeout(r, 50));
}

describe('LocalSettingsCssFilters.vue (CSS selectors tab)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStorage = {};
    });

    it('shows CSS selectors tab and its guide', async () => {
        const wrapper = mount(LocalSettingsDomainFilters);
        await switchToCssTab(wrapper);

        const text = wrapper.text();
        expect(text).toContain('CSS selector filters');
        expect(text).toContain('How CSS selector filters work & examples');
        expect(text).toContain('No CSS selector filters yet.');
    });

    it('renders only type=css filters (playback entries excluded)', async () => {
        mockStorage['CUSTOM_DOMAIN_FILTERS'] = [
            { id: '1', domain: 'reddit.com', filter_pattern: 'Created Sep', filter_type: 'stop_startsWith', priority: 0 },
            { id: '2', domain: 'youtube.com', filter_pattern: '.newsletter', type: 'css', priority: 1 },
            { id: '3', domain: '*', filter_pattern: '#comments', type: 'css', priority: -1 }
        ];

        const wrapper = mount(LocalSettingsDomainFilters);
        await switchToCssTab(wrapper);

        const text = wrapper.text();
        expect(text).toContain('.newsletter');
        expect(text).toContain('#comments');
        expect(text).toContain('p(-1) disabled'); // priority -1 badge
        expect(text).not.toContain('Created Sep'); // playback rule hidden
    });

    it('adds a CSS selector rule, saved with type "css", preserving playback entries', async () => {
        mockStorage['CUSTOM_DOMAIN_FILTERS'] = [
            { id: '1', domain: 'reddit.com', filter_pattern: 'Created Sep', filter_type: 'stop_startsWith', priority: 0 }
        ];

        const wrapper = mount(LocalSettingsDomainFilters);
        await switchToCssTab(wrapper);

        const addButton = wrapper.findAll('button').find(b => b.text().includes('Add new CSS selector'));
        expect(addButton).toBeDefined();
        await addButton.trigger('click');
        await wrapper.vm.$nextTick();

        const inputs = wrapper.findAll('input');
        await inputs[0].setValue('wikipedia.org'); // Domain
        await inputs[1].setValue('.newsletter'); // CSS selector

        const saveButton = wrapper.findAll('.mt-5 button').find(b => b.text() === 'Add');
        expect(saveButton).toBeDefined();
        await saveButton.trigger('click');
        await wrapper.vm.$nextTick();

        const saved = mockStorage['CUSTOM_DOMAIN_FILTERS'];
        const cssRule = saved.find(f => f.type === 'css');
        expect(cssRule).toBeDefined();
        expect(cssRule.filter_pattern).toBe('.newsletter');
        expect(cssRule.domain).toBe('wikipedia.org');

        // Full array persisted - playback entry untouched
        expect(saved.some(f => f.id === '1' && f.filter_type === 'stop_startsWith')).toBe(true);
        expect(global.chrome.runtime.sendMessage).toHaveBeenCalled();
    });

    it('deletes a CSS selector rule', async () => {
        mockStorage['CUSTOM_DOMAIN_FILTERS'] = [
            { id: '1', domain: 'youtube.com', filter_pattern: '.newsletter', type: 'css', priority: 0 }
        ];

        const wrapper = mount(LocalSettingsDomainFilters);
        await switchToCssTab(wrapper);

        expect(wrapper.text()).toContain('.newsletter');

        const deleteButton = wrapper.find('button.hover\\:text-red-500');
        await deleteButton.trigger('click');

        expect(wrapper.text()).toContain('No CSS selector filters yet.');
        expect(global.chrome.storage.local.set).toHaveBeenCalled();
    });
});