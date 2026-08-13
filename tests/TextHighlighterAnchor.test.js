import { describe, it, expect, beforeEach } from 'vitest';
import '../js/utils/fragment-generation-and-text-fragment-utils.js';
import TextHighlighter from '../js/components/speech/tts-voice-player/TextHighlighter.js';
import { createTextFragment, createHighlightOnPage } from '../js/utils/helpers.js';

function setupGlobals() {
    window.VR_Reader = {
        savedMarkElements: [],
        savedHighlightedElements: {},
        savedLocalStorageGlobal: {},
        ttsWidget: { changePlayingButtonStatus() {} }
    };
    globalThis.activeOverlayElements = [];

    // JSDOM does not compute layout, so the visibility checks in the
    // text-fragment matcher would reject every node. Treat all nodes as visible.
    if (!Element.prototype.checkVisibility) {
        Element.prototype.checkVisibility = () => true;
    }
    if (!window.getComputedStyle) {
        window.getComputedStyle = () => ({
            visibility: 'visible',
            display: 'inline',
            position: 'static'
        });
    }
}

function buildForumPage() {
    // The metadata div sits between the two sentences in Post #2. This means
    // captureHighlightAnchor() after sentence 1 lands on the date text, not on
    // sentence 2, simulating the overshoot that makes plain anchor-only search
    // fall through to the duplicate quote block in Post #3.
    document.body.innerHTML = `
        <div id="post2" class="post">
            <p id="post2-s1">A little bit of jumpscare at the end.</p>
            <div class="post-meta">Aug 2, 8:29 AM</div>
            <p id="post2-s2">I thought the next episode is TP4, but apparently just Phase Four lol</p>
        </div>
        <div id="post3" class="post">
            <blockquote id="quote-body">
                dazedcowcow62 said:
                A little bit of jumpscare at the end. I thought the next episode is TP4, but apparently just Phase Four lol
            </blockquote>
            <p id="post3-body">Yeah but that's what leads to turning point 4 and it's close. Super excited.</p>
        </div>
    `;
}

function mockPlayer(queue) {
    return {
        replayQueue: queue.map((text, index) => ({ text, index })),
        wordTimestamps: new Map(),
        voicePrefs: {
            highlightReadingEnabled: true,
            autoscrollReadingEnabled: false
        }
    };
}

async function highlightSentence(highlighter, text, index, anchor = null) {
    await highlighter.createHighlights(text, index, anchor);
    return window.VR_Reader.savedMarkElements.slice();
}

async function createMarkForSentence(text) {
    const fragment = createTextFragment({
        status: 0,
        fragment: { textStart: text.trim().replace(/\.*$/g, '') }
    });
    const result = await createHighlightOnPage(
        fragment,
        [Math.floor(Date.now() / 1000)],
        false,
        false,
        0,
        true,
        null
    );
    return result;
}

