import { describe, it, expect } from 'vitest';
import '../js/utils/fragment-generation-and-text-fragment-utils.js';

// This jsdom does not implement element layout, so the matcher's visibility
// check (which falls back to offsetWidth/getClientRects) would reject every
// text node. Treat all elements as visible so the real matching logic runs.
if (typeof Element !== 'undefined' && typeof Element.prototype.checkVisibility !== 'function') {
    Element.prototype.checkVisibility = function () { return true; };
}

// Sentence exactly as a TTS flow would hand it to the matcher (contiguous
// possessive). The page DOM below renders the same possessive with an inline
// element boundary + stray whitespace, which is why getTextContent collapses it
// to "Townfall 's" instead of "Townfall's".
const SENTENCE = "But about Townfall's ending, the developer had this to say.";

// Mirror of the apostrophe merge used in normalizeString, for assertions only.
const normalizeForAssertion = (s) => s
    .replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/([a-z0-9]) '([a-z0-9])/g, "$1'$2")
    .toLowerCase();

function highlightOnPage(sentence, html) {
    document.body.innerHTML = html;
    document.documentElement.lang = 'en';

    const result = globalThis.processFragmentDirectives(
        { text: [{ textStart: sentence, prefix: '', textEnd: '', suffix: '' }] },
        true,
        false
    );

    const marks = Array.from(document.querySelectorAll('mark'));
    const joinedMarkText = marks.map(m => m.textContent).join('');

    return { marks, joinedMarkText, result };
}

describe('fragment utils - split possessive normalization', () => {
    it('merges a possessive split by an inline boundary + newline', () => {
        const { marks, joinedMarkText } = highlightOnPage(
            SENTENCE,
            `<p>But about <span class="italic"><span>Townfall</span>
</span>'s ending, the developer had this to say.</p>`
        );

        expect(marks.length).toBeGreaterThan(0);
        expect(normalizeForAssertion(joinedMarkText)).toBe(normalizeForAssertion(SENTENCE));
    });

    it('merges a possessive split by a space inside the preceding span', () => {
        const { marks, joinedMarkText } = highlightOnPage(
            SENTENCE,
            `<p>But about <span class="italic"><span>Townfall</span> </span>'s ending, the developer had this to say.</p>`
        );

        expect(marks.length).toBeGreaterThan(0);
        expect(normalizeForAssertion(joinedMarkText)).toBe(normalizeForAssertion(SENTENCE));
    });

    it('merges a possessive split by a space in the following text node', () => {
        const { marks, joinedMarkText } = highlightOnPage(
            SENTENCE,
            `<p>But about <span class="italic"><span>Townfall</span></span> 's ending, the developer had this to say.</p>`
        );

        expect(marks.length).toBeGreaterThan(0);
        expect(normalizeForAssertion(joinedMarkText)).toBe(normalizeForAssertion(SENTENCE));
    });

    it('merges a possessive split by a space on both sides of the boundary', () => {
        const { marks, joinedMarkText } = highlightOnPage(
            SENTENCE,
            `<p>But about <span class="italic"><span>Townfall</span> </span> 's ending, the developer had this to say.</p>`
        );

        expect(marks.length).toBeGreaterThan(0);
        expect(normalizeForAssertion(joinedMarkText)).toBe(normalizeForAssertion(SENTENCE));
    });

    it('still matches when the DOM is already contiguous (no regression)', () => {
        const { marks, joinedMarkText } = highlightOnPage(
            SENTENCE,
            `<p>But about <span class="italic"><span>Townfall</span></span>'s ending, the developer had this to say.</p>`
        );

        expect(marks.length).toBeGreaterThan(0);
        expect(normalizeForAssertion(joinedMarkText)).toBe(normalizeForAssertion(SENTENCE));
    });

    it('normalizes curly apostrophes on both sides of the boundary', () => {
        const { marks, joinedMarkText } = highlightOnPage(
            "It's about Townfall's ending and the rest.",
            `<p>It’s about <span>Townfall</span>
’s ending and the rest.</p>`
        );

        expect(marks.length).toBeGreaterThan(0);
        expect(normalizeForAssertion(joinedMarkText)).toBe(normalizeForAssertion("It's about Townfall's ending and the rest."));
    });

    it('matches a split contraction across an inline boundary', () => {
        const { marks, joinedMarkText } = highlightOnPage(
            "They don't think it will work.",
            `<p>They <span>don</span>
't think it will work.</p>`
        );

        expect(marks.length).toBeGreaterThan(0);
        expect(normalizeForAssertion(joinedMarkText)).toBe(normalizeForAssertion("They don't think it will work."));
    });
});

