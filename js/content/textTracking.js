/**
 * ============================================================================
 * textTracking Module
 * ============================================================================
 * A core utility module for parsing, locating, and tracking text within the DOM.
 * Includes advanced algorithms to map selected text to its position in the
 * Readability-extracted article and precisely calculate the remaining text to read.
 */
window.VR_Reader = window.VR_Reader || {};
const VR_Reader = window.VR_Reader;

import Readability from '../vendor/Readability.js';
import { getInnerText_pageReader, extractJsonLdArticle, extractFromSemanticHtml, extractCompletePageText, applyCustomCssSelectors } from '../utils/helpers.js';
import { extractFromHtml } from '../vendor/article-extractor.esm.js';

// Block elements that force a line break when building read text, so that a
// <p> (or other block) boundary becomes a sentence boundary even when the
// paragraph has no terminal period.
const VR_BLOCK_TAGS = new Set([
    'DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'LI', 'ARTICLE', 'SECTION', 'HEADER', 'FOOTER',
    'BLOCKQUOTE', 'PRE', 'UL', 'OL', 'TR', 'NAV', 'ASIDE'
]);

// True when an element matches one of the user's custom CSS-selector rules.
// Used by the live-DOM text walkers so those elements are excluded from the
// playback text WITHOUT being removed from the page itself.
const matchesCustomCssSelector = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE || typeof node.matches !== 'function') return false;
    const selectors = (typeof VR_Reader !== 'undefined' && VR_Reader.cssSelectorList) || [];
    if (!selectors.length) return false;
    for (const selector of selectors) {
        if (typeof selector !== 'string' || !selector.trim()) continue;
        try {
            if (node.matches(selector.trim())) return true;
        } catch (e) {
            // Invalid selector — ignore, matches() throws.
        }
    }
    return false;
};

VR_Reader.getTextFragmentNodes = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;
    
    const range = selection.getRangeAt(0);
    
    return {
        startContainer: range.startContainer,
        endContainer: range.endContainer,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        commonAncestor: range.commonAncestorContainer,
        // Get the parent elements (usually <p>, <div>, etc.)
        startElement: range.startContainer.nodeType === Node.TEXT_NODE 
            ? range.startContainer.parentElement 
            : range.startContainer,
        endElement: range.endContainer.nodeType === Node.TEXT_NODE 
            ? range.endContainer.parentElement 
            : range.endContainer
    };
};

/**
 * Find the corresponding node in Readability's extracted content
 * Readability preserves the DOM structure, so we can match nodes
 */
VR_Reader.findNodeInReadabilityContent = (originalNode, readabilityElement) => {
    // Validate inputs
    if (!originalNode) {
        console.warn('❌ originalNode is null or undefined');
        return null;
    }
    
    if (!readabilityElement) {
        console.warn('❌ readabilityElement is null or undefined');
        return null;
    }
    
    // Check if readabilityElement has querySelectorAll method
    if (typeof readabilityElement.querySelectorAll !== 'function') {
        console.warn('❌ readabilityElement does not have querySelectorAll method');
        return null;
    }
    
    // Ensure originalNode is an element (not a text node)
    let nodeToMatch = originalNode;
    if (originalNode.nodeType === Node.TEXT_NODE) {
        nodeToMatch = originalNode.parentElement;
    }
    
    if (!nodeToMatch || !nodeToMatch.tagName) {
        console.warn('❌ Could not get valid element from originalNode');
        return null;
    }
    
    // Strategy 1: Try to find by ID (if it exists)
    if (nodeToMatch.id) {
        try {
            const match = readabilityElement.querySelector(`#${CSS.escape(nodeToMatch.id)}`);
            if (match) {
                console.log('✅ Found by ID:', nodeToMatch.id);
                return match;
            }
        } catch(e) {
            console.warn('Error finding by ID:', e);
        }
    }
    
    // Strategy 2: Try to find by matching text content and tag name
    const tagName = nodeToMatch.tagName;
    let textContent = '';
    
    try {
        textContent = nodeToMatch.textContent?.trim().slice(0, 100) || '';
    } catch(e) {
        console.warn('Error getting textContent:', e);
    }
    
    if (tagName && textContent) {
        try {
            const candidates = readabilityElement.querySelectorAll(tagName);
            for (let candidate of candidates) {
                try {
                    const candidateText = candidate.textContent?.trim().slice(0, 100) || '';
                    if (candidateText === textContent) {
                        console.log('✅ Found by tag + text match:', tagName);
                        return candidate;
                    }
                } catch(e) {
                    console.warn('Error processing candidate:', e);
                    continue;
                }
            }
        } catch(e) {
            console.warn('Error in querySelectorAll:', e);
        }
    }
    
    // Strategy 3: Try to find by position in parent
    try {
        const parent = nodeToMatch.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children);
            const indexInParent = siblings.indexOf(nodeToMatch);
            
            // Try to find the parent first (recursive)
            const parentInReadability = VR_Reader.findNodeInReadabilityContent(
                parent, 
                readabilityElement
            );
            
            if (parentInReadability && parentInReadability.children && parentInReadability.children[indexInParent]) {
                console.log('✅ Found by parent + index');
                return parentInReadability.children[indexInParent];
            }
        }
    } catch(e) {
        console.warn('Error finding by parent + index:', e);
    }
    
    // Strategy 4: Fuzzy match by text content similarity
    try {
        const allNodes = readabilityElement.querySelectorAll('*');
        let bestMatch = null;
        let bestScore = 0;
        
        for (let node of allNodes) {
            try {
                if (node.tagName !== tagName) continue;
                
                const score = /**
 * Calculate text similarity (simple version)
 */
VR_Reader.calculateTextSimilarity(
                    nodeToMatch.textContent || '',
                    node.textContent || ''
                );
                
                if (score > bestScore && score > 0.9) { // 90% similarity threshold
                    bestScore = score;
                    bestMatch = node;
                }
            } catch(e) {
                continue;
            }
        }
        
        if (bestMatch) {
            console.log('✅ Found by fuzzy text match, score:', bestScore);
            return bestMatch;
        }
    } catch(e) {
        console.warn('Error in fuzzy matching:', e);
    }
    
    console.warn('❌ Could not find node in Readability content');
    return null;
};

