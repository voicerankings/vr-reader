/**
 * WordHighlighter
 * Parses timestamp data returned by TTS providers and orchestrates the DOM manipulations
 * to highlight individual words smoothly as the audio plays.
 */
import { createTextFragment, scrollElementToReadingPosition } from "../../../utils/helpers";
import { normalizeWord, wordsMatch, isStopWord } from "../../../utils/wordMatching";

const WORD_LEAD_BUFFER_MS = 50;

export default class WordHighlighter {
    constructor(player) {
        this.player = player;
    }

    static isWordChar(char) {
        return /[a-zA-Z0-9_]/.test(char);
    }

    static isWordBoundary(text, startIndex, wordLength) {
        if (startIndex === -1) return false;
        const before = startIndex > 0 ? text[startIndex - 1] : ' ';
        const after = startIndex + wordLength < text.length ? text[startIndex + wordLength] : ' ';
        return !WordHighlighter.isWordChar(before) && !WordHighlighter.isWordChar(after);
    }

    static findWord(text, word, startPos) {
        let pos = startPos;
        const lowerText = text.toLowerCase();
        const lowerWord = word.toLowerCase();
        const cleanWord = word.includes("'") || word.includes("’") ? word.replace(/['’]/g, '').toLowerCase() : null;
        const baseWord = word.includes("'") || word.includes("’") ? word.split(/['’]/)[0].toLowerCase() : null;

        while (pos < text.length) {
            let candidates = [];

            let idx1 = lowerText.indexOf(lowerWord, pos);
            if (idx1 !== -1) candidates.push({ idx: idx1, length: word.length });

            let idxClean = cleanWord ? lowerText.indexOf(cleanWord, pos) : -1;
            if (idxClean !== -1) candidates.push({ idx: idxClean, length: cleanWord.length });

            let idxBase = baseWord ? lowerText.indexOf(baseWord, pos) : -1;
            if (idxBase !== -1) candidates.push({ idx: idxBase, length: baseWord.length });

            if (candidates.length === 0) return null;

            // Sort candidates by lowest index first
            candidates.sort((a, b) => a.idx - b.idx);

            for (const cand of candidates) {
                if (WordHighlighter.isWordBoundary(text, cand.idx, cand.length)) {
                    return { index: cand.idx, length: cand.length };
                }
            }

            pos++;
        }
        return null;
    }

    injectWordHighlightStyles(highlightMode) {
        const styleId = 'vrrWordHighlightStyles';
        let styleElement = document.getElementById(styleId);

        const transition = (highlightMode === 'smooth')
            ? 'transition: left 0.1s linear, top 0.1s linear, width 0.1s linear, height 0.1s linear;'
            : 'transition: none;';

        const cssContent = `
            .word-highlight-bar {
                position: absolute;
                background-color: rgba(168, 85, 247, 0.4);
                border-radius: 3px;
                ${transition}
                opacity: 0;
                z-index: 2147483647;
                pointer-events: none;
                /* Blend only applies while the bar is visible. The invisible
                   (pre-created) bar must not force an isolated blend layer on
                   first paint, which causes a momentary layout/compositing
                   glitch. */
                mix-blend-mode: normal;
            }

            .word-highlight-bar.active {
                opacity: 1;
                mix-blend-mode: multiply;
            }

            .word-highlight-target {
                display: inline !important;
                /* Do NOT add position: relative or z-index here. Keeping these
                   spans as ordinary inline boxes ensures the sentence overlay's
                   mark.getClientRects() returns continuous line boxes instead
                   of fragmenting into one box per word. */
                padding: 0 !important;
                margin: 0 !important;
                border: 0 !important;
                font: inherit !important;
                line-height: inherit !important;
                vertical-align: baseline !important;
                background-color: transparent !important;
                text-transform: inherit !important;
                letter-spacing: inherit !important;
                word-spacing: inherit !important;
                text-decoration: inherit !important;
                color: inherit !important;
                text-shadow: inherit !important;
            }

            @media (prefers-color-scheme: dark) {
                .word-highlight-bar {
                    background-color: rgba(168, 85, 247, 0.6);
                }
            }
        `;

        if (styleElement) {
            if (styleElement.textContent !== cssContent) {
                styleElement.textContent = cssContent;
            }
        } else {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            styleElement.textContent = cssContent;
            document.head.appendChild(styleElement);
        }

        this.player.wordHighlightStylesInjected = true;
    }

    highlightWordsWithTiming(textNodes, wordTimestamps, utteranceText, sentenceIndex, highlightMode = 'smooth') {
        this.player.clearWordHighlights();

        requestAnimationFrame(() => {
            if (this.player.currentPlayingIndex !== sentenceIndex) return;

            const state = this._createWordHighlightState(textNodes, wordTimestamps, utteranceText, sentenceIndex);
            if (!state) return;

            this.activateWordHighlights(state, highlightMode);
        });
    }

    findWordIndexAtTime(wordTimestamps, currentTimeMs) {
        if (currentTimeMs < wordTimestamps[0].startTime) {
            return -1;
        }

        let left = 0;
        let right = wordTimestamps.length - 1;
        let result = -1;

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const word = wordTimestamps[mid];

            if (currentTimeMs >= word.startTime && currentTimeMs < word.endTime) {
                return mid;
            }

            if (currentTimeMs >= word.endTime) {
                result = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return result;
    }

    findAllTextNodesForUtterance(utteranceText, sentenceIndex = null) {
        const textNodes = [];
        const marks = document.querySelectorAll('mark.text-fragments-vrr.vrr-streaming');

        const normalizedUtterance = utteranceText.trim().replace(/\s+/g, ' ').toLowerCase();

        for (const mark of marks) {
            // Only consider marks belonging to the requested sentence. This
            // prevents the word bar from jumping backward to an earlier
            // duplicate occurrence of the same text on the page.
            if (sentenceIndex !== null && mark.dataset.answerListId !== String(sentenceIndex)) {
                continue;
            }

            const markText = mark.textContent.trim().replace(/\s+/g, ' ').toLowerCase();

            if (markText.includes(normalizedUtterance) || normalizedUtterance.includes(markText)) {
                const walker = document.createTreeWalker(
                    mark,
                    NodeFilter.SHOW_TEXT,
                    {
                        acceptNode: (node) => {
                            return node.textContent.trim().length > 0
                                ? NodeFilter.FILTER_ACCEPT
                                : NodeFilter.FILTER_REJECT;
                        }
                    }
                );

                let node;
                while (node = walker.nextNode()) {
                    textNodes.push(node);
                }
            }
        }

        return textNodes;
    }

    clearWordHighlights() {
        if (this.player.currentWordHighlightInterval) {
            cancelAnimationFrame(this.player.currentWordHighlightInterval);
            this.player.currentWordHighlightInterval = null;
        }

        const highlightBar = document.querySelector('.vrr-floating-highlight');
        if (highlightBar) highlightBar.remove();
        this.player.currentHighlightBar = null;

        const wordSpans = document.querySelectorAll('.word-highlight-target');

        wordSpans.forEach((span) => {
            // Preserve word spans inside preloaded (pending) highlights.
            if (span.closest && span.closest('mark.vrr-highlight-pending')) return;
            if (span.parentNode) {
                const text = document.createTextNode(span.textContent);
                span.parentNode.replaceChild(text, span);
            }
        });

        this.player.currentHighlightedWords = [];
    }

    _createWordHighlightState(textNodes, wordTimestamps, utteranceText, sentenceIndex) {
        if (!wordTimestamps || wordTimestamps.length === 0) {
            console.warn('No word timestamps to highlight');
            return null;
        }

        const wrappedWords = this.wrapWordsInSpans(textNodes, utteranceText, sentenceIndex);

        if (!wrappedWords || wrappedWords.length === 0) return null;

        const validSpans = wrappedWords.filter(s => s !== null);
        if (validSpans.length === 0) return null;

        const anchorSpan = validSpans[0];
        anchorSpan.style.setProperty('position', 'relative', 'important');

        const highlightBar = document.createElement('div');
        highlightBar.className = 'word-highlight-bar';
        // Inline guarantee that the bar is out of flow from the very first
        // frame. Its stylesheet rule alone is not enough: if the injected
        // styles aren't applied for even one frame, this block <div> would sit
        // in the paragraph's line flow and push the sentence down momentarily.
        highlightBar.style.setProperty('position', 'absolute', 'important');
        anchorSpan.appendChild(highlightBar);

        return { wrappedWords, highlightBar, anchorSpan, utteranceText, sentenceIndex };
    }

    prepareWordHighlights(sentenceIndex) {
        const clip = this.player.replayQueue[sentenceIndex];
        if (!clip) {
            console.warn(`No clip for sentence index ${sentenceIndex}`);
            return null;
        }

        const utteranceText = this.player.cleanUtteranceText(clip.text);
        const wordTimestamps = this.player.wordTimestamps.get(sentenceIndex);

        if (!wordTimestamps || wordTimestamps.length === 0) return null;

        const allTextNodes = this.findAllTextNodesForUtterance(utteranceText, sentenceIndex);
        if (allTextNodes.length === 0) {
            console.warn(`No text nodes found for preloaded sentence ${sentenceIndex}`);
            return null;
        }

        const state = this._createWordHighlightState(allTextNodes, wordTimestamps, utteranceText, sentenceIndex);
        if (state) {
            this.player.pendingWordHighlights.set(sentenceIndex, state);
            console.log(`✅ Preloaded word highlights for sentence ${sentenceIndex}: ${state.wrappedWords.length} words`);
        }
        return state;
    }

    activateWordHighlights(state, highlightMode = 'smooth') {
        if (!state) return;

        const { wrappedWords, highlightBar, anchorSpan, sentenceIndex } = state;

        if (this.player.currentPlayingIndex !== sentenceIndex) return;

        highlightBar.classList.add('vrr-floating-highlight', 'active');
        this.player.currentHighlightBar = highlightBar;

        let lastHighlightedIndex = -1;

        const highlightNextWord = () => {
            if (this.player.currentPlayingIndex !== sentenceIndex) return;

            if (!this.player.externalAudioSpeaking) return;

            if (highlightMode === 'instant') {
                this.player.frameSkipCounter++;
                if (this.player.frameSkipCounter % 2 !== 0) {
                    this.player.currentWordHighlightInterval = requestAnimationFrame(highlightNextWord);
                    return;
                }
            }

            const currentAudioTime = this.player.currentAudioTime;
            const currentWordIndex = this.findWordIndexAtTime(
                this.player.wordTimestamps.get(sentenceIndex),
                currentAudioTime + WORD_LEAD_BUFFER_MS
            );

            if (currentWordIndex !== lastHighlightedIndex && currentWordIndex !== -1) {
                const wordSpan = wrappedWords[currentWordIndex];

                if (wordSpan && wordSpan.parentElement) {
                    const rect = wordSpan.getBoundingClientRect();
                    const referenceRect = anchorSpan.getClientRects()[0] || anchorSpan.getBoundingClientRect();

                    highlightBar.style.left = `${rect.left - referenceRect.left}px`;
                    highlightBar.style.top = `${rect.top - referenceRect.top}px`;
                    highlightBar.style.width = `${rect.width}px`;
                    highlightBar.style.height = `${rect.height}px`;

                    if (currentWordIndex % 10 === 0 &&
                        typeof VR_Reader !== 'undefined' &&
                        VR_Reader.savedLocalStorageGlobal &&
                        VR_Reader.savedLocalStorageGlobal['DEFAULT_AUTOSCROLL_READING_STATE'] === true) {
                        scrollElementToReadingPosition(wordSpan);
                    }

                    lastHighlightedIndex = currentWordIndex;
                }
            }

            this.player.currentWordHighlightInterval = requestAnimationFrame(highlightNextWord);
        };

        // Highlight the first word immediately so the bar appears as soon as
        // audio starts, rather than waiting for the first timeupdate event.
        highlightNextWord();
    }

    wrapWordsInSpans(textNodes, utteranceText, sentenceIndex = null) {
        const wrappedSpans = [];

        const targetIndex = sentenceIndex !== null ? sentenceIndex : this.player.currentPlayingIndex;
        const timestamps = this.player.wordTimestamps.get(targetIndex);
        if (!timestamps || timestamps.length === 0) return wrappedSpans;

        const words = timestamps.map(t => t.word);

        let combinedText = '';
        const nodeMap = [];
        textNodes.forEach((node, nodeIdx) => {
            const text = node.textContent;
            for (let i = 0; i < text.length; i++) {
                nodeMap.push({ nodeIdx, charIdx: i });
            }
            combinedText += text;
        });

        const tokens = [];
        {
            const tokenRegex = /\S+/g;
            let tokenMatch;
            while ((tokenMatch = tokenRegex.exec(combinedText)) !== null) {
                tokens.push({ start: tokenMatch.index, end: tokenMatch.index + tokenMatch[0].length, text: tokenMatch[0] });
            }
        }

        const wordPositions = [];
        let searchPos = 0;
        let tokenCursor = 0;
        let consecutiveUnmatched = 0;

        const isSequenceOrDistinctiveMatch = (markIdx, tokenIdx) => {
            const currentNorm = normalizeWord(words[markIdx]);

            if (currentNorm.length >= 5 && !isStopWord(currentNorm)) return true;

            let prevMatches = false;
            let prevIsNonStop = false;
            if (markIdx > 0 && tokenIdx > 0) {
                const prevMark = words[markIdx - 1];
                const prevToken = tokens[tokenIdx - 1].text;
                if (prevMark && prevToken && wordsMatch(prevMark, prevToken)) {
                    prevMatches = true;
                    if (!isStopWord(prevMark) || !isStopWord(prevToken)) prevIsNonStop = true;
                }
            }

            let nextMatches = false;
            let nextIsNonStop = false;
            if (markIdx < words.length - 1 && tokenIdx < tokens.length - 1) {
                const nextMark = words[markIdx + 1];
                const nextToken = tokens[tokenIdx + 1].text;
                if (nextMark && nextToken && wordsMatch(nextMark, nextToken)) {
                    nextMatches = true;
                    if (!isStopWord(nextMark) || !isStopWord(nextToken)) nextIsNonStop = true;
                }
            }

            if (!isStopWord(currentNorm) && (prevMatches || nextMatches)) return true;
            if (prevIsNonStop || nextIsNonStop) return true;
            if (prevMatches && nextMatches) return true;

            return false;
        };

        for (let i = 0; i < words.length; i++) {
            const word = words[i];

            while (tokenCursor < tokens.length && tokens[tokenCursor].end <= searchPos) {
                tokenCursor++;
            }

            let match = WordHighlighter.findWord(combinedText, word, searchPos);

            // Lookahead Heuristic: 
            // If we found a match, but it is further ahead, check if a FUTURE word matches CLOSER to searchPos.
            // If it does, this match is likely a false positive (matching a later occurrence of the word).
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
                    match = null;
                }
            }

            if (match !== null && match.index + match.length > nodeMap.length) {
                match = null;
            }

            if (match === null) {
                // Fuzzy token-based fallback: transcript and page text often differ in spelling,
                // numbers, contractions, or accents. Try matching against nearby text tokens so
                // the word isn't skipped. Strictly forward-only (monotonic) - never backwards.
                const maxLookAhead = consecutiveUnmatched >= 3 ? 15 : 5;
                for (let offset = 0; offset < maxLookAhead && tokenCursor + offset < tokens.length; offset++) {
                    const token = tokens[tokenCursor + offset];
                    if (token.start < searchPos) continue;
                    if (wordsMatch(word, token.text)) {
                        if (offset <= 1 || isSequenceOrDistinctiveMatch(i, tokenCursor + offset)) {
                            match = { index: token.start, length: token.end - token.start };
                            tokenCursor = tokenCursor + offset + 1;
                            break;
                        }
                    }
                }
            }

            if (match === null) {
                wordPositions.push(null);
                consecutiveUnmatched++;
                continue;
            }

            consecutiveUnmatched = 0;

            const foundIndex = match.index;
            const wordLength = match.length;

            if (foundIndex + wordLength > nodeMap.length) {
                wordPositions.push(null);
                continue;
            }

            wordPositions.push({
                word,
                wordIndex: i,
                startPos: foundIndex,
                endPos: foundIndex + wordLength,
                startNode: nodeMap[foundIndex].nodeIdx,
                endNode: nodeMap[foundIndex + wordLength - 1].nodeIdx
            });

            searchPos = foundIndex + wordLength;
        }

        const validPositions = wordPositions.filter(wp => wp !== null);
        const replacements = [];

        textNodes.forEach((textNode, nodeIdx) => {
            const text = textNode.textContent;
            const fragment = document.createDocumentFragment();
            const nodeSpans = [];

            const wordsInNode = validPositions.filter(wp =>
                wp.startNode <= nodeIdx && wp.endNode >= nodeIdx
            );

            if (wordsInNode.length === 0) return;

            let nodeOffset = 0;
            for (let i = 0; i < nodeIdx; i++) nodeOffset += textNodes[i].textContent.length;

            let charIndex = 0;

            wordsInNode.forEach(wp => {
                let wordStartInNode = Math.max(0, wp.startPos - nodeOffset);
                let wordEndInNode = Math.min(text.length, wp.endPos - nodeOffset);

                if (wordStartInNode < charIndex) {
                    wordStartInNode = charIndex;
                }
                if (wordEndInNode <= wordStartInNode) return;

                if (charIndex < wordStartInNode) {
                    fragment.appendChild(document.createTextNode(text.substring(charIndex, wordStartInNode)));
                }

                const span = document.createElement('span');
                span.className = 'word-highlight-target';
                span.textContent = text.substring(wordStartInNode, wordEndInNode);
                span.setAttribute('data-word-index', wp.wordIndex);

                fragment.appendChild(span);
                nodeSpans.push(span);

                charIndex = wordEndInNode;
            });

            if (charIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(charIndex)));
            }

            replacements.push({ textNode, fragment, spans: nodeSpans });
        });

        for (const { textNode, fragment, spans } of replacements) {
            if (textNode.parentNode) {
                textNode.parentNode.replaceChild(fragment, textNode);
                wrappedSpans.push(...spans);
            }
        }

        const spansByWordIndex = new Map();
        for (const span of wrappedSpans) {
            const wordIndex = span.getAttribute('data-word-index');
            if (wordIndex === null || spansByWordIndex.has(wordIndex)) continue;
            spansByWordIndex.set(wordIndex, span);
        }

        const alignedSpans = [];
        let lastAlignedSpan = null;
        for (let i = 0; i < wordPositions.length; i++) {
            if (wordPositions[i] === null) {
                alignedSpans.push(lastAlignedSpan);
                continue;
            }
            lastAlignedSpan = spansByWordIndex.get(String(i)) || null;
            alignedSpans.push(lastAlignedSpan);
        }

        return alignedSpans;
    }

    getTextNodesInRange(range) {
        const textNodes = [];

        const walker = document.createTreeWalker(
            range.commonAncestorContainer,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    if (node.textContent.trim().length === 0) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            }
        );

        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }

