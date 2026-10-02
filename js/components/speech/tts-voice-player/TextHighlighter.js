import {
    createTextFragment,
    createHighlightOnPage,
    removeHiglightOnPage,
    getInnerText,
    isNodeBefore,
    scrollElementToReadingPosition
} from "../../../utils/helpers";

/**
 * ============================================================================
 * TextHighlighter (Visual Sentence Highlighting)
 * ============================================================================
 * Coordinates visual sentence highlighting (as opposed to WordHighlighter's 
 * precision word highlighting) by modifying the DOM tree structure or utilizing
 * the `createHighlightOnPage` directives depending on active mode.
 */
export default class TextHighlighter {
    constructor(voicePlayer) {
        this.player = voicePlayer;
        this._fallbackAnchor = null;
    }

    /**
     * Builds prefix/suffix context from neighboring sentences in the
     * replayQueue so the text-fragment matcher can disambiguate duplicate
     * lines (forum timestamps, repeated profile blocks, etc.).
     *
     * `expandBy` controls how many extra neighbors are pulled in:
     *   0 = immediate neighbors only (fast, covers most cases)
     *   1 = ±2 neighbors (wider context for repeated profile blocks)
     *   2 = ±3 neighbors (maximum expansion)
     *
     * Uses the `#:~:text=[prefix-,]textStart[,-suffix]` format which
     * requires textStart to begin immediately after the matched prefix text.
     */
    getSentenceContext(sentenceIndex, expandBy = 0) {
        const queue = this.player.replayQueue;
        if (!Array.isArray(queue) || queue.length === 0 || sentenceIndex == null) {
            return { prefix: null, suffix: null };
        }
        const CONTEXT_WORDS = 8;
        const totalWords = CONTEXT_WORDS * (expandBy + 1);

        const tailWords = (t) => {
            const w = (t || '').trim().split(/\s+/).filter(Boolean);
            return w.slice(-totalWords).join(' ') || null;
        };
        const headWords = (t) => {
            const w = (t || '').trim().split(/\s+/).filter(Boolean);
            return w.slice(0, totalWords).join(' ') || null;
        };

        // Gather text from multiple neighbor sentences for prefix/suffix
        let prevTexts = [];
        for (let i = 1; i <= expandBy + 1; i++) {
            const p = queue[sentenceIndex - i];
            if (p && p.text) prevTexts.unshift(p.text);
        }
        let nextTexts = [];
        for (let i = 1; i <= expandBy + 1; i++) {
            const n = queue[sentenceIndex + i];
            if (n && n.text) nextTexts.push(n.text);
        }

        return {
            prefix: prevTexts.length ? tailWords(prevTexts.join(' ')) : null,
            suffix: nextTexts.length ? headWords(nextTexts.join(' ')) : null
        };
    }

    /**
     * Tries to highlight the full sentence with progressively wider prefix/suffix
     * context. Returns the result from the first successful attempt, or null if
     * none succeeded (caller should fall back to plain textStart).
     */
    async _tryHighlightWithContext(textStart, hasScrollOn, showHighlight, sentenceIndex, clickable = false, searchStartAnchor = null, inactive = false) {
        for (let expand = 0; expand <= 2; expand++) {
            const ctx = this.getSentenceContext(sentenceIndex, expand);
            if (!ctx.prefix && !ctx.suffix) {
                return null;
            }

            // When the positional anchor is present and no prefix exists, the
            // anchor alone is sufficient to disambiguate the correct occurrence.
            // Including a suffix that is non-contiguous across block boundaries
            // would cause the match to be rejected unnecessarily.
            const effectiveSuffix = (!ctx.prefix && searchStartAnchor) ? null : ctx.suffix;

            let selection = {
                status: 0,
                fragment: {
                    textStart: textStart.trim().replace(/\.*$/g, ""),
                    textEnd: null,
                    prefix: ctx.prefix,
                    suffix: effectiveSuffix
                }
            };
            let fragment = createTextFragment(selection);
            let res = await createHighlightOnPage(
                fragment,
                [Math.floor(Date.now() / 1000)],
                hasScrollOn,
                clickable,
                sentenceIndex,
                showHighlight,
                searchStartAnchor,
                inactive
            );
            if (res.processedDirectives[0].length > 0) {
                return res;
            }
            // Suffix contiguity is brittle across block boundaries. When a
            // prefix exists, retry prefix-only — the prefix alone anchors the
            // match to the correct occurrence.
            if (ctx.prefix && effectiveSuffix) {
                selection.fragment.suffix = null;
                fragment = createTextFragment(selection);
                res = await createHighlightOnPage(
                    fragment,
                    [Math.floor(Date.now() / 1000)],
                    hasScrollOn,
                    clickable,
                    sentenceIndex,
                    showHighlight,
                    searchStartAnchor,
                    inactive
                );
                if (res.processedDirectives[0].length > 0) {
                    return res;
                }
            }
        }
        return null;
    }