VR_Reader.calculateTextSimilarity = (text1, text2) => {
    const clean1 = text1.trim().toLowerCase().replace(/\s+/g, ' ');
    const clean2 = text2.trim().toLowerCase().replace(/\s+/g, ' ');
    
    if (clean1 === clean2) return 1.0;
    
    // Use length and substring matching as simple similarity
    const shorter = clean1.length < clean2.length ? clean1 : clean2;
    const longer = clean1.length >= clean2.length ? clean1 : clean2;
    
    if (longer.includes(shorter)) {
        return shorter.length / longer.length;
    }
    
    // Count matching words
    const words1 = new Set(clean1.split(' '));
    const words2 = new Set(clean2.split(' '));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    
    return (2 * intersection.size) / (words1.size + words2.size);
};

/**
 * Locate the end of a text fragment inside a flattened string, using prefix/suffix
 * context when available so we don't match an earlier duplicate.
 */
VR_Reader.findSelectionEndInText = (text, fragmentInfo) => {
    if (!fragmentInfo || !text) return -1;

    const cleanText = text.replace(/\s+/g, ' ').trim();
    const { prefix, suffix, textStart, textEnd, fullText } = fragmentInfo;
    const selectionText = (fullText || textStart || '').replace(/\s+/g, ' ').trim();

    if (!selectionText) return -1;

    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const buildPattern = (usePrefix, useSuffix) => {
        let pattern = '';
        if (usePrefix && prefix) {
            pattern += escapeRegex(prefix.replace(/\s+/g, ' ').trim()) + '\\s+';
        }
        if (textEnd) {
            pattern += '(' + escapeRegex(textStart.replace(/\s+/g, ' ').trim()) + '.*?' + escapeRegex(textEnd.replace(/\s+/g, ' ').trim()) + ')';
        } else {
            pattern += '(' + escapeRegex(selectionText) + ')';
        }
        if (useSuffix && suffix) {
            pattern += '\\s+' + escapeRegex(suffix.replace(/\s+/g, ' ').trim());
        }
        return pattern;
    };

    const strategies = [
        { prefix: true, suffix: true },
        { prefix: true, suffix: false },
        { prefix: false, suffix: true },
        { prefix: false, suffix: false }
    ];

    for (const strategy of strategies) {
        const regex = new RegExp(buildPattern(strategy.prefix, strategy.suffix), 'is');
        const match = cleanText.match(regex);
        if (match && match[1]) {
            return match.index + match[1].length;
        }
    }

    // Final fallback: simple substring match
    const idx = cleanText.indexOf(selectionText);
    if (idx !== -1) {
        return idx + selectionText.length;
    }

    return -1;
};

/**
 * Get all text content AFTER a specific node in the DOM tree
 */
VR_Reader.getTextAfterNode = (startNode, containerElement) => {
    const textParts = [];
    let foundStart = false;
    
    // Create a tree walker to traverse all nodes
    const walker = document.createTreeWalker(
        containerElement,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                // Skip script, style, etc.
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const tagName = node.tagName;
                    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME'].includes(tagName)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );
    
    // Walk through all nodes
    let currentNode;
    while (currentNode = walker.nextNode()) {
        // Once we find our start node, set the flag
        if (currentNode === startNode) {
            foundStart = true;
            continue; // Skip the start node itself
        }
        
        // After we've found the start node, collect text
        if (foundStart && currentNode.nodeType === Node.TEXT_NODE) {
            const text = currentNode.textContent.trim();
            if (text.length > 0) {
                textParts.push(text);
            }
        }
    }
    
    const result = textParts.join(' ').trim();
    console.log(`📄 Text after node: ${result.length} characters`);
    if (result.length > 0) {
        console.log(`   Preview: "${result.slice(0, 100)}..."`);
    }
    
    return result;
};

VR_Reader.getTextAfterNodeEfficient = (startNode, containerElement) => {
    const textParts = [];

    // Insert a paragraph break marker so block boundaries become sentence
    // boundaries (the sentence splitter treats '\n' as a delimiter).
    const pushBlockBreak = () => {
        const last = textParts[textParts.length - 1];
        if (last !== '\n') textParts.push('\n');
    };

    // Helper to get all text from a node and its descendants
    const getAllText = (node) => {
        if (!node) return;
        
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) textParts.push(text);
            return;
        }
        
        if (node.nodeType === Node.ELEMENT_NODE) {
            // Skip unwanted elements
            if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME'].includes(node.tagName)) {
                return;
            }
            if (matchesCustomCssSelector(node)) return;

            const isBlock = VR_BLOCK_TAGS.has(node.tagName);
            if (isBlock) pushBlockBreak();
            
            // Get text from all children
            for (const child of node.childNodes) {
                getAllText(child);
            }

            if (isBlock) pushBlockBreak();
        }
    };
    
    // Get all next siblings of startNode
    let nextSibling = startNode.nextSibling;
    while (nextSibling) {
        getAllText(nextSibling);
        nextSibling = nextSibling.nextSibling;
    }
    
    // If no more siblings, go up to parent and get its next siblings
    let parent = startNode.parentElement;
    while (parent && parent !== containerElement && parent.parentElement !== containerElement) {
        let parentNextSibling = parent.nextSibling;
        while (parentNextSibling) {
            getAllText(parentNextSibling);
            parentNextSibling = parentNextSibling.nextSibling;
        }
        parent = parent.parentElement;
    }
    
    const result = textParts.join(' ').trim();
    console.log(`📄 Text after node (efficient): ${result.length} characters`);
    if (result.length > 0) {
        console.log(`   Preview: "${result.slice(0, 100)}..."`);
    }
    
    return result;
};

/**
 * Walk the DOM starting from a Range's end point and extract all remaining text
 * with block-element line breaks preserved. Handles the partial-text-node case
 * where the selection ends mid-text-node.
 */
