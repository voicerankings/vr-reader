import { describe, it, expect } from 'vitest';
import SentenceSplitter from '../js/components/speech/tts-voice-player/SentenceSplitter.js';

describe('SentenceSplitter', () => {
    describe('splitTextIntoSentences', () => {
        it('should split standard paragraph into sentences', () => {
            const text = "First sentence here. Second sentence starts now! Is this the third?";
            const sentences = SentenceSplitter.splitTextIntoSentences(text);
            expect(sentences).toHaveLength(3);
            expect(sentences[0]).toBe("First sentence here.");
            expect(sentences[1]).toBe("Second sentence starts now!");
            expect(sentences[2]).toBe("Is this the third?");
        });

        it('should not split on English abbreviations like Dr. or Mr.', () => {
            const text = "Dr. Smith met with Mr. Johnson at 5 p.m. It was a good meeting.";
            const sentences = SentenceSplitter.splitTextIntoSentences(text);
            expect(sentences).toHaveLength(2);
            expect(sentences[0]).toBe("Dr. Smith met with Mr. Johnson at 5 p.m.");
            expect(sentences[1]).toBe("It was a good meeting.");
        });
    it('should split on a hard newline boundary (title as its own line)', () => {
            const text = "Why U.S. Markets React\nIn particular, the volatility this week surprised analysts abruptly.";
            const sentences = SentenceSplitter.splitTextIntoSentences(text);
            expect(sentences[0]).toBe("Why U.S. Markets React");
            expect(sentences[1]).toBe("In particular, the volatility this week surprised analysts abruptly.");
        });
    });

    describe('applyFilterList', () => {
        it('should strip clean filter patterns like citation numbers [1]', () => {
            const queue = ["Quantum computing[1] is fast[2]."];
            const filters = [{ type: 'clean', pattern: '\\[\\d+\\]' }];
            const result = SentenceSplitter.applyFilterList(queue, filters);

            expect(result).toHaveLength(1);
            expect(result[0]).toBe("Quantum computing is fast.");
        });

        it('should skip entire lines matching contains filters', () => {
            const queue = [
                "This is main content.",
                "Leave a comment below.",
                "Thanks for reading."
            ];
            const filters = [{ type: 'contains', pattern: 'Leave a comment' }];
            const result = SentenceSplitter.applyFilterList(queue, filters);

            expect(result).toHaveLength(2);
            expect(result).toEqual([
                "This is main content.",
                "Thanks for reading."
            ]);
        });

        it('should halt playback completely when encountering stop_exact filter', () => {
            const queue = [
                "Line 1 content.",
                "How this was made",
                "Line 3 after stop header."
            ];
            const filters = [{ type: 'stop_exact', pattern: 'How this was made' }];
            const result = SentenceSplitter.applyFilterList(queue, filters);

            expect(result).toHaveLength(1);
            expect(result[0]).toBe("Line 1 content.");
        });

        it('should not halt stop_exact when sentence only contains the pattern inside a sentence', () => {
            const queue = [
                "Let me tell you how this was made in detail.",
                "How this was made"
            ];
            const filters = [{ type: 'stop_exact', pattern: 'How this was made' }];
            const result = SentenceSplitter.applyFilterList(queue, filters);

            expect(result).toHaveLength(1);
            expect(result[0]).toBe("Let me tell you how this was made in detail.");
        });
    });
});