    /**
     * Captures the DOM position just after the currently highlighted sentence's
     * <mark> element. Used as a positional anchor so the next search starts
     * *past* the sentence we just read — even when prefix/suffix context is
     * identical across duplicate occurrences (e.g. forum profile blocks).
     *
     * Walks to the first surviving text node after the last mark so that
     * parent.normalize() in removeHiglightOnPage() cannot detach the reference.
     */
    captureHighlightAnchor() {
        const marks = (window.VR_Reader && window.VR_Reader.savedMarkElements) || [];

        // When the previous highlight fell back to native selection, there are
        // no <mark> elements in savedMarkElements. Use the synthetic anchor
        // captured from the native selection's focus range instead.
        if (!marks.length && this._fallbackAnchor) {
            const a = this._fallbackAnchor;
            this._fallbackAnchor = null;
            return a;
        }

        if (!marks.length) return null;

        const lastMark = marks[marks.length - 1];
        if (!lastMark || !lastMark.parentNode) return null;

        try {
            const boundary = document.createRange();
            boundary.setStartAfter(lastMark);

            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
            walker.currentNode = lastMark;
            let node = walker.nextNode();
            while (node) {
                if (!lastMark.contains(node) &&
                    node.textContent && node.textContent.trim().length > 0 &&
                    TextHighlighter._isAnchorCandidate(node)) {
                    return { node, offset: 0 };
                }
                node = walker.nextNode();
            }

            return { node: boundary.startContainer, offset: boundary.startOffset };
        } catch (e) {
            return null;
        }
    }

    /**
     * Guards against the anchor overshooting the real reading position.
     *
     * The walk to "the first text node after the mark" is purely document-order,
     * so without this it happily returns a node from a <script>/<style> body, a
     * hidden tooltip, an off-screen dropdown, or an aria-hidden overlay. Every
     * one of those sits *after* the sentence the user is actually reading, and
     * an anchor past the target makes the next-sentence search skip it entirely
     * and land on an unrelated duplicate further down the page.
     */
    static _isAnchorCandidate(node) {
        const parent = node.parentElement;
        if (!parent) return false;

        // Never anchor on machine-readable or chrome text.
        if (parent.closest('script, style, noscript, template, textarea, svg, head')) return false;

        // The extension's own widgets live in document.body too and are not page
        // content, so anchoring inside them sends the search off the article.
        if (parent.closest('[id^="vrr-"], .vrr-widget, #SelectPlayback')) return false;

        // aria-hidden content is presentational (tooltips, sr-only duplicates).
        if (parent.closest('[aria-hidden="true"]')) return false;

        // Inline/attribute hiding. checkVisibility() is the stronger check but it
        // depends on layout being resolved, so it cannot be the only guard.
        for (let el = parent; el && el !== document.body; el = el.parentElement) {
            if (el.hidden) return false;
            const style = el.style;
            if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return false;
        }

        // Same visibility rule the matcher itself applies.
        if (typeof globalThis.isNodeVisible === 'function' && !globalThis.isNodeVisible(node)) return false;

        return true;
    }

    /**
     * Anchor for the text immediately following a highlight result. Used by the
     * shortening loop so the tail of a partially matched sentence is searched
     * from just after the part that was found, keeping it contiguous.
     */
    _captureAnchorAfterResult(result) {
        const marks = result?.processedDirectives?.[0];
        if (!marks || !marks.length) return null;

        const lastMark = marks[marks.length - 1];
        if (!lastMark || !lastMark.parentNode) return null;

        try {
            const boundary = document.createRange();
            boundary.setStartAfter(lastMark);
            return { node: boundary.startContainer, offset: boundary.startOffset };
        } catch (e) {
            return null;
        }
    }