        return textNodes;
    }

    parseWordTimestamps(wordTimestampArray, sentenceIndex) {
        if (!wordTimestampArray || !Array.isArray(wordTimestampArray)) {
            console.warn('Invalid word timestamp array');
            return;
        }

        let parsedTimestamps = wordTimestampArray.map(item => {
            const data = typeof item === 'string' ? JSON.parse(item) : item;

            let cleanWord = data.word
                .replace(/^["'""]+|["'""]+$/g, '')
                .replace(/^—+|—+$/g, '')
                .trim();

            const originalWord = cleanWord;
            const matchWord = cleanWord.replace(/[,;:.!?]+$/g, '').trim();

            const startTimeMs = data.startTime;
            const durationMs = data.duration;

            return {
                word: matchWord,
                originalWord: originalWord,
                rawWord: data.word,
                startTime: startTimeMs,
                duration: durationMs,
                endTime: startTimeMs + durationMs
            };
        })
            .filter(item => {
                const hasAlphaNumeric = /[a-zA-Z0-9]/.test(item.word);
                return hasAlphaNumeric;
            });

        const filteredTimestamps = [];
        for (let i = 0; i < parsedTimestamps.length; i++) {
            const current = parsedTimestamps[i];
            const next = parsedTimestamps[i + 1];

            if (next &&
                next.startTime < current.endTime &&
                next.word.toLowerCase().replace(/[^a-z0-9]/g, '').includes(current.word.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
                continue;
            }

            filteredTimestamps.push(current);
        }

        const expandedTimestamps = [];
        for (const item of filteredTimestamps) {
            const parts = item.word.split(/\s+/).filter(w => w.length > 0 && /[a-zA-Z0-9]/.test(w));

            if (parts.length <= 1) {
                expandedTimestamps.push(item);
                continue;
            }

            const totalChars = parts.reduce((acc, p) => acc + p.length, 0);
            const totalDuration = item.duration || 0;
            let currentStart = item.startTime;

            for (const subWord of parts) {
                const subDuration = totalChars > 0
                    ? Math.round((subWord.length / totalChars) * totalDuration)
                    : Math.round(totalDuration / parts.length);

                expandedTimestamps.push({
                    ...item,
                    word: subWord,
                    originalWord: subWord,
                    startTime: currentStart,
                    duration: subDuration,
                    endTime: currentStart + subDuration
                });

                currentStart += subDuration;
            }
        }

        this.player.wordTimestamps.set(sentenceIndex, expandedTimestamps);

        console.log(`✅ Stored ${expandedTimestamps.length} word timestamps (expanded from ${filteredTimestamps.length}, filtered from ${parsedTimestamps.length})`);
    }
}
