import { CONSTANTS } from "../../../constants/constants";
import { levenshteinDistance, hasTimeInString } from "../../../utils/helpers";

/**
 * ============================================================================
 * SentenceSplitter (Text Parsing Engine)
 * ============================================================================
 * Provides advanced regex parsing to chunk large blocks of text into individual 
 * TTS-friendly sentences. Understands English abbreviations (Mr., Dr., etc.) 
 * to prevent unnatural mid-sentence splitting.
 */
export default class SentenceSplitter {
    static splitTextIntoSentences(processedText) {
        const abbreviations = [
            'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Rev', 'Sr', 'Jr', 'St', 'Pres', 'Gov', 'Sen',
            'Rep', 'Lt', 'Col', 'Gen', 'Maj', 'Capt', 'Sgt', 'Pvt', 'Adm', 'Cpl', 'Cmdr',
            'Ens', 'Amb', 'Asst', 'Supt', 'Sec', 'Treas', 'Dep', 'Dir', 'Adj', 'Bp', 'Cpt',
            'Ald', 'Cl', 'Pr', 'Secy',
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Sept', 'Oct', 'Nov', 'Dec',
            'etc', 'vs', 'i\\.e', 'e\\.g', 'cf', 'approx', 'est', 'vol', 'no', 'Inc', 'Corp', 'Ltd',
            'Co', 'Ave', 'Blvd', 'Rd', 'Dept', 'Univ', 'Assn', 'Bros', 'Ph\\.D', 'M\\.D', 'B\\.A',
            'M\\.A', 'U\\.S', 'U\\.K', 'E\\.U'
        ];

        const sentenceEndPattern =
            `(?<!\\b(?:${abbreviations.join('|')}))` +
            `(?<!\\b[A-Z])` +
            `(?<!\\d)` +
            `[.?!。]` +
            `["'""'']?` +
            `(?=\\s|[.?!。]|$)`;

        const quoteNewlinePattern = `["'""'']\\s*\\n`;
        const finalRegex = new RegExp(`${sentenceEndPattern}|${quoteNewlinePattern}|\\n`, 'g');
        const UNIQUE_DELIMITER = '___SENTENCE_BREAK___';

        let textWithDelimiters = processedText.replace(finalRegex, (match) => {
            if (match === '\n') return UNIQUE_DELIMITER;
            return `${match}${UNIQUE_DELIMITER}`;
        });

        return textWithDelimiters
            .split(UNIQUE_DELIMITER)
            .map(s => s.trim())
            .filter(s => s.length > 0 && /[a-zA-Z0-9]/.test(s));
    }

    static splitTextIntoSentencesUnprotected(processedText) {
        const sentenceEndPattern = `[.?!。]` +
            `["'""]?` +
            `(?=\\s|[.?!。]|$)`;

        const finalRegex = new RegExp(`${sentenceEndPattern}|\\n`, 'g');
        const UNIQUE_DELIMITER = '___SENTENCE_BREAK___';

        let textWithDelimiters = processedText.replace(finalRegex, (match) => {
            if (match === '\n') return UNIQUE_DELIMITER;
            return `${match}${UNIQUE_DELIMITER}`;
        });

        return textWithDelimiters
            .split(UNIQUE_DELIMITER)
            .map(s => s.trim())
            .filter(s => s.length > 0 && /[a-zA-Z0-9]/.test(s));
    }

    static calculateStringDifferencePercentage(str1, str2) {
        const maxLength = Math.max(str1.length, str2.length);
        const distance = levenshteinDistance(str1, str2);
        const differencePercentage = (distance / maxLength) * 100;
        const similarityPercentage = 100 - differencePercentage;
        return similarityPercentage;
    }

    static regexIndexOf(text, regex, startIndex) {
        const indexInSuffix = text.slice(startIndex).search(regex);
        const pos = indexInSuffix < 0 ? indexInSuffix : indexInSuffix + startIndex;

        if (pos !== -1 && text.slice(pos, pos + 1) === '.') {
            const abbreviationPattern = new RegExp(`\\b(?:${CONSTANTS.ABBREVIATIONS.join('|')})\\.$`, 'i');
            const precedingText = text.slice(0, pos + 1);
            const abbreviationMatch = abbreviationPattern.test(precedingText);

            if (abbreviationMatch) {
                const newPos = pos + 1;
                const result = SentenceSplitter.regexIndexOf(text, regex, newPos);
                return {
                    delimeter: result.delimeter,
                    pos: result.pos
                };
            }
        }

        const matches = text.matchAll(regex);
        let matchText;
        for (const match of matches) {
            matchText = match[0];
            break;
        }

        return {
            delimeter: (pos === -1) ? false : text.slice(pos, pos + 1),
            pos: pos + 1
        };
    }