    /**
     * Returns true when a highlight result's first <mark> is at or after the
     * captured anchor point. Used to reject context matches that landed on an
     * earlier duplicate occurrence.
     */
    _resultIsAtOrAfterAnchor(result, anchor) {
        if (!anchor || !result?.processedDirectives?.[0]?.length) {
            return true;
        }
        const mark = result.processedDirectives[0][0];
        if (!mark) return true;

        try {
            const anchorRange = document.createRange();
            anchorRange.setStart(anchor.node, anchor.offset);
            anchorRange.collapse(true);

            const markRange = document.createRange();
            markRange.selectNode(mark);

            return anchorRange.compareBoundaryPoints(Range.START_TO_START, markRange) <= 0;
        } catch (e) {
            return true;
        }
    }

    /**
     * Unwraps and forgets the <mark> elements produced by a highlight result
     * that was rejected (e.g. it landed before the anchor).
     */
    _removeResultMarks(result) {
        if (!result?.processedDirectives?.[0]?.length) return;
        const marks = result.processedDirectives[0];
        marks.forEach(m => {
            const idx = window.VR_Reader.savedMarkElements.indexOf(m);
            if (idx !== -1) window.VR_Reader.savedMarkElements.splice(idx, 1);
        });
        globalThis.removeMarks(marks);
    }

    /**
     * Runs a plain textStart search with the anchor, then also runs a
     * document-first search without the anchor. Returns whichever result lands
     * earlier in the DOM, cleaning up the rejected marks so they don't leak
     * into the next anchor capture.
     */
    async _plainHighlightWithFallback(plainTextFragment, hasScrollOn, clickable, answerListId, showHighlight, searchStartAnchor, inactive = false) {
        const anchoredMarkCount = window.VR_Reader.savedMarkElements.length;
        const anchoredRes = await createHighlightOnPage(
            plainTextFragment,
            [Math.floor(Date.now() / 1000)],
            hasScrollOn,
            clickable,
            answerListId,
            showHighlight,
            searchStartAnchor,
            inactive
        );
        const anchoredNewMarks = inactive
            ? anchoredRes.processedDirectives[0]
            : window.VR_Reader.savedMarkElements.slice(anchoredMarkCount);

        if (!searchStartAnchor) {
            return anchoredRes;
        }

        // For inactive/preloaded highlights, skip the document-first fallback
        // search. Running two highlight passes while the first pass's marks sit
        // in the DOM wraps the same text twice, creating nested <mark> elements
        // that break word highlighting and clutter the page.
        if (inactive) {
            return anchoredRes;
        }

        const fallbackMarkCount = window.VR_Reader.savedMarkElements.length;
        const fallbackRes = await createHighlightOnPage(
            plainTextFragment,
            [Math.floor(Date.now() / 1000)],
            hasScrollOn,
            clickable,
            answerListId,
            showHighlight,
            null,
            inactive
        );
        const fallbackNewMarks = inactive
            ? fallbackRes.processedDirectives[0]
            : window.VR_Reader.savedMarkElements.slice(fallbackMarkCount);

        const anchoredMarks = anchoredRes.processedDirectives[0];
        const fallbackMarks = fallbackRes.processedDirectives[0];

        // Prefer the document-first result when it exists and lands earlier in
        // the DOM than the anchored result.
        //
        // Deliberately NOT gated on _resultIsAtOrAfterAnchor. That check belongs
        // on the *anchored* result (it already runs in Phase 1 and in
        // highlightWithFallback). Applying it here made the fallback unreachable
        // in the only case it exists for: when the anchor overshot the target,
        // the correct document-first occurrence is by definition *before* the
        // anchor, so the gate rejected it and the wrong duplicate won.
        if (fallbackMarks.length > 0 &&
            (anchoredMarks.length === 0 || isNodeBefore(fallbackMarks[0], anchoredMarks[0]))) {
            if (!inactive) {
                anchoredNewMarks.forEach(m => {
                    const idx = window.VR_Reader.savedMarkElements.indexOf(m);
                    if (idx !== -1) window.VR_Reader.savedMarkElements.splice(idx, 1);
                });
            }
            globalThis.removeMarks(anchoredNewMarks);
            return fallbackRes;
        }

        // Anchored result is earlier (or equal). Discard the document-first marks.
        if (fallbackNewMarks.length > 0) {
            if (!inactive) {
                fallbackNewMarks.forEach(m => {
                    const idx = window.VR_Reader.savedMarkElements.indexOf(m);
                    if (idx !== -1) window.VR_Reader.savedMarkElements.splice(idx, 1);
                });
            }
            globalThis.removeMarks(fallbackNewMarks);
        }
        return anchoredRes;
    }

