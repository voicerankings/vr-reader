const NUMBER_WORDS_ONES = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
    'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18,
    'nineteen': 19
};

const NUMBER_WORDS_TENS = {
    'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
    'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90
};

const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'at', 'by', 'for', 'with',
    'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'once',
    'here', 'there', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just',
    'should', 'now', 'be', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'having',
    'do', 'does', 'did', 'of', 'it', 'its', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that'
]);

export function normalizeWord(word) {
    if (!word) return '';
    return String(word)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}']/gu, '');
}

export function phoneticNormalize(str) {
    return (str || '')
        .toLowerCase()
        .replace(/ae/g, 'e')
        .replace(/oe/g, 'e')
        .replace(/ph/g, 'f')
        .replace(/ck/g, 'k')
        .replace(/c([iey])/g, 's$1')
        .replace(/c/g, 'k');
}

export function levenshteinDistance(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const row = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) row[j] = j;

    for (let i = 1; i <= a.length; i++) {
        let prev = i;
        for (let j = 1; j <= b.length; j++) {
            const val = a[i - 1] === b[j - 1]
                ? row[j - 1]
                : Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
            row[j - 1] = prev;
            prev = val;
        }
        row[b.length] = prev;
    }

    return row[b.length];
}

export function wordToNumber(text) {
    if (!text) return null;

    const normalized = String(text).toLowerCase().trim();

    const numValue = Number(normalized);
    if (!isNaN(numValue)) return numValue;

    if (NUMBER_WORDS_ONES[normalized] !== undefined) return NUMBER_WORDS_ONES[normalized];
    if (NUMBER_WORDS_TENS[normalized] !== undefined) return NUMBER_WORDS_TENS[normalized];

    const words = normalized.split(/[\s-]+/);
    let total = 0;
    let current = 0;

    for (const word of words) {
        if (NUMBER_WORDS_ONES[word] !== undefined) {
            current += NUMBER_WORDS_ONES[word];
        } else if (NUMBER_WORDS_TENS[word] !== undefined) {
            current += NUMBER_WORDS_TENS[word];
        } else if (word === 'hundred') {
            current = current * 100;
        } else if (word === 'thousand') {
            total += current * 1000;
            current = 0;
        } else if (word === 'million') {
            total += current * 1000000;
            current = 0;
        } else if (word === 'billion') {
            total += current * 1000000000;
            current = 0;
        }
    }

    total += current;
    return total > 0 ? total : null;
}

export function wordsMatch(transcriptWord, textWord) {
    const normalizedTranscript = normalizeWord(transcriptWord);
    const normalizedText = normalizeWord(textWord);

    if (!normalizedTranscript || !normalizedText) return false;
    if (normalizedTranscript === normalizedText) return true;

    const pTranscript = phoneticNormalize(normalizedTranscript);
    const pText = phoneticNormalize(normalizedText);
    if (pTranscript === pText) return true;

    const maxLen = Math.max(normalizedTranscript.length, normalizedText.length);
    const minLen = Math.min(normalizedTranscript.length, normalizedText.length);

    if (minLen >= 4) {
        const dist = levenshteinDistance(normalizedTranscript, normalizedText);
        if (maxLen <= 5 && dist <= 1) return true;
        if (maxLen <= 8 && dist <= 2) return true;
        if (maxLen > 8 && dist <= 3) return true;
        if ((maxLen - dist) / maxLen >= 0.70) return true;
    }

    const transcriptNum = wordToNumber(normalizedTranscript);
    if (transcriptNum !== null && normalizedText === String(transcriptNum)) return true;

    const textNum = wordToNumber(normalizedText);
    if (textNum !== null && normalizedTranscript === String(textNum)) return true;

    return false;
}

export function isStopWord(w) {
    return STOP_WORDS.has(normalizeWord(w));
}