describe('TextHighlighter auto-advance anchor behavior', () => {
    beforeEach(() => {
        setupGlobals();
        buildForumPage();
    });

    it('highlights sentence 2 in Post #2, not the quote block in Post #3', async () => {
        const sentence1 = 'A little bit of jumpscare at the end.';
        const sentence2 = 'I thought the next episode is TP4, but apparently just Phase Four lol';
        const sentence3 = "Yeah but that's what leads to turning point 4 and it's close. Super excited.";

        const player = mockPlayer([sentence1, sentence2, sentence3]);
        const highlighter = new TextHighlighter(player);

        // Simulate the user having just heard sentence 1 (Post #2).
        const firstHighlightResult = await createMarkForSentence(sentence1);
        expect(firstHighlightResult.processedDirectives[0].length).toBeGreaterThan(0);
        expect(document.getElementById('post2-s1').contains(firstHighlightResult.processedDirectives[0][0])).toBe(true);

        const anchor = highlighter.captureHighlightAnchor();
        expect(anchor).not.toBeNull();

        // Auto-advance to sentence 2 with the captured anchor.
        window.VR_Reader.savedMarkElements = [];
        globalThis.activeOverlayElements = [];

        await highlightSentence(highlighter, sentence2, 1, anchor);

        const marks = window.VR_Reader.savedMarkElements;
        expect(marks.length).toBeGreaterThan(0);

        const firstMark = marks[0];
        expect(document.getElementById('post2-s2').contains(firstMark)).toBe(true);
        expect(document.getElementById('quote-body').contains(firstMark)).toBe(false);
    });

    it('uses the document-first fallback when the anchor overshoots to a later duplicate', async () => {
        const sentence2 = 'I thought the next episode is TP4, but apparently just Phase Four lol';

        document.body.innerHTML = `
            <p id="target">${sentence2}</p>
            <blockquote id="quote">${sentence2}</blockquote>
        `;

        // No prefix/suffix context available, so the code will use the plain
        // anchor-only path. The anchor is deliberately placed inside the quote
        // block to simulate an overshoot. The document-first fallback finds the
        // earlier #target occurrence. With the old FOLLOWING bitmask check, the
        // quote block would incorrectly be kept.
        const quote = document.getElementById('quote');
        const quoteTextNode = quote.firstChild;
        const anchor = { node: quoteTextNode, offset: 0 };

        const player = mockPlayer([sentence2]);
        const highlighter = new TextHighlighter(player);

        await highlightSentence(highlighter, sentence2, 0, anchor);

        const marks = window.VR_Reader.savedMarkElements;
        expect(marks.length).toBeGreaterThan(0);

        const firstMark = marks[0];
        expect(document.getElementById('target').contains(firstMark)).toBe(true);
        expect(document.getElementById('quote').contains(firstMark)).toBe(false);
    });

    it('keeps context highlights on the definition-list entry, not an earlier body mention', async () => {
        const prevSentence = 'Having to pay for a game that already exists is still frustrating, though.';
        const target = 'Developer(s) Halo Studios';

        document.body.innerHTML = `
            <p id="body-mention">There's already the issue of Halo Studios requiring two subscriptions.</p>
            <p id="prev-para">${prevSentence}</p>
            <dl id="game-details">
                <div>
                    <dt id="game-details-dt"><strong>Developer(s)</strong></dt>
                    <dd id="game-details-dd"><span>Halo Studios</span></dd>
                </div>
            </dl>
        `;

        // Anchor right after the preceding paragraph, i.e. just before the
        // definition list where the dropdown-selected line actually lives.
        const prevPara = document.getElementById('prev-para');
        const anchorNode = document.createTextNode(' ');
        prevPara.appendChild(anchorNode);
        const anchor = { node: anchorNode, offset: 0 };

        const player = mockPlayer([prevSentence, target]);
        const highlighter = new TextHighlighter(player);

        window.VR_Reader.savedMarkElements = [];
        globalThis.activeOverlayElements = [];

        await highlightSentence(highlighter, target, 1, anchor);

        const marks = window.VR_Reader.savedMarkElements;
        expect(marks.length).toBeGreaterThan(0);

        const markInDd = marks.some(m => document.getElementById('game-details-dd').contains(m));
        const markInBody = marks.some(m => document.getElementById('body-mention').contains(m));
        expect(markInDd).toBe(true);
        expect(markInBody).toBe(false);
    });

    it('does not jump back to an earlier post when the same user posted twice', async () => {
        const post1End = 'Rudeus being a doting parent is sweet.';
        const post2Start = 'Yeah but that is what leads to turning point 4.';

        document.body.innerHTML = `
            <div id="post1">
                <div class="avatar">MegamiRem Forever Ai's fan</div>
                <p id="post1-body">${post1End}</p>
            </div>
            <div id="post2">
                <div class="avatar">MegamiRem Forever Ai's fan</div>
                <p id="post2-body">${post2Start}</p>
            </div>
        `;

        // Anchor at the end of the first post. The prefix (post1End) appears
        // in post #1, but the target must be at or after the anchor.
        const post1Body = document.getElementById('post1-body');
        const anchorNode = document.createTextNode(' ');
        post1Body.appendChild(anchorNode);
        const anchor = { node: anchorNode, offset: 0 };

        const player = mockPlayer([post1End, post2Start]);
        const highlighter = new TextHighlighter(player);

        window.VR_Reader.savedMarkElements = [];
        globalThis.activeOverlayElements = [];

        await highlightSentence(highlighter, post2Start, 1, anchor);

        const marks = window.VR_Reader.savedMarkElements;
        expect(marks.length).toBeGreaterThan(0);

        const firstMark = marks[0];
        expect(document.getElementById('post2-body').contains(firstMark)).toBe(true);
        expect(document.getElementById('post1-body').contains(firstMark)).toBe(false);
    });
});