    async highlightWithFallback(originalText, hasScrollOn, showHighlight, sentenceIndex, searchStartAnchor = null, inactive = false, returnResult = false) {
        let currentText = originalText.trim();
        let remaining = "";

        // Try progressively expanding the context window first.
        // Falls through to the plain textStart + shortening loop below.
        const ctxResult = await this._tryHighlightWithContext(currentText, hasScrollOn, showHighlight, sentenceIndex, false, searchStartAnchor, inactive);
        if (ctxResult && this._resultIsAtOrAfterAnchor(ctxResult, searchStartAnchor)) {
            if (remaining.trim().length > 0) {
                await this.highlightWithFallback(remaining, hasScrollOn, showHighlight, sentenceIndex, searchStartAnchor, inactive, returnResult);
            }
            return returnResult ? ctxResult : true;
        }

        if (ctxResult) {
            this._removeResultMarks(ctxResult);
        }

        // Context match failed or landed before the anchor. Try a plain
        // (no-context) full-sentence attempt before entering the shortening loop.
        // This handles the first sentence (title, index 0) where suffix context
        // is present but not contiguous in the DOM, so the text IS findable but
        // context-only search fails.
        {
            const plainSel = { status: 0, fragment: { textStart: currentText.trim().replace(/\.*$/g, ""), textEnd: null } };
            const plainFragment = createTextFragment(plainSel);
            const plainRes = await this._plainHighlightWithFallback(
                plainFragment,
                hasScrollOn,
                false,
                sentenceIndex,
                showHighlight,
                searchStartAnchor,
                inactive
            );
            if (plainRes.processedDirectives[0].length > 0) {
                if (remaining.trim().length > 0) {
                    await this.highlightWithFallback(remaining, hasScrollOn, showHighlight, sentenceIndex, searchStartAnchor, inactive, returnResult);
                }
                return returnResult ? plainRes : true;
            }
        }

        // No prefix and no positional anchor means shortening creates ambiguous
        // fragments that match elsewhere on the page. Bail so callers use native.
        const ctx = this.getSentenceContext(sentenceIndex, 2);
        if (!ctx.prefix && !searchStartAnchor) {
            return returnResult ? null : false;
        }

        // Floor for the shortening loop. Below roughly this many words a fragment
        // is far more likely to be a coincidental match elsewhere on the page
        // than the real text — a one-word fragment matches almost anything, which
        // is what produced a stray highlighted "or" in an unrelated paragraph.
        // When even this cannot be found, give up and let the caller fall back
        // to a native selection over the correct text rather than mark the wrong
        // word somewhere else.
        const MIN_FRAGMENT_WORDS = 3;

        while (currentText.length > 0) {
            if (currentText.trim().split(/\s+/).length < MIN_FRAGMENT_WORDS) {
                console.log(`❌ Fragment too short to match safely: "${currentText}"`);
                return returnResult ? null : false;
            }

            const selection = {
                status: 0,
                fragment: {
                    textStart: currentText.trim().replace(/\.*$/g, ""),
                    textEnd: null
                }
            };

            const fragment = createTextFragment(selection);

            const res = await createHighlightOnPage(
                fragment,
                [Math.floor(Date.now() / 1000)],
                hasScrollOn,
                false,
                sentenceIndex,
                showHighlight,
                searchStartAnchor,
                inactive
            );

            if (res.processedDirectives[0].length > 0) {
                console.log(`✅ Highlight success for: "${currentText.substring(0, 50)}..."`);
                if (remaining.trim().length > 0) {
                    // Resume from just after the fragment we actually matched.
                    // Re-using the original anchor here re-searched the whole
                    // rest of the page for the tail, so the leftover words were
                    // matched against unrelated text and landed as scattered
                    // single-word highlights instead of finishing this sentence.
                    const tailAnchor = this._captureAnchorAfterResult(res) || searchStartAnchor;
                    await this.highlightWithFallback(remaining, hasScrollOn, showHighlight, sentenceIndex, tailAnchor, inactive, returnResult);
                }
                return returnResult ? res : true;
            } else {
                console.warn(`⚠️ Highlight failed for: "${currentText.substring(0, 50)}...", shortening...`);

                currentText = currentText.trim();

                if (currentText.endsWith('.')) {
                    remaining = '.' + remaining;
                    currentText = currentText.substring(0, currentText.length - 1).trim();
                } else {
                    const lastDot = currentText.lastIndexOf('.');
                    if (lastDot > 0) {
                        remaining = currentText.substring(lastDot + 1) + remaining;
                        currentText = currentText.substring(0, lastDot + 1);
                    } else {
                        const lastSpace = currentText.lastIndexOf(' ');
                        if (lastSpace > 0) {
                            remaining = currentText.substring(lastSpace) + remaining;
                            currentText = currentText.substring(0, lastSpace).trim();
                        } else {
                            console.log(`❌ Cannot shorten further: "${currentText}"`);
                            return returnResult ? null : false;
                        }
                    }
                }
            }
        }

        return returnResult ? null : false;
    }

