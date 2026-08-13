import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import HighlightControls from '../src/components/Settings/HighlightControls.vue';

// Mock composable dependency
vi.mock('../src/composables/useLocalSettings', () => ({
    default: () => ({
        getFromStorageHighlightOptions: vi.fn(() => Promise.resolve()),
        highlightState: ref(true),
        autoscrollState: ref(true),
        autoReadTitleState: ref(true),
        highlightModeState: ref('smooth'),
        highlightThemeState: ref('auto')
    })
}));

vi.mock('../js/utils/helpers', () => ({
    saveToLocalStorage: vi.fn(() => Promise.resolve())
}));

global.chrome = {
    runtime: {
        sendMessage: vi.fn()
    }
};

describe('HighlightControls.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders reader controls and checkboxes', () => {
        const wrapper = mount(HighlightControls);
        const text = wrapper.text();
        expect(text).toContain('Reader controls');
        expect(text).toContain('Autoscroll to line being read aloud');
        expect(text).toContain('Highlight text being read aloud');
        expect(text).toContain('Read article/blog title');
    });

    it('renders highlight style options when highlightState is true', () => {
        const wrapper = mount(HighlightControls);
        const text = wrapper.text();
        expect(text).toContain('Highlight style:');
        expect(text).toContain('Smooth (word-by-word)');
        expect(text).toContain('Instant (word-by-word)');
        expect(text).toContain('Full sentence');
    });
});