VR_Reader.getTextFromRangeEnd = (range) => {
    const parts = [];

    const pushBreak = () => {
        const last = parts[parts.length - 1];
        if (!last || last === '\n') return;
        if (/[ \t]+$/.test(last)) parts[parts.length - 1] = last.replace(/[ \t]+$/, '');
        parts.push('\n');
    };

    const walkFrom = (node, startOffset) => {
        if (!node) return;
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.slice(startOffset).replace(/[ \t\r\n]+/g, ' ');
            if (text.trim()) parts.push(text);
            return;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME'].includes(node.tagName)) return;
            if (matchesCustomCssSelector(node)) return;
            const isBlock = VR_BLOCK_TAGS.has(node.tagName);
            if (isBlock) pushBreak();
            for (const child of node.childNodes) walkFrom(child, 0);
            if (isBlock) pushBreak();
        }
    };

    // Start with the remainder of the range's end container text node
    let node = range.endContainer;
    if (node.nodeType === Node.TEXT_NODE) {
        const tailText = node.textContent.slice(range.endOffset).replace(/[ \t\r\n]+/g, ' ');
        if (tailText.trim()) parts.push(tailText);
        node = node.nextSibling;
    }

    // Walk subsequent siblings and their descendants
    while (node) {
        walkFrom(node, 0);
        node = node.nextSibling;
    }

    // Walk up the tree: at each ancestor, walk its following siblings
    let parent = range.endContainer.parentElement;
    while (parent && parent !== document.body) {
        let sibling = parent.nextSibling;
        while (sibling) {
            walkFrom(sibling, 0);
            sibling = sibling.nextSibling;
        }
        parent = parent.parentElement;
    }

    return parts.join('').trim();
};

/**
 * Fallback: Match by text content if node matching fails
 */
VR_Reader.getRemainingTextByTextMatch = (fragmentInfo, articleText, articleTitle) => {
    console.log('⚠️ Falling back to text-based matching');
    
    const selectionText = fragmentInfo.fullText || fragmentInfo.textStart;
    
    if (!selectionText || !articleText) {
        return {
            remainingText: articleText || '',
            articleText: articleText || '',
            articleTitle: articleTitle || document.title,
            method: 'text-match-no-data'
        };
    }
    
    const cleanArticle = articleText.replace(/\s+/g, ' ').trim();
    const cleanSelection = selectionText.replace(/\s+/g, ' ').trim();
    
    const index = cleanArticle.indexOf(cleanSelection);
    
    if (index !== -1) {
        const remainingText = cleanArticle.slice(index + cleanSelection.length).trim();
        console.log('✅ Found by text match, remaining:', remainingText.length);
        
        return {
            remainingText,
            articleText,
            articleTitle,
            method: 'text-match-fallback'
        };
    }
    
    console.warn('❌ Could not find selection in article text');
    return {
        remainingText: articleText,
        articleText,
        articleTitle,
        method: 'full-article-fallback'
    };
};

VR_Reader.generatePreciseTextFragment = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;
    
    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    
    // Get the containing node (paragraph, div, etc.)
    const containerNode = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;
    
    const containerText = containerNode.textContent;
    
    // Find selection position within container
    const selectionStartInContainer = containerText.indexOf(selectedText);
    const selectionEndInContainer = selectionStartInContainer + selectedText.length;
    
    // Extract prefix - text before selection in the same container
    const prefixText = containerText.slice(0, selectionStartInContainer).trim();
    const prefixWords = prefixText.split(/\s+/).filter(w => w.length > 0);
    
    // Extract suffix - text after selection in the same container
    const suffixText = containerText.slice(selectionEndInContainer).trim();
    const suffixWords = suffixText.split(/\s+/).filter(w => w.length > 0);
    
    // Start with minimal context and expand if needed
    let prefix = '';
    let suffix = '';
    let prefixLength = 0;
    let suffixLength = 0;
    
    // Chrome's algorithm: Start with last 3 words before, first 3 words after
    const MIN_CONTEXT_WORDS = 3;
    const MAX_CONTEXT_WORDS = 10;
    
    // Build initial context
    prefix = prefixWords.slice(-MIN_CONTEXT_WORDS).join(' ');
    suffix = suffixWords.slice(0, MIN_CONTEXT_WORDS).join(' ');
    
    const escapeRegex = (str) => {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // Function to check if current context makes selection unique in container
    const isUnique = (prefixCtx, suffixCtx, selectedTxt) => {
        const pattern = prefixCtx 
            ? `${escapeRegex(prefixCtx)}\\s+${escapeRegex(selectedTxt)}`
            : escapeRegex(selectedTxt);
        
        const fullPattern = suffixCtx
            ? `${pattern}\\s+${escapeRegex(suffixCtx)}`
            : pattern;
        
        const regex = new RegExp(fullPattern, 'gi');
        const matches = containerText.match(regex);
        
        return matches && matches.length === 1;
    };
    
    // Expand context if not unique
    prefixLength = MIN_CONTEXT_WORDS;
    suffixLength = MIN_CONTEXT_WORDS;
    
    while (!isUnique(prefix, suffix, selectedText) && 
           (prefixLength < MAX_CONTEXT_WORDS || suffixLength < MAX_CONTEXT_WORDS)) {
        
        // Expand prefix
        if (prefixLength < MAX_CONTEXT_WORDS && prefixLength < prefixWords.length) {
            prefixLength++;
            prefix = prefixWords.slice(-prefixLength).join(' ');
        }
        
        // Expand suffix
        if (suffixLength < MAX_CONTEXT_WORDS && suffixLength < suffixWords.length) {
            suffixLength++;
            suffix = suffixWords.slice(0, suffixLength).join(' ');
        }
        
        // If we've maxed out both, break
        if (prefixLength >= Math.min(MAX_CONTEXT_WORDS, prefixWords.length) &&
            suffixLength >= Math.min(MAX_CONTEXT_WORDS, suffixWords.length)) {
            break;
        }
    }
    
    // For long selections, split into start and end
    const words = selectedText.split(/\s+/);
    let textStart, textEnd;
    
    if (words.length > 8) {
        // Use first 4 and last 4 words for long selections
        textStart = words.slice(0, 4).join(' ');
        textEnd = words.slice(-4).join(' ');
    } else {
        textStart = selectedText;
        textEnd = null;
    }
    
    return {
        prefix: prefix || null,
        textStart,
        textEnd,
        suffix: suffix || null,
        fullText: selectedText,
        containerNode,
        selectionStartInContainer,
        selectionEndInContainer,
        // Debug info
        _debug: {
            prefixWordsUsed: prefixLength,
            suffixWordsUsed: suffixLength,
            isUnique: isUnique(prefix, suffix, selectedText)
        }
    };
};

/**
 * Find exact position within a node using text fragment matching
 */