    highlightFunc() {
        return {
            iterateNode: function* iterateNode(topNode) {
                let childNodes = topNode.childNodes;
                for (let i = 0; i < childNodes.length; i++) {
                    let node = childNodes[i]
                    if (node.nodeType === 3) {
                        yield node;
                    } else {
                        yield* iterateNode(node);
                    }
                }
            },

            addHighlightDiv: function addHighlightDiv(rects) {
                for (let i = 0; i < rects.length; i++) {

                    let rect = rects[i];
                    let highlightRect = document.createElement('DIV')
                    document.body.appendChild(highlightRect)
                    highlightRect.classList.add('ai-highlight-marker')
                    highlightRect.style.top = rect.y + window.scrollY + 'px'
                    highlightRect.style.left = rect.x + 'px'
                    highlightRect.style.height = rect.height + 'px'
                    highlightRect.style.width = rect.width + 'px'

                }
            },

            removeHighlight: function removeHighlight() {
                let highlights = document.querySelectorAll('.ai-highlight-marker');
                for (let i = 0; i < highlights.length; i++) {
                    highlights[i].remove();
                }
            }


        }
    }

    async createWordByWordHighlights(utteranceText, sentenceIndex, searchStartAnchor = null) {
        const wordTimestamps = this.player.wordTimestamps.get(sentenceIndex);
        const highlightEnabled = this.player.voicePrefs.highlightReadingEnabled;
        const scrollEnabled = this.player.voicePrefs.autoscrollReadingEnabled;
        const highlightMode = this.player.voicePrefs.highlightMode || 'smooth';

        if (!highlightEnabled && !scrollEnabled) return;

        const hasWordTimestamps = wordTimestamps && wordTimestamps.length > 0;
        const userWantsSentenceMode = highlightMode === 'sentence';
        console.log('userWantsSentenceMode', userWantsSentenceMode)
        if (userWantsSentenceMode || !hasWordTimestamps) {
            this.createHighlights(utteranceText, sentenceIndex, searchStartAnchor);
            return;
        }

        if (highlightEnabled) {
            this.player.injectWordHighlightStyles(highlightMode);
        }

        // Word-level mode keeps BOTH the sentence highlight and the moving word
        // bar. The sentence overlay is painted by highlightWithFallback BEFORE
        // highlightWordsWithTiming wraps the words into spans, so it stays one
        // continuous highlight instead of fragmenting per-word.
        let showHighlight = highlightEnabled;
        let hasScrollOn = scrollEnabled;

        if (showHighlight || hasScrollOn) {
            await this.highlightWithFallback(utteranceText, hasScrollOn, showHighlight, sentenceIndex, searchStartAnchor);

            if (highlightEnabled && hasWordTimestamps && highlightMode !== 'sentence') {
                const allTextNodes = this.player.findAllTextNodesForUtterance(utteranceText);

                if (allTextNodes.length > 0) {
                    this.player.highlightWordsWithTiming(allTextNodes, wordTimestamps, utteranceText, sentenceIndex, highlightMode);
                }
            }
        }
    }

