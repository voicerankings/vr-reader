import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import LocalSettingsKeyboardShortcut from '../src/components/Settings/LocalSettingsKeyboardShortcut.vue';

global.chrome = {
    runtime: {
        sendMessage: vi.fn()
    }
};

describe('LocalSettingsKeyboardShortcut.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders shortcut title and action buttons', () => {
        const wrapper = mount(LocalSettingsKeyboardShortcut, {
            global: {
                directives: {
                    tooltip: () => {}
                }
            }
        });
        const text = wrapper.text();
        expect(text).toContain('Keyboard shortcuts');
        expect(text).toContain('Auto Start Reader');
        expect(text).toContain('Update shortcuts');
    });

    it('sends Chrome runtime message when Update shortcuts button is clicked', async () => {
        const wrapper = mount(LocalSettingsKeyboardShortcut, {
            global: {
                directives: {
                    tooltip: () => {}
                }
            }
        });
        await wrapper.find('button.bg-blue-600').trigger('click');

        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
            action: 'navigateTo',
            url: 'chrome://extensions/shortcuts'
        });
    });
});