VR_Reader.findPositionInNode = (fragmentInfo, nodeText) => {
    if (!fragmentInfo) return -1;
    
    const { prefix, textStart, textEnd, suffix, fullText } = fragmentInfo;
    const cleanNodeText = nodeText.replace(/\s+/g, ' ').trim();
    
    const escapeRegex = (str) => {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };
    
    // Build search pattern
    const buildPattern = (includePrefix, includeSuffix) => {
        let pattern = '';
        
        if (includePrefix && prefix) {
            pattern += escapeRegex(prefix) + '\\s+';
        }
        
        if (textEnd) {
            // Long selection with start and end
            pattern += '(' + escapeRegex(textStart) + '.*?' + escapeRegex(textEnd) + ')';
        } else {
            pattern += '(' + escapeRegex(fullText || textStart) + ')';
        }
        
        if (includeSuffix && suffix) {
            pattern += '\\s+' + escapeRegex(suffix);
        }
        
        return pattern;
    };
    
    // Try different combinations, starting with most specific
    const strategies = [
        { prefix: true, suffix: true, name: 'prefix+text+suffix' },
        { prefix: true, suffix: false, name: 'prefix+text' },
        { prefix: false, suffix: true, name: 'text+suffix' },
        { prefix: false, suffix: false, name: 'text only' }
    ];
    
    for (const strategy of strategies) {
        const pattern = buildPattern(strategy.prefix, strategy.suffix);
        const regex = new RegExp(pattern, 'is'); // 's' flag for dotAll
        const match = cleanNodeText.match(regex);
        
        if (match) {
            // match[1] contains the actual selection text (captured group)
            const selectionText = match[1];
            
            // Find where the selection starts in the full text
            const selectionStart = match.index;
            
            // Add prefix length if we used it
            let adjustedStart = selectionStart;
            if (strategy.prefix && prefix) {
                const prefixInMatch = cleanNodeText.slice(selectionStart, selectionStart + prefix.length + 10);
                const actualPrefixMatch = prefixInMatch.match(new RegExp(escapeRegex(prefix) + '\\s+', 'i'));
                if (actualPrefixMatch) {
                    adjustedStart += actualPrefixMatch[0].length;
                }
            }
            
            // The end position is start + length of actual selection
            let selectionEnd = adjustedStart + selectionText.length;
            
            // Hardening: if the full selection text is available and fits inside this
            // node, use its exact end so a loose non-greedy match can't pin `selectionEnd`
            // a few characters early (i.e. mid-word, before the selection tail).
            if (fragmentInfo.fullText) {
                const fullSel = fragmentInfo.fullText.replace(/\s+/g, ' ').trim();
                if (fullSel) {
                    const trueStart = cleanNodeText.indexOf(fullSel, Math.max(0, adjustedStart - 10));
                    if (trueStart !== -1 && trueStart + fullSel.length > selectionEnd) {
                        selectionEnd = trueStart + fullSel.length;
                    }
                }
            }
            
            console.log(`✅ Match found using strategy: ${strategy.name}`);
            console.log(`📍 Selection starts at: ${adjustedStart}`);
            console.log(`📍 Selection ends at: ${selectionEnd}`);
            console.log(`📏 Selection length: ${selectionText.length}`);
            
            // Verify with context
            const beforeSelection = cleanNodeText.slice(Math.max(0, adjustedStart - 30), adjustedStart);
            const theSelection = cleanNodeText.slice(adjustedStart, selectionEnd);
            const afterSelection = cleanNodeText.slice(selectionEnd, Math.min(cleanNodeText.length, selectionEnd + 30));
            
            console.log('Context check:');
            console.log(`  Before: "...${beforeSelection}"`);
            console.log(`  Selection: "${theSelection}"`);
            console.log(`  After: "${afterSelection}..."`);
            
            return selectionEnd;
        }
    }
    
    console.warn('❌ No match found with any strategy');
    return -1;
};

/**
 * Build the readable text of a subtree, preserving block boundaries as '\n'
 * (paragraph breaks become sentence breaks even without a terminal period).
 * textContent remains the same after collapsing whitespace, so these '\n'
 * markers do not change the flattened character mapping used for slicing.
 */
VR_Reader.buildTextWithBlockBreaks = (root) => {
    const parts = [];

    const pushBreak = () => {
        const last = parts[parts.length - 1];
        if (!last || last === '\n') return;
        if (/[ \t]+$/.test(last)) parts[parts.length - 1] = last.replace(/[ \t]+$/, '');
        parts.push('\n');
    };

    const walk = (node) => {
        if (!node) return;

        if (node.nodeType === Node.TEXT_NODE) {
            // Collapse internal whitespace but PRESERVE the whitespace that exists
            // between this node and its neighbours. Trimming here (as before) would
            // drop the boundary space, so concatenation below must not add a space
            // where the source has none (e.g. "<a>feels</a>." -> "feels.", not "feels .").
            const text = node.textContent.replace(/[ \t\r\n]+/g, ' ');
            if (text.trim()) parts.push(text);
            return;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME'].includes(node.tagName)) return;

            const isBlock = VR_BLOCK_TAGS.has(node.tagName);
            if (isBlock) pushBreak();
            for (const child of node.childNodes) walk(child);
            if (isBlock) pushBreak();
        }
    };

    walk(root);
    // Concatenate text pieces directly (no forced separator): the pieces already
    // carry the whitespace that actually separates them in the source, so the
    // whitespace-collapsed form is identical to `root.textContent` collapsed,
    // keeping the flat-index mapping used by sliceBlockTextAfterFlatIndex exact.
    return parts.join('').trim();
};

/**
 * Given a whitespace/block-break-aware string and an index into its
 * whitespace-collapsed form, return the raw substring starting at the collapsed
 * index (mirrors .replace(/\s+/g, ' ').trim()).
 */
VR_Reader.sliceBlockTextAfterFlatIndex = (rawText, flatIndex) => {
    let flatPos = 0;
    let i = 0;

    while (i < rawText.length) {
        if (/\s/.test(rawText[i])) {
            let j = i;
            while (j < rawText.length && /\s/.test(rawText[j])) j++;

            const betweenNonSpace =
                i > 0 && !/\s/.test(rawText[i - 1]) &&
                j < rawText.length && !/\s/.test(rawText[j]);

            if (betweenNonSpace) {
                if (flatPos === flatIndex) return rawText.slice(i);
                flatPos++;
            }
            i = j;
        } else {
            if (flatPos === flatIndex) return rawText.slice(i);
            flatPos++;
            i++;
        }
    }

    return '';
};

