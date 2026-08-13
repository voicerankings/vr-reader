import { describe, it, expect } from 'vitest';
import WordHighlighter from '../js/components/speech/external-voice-player/WordHighlighter.js';

describe('WordHighlighter - Core Algorithmic Logic', () => {
    describe('isWordBoundary', () => {
        it('should correctly identify word boundaries around standard words', () => {
            const text = 'The quick brown fox';
            const index = text.indexOf('quick');
            expect(WordHighlighter.isWordBoundary(text, index, 'quick'.length)).toBe(true);
        });

        it('should correctly reject partial matches (substring trap)', () => {
            const text = 'A foxy quick brown fox';
            const index = text.indexOf('fox'); // Finds 'fox' inside 'foxy'
            expect(WordHighlighter.isWordBoundary(text, index, 'fox'.length)).toBe(false);
            
            const secondIndex = text.lastIndexOf('fox'); // Finds the actual 'fox'
            expect(WordHighlighter.isWordBoundary(text, secondIndex, 'fox'.length)).toBe(true);
        });

        it('should handle boundaries for acronyms with punctuation', () => {
            const text = 'I.B.M. is a company';
            // Even though I, B, M are separated by dots, the boundaries are respected.
            // If we search for 'I', index 0, length 1
            expect(WordHighlighter.isWordBoundary(text, 0, 1)).toBe(true);
            // Search for 'B', index 2, length 1
            expect(WordHighlighter.isWordBoundary(text, 2, 1)).toBe(true);
        });

        it('should handle boundaries for contractions', () => {
            const text = "Please don't jump";
            const index = text.indexOf("don't");
            expect(WordHighlighter.isWordBoundary(text, index, 5)).toBe(true);
        });
    });

    describe('findWord', () => {
        it('should find exact matches with case insensitivity', () => {
            const text = 'HeLLo World';
            const match = WordHighlighter.findWord(text, 'hello', 0);
            expect(match).not.toBeNull();
            expect(match.index).toBe(0);
            expect(match.length).toBe(5);
        });

        it('should skip partial matches and find the whole word', () => {
            const text = 'He was sixty when he caught six fish';
            // Start at 0, looking for 'six'. Should skip 'sixty' and find 'six'
            const match = WordHighlighter.findWord(text, 'six', 0);
            expect(match).not.toBeNull();
            expect(match.index).toBe(28); // index of 'six'
        });

        it('should match the base word if the word includes quotes', () => {
            const text = 'Please dont jump'; // User text doesn't have the quote
            // TTS transcript has "don't"
            const match = WordHighlighter.findWord(text, "don't", 0);
            expect(match).not.toBeNull();
            expect(match.index).toBe(7);
            expect(match.length).toBe(4); // matched "dont", length 4
        });

        it('should return null if the word cannot be found at all', () => {
            const text = 'The apple is red';
            const match = WordHighlighter.findWord(text, 'banana', 0);
            expect(match).toBeNull();
        });
    });

    describe('wrapWordsInSpans alignment (word split across text nodes)', () => {
        function buildHighlightedSpans() {
            const player = {
                currentPlayingIndex: 0,
                wordTimestamps: new Map([[0, [
                    { word: 'When', startTime: 0, duration: 100, endTime: 100 },
                    { word: 'building', startTime: 100, duration: 100, endTime: 200 },
                    { word: "Townfall's", startTime: 200, duration: 100, endTime: 300 },
                    { word: 'main', startTime: 300, duration: 100, endTime: 400 },
                    { word: 'story', startTime: 400, duration: 100, endTime: 500 },
                    { word: 'there', startTime: 500, duration: 100, endTime: 600 },
                    { word: 'was', startTime: 600, duration: 100, endTime: 700 },
                    { word: 'a', startTime: 700, duration: 100, endTime: 800 },
                    { word: 'clear', startTime: 800, duration: 100, endTime: 900 },
                    { word: 'effort', startTime: 900, duration: 100, endTime: 1000 }
                ]]])
            };

            const highlighter = new WordHighlighter(player);

            const container = document.createElement('div');
            container.innerHTML =
                '<span>When building </span>' +
                '<span><span class="italic">Townfall\'</span></span>' +
                '<span>s main story, there was a clear effort.</span>';

            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => node.textContent.trim().length > 0
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT
            });

            const textNodes = [];
            while (walker.nextNode()) textNodes.push(walker.currentNode);

            const utteranceText = "When building Townfall's main story, there was a clear effort.";
            return {
                alignedSpans: highlighter.wrapWordsInSpans(textNodes, utteranceText),
                words: ["When", "building", "Townfall's", "main", "story", "there", "was", "a", "clear", "effort"]
            };
        }

        it('keeps every word aligned when a possessive straddles two text nodes', () => {
            const { alignedSpans, words } = buildHighlightedSpans();

            expect(alignedSpans).toHaveLength(words.length);

            alignedSpans.forEach((span, i) => {
                expect(span, `word index ${i} (${words[i]}) should have a highlight span`).not.toBeNull();
            });

            expect(alignedSpans[2].textContent).toBe("Townfall'");
            expect(alignedSpans[3].textContent).toBe('main');
            expect(alignedSpans[4].textContent).toBe('story');
            expect(alignedSpans[8].textContent).toBe('clear');
            expect(alignedSpans[9].textContent).toBe('effort');
        });
    });

    describe('real Deepgram flow (possessive straddles italic span)', () => {
        const DEEPGRAM_WORDS = [
            { word: 'when', start: 0.08, end: 0.32 },
            { word: 'building', start: 0.32, end: 0.72 },
            { word: "townfall's", start: 0.72, end: 1.22 },
            { word: 'main', start: 1.36, end: 1.68 },
            { word: 'story', start: 1.68, end: 2.08 },
            { word: 'there', start: 2.08, end: 2.24 },
            { word: 'was', start: 2.24, end: 2.48 },
            { word: 'a', start: 2.48, end: 2.56 },
            { word: 'clear', start: 2.56, end: 2.88 },
            { word: 'effort', start: 2.88, end: 3.2 },
            { word: 'to', start: 3.2, end: 3.36 },
            { word: 'show', start: 3.36, end: 3.6 },
            { word: 'more', start: 3.6, end: 3.84 },
            { word: 'of', start: 3.84, end: 4.0 },
            { word: "simon's", start: 4.0, end: 4.48 },
            { word: 'in', start: 4.48, end: 4.64 },
            { word: 'the', start: 4.64, end: 4.8 },
            { word: 'moment', start: 4.8, end: 5.2 },
            { word: 'mental', start: 5.2, end: 5.52 },
            { word: 'state', start: 5.52, end: 5.92 },
            { word: 'to', start: 5.92, end: 6.08 },
            { word: 'humanize', start: 6.08, end: 6.56 },
            { word: 'him', start: 6.56, end: 6.88 },
            { word: 'and', start: 6.88, end: 7.12 },
            { word: 'other', start: 7.12, end: 7.52 },
            { word: 'supporting', start: 7.52, end: 7.92 },
            { word: 'characters', start: 7.92, end: 8.42 },
            { word: 'as', start: 8.48, end: 8.64 },
            { word: 'well', start: 8.64, end: 8.96 }
        ];

        const UTTERANCE = "When building Townfall's main story, there was a clear effort to show more of Simon's in the moment mental state to humanize him and other supporting characters as well.";

        it('keeps every word aligned through parseWordTimestamps -> wrapWordsInSpans', () => {
            const player = { currentPlayingIndex: 0, wordTimestamps: new Map() };
            const wh = new WordHighlighter(player);

            document.body.innerHTML = '<p class="ContentParagraph"><mark class="text-fragments-vrr vrr-streaming"><span class="ContentText">When building </span><span class="ContentText"><span class="ContentText-BodyTextChunk_italic">Townfall\'</span></span><span class="ContentText">s main story, there was a clear effort to show more of Simon\'s in the moment mental state to humanize him and other supporting characters as well.</span></mark></p>';

            const deepgramStyle = DEEPGRAM_WORDS.map(w => ({
                word: w.word,
                startTime: Math.round(w.start * 1000),
                duration: Math.round((w.end - w.start) * 1000)
            }));

            wh.parseWordTimestamps(deepgramStyle, 0);

            const textNodes = wh.findAllTextNodesForUtterance(UTTERANCE);
            const alignedSpans = wh.wrapWordsInSpans(textNodes, UTTERANCE);

            expect(textNodes.length).toBeGreaterThan(0);
            expect(alignedSpans).toHaveLength(player.wordTimestamps.get(0).length);

            alignedSpans.forEach((span, i) => {
                expect(span, `word index ${i} should have a highlight span`).not.toBeNull();
            });

            expect(alignedSpans[2].textContent).toBe("Townfall'");
            expect(alignedSpans[3].textContent).toBe('main');
            expect(alignedSpans[14].textContent).toBe("Simon's");
            expect(alignedSpans[28].textContent).toBe('well');
        });
    });

    describe('Lookahead Heuristic Simulation', () => {
        // This simulates the lookahead logic in wrapWordsInSpans
        const simulateLookahead = (combinedText, words) => {
            const results = [];
            let searchPos = 0;
            
            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                let match = WordHighlighter.findWord(combinedText, word, searchPos);

                if (match !== null && match.index > searchPos) {
                    let futureWordCloser = false;
                    for (let j = 1; j <= 3 && i + j < words.length; j++) {
                        const futureWord = words[i + j];
                        let futureMatch = WordHighlighter.findWord(combinedText, futureWord, searchPos);
                        
                        if (futureMatch !== null && futureMatch.index < match.index) {
                            futureWordCloser = true;
                            break;
                        }
                    }

                    if (futureWordCloser) {
                        match = null; // Reject this match
                    }
                }

                if (match !== null) {
                    results.push(word);
                    searchPos = match.index + match.length;
                }
            }
            return results;
        };

        it('should gracefully skip hallucinated words without jumping the pointer', () => {
            // "6" transcribed as "six", but then "six" occurs later naturally.
            const combinedText = '6 books about six dogs';
            const transcript = ['six', 'books', 'about', 'six', 'dogs'];
            
            const highlightedWords = simulateLookahead(combinedText, transcript);
            
            // It should NOT highlight the first 'six' (because it finds the second 'six' but lookahead sees 'books' is closer)
            // It should successfully highlight everything else.
            expect(highlightedWords).toEqual(['books', 'about', 'six', 'dogs']);
        });

        it('should handle perfectly synchronized sequences', () => {
            const combinedText = 'The quick brown fox';
            const transcript = ['The', 'quick', 'brown', 'fox'];
            const highlightedWords = simulateLookahead(combinedText, transcript);
            expect(highlightedWords).toEqual(transcript);
        });
    });

    describe('Preload and activation', () => {
        it('prepares word spans inside a pending mark and activates them without re-wrapping', () => {
            const player = {
                currentPlayingIndex: 1,
                externalAudioSpeaking: true,
                currentAudioTime: 0,
                wordTimestamps: new Map([[1, [
                    { word: 'Hello', startTime: 0, duration: 100, endTime: 100 },
                    { word: 'world', startTime: 100, duration: 100, endTime: 200 }
                ]]]),
                replayQueue: [{ text: 'previous sentence' }, { text: 'Hello world' }],
                pendingWordHighlights: new Map(),
                currentHighlightBar: null,
                currentWordHighlightInterval: null,
                cleanUtteranceText: (t) => t.trim()
            };

            const wh = new WordHighlighter(player);
            document.body.innerHTML = '<p><mark class="text-fragments-vrr vrr-streaming vrr-highlight-pending">Hello world</mark></p>';

            const state = wh.prepareWordHighlights(1);
            expect(state).not.toBeNull();
            expect(player.pendingWordHighlights.has(1)).toBe(true);
            expect(document.querySelectorAll('.word-highlight-target').length).toBe(2);
            expect(document.querySelector('.vrr-floating-highlight')).toBeNull();

            wh.activateWordHighlights(state, 'smooth');
            expect(document.querySelector('.vrr-floating-highlight')).not.toBeNull();
            expect(player.currentHighlightBar).not.toBeNull();

            if (player.currentWordHighlightInterval) {
                cancelAnimationFrame(player.currentWordHighlightInterval);
            }
        });
    });
});