    getTextNodesFromElement(element) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null
        );

        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.trim().length > 0) {
                textNodes.push(node);
                console.log('📍 Text node:', node.textContent);
            }
        }

        return textNodes;
    }

    findTextInDocument(text) {
        const searchRoot = this.player.answerElement || document.body;

        const walker = document.createTreeWalker(
            searchRoot,
            NodeFilter.SHOW_TEXT,
            null
        );

        let node;
        while (node = walker.nextNode()) {
            const nodeText = node.textContent;
            const index = nodeText.indexOf(text);

            if (index !== -1) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + text.length);
                console.log('✅ Found text at:', node, 'index:', index);
                return range;
            }
        }

        console.warn('❌ Text not found in document:', text);
        return null;
    }

    async createHighlights(utteranceText, sentenceIndex = null, searchStartAnchor = null) {
        const highlightEnabled = this.player.voicePrefs.highlightReadingEnabled;
        const scrollEnabled = this.player.voicePrefs.autoscrollReadingEnabled;

        if (!highlightEnabled && !scrollEnabled) {
            console.log('⚠️ Both highlighting and autoscroll disabled');
            return;
        }

        let foundRange = false;

        removeHiglightOnPage()

        // When createHighlights runs in the non-preloaded path, there may be
        // pending marks from a previous preload cycle still in the DOM. Unwrap
        // them so the text search runs against clean page text and cannot nest
        // active marks inside them. Also drop the corresponding preload records
        // so activatePendingHighlight can't later promote these (now detached)
        // marks into the active highlight set.
        const unwrapped = new Set();
        document.querySelectorAll('mark.text-fragments-vrr.vrr-highlight-pending').forEach((m) => {
            if (m && m.parentNode) {
                const range = document.createRange();
                range.selectNodeContents(m);
                const fragment = range.extractContents();
                m.parentNode.insertBefore(fragment, m);
                m.parentNode.removeChild(m);
                unwrapped.add(m);
            }
        });
        if (unwrapped.size > 0 && this.player.pendingHighlights && this.player.pendingHighlights.size) {
            for (const [index, pending] of this.player.pendingHighlights) {
                if (!pending || !Array.isArray(pending.marks)) continue;
                if (pending.marks.some(mark => mark && unwrapped.has(mark))) {
                    this.player.pendingHighlights.delete(index);
                }
            }
        }

        let plainSelection = {
            status: 0,
            fragment: {
                textStart: utteranceText.trim().replace(/\.*$/g, ""),
                textEnd: null
            }
        }
        let plainTextFragment = createTextFragment(plainSelection);

        let showHighlight = highlightEnabled;
        let hasScrollOn = scrollEnabled;

        if (showHighlight || hasScrollOn) {
            // ALWAYS clear any existing native drag selection before we start highlighting,
            // otherwise the user's initial huge drag selection will stay stuck on the screen.
            let s = window.getSelection();
            if (s) {
                s.removeAllRanges();
            }

            // Phase 1: progressive context + positional anchor validation.
            // The context search ignores the anchor when a prefix exists, because
            // the prefix (previous sentence) lies before the anchor. We then
            // verify the match is at or after the anchor to avoid earlier
            // duplicates.
            const ctxResult = await this._tryHighlightWithContext(utteranceText, hasScrollOn, showHighlight, sentenceIndex, showHighlight, searchStartAnchor);
            let result;
            if (ctxResult && this._resultIsAtOrAfterAnchor(ctxResult, searchStartAnchor)) {
                result = ctxResult;
            } else {
                if (ctxResult) {
                    this._removeResultMarks(ctxResult);
                }
                // Phase 2: anchor-only (plain textStart, forward-seek position)
                // with a document-first fallback. If the fallback lands earlier
                // in the DOM, the anchor overshot and we should use it.
                result = await this._plainHighlightWithFallback(
                    plainTextFragment,
                    hasScrollOn,
                    showHighlight,
                    sentenceIndex,
                    showHighlight,
                    searchStartAnchor
                );
            }
            console.log(result);

            if (result.processedDirectives[0].length === 0 && showHighlight) {
                // Retry the primary fragment-based highlighter using progressive
                // shortening before ever falling back to the native selection
                // highlighter. This keeps the visual style consistent while reading,
                // so we don't jump between the overlay highlight and the browser's
                // default selection highlight from sentence to sentence.
                const retried = await this.highlightWithFallback(utteranceText, hasScrollOn, showHighlight, sentenceIndex, searchStartAnchor);
                if (retried) {
                    console.log('✅ Primary highlighter succeeded via progressive retry');
                    return;
                }

                console.warn('⚠️ Primary highlighter failed entirely, using native selection fallback');
                // Truthy check, not `=== null`: answerElement is undefined on
                // players that never resolved an article container, and letting
                // that through threw on `topParent.textContent` instead of
                // quietly skipping the highlight.
                if (!this.player || !this.player.answerElement) return false;
                let topParent = this.player.answerElement;
                let s, range;
                let strToSearch = utteranceText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                let re = RegExp(strToSearch, 'g')

                this.highlightFunc().removeHighlight()
                s = window.getSelection();
                s.removeAllRanges()
                const runMatcher = () => {
                    let match = re.exec(topParent.textContent)

                    let it = this.highlightFunc().iterateNode(topParent);
                    let currentIndex = 0;
                    let result = it.next();

                    while (!result.done) {
                        if (match && match.index >= currentIndex && match.index < currentIndex + result.value.length) {
                            range = new Range();
                            range.setStart(result.value, match.index - currentIndex)

                        }
                        if (match && match.index + strToSearch.length >= currentIndex && match.index + strToSearch.length <= currentIndex + result.value.length) {
                            range.setEnd(result.value, match.index + strToSearch.length - currentIndex)
                            s.addRange(range)

                            document.getSelection().removeAllRanges();
                            setTimeout(() => {
                                document.getSelection().addRange(range);
                            }, 200);


                            if (range && range.getClientRects().length > 0) {
                                foundRange = true
                            }
                        }
                        currentIndex += result.value.length;
                        result = it.next();
                    }
                }
                runMatcher();

                // Native selection creates no <mark> elements, so
                // captureHighlightAnchor() would return null on the next sentence.
                // Synthesise an anchor from the selected range's end so the next
                // search is bound to the correct position and won't jump backward.
                if (range && range.endContainer) {
                    this._fallbackAnchor = { node: range.endContainer, offset: range.endOffset };
                }
            } else if (result.processedDirectives[0].length === 0 && !showHighlight && hasScrollOn) {
                console.log('⚠️ Highlight failed but scroll was requested - scroll should have been attempted by createHighlightOnPage');
            }
        }
    }

    /**
     * Pre-create a sentence highlight (and, optionally, word spans) for an
     * upcoming sentence while the current sentence is still playing. The marks
     * are created in a hidden/pending state and must be activated via
     * activatePendingHighlight() when playback reaches the sentence.
     */
    async createPreloadedHighlights(utteranceText, sentenceIndex, searchStartAnchor = null) {
        const highlightEnabled = this.player.voicePrefs.highlightReadingEnabled;
        const scrollEnabled = this.player.voicePrefs.autoscrollReadingEnabled;

        if (!highlightEnabled && !scrollEnabled) return null;

        // If this sentence is already the active (or a past) one, its highlight
        // is owned by the active highlight path. Bailing before any DOM search
        // prevents a second createHighlightOnPage pass from racing the active
        // one and nesting <mark> elements.
        if (sentenceIndex != null && sentenceIndex <= this.player.currentPlayingIndex) {
            return null;
        }

        const plainSelection = {
            status: 0,
            fragment: {
                textStart: utteranceText.trim().replace(/\.*$/g, ""),
                textEnd: null
            }
        };
        const plainTextFragment = createTextFragment(plainSelection);

        // Phase 1: context + anchor validation, inactive (no overlay/scroll).
        let result = await this._tryHighlightWithContext(utteranceText, false, false, sentenceIndex, false, searchStartAnchor, true);
        if (result && !this._resultIsAtOrAfterAnchor(result, searchStartAnchor)) {
            this._removeResultMarks(result);
            result = null;
        }

        // Phase 2: plain anchored fallback, still inactive.
        if (!result || result.processedDirectives[0].length === 0) {
            result = await this._plainHighlightWithFallback(plainTextFragment, false, false, 0, false, searchStartAnchor, true);
        }

        // Phase 3: progressive shortening if needed.
        if (!result || result.processedDirectives[0].length === 0) {
            result = await this.highlightWithFallback(utteranceText, false, false, sentenceIndex, searchStartAnchor, true, true);
        }

        if (!result || result.processedDirectives[0].length === 0) {
            console.warn(`⚠️ Preload highlight failed for sentence ${sentenceIndex}`);
            return null;
        }

        const marks = result.processedDirectives[0];
        console.log(`✅ Preloaded highlight for sentence ${sentenceIndex}: ${marks.length} mark(s)`);

        // Create the sentence overlay NOW, while the marks are still plain text.
        // Keeping it hidden ({ pending: true }) until activation. Doing it here —
        // instead of at activation time — computes the rects before the words get
        // wrapped into spans, so the overlay stays one continuous sentence
        // highlight instead of fragmenting into one box per word.
        let overlayElements = null;
        if (this.player.voicePrefs.highlightReadingEnabled && typeof globalThis.createOverlayFromMarks === 'function') {
            overlayElements = globalThis.createOverlayFromMarks(marks, { pending: true });
        }

        return { result, marks, utteranceText, overlayElements };
    }

    /**
     * Promote a preloaded highlight to active: register the marks, reveal the
     * sentence overlay, and make them visible.
     */
    activatePendingHighlight(pending) {
        if (!pending || !pending.marks || pending.marks.length === 0) return;

        const { result, marks, overlayElements } = pending;

        marks.forEach((mark) => {
            if (window.VR_Reader.savedMarkElements.indexOf(mark) === -1) {
                window.VR_Reader.savedMarkElements.push(mark);
            }
            mark.classList.remove('vrr-highlight-pending');
        });

        // Reveal the pre-painted sentence overlay (computed before word
        // wrapping). Fall back to painting it now if the pending record predates
        // the overlay pre-paint (e.g. old pending entries).
        if (this.player.voicePrefs.highlightReadingEnabled) {
            if (overlayElements && overlayElements.length > 0 && typeof globalThis.revealPendingOverlayElements === 'function') {
                globalThis.revealPendingOverlayElements(overlayElements);
            } else if (typeof globalThis.createOverlayFromMarks === 'function') {
                globalThis.createOverlayFromMarks(marks);
            }
        }

        if (this.player.voicePrefs.autoscrollReadingEnabled && marks[0]) {
            scrollElementToReadingPosition(marks[0]);
        }

        if (result?.directives?.text?.[0]) {
            window.VR_Reader.savedHighlightedElements["#:~:text=" + result.directives.text[0]] = marks[0];
        }
    }

    makeInvisibleHighlights() {
        document.querySelectorAll(".markdown.prose").forEach((element) => {
            window.VR_Reader.addListener(element.closest(".text-base"), 'mouseover', (e) => {
                this.createInvisibleHighlightsFromElement(element)
            })
        });
    }

    createInvisibleHighlightsFromElement(element) {
        if (!element) return false;

        let answerText = getInnerText(element);

        const regex = /(\n)|(?<!\..)[.?!\n]\s+/g;
        const answerTextParsedList = answerText.trim().split(regex).filter((strItem) => strItem !== undefined && strItem.trim() !== "" && strItem.trim() !== "\n");

        let answerListID = "answerList_" + Math.floor(Math.random() * 1000) + 100;
        this.player.saveAnswerParseList[answerListID] = answerTextParsedList;

        answerTextParsedList.forEach(async (str) => {
            let customSelection = {
                status: 0,
                fragment: {
                    textStart: str.trim().replace(/\.*$/g, ""),
                    textEnd: null
                }
            }

            let textFragment = createTextFragment(customSelection);
            await createHighlightOnPage(textFragment, [Math.floor(Date.now() / 1000)], false, true, answerListID);
        })
    }
}