/**
 * Get remaining text from within a matched paragraph node
 */
VR_Reader.getRemainingTextFromParagraph = (fragmentInfo, matchedNode) => {
    const nodeText = matchedNode.textContent;
    const cleanNodeText = nodeText.replace(/\s+/g, ' ').trim();
    
    // Find end position of selection within this node
    const endPosition = VR_Reader.findPositionInNode(fragmentInfo, cleanNodeText);
    
    if (endPosition === -1) {
        console.warn('Could not find selection in node, returning empty string');
        return '';
    }

    // Get ONLY text after the selection in this node, preserving block breaks
    // so that inner block boundaries surface as sentence boundaries.
    const blockText = VR_Reader.buildTextWithBlockBreaks(matchedNode);
    const remainingInNode = VR_Reader.sliceBlockTextAfterFlatIndex(blockText, endPosition).trim();
    
    if (remainingInNode.length === 0) {
        console.log('📝 No remaining text in this paragraph (selection ends at paragraph end)');
    } else {
        console.log(`📝 Remaining text in paragraph (${remainingInNode.length} chars): "${remainingInNode.slice(0, 100)}..."`);
    }
    
    return remainingInNode;
};

/**
 * Combine the remaining text inside the matched node with the text after the
 * node, separating them by a paragraph break when the matched node is itself a
 * block element (so the boundary surfaces as a new sentence).
 */
VR_Reader.combineRemainingParagraphAndAfter = (inParagraph, afterNode, matchedNode) => {
    const isBlock = matchedNode &&
        matchedNode.nodeType === Node.ELEMENT_NODE &&
        VR_BLOCK_TAGS.has(matchedNode.tagName);

    if (inParagraph && inParagraph.length > 0 && afterNode && afterNode.length > 0) {
        return (inParagraph + (isBlock ? '\n' : ' ') + afterNode).trim();
    }

    return (inParagraph || afterNode || '').trim();
};

/**
 * Enhanced: Get remaining text using both node matching AND text fragment precision
 */
VR_Reader.getRemainingTextPrecise = async () => {
    try {
        // Step 1: Capture precise text fragment with context
        const fragmentInfo = VR_Reader.generatePreciseTextFragment();
        
        if (!fragmentInfo) {
            console.warn('No selection found');
            return { 
                remainingText: '', 
                articleText: '',
                articleTitle: document.title,
                method: 'no-selection' 
            };
        }
        
        console.log('🎯 Text fragment info:', {
            prefix: fragmentInfo.prefix,
            textStart: fragmentInfo.textStart?.slice(0, 50) + '...',
            textEnd: fragmentInfo.textEnd,
            suffix: fragmentInfo.suffix,
            isUnique: fragmentInfo._debug?.isUnique
        });
        
        // Step 2: Extract article with Readability
        let readabilityElement, articleText, articleTitle;
        
        try {
            const documentClone = document.cloneNode(true);
            // Apply user CSS-selector rules before parsing so elements removed
            // by custom filters never reach the spoken text.
            applyCustomCssSelectors(documentClone, (typeof VR_Reader !== 'undefined' && VR_Reader.cssSelectorList) || []);
            const article = new Readability(documentClone).parse();
            
            if (!article || !article.content) {
                throw new Error('Readability returned no content');
            }
            
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = article.content;
            readabilityElement = tempDiv;
            articleText = getInnerText_pageReader(tempDiv);
            articleTitle = article.title;
        } catch(e) {
            console.warn('Readability failed, trying extractFromHtml:', e);
            
            try {
                let result = await extractFromHtml(document.body.parentNode.outerHTML);
                if (result && result.content) {
                    const tempDiv = document.createElement("div");
                    tempDiv.innerHTML = result.content;
                    readabilityElement = tempDiv;
                    articleText = getInnerText_pageReader(tempDiv);
                    articleTitle = result.title;
                } else {
                    throw new Error('extractFromHtml returned no content');
                }
            } catch(e2) {
                console.error('Both extraction methods failed:', e2);
                
                // Final fallback: use simple text match on full document
                return /**
 * Fallback: Match by text content on document.body using explicit block breaks
 */
VR_Reader.getFallbackRemainingText(fragmentInfo);
            }
        }
        
        // Validate we have content
        if (!readabilityElement || !articleText) {
            console.error('No article content extracted');
            return VR_Reader.getFallbackRemainingText(fragmentInfo);
        }
        
        // Step 3: Find the matching paragraph node
        let matchedNode = null;
        
        try {
            matchedNode = VR_Reader.findNodeInReadabilityContent(
                fragmentInfo.containerNode,
                readabilityElement
            );
        } catch(e) {
            console.error('Error finding node in Readability content:', e);
        }
        
        if (!matchedNode) {
            console.warn('Could not find matching node, falling back to text match');
            return VR_Reader.getRemainingTextByTextMatch(
                fragmentInfo,
                articleText,
                articleTitle
            );
        }
        
        console.log('✅ Found matching paragraph node:', matchedNode.tagName);
        
        // Step 4: Use text fragment to find exact position within the node
        let remainingInParagraph = '';
        
        try {
            remainingInParagraph = VR_Reader.getRemainingTextFromParagraph(
                fragmentInfo,
                matchedNode
            );
        } catch(e) {
            console.error('Error getting remaining text from paragraph:', e);
            remainingInParagraph = '';
        }
        
        // Step 5: Get all text after this entire paragraph node
        let textAfterNode = '';
        
        try {
            textAfterNode = VR_Reader.getTextAfterNodeEfficient(matchedNode, readabilityElement);
        } catch(e) {
            console.error('Error getting text after node:', e);
            textAfterNode = '';
        }
        
        // Combine: remaining text in paragraph + all text after the paragraph
        // (separated by a paragraph break when the matched node is a block)
        const remainingText = VR_Reader.combineRemainingParagraphAndAfter(
            remainingInParagraph,
            textAfterNode,
            matchedNode
        );
        
        console.log('📊 Total remaining text:', remainingText.length, 'characters');
        console.log('  - After selection in paragraph:', remainingInParagraph.length);
        console.log('  - After entire paragraph:', textAfterNode.length);
        
        // Visual verification
        if (remainingText.length > 0) {
            console.log('🔍 Preview of remaining text:');
            console.log(remainingText.slice(0, 200) + '...');
        } else {
            console.warn('⚠️ No remaining text found - selection might be at end of article');
        }
        
        return {
            remainingText,
            articleText,
            articleTitle,
            matchedNode,
            fragmentInfo,
            method: 'precise-text-fragment',
            breakdown: {
                inParagraphAfterSelection: remainingInParagraph.length,
                afterParagraphNode: textAfterNode.length,
                total: remainingText.length
            }
        };
        
    } catch(e) {
        console.error('Unexpected error in getRemainingTextPrecise:', e);
        
        // Ultimate fallback
        return {
            remainingText: '',
            articleText: '',
            articleTitle: document.title,
            method: 'error-fallback',
            error: e.message
        };
    }
};

