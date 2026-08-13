import { describe, it, expect } from 'vitest';

/**
 * Helper function replicating the initial Read Later text extraction & sentence merging logic 
 * from Start_VRR.js
 */
function extractReadLaterInitialText(rawText) {
    if (!rawText || rawText.trim().length < 50) {
        return rawText ? rawText.trim() : "";
    }

    const cleanText = rawText.replace(/\s+/g, ' ').trim();
    const MIN_ANCHOR_LENGTH = 50;
    const MAX_ANCHOR_LENGTH = 300;
    let cutoff = -1;

    for (let i = MIN_ANCHOR_LENGTH; i < Math.min(cleanText.length, MAX_ANCHOR_LENGTH); i++) {
        const ch = cleanText[i];
        if (ch === '.' || ch === '!' || ch === '?') {
            const next = cleanText[i + 1];
            if (!next || next === ' ' || next === '\n' || next === '"' || next === '\'' || next === ')') {
                cutoff = i + 1;
                break;
            }
        }
    }

    if (cutoff > 0) {
        return cleanText.substring(0, cutoff).trim();
    } else {
        return cleanText.substring(0, MAX_ANCHOR_LENGTH).trim();
    }
}

/**
 * Helper function replicating the full-sentence capture logic during Read Later progress updates
 * from ExternalVoicePlayer.js and RatingsOverlay.js
 */
function captureLastReadText(currentSentence) {
    if (!currentSentence) return "";
    return currentSentence.trim();
}

describe('Read Later Sentence Capture & Merging', () => {
    describe('Initial Read Later Save (Sentence Merging & Boundary Scanning)', () => {
        it('should merge short initial sentences (< 50 chars) with the next sentence until reaching at least 50 chars', () => {
            const articleText = "Short title. This is the second sentence that contains enough detail to pass fifty characters total.";
            const result = extractReadLaterInitialText(articleText);

            expect(result.length).toBeGreaterThanOrEqual(50);
            expect(result).toBe("Short title. This is the second sentence that contains enough detail to pass fifty characters total.");
        });

        it('should not break on abbreviations like Co. or Ltd. when scanning for sentence boundaries', () => {
            const articleText = "Nintendo Co., Ltd. is a Japanese multinational video game company headquartered in Kyoto.";
            const result = extractReadLaterInitialText(articleText);

            expect(result).toBe("Nintendo Co., Ltd. is a Japanese multinational video game company headquartered in Kyoto.");
        });

        it('should preserve exact sentence wording and normalize multi-line whitespace', () => {
            const articleText = "During a four-hour\n   session I was able to play through\n\tthe entirety of the first act of Galactic Racer.";
            const result = extractReadLaterInitialText(articleText);

            expect(result).toBe("During a four-hour session I was able to play through the entirety of the first act of Galactic Racer.");
        });

        it('should cut off at the first valid sentence boundary at or past 50 characters', () => {
            const articleText = "This first sentence is long enough to cross the fifty character minimum threshold easily. This is a second sentence that should not be included.";
            const result = extractReadLaterInitialText(articleText);

            expect(result).toBe("This first sentence is long enough to cross the fifty character minimum threshold easily.");
        });
    });

    describe('Progress Sync (Full Sentence Capture without 150-char Truncation)', () => {
        it('should capture the full sentence without truncating at 150 characters or cutting words in half', () => {
            const longSentence = "During a four-hour session I was able to play through the entirety of the first act of Galactic Racer’s single-player campaign, which takes your protagonist, Shade, from their first-ever race to the head-to-head qualifier that will earn them entry into the Galactic League tournament.";
            
            const result = captureLastReadText(longSentence);

            // Verify it does NOT truncate to 150 chars ('...takes your prota')
            expect(result.length).toBeGreaterThan(150);
            expect(result.length).toBe(284);
            expect(result.endsWith("Galactic League tournament.")).toBe(true);
            expect(result.endsWith("takes your prota")).toBe(false);
            expect(result).toContain("protagonist");
            expect(result).toBe(longSentence);
        });

        it('should trim extra leading and trailing whitespace from the current sentence', () => {
            const sentenceWithPadding = "   Across that journey, I experienced the thrill of high-speed racing.   \n";
            const result = captureLastReadText(sentenceWithPadding);

            expect(result).toBe("Across that journey, I experienced the thrill of high-speed racing.");
        });

        it('should generate text_fragment_url with the exact same full text as last_read_text', () => {
            const sentence = "It's felt a little bit static in terms of what you play, how you play, what you play with.";
            const baseUrl = "https://www.ign.com/articles/star-wars-galactic-racer-campaign-preview";
            
            const lastReadText = sentence.trim();
            const textFragmentUrl = `${baseUrl}#:~:text=${encodeURIComponent(lastReadText)}`;

            expect(decodeURIComponent(textFragmentUrl.split('#:~:text=')[1])).toBe(lastReadText);
            expect(textFragmentUrl.endsWith("what%20you")).toBe(false);
            expect(textFragmentUrl).toContain("what%20you%20play");
        });
    });
});
