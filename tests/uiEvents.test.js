import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { initializeLinkRouting } from '../js/content/uiEvents.js';

vi.mock('../js/utils/helpers', () => ({
    saveToLocalStorage: vi.fn(() => Promise.resolve())
}));

global.chrome = {
    runtime: {
        sendMessage: vi.fn()
    }
};

describe('uiEvents link routing', () => {
    beforeAll(() => {
        initializeLinkRouting();
    });

    beforeEach(() => {
        document.body.innerHTML = '';
        global.chrome.runtime.sendMessage.mockClear();
    });

    it('routes open-voice-list links to the /voices sidepanel route with the provider', () => {
        const link = document.createElement('a');
        link.className = 'voicerankings-link';
        link.setAttribute('data-type', 'open-voice-list');
        link.setAttribute('data-provider', 'OpenAI');
        link.href = '#';
        document.body.appendChild(link);

        link.click();

        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
            action: 'open-sidepanel',
            route: '/voices',
            data: {
                provider: 'OpenAI'
            }
        });
    });

    it('routes open-byok links to the /settings sidepanel route with byok tab and provider', () => {
        const link = document.createElement('a');
        link.className = 'voicerankings-link';
        link.setAttribute('data-type', 'open-byok');
        link.setAttribute('data-provider', 'Rime');
        link.href = '#';
        document.body.appendChild(link);

        link.click();

        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
            action: 'open-sidepanel',
            route: '/settings',
            data: {
                tab: 'byok',
                provider: 'Rime'
            }
        });
    });

    it('ignores clicks on elements that are not voicerankings links', () => {
        const button = document.createElement('button');
        button.setAttribute('data-type', 'open-voice-list');
        button.textContent = 'Not a link';
        document.body.appendChild(button);

        button.click();

        expect(global.chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
});