/**
 * Extracts text from the DOM but forces newlines at Block element boundaries.
 * This solves the "Reddit Problem" where header text glues to comment text.
 */
function getTextWithExplicitBlockBreaks(root) {
    let text = '';
    const blockStack = [];

    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                // Skip invisible elements (script, style, hidden) and any
                // elements the user's CSS-selector rules target.
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const tag = node.tagName;
                    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'SVG' || tag === 'PATH') {
                        return NodeFilter.FILTER_REJECT;
                    }
                    if (matchesCustomCssSelector(node)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    let currentNode;
    while (currentNode = walker.nextNode()) {
        // Pop any block elements we have left (the walker only sees opening
        // tags; a closing </div> never appears as a node, so detect it by
        // checking whether the current node is still inside the topmost
        // block on the stack).
        while (blockStack.length > 0 && !blockStack[blockStack.length - 1].contains(currentNode)) {
            blockStack.pop();
            if (text.length > 0 && !text.endsWith('\n')) {
                text += '\n';
            }
        }

        if (currentNode.nodeType === Node.ELEMENT_NODE) {
            const tag = currentNode.tagName;
            
            // Explicit line break tags
            if (tag === 'BR') {
                text += '\n';
            } 
            // Block level elements: Add newline and push onto the stack so we
            // also emit one when leaving the element.
            else if (VR_BLOCK_TAGS.has(tag)) {
                if (text.length > 0 && !text.endsWith('\n')) {
                    text += '\n';
                }
                blockStack.push(currentNode);
            }
        } else if (currentNode.nodeType === Node.TEXT_NODE) {
            const val = currentNode.nodeValue;
            // Clean up excessive internal whitespace but keep content
            const cleanVal = val.replace(/[\r\n\t]+/g, ' ').replace(/  +/g, ' ');
            
            if (cleanVal.length > 0) {
                text += cleanVal;
            }
        }
    }

    // Pop any remaining block entries at the end of the walk
    while (blockStack.length > 0) {
        blockStack.pop();
        if (text.length > 0 && !text.endsWith('\n')) {
            text += '\n';
        }
    }
    
    return text.trim();
}

/**
 * Map a flattened index (into a whitespace-collapsed, trimmed string, i.e.
 * `s.replace(/[\s\n\r]+/g, ' ').trim()`) back to the corresponding raw index in
 * `rawText` (the newline-rich body). Whitespace runs count as a single unit,
 * so this lands exactly on the boundary and never splits a word.
 */
VR_Reader.flattenIndexToRawIndex = (rawText, flatIndex) => {
    if (flatIndex < 0) return 0;

    let flatPos = 0;
    let i = 0;

    // Skip leading whitespace (matches .trim() on the flattened string)
    while (i < rawText.length && /[\s\n\r]/.test(rawText[i])) i++;

    while (i < rawText.length) {
        if (/[\s\n\r]/.test(rawText[i])) {
            let j = i;
            while (j < rawText.length && /[\s\n\r]/.test(rawText[j])) j++;

            const betweenNonSpace =
                i > 0 && !/[\s\n\r]/.test(rawText[i - 1]) &&
                j < rawText.length && !/[\s\n\r]/.test(rawText[j]);

            if (betweenNonSpace) {
                if (flatPos === flatIndex) return i;
                flatPos++;
            }
            i = j;
        } else {
            if (flatPos === flatIndex) return i;
            flatPos++;
            i++;
        }
    }

    return rawText.length;
};

VR_Reader.getFallbackRemainingText = (fragmentInfo) => {
    console.log('🔄 Executing Raw Body Fallback strategy (Explicit Block Breaks)...');
    
    // 1. Get raw text using our custom walker that forces \n between divs
    const fullText = getTextWithExplicitBlockBreaks(document.body);
    
    // 2. Identify the search string
    let selectionText = "";
    if(fragmentInfo) {
        selectionText = fragmentInfo.fullText || fragmentInfo.textStart || "";
    }

    if (!selectionText || selectionText.length === 0) {
        console.warn('❌ Fallback failed: No selection text provided');
        return {
            remainingText: fullText, 
            articleText: fullText,
            articleTitle: document.title,
            method: 'fallback-no-selection-data'
        };
    }
    
    // 3. Normalize strings for SEARCH ONLY
    // Since we added a bunch of \n, the user's selection (which might not have them)
    // won't match directly. We strip newlines just to find the *Index*.
    const cleanFullTextForSearch = fullText.replace(/[\s\n\r]+/g, ' ').trim();

    // 4. Find the selection position, using prefix/suffix context when available
    // so we don't accidentally match an earlier duplicate (e.g. in nav text).
    const selectionEndFlattened = VR_Reader.findSelectionEndInText(cleanFullTextForSearch, fragmentInfo);

    if (selectionEndFlattened !== -1) {
        // CHALLENGE: selectionEndFlattened corresponds to the "flattened" string, not our "newline-rich" fullText.
        // Map the flattened END of the full selection back to the newline-rich text
        // using the exact same collapsing rule (whitespace runs = one unit). This is
        // deterministic and always cuts exactly after the selection's final character,
        // never mid-word.
        const splitIndex = (VR_Reader.flattenIndexToRawIndex || flattenIndexToRawIndex)(fullText, selectionEndFlattened);

        let finalRemainingText = fullText.slice(splitIndex).trim();
        if (finalRemainingText.length === 0 && fullText.length > 0) {
            // Safety net: if mapping consumed everything, keep the whole body so we
            // never drop content entirely.
            console.warn("Could not map selection back to newline-rich text. Returning full body.");
            finalRemainingText = fullText;
        }
        
        console.log(`✅ Fallback found text match.`);
        console.log(`   Remaining Length: ${finalRemainingText.length}`);
        
        return {
            remainingText: finalRemainingText,
            articleText: fullText, // Return the nice newline-rich text as the full article
            articleTitle: document.title,
            method: 'fallback-text-match'
        };
    }
    
    // 5. Advanced Fallback: Fuzzy Search (Partial Match)
    if (cleanSelectionForSearch.length > 50) {
        const partialSelection = cleanSelectionForSearch.slice(-50);
        // Locate the end-most occurrence of the partial selection in the flattened
        // text, then map it back to the newline-rich body exactly (avoids matching
        // an earlier duplicate and never splits a word).
        const partialIndex = cleanFullTextForSearch.lastIndexOf(partialSelection);
        
        if (partialIndex !== -1) {
            const partialEndFlattened = partialIndex + partialSelection.length;
            const splitIndex = (VR_Reader.flattenIndexToRawIndex || flattenIndexToRawIndex)(fullText, partialEndFlattened);
            const remainingText = fullText.slice(splitIndex).trim();
            
            console.log(`✅ Fallback found partial text match.`);
            return {
                remainingText,
                articleText: fullText,
                articleTitle: document.title,
                method: 'fallback-partial-match'
            };
        }
    }

    console.warn('❌ Fallback could not find selection in document body');
    
    return {
        remainingText: '', 
        articleText: fullText,
        articleTitle: document.title,
        method: 'fallback-failed-to-locate'
    };
};

