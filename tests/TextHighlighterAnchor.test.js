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

describe('TextHighlighter anchor candidates', () => {
    beforeEach(() => {
        setupGlobals();
    });

    // A hero section whose copy is broken up by <br> and nested divs, followed by
    // card copy that reuses short words. This is the shape that produced a stray
    // one-word highlight in an unrelated card on gadgets.muse.ai.
    function buildSplitHeroPage() {
        document.body.innerHTML = `
            <div id="hero">
                <p id="hero-p1">Get started by grabbing an <a href="#">SDK token</a> and one of our featured <a href="#">project ideas</a>. Then tinker and customize to your heart's delight.</p>
                <p id="hero-p2">Or build support for an entirely new board<br>if that's more your thing.</p>
            </div>
            <div id="cards">
                <div id="card-1">
                    <h3>ESP32 Device SDK</h3>
                    <p>Connect your ESP32 board to Muse through our open source SDK. Throw in a screen to show images, add audio in and out, <em>or</em> wire up other sensors.</p>
                </div>
            </div>
        `;
    }

    it('never anchors on hidden, script or extension-widget text after a mark', () => {
        buildSplitHeroPage();

        // Mark the first hero paragraph, then append the kinds of nodes that used
        // to capture the anchor and push the next search past the real text.
        const p1 = document.getElementById('hero-p1');
        const mark = document.createElement('mark');
        mark.textContent = 'Then tinker and customize to your heart\u2019s delight.';
        p1.appendChild(mark);
        window.VR_Reader.savedMarkElements = [mark];

        const decoy = document.createElement('div');
        decoy.innerHTML = `
            <script id="decoy-script">window.__tracker = "or build support";</script>
            <style id="decoy-style">.or { color: red; }</style>
            <div id="decoy-hidden" style="display:none">or build support for an entirely new board</div>
            <div id="decoy-aria" aria-hidden="true">or build support for an entirely new board</div>
            <div id="vrr-widget-toast">or build support for an entirely new board</div>
            <p id="hero-p2">Or build support for an entirely new board<br>if that's more your thing.</p>
        `;
        document.body.appendChild(decoy);

        const highlighter = new TextHighlighter(mockPlayer([]));
        const anchor = highlighter.captureHighlightAnchor();

        expect(anchor).not.toBeNull();
        expect(anchor.node.textContent).toContain('Or build support');

        // The anchor must not come from any of the decoy containers.
        for (const id of ['decoy-script', 'decoy-style', 'decoy-hidden', 'decoy-aria', 'vrr-widget-toast']) {
            const el = document.getElementById(id);
            expect(el.contains(anchor.node)).toBe(false);
        }
    });

    it('does not reduce a block-straddling sentence to a lone stop word in an unrelated card', async () => {
        buildSplitHeroPage();

        // The queue sentence as the page reader produces it: the <br> makes the
        // matcher split the block group, so the whole sentence can never match.
        const straddling = "Or build support for an entirely new board if that's more your thing.";
        const player = mockPlayer([straddling]);
        const highlighter = new TextHighlighter(player);

        window.VR_Reader.savedMarkElements = [];
        globalThis.activeOverlayElements = [];

        await highlightSentence(highlighter, straddling, 0, null);

        const marks = window.VR_Reader.savedMarkElements;
        const markedText = marks.map(m => m.textContent).join('').trim();
        const markedWords = markedText ? markedText.split(/\s+/) : [];

        // The regression was a single stray word matched inside #card-1.
        const strayInCard = marks.some(m => document.getElementById('card-1').contains(m));
        expect(strayInCard).toBe(false);

        // And nothing shorter than the 3-word floor should ever be marked.
        expect(markedWords.length).not.toBe(1);
    });
});
