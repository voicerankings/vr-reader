import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import SentenceSplitter from '../js/components/speech/tts-voice-player/SentenceSplitter.js';

const fixturePath = path.resolve(__dirname, 'fixtures/opencritic.html');

function setupGlobals(dom) {
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.Node = dom.window.Node;
    globalThis.NodeFilter = dom.window.NodeFilter;
    globalThis.Range = dom.window.Range;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.navigator = dom.window.navigator;
    globalThis.chrome = { runtime: { sendMessage: () => {}, onMessage: { addListener: () => {} } } };

    if (!dom.window.Element.prototype.checkVisibility) {
        dom.window.Element.prototype.checkVisibility = () => true;
    }

    // Re-use the same shared object across tests so that cached ESM modules
    // (e.g. textTracking.js) keep their VR_Reader method references valid.
    const shared = globalThis.VR_Reader || {
        savedMarkElements: [],
        savedHighlightedElements: {},
        savedLocalStorageGlobal: {},
        ttsWidget: { changePlayingButtonStatus() {} }
    };
    dom.window.VR_Reader = shared;
    globalThis.VR_Reader = shared;
}

function selectElementText(doc, searchText) {
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
        const index = node.textContent.indexOf(searchText);
        if (index !== -1) {
            const range = doc.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + searchText.length);
            const selection = doc.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            return node;
        }
    }
    return null;
}

function buildPlaybackLines(text) {
    let queueList = SentenceSplitter.splitTextIntoSentences(text);
    queueList = SentenceSplitter.applyFilterList(queueList, []);
    let mergedQueueList = SentenceSplitter.mergeSentences(queueList);
    mergedQueueList = mergedQueueList.filter(t => {
        if (!t) return false;
        const cleanText = t.replace(/&nbsp;/g, '').trim();
        return cleanText.length > 0;
    });
    return mergedQueueList;
}

describe('Click to Read -> Continue simulation (OpenCritic)', () => {
    let dom;

    beforeEach(async () => {
        const html = fs.readFileSync(fixturePath, 'utf-8');
        dom = new JSDOM(html, { url: 'https://opencritic.com/game/6224/super-mario-party' });
        setupGlobals(dom);

        // The vendored Readability.js tries to assign module.exports, which
        // breaks under ESM. Make module undefined before loading it.
        globalThis.module = undefined;

        // fragment-generation-and-text-fragment-utils.js registers its helpers
        // on the Node global object, but textTracking.js expects them on
        // window.VR_Reader. Load it first and copy them over.
        await import('../js/utils/fragment-generation-and-text-fragment-utils.js');
        dom.window.VR_Reader.generateFragment = globalThis.generateFragment;
        dom.window.VR_Reader.processTextFragmentDirective = globalThis.processTextFragmentDirective;

        await import('../js/content/textTracking.js');
    }, 20000);

    async function runContinueTest(strictMode) {
        const searchText = 'Critic Reviews for Super Mario Party';
        VR_Reader.savedLocalStorageGlobal['DEFAULT_READER_STRICT_MODE'] = strictMode;

        const selectedNode = selectElementText(document, searchText);
        expect(selectedNode).not.toBeNull();

        const captured = VR_Reader.captureSelectionData();
        expect(captured).not.toBeNull();
        expect(VR_Reader.storedSelectionData).not.toBeNull();

        const result = await VR_Reader.calculateRemainingText();
        expect(result).not.toBeNull();
        expect(result.remainingText).toBeTruthy();
        expect(result.remainingText.length).toBeGreaterThan(50);

        console.log(`\n=== Click to Read: "${searchText}" (strict=${strictMode}) ===`);
        console.log(`Method used: ${result.method}`);
        console.log(`Remaining text length: ${result.remainingText.length}`);
        console.log(`First 300 chars of remaining text:\n${result.remainingText.substring(0, 300)}...`);

        const playbackLines = buildPlaybackLines(result.remainingText);
        console.log(`\n=== Playback lines after clicking Continue (${playbackLines.length} lines) ===`);
        playbackLines.slice(0, 30).forEach((line, i) => {
            console.log(`${i + 1}. ${line}`);
        });
        if (playbackLines.length > 30) {
            console.log(`... and ${playbackLines.length - 30} more lines`);
        }

        return { result, playbackLines };
    }

    it('uses Readability in strict mode and drops review metadata', async () => {
        const { result, playbackLines } = await runContinueTest(true);

        expect(playbackLines.length).toBeGreaterThan(0);
        // Strict mode should go through the Readability / precise-text-fragment path.
        expect(['precise-text-fragment', 'text-match-fallback', 'retry-kept-comments']).toContain(result.method);

        const joined = playbackLines.join(' ');
        expect(joined).toContain('Super Mario Party has some strong new ideas');
        // Readability currently strips author/outlet/score details.
        expect(joined).not.toContain('Samuel Claiborn');
        expect(joined).not.toContain('7.3 / 10.0');
    });

    it('uses relaxed mode and preserves review author, outlet, and score metadata', async () => {
        const { result, playbackLines } = await runContinueTest(false);

        expect(playbackLines.length).toBeGreaterThan(0);
        expect(result.method).toBe('relaxed-complete-page');

        const joined = playbackLines.join(' ');
        expect(joined).toContain('IGN');
        expect(joined).toContain('Samuel Claiborn');
        expect(joined).toContain('7.3 / 10.0');

        // Relaxed extraction should keep each review block on its own line,
        // not concatenate adjacent block containers into one sentence.
        const gameInformerLine = playbackLines.find(line => line.includes('Game Informer'));
        expect(gameInformerLine).toBeTruthy();
        expect(gameInformerLine).not.toContain('GameSpot');

        const gameSpotLine = playbackLines.find(line => line.includes('GameSpot'));
        expect(gameSpotLine).toBeTruthy();
    });
});