/**
 * Step 1: Capture and store selection data immediately
 * Call this as soon as user highlights text
 */
VR_Reader.captureSelectionData = () => {
    try {
        if (window.VR_Reader) window.VR_Reader.hasContinuedReading = false;
        // Capture the text fragment info while selection is still active
        const fragmentInfo = VR_Reader.generatePreciseTextFragment();
        
        if (!fragmentInfo) {
            console.warn('No selection found');
            return null;
        }
        
        // Also capture the raw selection text
        const selection = window.getSelection();
        const selectionText = selection.toString().trim();
        
        // Store everything we need for later processing
        VR_Reader.storedSelectionData = {
            fragmentInfo,
            selectionText,
            capturedAt: Date.now(),
            // Store the container node reference
            containerNode: fragmentInfo.containerNode,
            // Store page info
            pageUrl: window.location.href,
            pageTitle: document.title
        };
        
        console.log('✅ Selection data captured and stored:', {
            prefix: fragmentInfo.prefix,
            textStart: fragmentInfo.textStart?.slice(0, 50) + '...',
            textEnd: fragmentInfo.textEnd,
            suffix: fragmentInfo.suffix,
            isUnique: fragmentInfo._debug?.isUnique,
            selectionLength: selectionText.length
        });
        
        return VR_Reader.storedSelectionData;
        
    } catch(e) {
        console.error('Error capturing selection data:', e);
        return null;
    }
};

/**
 * Step 2: Process the stored selection data later
 * Call this after TTS finishes reading the highlighted text
 * Prioritizes Readability/Node matching, but falls back to raw body text if needed.
 */