describe('fragment utils - typographic punctuation normalization', () => {
    const stripForAssertion = (s) => s
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\u2026/g, '...')
        .replace(/\s+/g, ' ')
        .toLowerCase();

    it('matches curly double quotes against straight quotes in the DOM', () => {
        const sentence = 'She said "hello" and left.';
        const { marks, joinedMarkText } = highlightOnPage(
            sentence,
            `<p>She said \u201Chello\u201D and left.</p>`
        );

        expect(marks.length).toBeGreaterThan(0);
        expect(stripForAssertion(joinedMarkText)).toBe(stripForAssertion(sentence));
    });

    it('matches em-dash text against a hyphen in the DOM', () => {
        const sentence = 'It was good \u2014 wait, actually it was nice to see him again.';
        const { marks, joinedMarkText } = highlightOnPage(
            sentence,
            `<p>It was good - wait, actually it was nice to see him again.</p>`
        );

        expect(marks.length).toBeGreaterThan(0);
        expect(stripForAssertion(joinedMarkText)).toBe(stripForAssertion(sentence));
    });

    it('matches ellipsis against three literal dots in the DOM', () => {
        const sentence = 'And then he paused \u2026 and thought about it.';
        const { marks, joinedMarkText } = highlightOnPage(
            sentence,
            `<p>And then he paused ... and thought about it.</p>`
        );

        expect(marks.length).toBeGreaterThan(0);
        expect(stripForAssertion(joinedMarkText)).toBe(stripForAssertion(sentence));
    });
});

describe('fragment utils - ambiguity handling', () => {
    it('uses the first match when the sentence appears more than once', () => {
        const sentence = 'A sentence that appears twice.';
        const { marks, joinedMarkText } = highlightOnPage(
            sentence,
            `<p>A sentence that appears twice.</p><p>A sentence that appears twice.</p>`
        );

        // Previously this returned [] (ambiguous) and forced the native
        // highlighter fallback. Now the first match should be highlighted.
        expect(marks.length).toBeGreaterThan(0);
        expect(joinedMarkText).toContain('A sentence that appears twice');
    });

    it('disambiguates duplicates using prefix/suffix context', () => {
        // Forum-style: "Aug 2, 8:27 AM" appears at the top of post #1 AND
        // again before post #2. With prefix "She really is adorable." the
        // matcher finds the second occurrence.
        document.body.innerHTML = `
            <p>Aug 2, 8:27 AM</p>
            <p>#1 MegamiRem</p>
            <p>She really is adorable.</p>
            <p>Aug 2, 8:27 AM</p>
            <p>#2 dazedcowcow62</p>
        `;
        document.documentElement.lang = 'en';

        const result = globalThis.processFragmentDirectives(
            { text: [{ textStart: 'Aug 2, 8:27 AM', prefix: 'She really is adorable.', textEnd: '', suffix: '' }] },
            true,
            false
        );

        const marks = Array.from(document.querySelectorAll('mark'));
        const paragraphs = Array.from(document.body.querySelectorAll('p'));

        // The mark must live inside the SECOND "Aug 2, 8:27 AM" paragraph
        // (index 3), not the first (index 0).
        expect(marks.length).toBeGreaterThan(0);
        const markedParagraph = paragraphs.findIndex(p => p.contains(marks[0]));
        expect(markedParagraph).toBe(3);
    });
});