    static removeUrlInBrackets(text) {
        const regex = /\[https?:\/\/[^\]]*\]/g;
        text = text.replace(regex, '');
        const regex2 = /\b(https?|ftp|file):\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;]*[-A-Za-z0-9+&@#/%=~_|]/g;
        return text.replace(regex2, '');
    }

    static stripMarkdownAsterisks(text) {
        return text.replace(/\*{2,}/g, '');
    }

    static removeBracketedSlashes(text) {
        const regex = /\[.*?\/.*?\]/g;
        text = text.replace(regex, '');
        const regex2 = /\[\/.*?\]/g;
        text = text.replace(regex2, '');
        const regex3 = /\[\\.*?\]/g;
        text = text.replace(regex3, '');
        return text;
    }

    static removeTelStrings(text) {
        const regex = /\[tel:\d+\]/g;
        return text.replace(regex, '');
    }

    static isOnlyPeriodsAndSpaces(str) {
        return /^[\.\s]*$/.test(str);
    }

    static findText(arr, str) {
        const lowerCaseArr = arr.map((obj) => obj.text.toLowerCase().replace(/[^A-Za-z0-9]/g, ''));
        return lowerCaseArr.findIndex((text) => text.indexOf(str.toLowerCase().replace(/[^A-Za-z0-9]/g, '')) > -1);
    }

    static endsWithRegexMatch(inputString, regexPattern) {
        const modifiedRegex = new RegExp(regexPattern.source + '$', 'g');
        const searchResult = inputString.search(modifiedRegex);
        return searchResult !== -1;
    }

    static removeLeadingAndTrailingAsterisksAndNewline(input) {
        input = input.replace(/^[*\n]+/, '');
        input = input.replace(/[*\n]+$/, '');
        return input;
    }

    static findLongestCommonSuffix(s1, s2) {
        let minLength = Math.min(s1.length, s2.length);
        for (let i = 1; i <= minLength; i++) {
            if (s1.slice(-i) !== s2.slice(-i)) {
                return s1.slice(-(i - 1));
            }
        }
        return s1.slice(-minLength);
    }

    static cleanOutput(output) {
        output = output.replace(/:\n/g, '. ');
        output = SentenceSplitter.removeLeadingAndTrailingAsterisksAndNewline(output);
        output = SentenceSplitter.removeUrlInBrackets(output);
        output = SentenceSplitter.stripMarkdownAsterisks(output);
        output = SentenceSplitter.removeBracketedSlashes(output);
        output = SentenceSplitter.removeTelStrings(output);
        output = SentenceSplitter.stripEmojis(output);
        return output;
    }

    static stripEmojis(str) {
        return str.replace(
            /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
            ''
        );
    }

    static checkMatch(arr, matchStr) {
        if (arr.length === 0) {
            return false;
        }
        const lastItem = arr[arr.length - 1].text;
        if (SentenceSplitter.calculateStringDifferencePercentage(lastItem, matchStr) > 90) return true;
        return lastItem.endsWith(matchStr);
    }

    static findAndRemoveTimeStrings(nextSpeechUtteranceText0) {
        let arr = nextSpeechUtteranceText0.split("\n");
        let foundTime = false;
        for (let i = arr.length - 1; i >= 0; i--) {
            if (hasTimeInString(arr[i])) {
                arr = arr.slice(i + 1);
                foundTime = true;
                break;
            }
        }
        if (foundTime) {
            return arr.join("\n");
        } else {
            return nextSpeechUtteranceText0;
        }
    }

    static isValidText(input) {
        const validPattern = /[a-zA-Z0-9]/;
        return typeof input === 'string' && validPattern.test(input.trim());
    }

    static mergeSentences(queueList) {
        // No merging - each fragment stays as its own sentence
        // This preserves exact text matching for the highlighter
        return queueList.map(line => line.replace(/[\s\u00A0]+/g, ' ').trim());
    }

    static applyFilterList(queueList, filterList) {
        if (!filterList || filterList.length === 0) {
            return queueList;
        }

        const processedList = [];

        const checkMatch = (text, pattern, type, caseSensitive = false) => {
            const t = caseSensitive ? text : text.toLowerCase();
            const p = caseSensitive ? pattern : pattern.toLowerCase();

            switch (type) {
                case 'regex':
                    try {
                        const hasUppercase = /[A-Z]/.test(pattern);
                        const flags = hasUppercase ? '' : 'i';
                        return new RegExp(pattern, flags).test(text);
                    } catch {
                        return false;
                    }
                case 'exact':
                case 'equals':
                    return caseSensitive ? text === pattern : t === p;
                case 'startsWith':
                    return t.startsWith(p);
                case 'endsWith':
                    return t.endsWith(p);
                case 'contains':
                default:
                    return t.includes(p);
            }
        };

        mainLoop:
        for (let i = 0; i < queueList.length; i++) {
            let currentLine = queueList[i];
            let shouldKeep = true;

            for (let j = 0; j < filterList.length; j++) {
                const filter = filterList[j];

                let action = 'remove';
                let matchMethod = filter.type;

                if (filter.type.startsWith('stop')) {
                    action = 'stop';
                    matchMethod = filter.type.includes('_') ? filter.type.split('_')[1] : 'contains';
                } else if (filter.type === 'clean') {
                    action = 'clean';
                    matchMethod = 'regex';
                }

                const normalizedForCheck = currentLine.replace(/[\s\u00A0]+/g, ' ').trim();
                const isMatch = checkMatch(normalizedForCheck, filter.pattern, matchMethod);

                if (isMatch) {
                    if (action === 'stop') {
                        break mainLoop;
                    } else if (action === 'clean') {
                        try {
                            const hasUppercase = /[A-Z]/.test(filter.pattern);
                            const flags = hasUppercase ? 'g' : 'gi';
                            const regex = new RegExp(filter.pattern, flags);
                            currentLine = currentLine.replace(regex, '').replace(/\s+/g, ' ').trim();
                        } catch (e) {
                            console.error(`Invalid clean pattern: ${filter.pattern}`, e);
                        }
                    } else if (action === 'remove') {
                        shouldKeep = false;
                        break;
                    }
                }
            }

            if (shouldKeep && currentLine.trim().length > 0) {
                processedList.push(currentLine);
            }
        }

        return processedList;
    }
}