VR_Reader.calculateRemainingText = async () => {
    try {
        // Check if we have stored selection data
        if (!VR_Reader.storedSelectionData) {
            console.warn('No stored selection data available');
            return {
                remainingText: '',
                articleText: '',
                articleTitle: document.title,
                method: 'no-stored-data'
            };
        }
        
        const { fragmentInfo, selectionText } = VR_Reader.storedSelectionData;
        
        console.log('🔄 Processing stored selection data...');
        
        let readabilityResult = null;

        // ---------------------------------------------------------
        // STRATEGY 0: RELAXED / NON-STRICT COMPLETE-PAGE EXTRACTION
        // ---------------------------------------------------------
        const strictMode = VR_Reader.savedLocalStorageGlobal['DEFAULT_READER_STRICT_MODE'] !== false;
        if (!strictMode) {
            console.log('🧘 Relaxed mode: using DOM-based extraction for remaining text...');
            try {
                // Use the text-fragment library to find the selection Range in the
                // DOM via prefix/suffix disambiguation instead of string-matching
                // extracted page text. This correctly handles duplicate occurrences
                // and long selections that confounded the old regex-based approach.
                const result = globalThis.processTextFragmentDirective(fragmentInfo);
                if (result && result.length > 0) {
                    const range = result[0];
                    const remainingText = VR_Reader.getTextFromRangeEnd(range);
                    if (remainingText.length > 50) {
                        readabilityResult = {
                            remainingText,
                            articleText: remainingText,
                            articleTitle: document.title,
                            fragmentInfo,
                            calculatedAt: Date.now(),
                            method: 'relaxed-dom-based'
                        };
                        console.log(`✅ Relaxed mode remaining text: ${remainingText.length} chars`);
                    }
                }
            } catch (relaxedError) {
                console.warn('Relaxed DOM-based extraction failed:', relaxedError);
            }
        }

        // ---------------------------------------------------------
        // STRATEGY A: READABILITY / DOM NODE MATCHING (FALLBACK)
        // ---------------------------------------------------------
        if (!readabilityResult) try {
            // Helper to clean junk elements before parsing
            const removeJunk = (container, keepComments = false) => {
                let selectors = [
                    'footer', 'nav', 'aside', '[class*="ad-"]', '.ad', '.advert', 
                    '[class*="cookie"]', '.social', '.sharing', '.popup', 
                    '[class*="related"]'
                ];
                if (!keepComments) {
                    selectors.push('[class*="comment"]');
                }
                const safeKeywords = ['article', 'content', 'post', 'body', 'main', 'story', 'entry'];

                container.querySelectorAll(selectors.join(', ')).forEach(element => {
                    if (element === container) return;
                    const className = (element.className && typeof element.className === 'string') ? element.className.toLowerCase() : '';
                    let isSafe = false;
                    for (const keyword of safeKeywords) {
                        if (new RegExp(`\\b${keyword}\\b|${keyword}-`).test(className)) { isSafe = true; break; }
                    }
                    if (!isSafe) element.remove();
                });

                // Apply user-defined CSS-selector rules (dynamic, local + remote).
                applyCustomCssSelectors(container, VR_Reader.cssSelectorList || []);
            };

            let articleContent = null;
            let extractedTitle = null;
            let targetElement = null;
            let readabilityElement = null;
            let articleText = "";

            // 1. JSON-LD / Semantic Extraction (Find the "meat" of the page)
            let resultJsonLd = extractJsonLdArticle(document);
            if (resultJsonLd?.element) {
                targetElement = resultJsonLd.element;
            } else {
                let resultSemantic = extractFromSemanticHtml(document);
                if (resultSemantic?.element) targetElement = resultSemantic.element;
            }

            // 2. Try Intelligent Extraction on Target Element
            if (targetElement) {
                try {
                    const newDocument = document.implementation.createHTMLDocument();
                    const importedElement = newDocument.importNode(targetElement, true);
                    removeJunk(importedElement);
                    newDocument.body.appendChild(importedElement);
                    const intelligentResult = new Readability(newDocument).parse();
                    if (intelligentResult && intelligentResult.content) {
                        articleContent = intelligentResult.content;
                        extractedTitle = intelligentResult.title || document.title;
                    }
                } catch (e) {}
            }

            // 3. Try Full Document Readability (Fallback)
            if (!articleContent) {
                const documentClone = document.cloneNode(true);
                removeJunk(documentClone.body);
                const article = new Readability(documentClone).parse();
                if (article && article.content) {
                    articleContent = article.content;
                    extractedTitle = article.title;
                }
            }

            // 4. Process Content if Extraction Succeeded
            if (articleContent) {
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = articleContent;
                readabilityElement = tempDiv;
                articleText = getInnerText_pageReader(tempDiv);
                
                // Attempt Node Matching: Find the paragraph from selection inside Readability output
                let matchedNode = VR_Reader.findNodeInReadabilityContent(fragmentInfo.containerNode, readabilityElement);
                
                if (matchedNode) {
                    // Try exact paragraph text extraction using text fragments
                    let remainingInParagraph = VR_Reader.getRemainingTextFromParagraph(fragmentInfo, matchedNode);
                    let textAfterNode = VR_Reader.getTextAfterNodeEfficient(matchedNode, readabilityElement);

                    const combined = VR_Reader.combineRemainingParagraphAndAfter(
                        remainingInParagraph,
                        textAfterNode,
                        matchedNode
                    );

                    if (combined.length > 0) {
                        readabilityResult = {
                            remainingText: combined,
                            articleText: articleText,
                            articleTitle: extractedTitle,
                            matchedNode: matchedNode,
                            fragmentInfo,
                            calculatedAt: Date.now(),
                            method: 'precise-text-fragment'
                        };
                    }
                }
                
                // If Node match failed, try String Match on the Clean Readability content
                if (!readabilityResult) {
                    const textMatchResult = VR_Reader.getRemainingTextByTextMatch(fragmentInfo, articleText, extractedTitle);
                    if (textMatchResult.method === 'text-match-fallback' && textMatchResult.remainingText.length > 0) {
                        readabilityResult = {
                            ...textMatchResult,
                            fragmentInfo,
                            calculatedAt: Date.now()
                        };
                    }
                }
            }

            // RETRY: If the first pass (with [class*="comment"] removal) produced
            // too little content, re-run the full-document Readability step but
            // KEEP comment elements. This rescues pages like Hacker News where the
            // entire page content is user comments and stripping them leaves nothing.
            if (!readabilityResult || !readabilityResult.remainingText || readabilityResult.remainingText.length <= 50) {
                try {
                    const documentClone = document.cloneNode(true);
                    removeJunk(documentClone.body, true);
                    const article = new Readability(documentClone).parse();
                    if (article && article.content && article.content.length > 50) {
                        const tempDiv = document.createElement("div");
                        tempDiv.innerHTML = article.content;
                        const retryArticleText = getInnerText_pageReader(tempDiv);
                        
                        const textMatchResult = VR_Reader.getRemainingTextByTextMatch(fragmentInfo, retryArticleText, article.title || extractedTitle);
                        if (textMatchResult.method === 'text-match-fallback' && textMatchResult.remainingText.length > 0) {
                            readabilityResult = {
                                ...textMatchResult,
                                articleText: retryArticleText,
                                articleTitle: article.title || extractedTitle,
                                fragmentInfo,
                                calculatedAt: Date.now(),
                                method: 'retry-kept-comments'
                            };
                            console.log('✅ Strategy A retry (keeping comments) succeeded');
                        }
                    }
                } catch (e) {
                    console.log('⚠️ Strategy A retry (keeping comments) failed:', e);
                }
            }
        } catch (e) {
            console.log("⚠️ Readability strategy failed:", e);
        }

        // ---------------------------------------------------------
        // STRATEGY B: RAW BODY FALLBACK (IF STRATEGY A FAILED)
        // ---------------------------------------------------------
        
        // If Readability was successful and found substantial text, return it
        if (readabilityResult && readabilityResult.remainingText && readabilityResult.remainingText.length > 50) {
            console.log(`✅ Using Readability Result (${readabilityResult.method})`);
            VR_Reader.remainingTextResult = readabilityResult;
            return readabilityResult;
        }

        // Otherwise, prioritize the Raw Body Fallback
        console.warn("⚠️ Readability failed or couldn't find selection. Switching to Raw Body Fallback.");
        
        const fallbackResult = VR_Reader.getFallbackRemainingText(fragmentInfo);
        
        // Add metadata to result
        const finalResult = {
            ...fallbackResult,
            fragmentInfo,
            calculatedAt: Date.now(),
            // Update method name for clarity if it was a successful fallback match
            method: fallbackResult.method === 'fallback-text-match' ? 'raw-body-fallback' : fallbackResult.method
        };

        VR_Reader.remainingTextResult = finalResult;
        console.log("Final Result:", VR_Reader.remainingTextResult);
        
        return VR_Reader.remainingTextResult;
        
    } catch(e) {
        console.error('Unexpected error in calculateRemainingText:', e);
        
        // Use fallback even in crash scenarios
        return VR_Reader.getFallbackRemainingText(VR_Reader.storedSelectionData?.fragmentInfo || {});
    }
};

VR_Reader.clearStoredSelection = () => {
    VR_Reader.storedSelectionData = null;
    VR_Reader.remainingTextResult = null;
    console.log('🗑️ Stored selection data cleared');
};