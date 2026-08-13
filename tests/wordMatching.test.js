import { describe, it, expect } from 'vitest';
import {
    normalizeWord,
    phoneticNormalize,
    levenshteinDistance,
    wordToNumber,
    wordsMatch,
    isStopWord
} from '../js/utils/wordMatching.js';

describe('wordMatching - normalizeWord', () => {
    it('should lowercase and strip diacritics', () => {
        expect(normalizeWord('Café')).toBe('cafe');
        expect(normalizeWord('Ångström')).toBe('angstrom');
    });

    it('should strip punctuation but keep letters, numbers and apostrophes', () => {
        expect(normalizeWord("don't")).toBe("don't");
        expect(normalizeWord('Hello, world!')).toBe('helloworld');
        expect(normalizeWord('19:30')).toBe('1930');
    });

    it('should return empty string for empty input', () => {
        expect(normalizeWord('')).toBe('');
        expect(normalizeWord(null)).toBe('');
    });
});

describe('wordMatching - phoneticNormalize', () => {
    it('should normalize phonetic variants', () => {
        expect(phoneticNormalize('daemons')).toBe('demons');
        expect(phoneticNormalize('philosophy')).toBe('filosofy');
        expect(phoneticNormalize('check')).toBe('khek');
        expect(phoneticNormalize('cafe')).toBe('kafe');
        expect(phoneticNormalize('cat')).toBe('kat');
        expect(phoneticNormalize('circle')).toBe('sirkle');
    });
});

describe('wordMatching - levenshteinDistance', () => {
    it('should compute edit distances', () => {
        expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
        expect(levenshteinDistance('same', 'same')).toBe(0);
        expect(levenshteinDistance('abc', '')).toBe(3);
        expect(levenshteinDistance('', 'abc')).toBe(3);
    });
});

describe('wordMatching - wordToNumber', () => {
    it('should convert numeric strings', () => {
        expect(wordToNumber('19')).toBe(19);
        expect(wordToNumber('1920')).toBe(1920);
    });

    it('should convert single number words', () => {
        expect(wordToNumber('nineteen')).toBe(19);
        expect(wordToNumber('seventy')).toBe(70);
        expect(wordToNumber('zero')).toBe(0);
    });

    it('should convert multi-word numbers', () => {
        expect(wordToNumber('twenty one')).toBe(21);
        expect(wordToNumber('one hundred')).toBe(100);
        expect(wordToNumber('two thousand and five')).toBe(2005);
    });

    it('should return null for non-numbers', () => {
        expect(wordToNumber('hello')).toBeNull();
        expect(wordToNumber('')).toBeNull();
        expect(wordToNumber(null)).toBeNull();
    });
});

describe('wordMatching - wordsMatch', () => {
    it('should match identical normalized words', () => {
        expect(wordsMatch('Hello', 'hello')).toBe(true);
    });

    it('should match diacritic variants', () => {
        expect(wordsMatch('café', 'cafe')).toBe(true);
    });

    it('should match phonetic variants', () => {
        expect(wordsMatch('daemons', 'demons')).toBe(true);
        expect(wordsMatch('philosophy', 'filosofy')).toBe(true);
    });

    it('should match edit-distance variants', () => {
        expect(wordsMatch('committment', 'commitment')).toBe(true);
    });

    it('should match number words vs numerals', () => {
        expect(wordsMatch('nineteen', '19')).toBe(true);
        expect(wordsMatch('19', 'nineteen')).toBe(true);
    });

    it('should reject clearly different words', () => {
        expect(wordsMatch('cat', 'dog')).toBe(false);
        expect(wordsMatch('the', 'their')).toBe(false);
    });

    it('should not match when either side is empty', () => {
        expect(wordsMatch('', 'hello')).toBe(false);
        expect(wordsMatch('hello', '')).toBe(false);
    });
});

describe('wordMatching - isStopWord', () => {
    it('should identify common stop words', () => {
        expect(isStopWord('the')).toBe(true);
        expect(isStopWord('with')).toBe(true);
        expect(isStopWord('should')).toBe(true);
    });

    it('should reject content words and case-insensitively', () => {
        expect(isStopWord('The')).toBe(true);
        expect(isStopWord('elephant')).toBe(false);
        expect(isStopWord('5')).toBe(false);
    });
});
