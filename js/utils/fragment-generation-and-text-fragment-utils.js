"use strict";

Object.defineProperty(globalThis, "__esModule", {
  value: true
});
globalThis.isValidRangeForFragmentGeneration = globalThis.generateFragment = globalThis.forTesting = globalThis.GenerateFragmentStatus = void 0;

// Block elements list. <DL>, <DT>, and <DD> are intentionally omitted so
// definition-list entries (e.g. GameRant's "Developer(s) Halo Studios") can be
// highlighted as a single sentence instead of being split at the label/value
// boundary, which previously caused the matcher to fail and fall back to an
// earlier body mention.
const BLOCK_ELEMENTS = ['ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'BR', 'DETAILS', 'DIALOG', 'DIV', 'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HGROUP', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'UL', 'TR', 'TH', 'TD', 'COLGROUP', 'COL', 'CAPTION', 'THEAD', 'TBODY', 'TFOOT']; 

const BOUNDARY_CHARS = /[\t-\r -#%-\*,-\/:;\?@\[-\]_\{\}\x85\xA0\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u0AF0\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u1680\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2000-\u200A\u2010-\u2029\u202F-\u2043\u2045-\u2051\u2053-\u205F\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E44\u3000-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC9\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDC4B-\uDC4F\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDF3C-\uDF3E]|\uD807[\uDC41-\uDC45\uDC70\uDC71]|\uD809[\uDC70-\uDC74]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD83A[\uDD5E\uDD5F]/u;

const NON_BOUNDARY_CHARS = /[^\t-\r -#%-\*,-\/:;\?@\[-\]_\{\}\x85\xA0\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u0AF0\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u1680\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2000-\u200A\u2010-\u2029\u202F-\u2043\u2045-\u2051\u2053-\u205F\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E44\u3000-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC9\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDC4B-\uDC4F\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDF3C-\uDF3E]|\uD807[\uDC41-\uDC45\uDC70\uDC71]|\uD809[\uDC70-\uDC74]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD83A[\uDD5E\uDD5F]/u;


/**
 * --- OPTIMIZATION START ---
 * Cached Normalization to avoid repetitive heavy Regex/Unicode ops
 */
const normalizationCache = new Map();

const normalizeString = str => {
  if (!str) return '';
  if (str.length > 1000) {
    // Don't cache massive strings, just process them
    return normalizeUncachedString(str);
  }
  
  if (normalizationCache.has(str)) {
    return normalizationCache.get(str);
  }

  const normalized = normalizeUncachedString(str);
  
  // Keep cache size manageable
  if (normalizationCache.size > 2000) {
    normalizationCache.clear();
  }
  
  normalizationCache.set(str, normalized);
  return normalized;
};

// Collapses whitespace, strips diacritics, lowercases, normalizes apostrophes,
// and merges split possessives/contractions ("Townfall 's" -> "townfall's").
// This keeps a sentence sourced from one text representation (e.g. innerText or
// html-to-text, which render "Townfall's" contiguously) matchable against the
// live-DOM text that getTextContent builds (where an inline-element boundary
// leaves a stray space before the apostrophe).
const normalizeUncachedString = str => {
  return str.normalize('NFKD')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/([a-z0-9]) '([a-z0-9])/g, "$1'$2");
};

/**
 * --- OPTIMIZATION START ---
 * Highly optimized visibility check.
 * Removes window.getComputedStyle() which causes Layout Thrashing.
 * Uses checkVisibility() where supported, falls back to offsetWidth/Height.
 */
const isNodeVisible = node => {
  // 1. Text Nodes: check parent
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent) return false;
    
    // Fast path: Modern API
    if (parent.checkVisibility) {
      return parent.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }
    // Fallback: Dimensions
    return !!(parent.offsetWidth || parent.offsetHeight || parent.getClientRects().length);
  }

  // 2. Elements
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (node.checkVisibility) {
       return node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }
    return !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length);
  }
  
  return true;
};
/* --- OPTIMIZATION END --- */


const processTextFragmentDirective = (textFragment,skipSuffix,searchStartAnchor = null) => {
  const results = [];
  const searchRange = document.createRange();
  searchRange.selectNodeContents(document.body);

  // The anchor marks where the *target* should begin. When we have a prefix,
  // the prefix itself can legitimately be before the anchor, so we search the
  // whole body for the prefix and then enforce that textStart is at or after
  // the anchor. For plain (no-prefix) searches we can start at the anchor.
  let anchorRange = null;
  if (searchStartAnchor && searchStartAnchor.node) {
    try {
      anchorRange = document.createRange();
      anchorRange.setStart(searchStartAnchor.node, searchStartAnchor.offset);
      anchorRange.collapse(true);
    } catch (err) {
      // Anchor may be stale (node detached/removed) - fall back to whole body.
      anchorRange = null;
    }
  }

  if (anchorRange && !textFragment.prefix) {
    try {
      searchRange.setStart(anchorRange.startContainer, anchorRange.startOffset);
    } catch (err) {
      // Stale anchor - fall back to whole body.
    }
  }

  while (!searchRange.collapsed && results.length < 2) {

    let potentialMatch;

    if (textFragment.prefix) {
      const prefixMatch = findTextInRange(textFragment.prefix, searchRange);

      if (prefixMatch == null) {
        break;
      } 

      advanceRangeStartPastOffset(searchRange, prefixMatch.startContainer, prefixMatch.startOffset); 

      const matchRange = document.createRange();
      matchRange.setStart(prefixMatch.endContainer, prefixMatch.endOffset);
      matchRange.setEnd(searchRange.endContainer, searchRange.endOffset);
      advanceRangeStartToNonWhitespace(matchRange);

      if (matchRange.collapsed) {
        break;
      }

      potentialMatch = findTextInRange(textFragment.textStart, matchRange); 

      if (potentialMatch == null) {
        break;
      } 

      if (potentialMatch.compareBoundaryPoints(Range.START_TO_START, matchRange) !== 0) {
        continue;
      }

      // If we have an anchor, reject prefix matches whose target starts
      // before the anchor. This keeps highlights on the correct duplicate
      // post / profile block while still allowing the prefix to be found.
      if (anchorRange && potentialMatch.compareBoundaryPoints(Range.START_TO_START, anchorRange) < 0) {
        continue;
      }
    } else {
      potentialMatch = findTextInRange(textFragment.textStart, searchRange);

      if (potentialMatch == null) {
        break;
      }

      advanceRangeStartPastOffset(searchRange, potentialMatch.startContainer, potentialMatch.startOffset);
    }

    if (textFragment.textEnd) {
      const textEndRange = document.createRange();
      textEndRange.setStart(potentialMatch.endContainer, potentialMatch.endOffset);
      textEndRange.setEnd(searchRange.endContainer, searchRange.endOffset); 

      let matchFound = false; 

      while (!textEndRange.collapsed && results.length < 2) {
        const textEndMatch = findTextInRange(textFragment.textEnd, textEndRange);

        if (textEndMatch == null) {
          break;
        }

        advanceRangeStartPastOffset(textEndRange, textEndMatch.startContainer, textEndMatch.startOffset);
        potentialMatch.setEnd(textEndMatch.endContainer, textEndMatch.endOffset);

        if (textFragment.suffix) {
          const suffixResult = checkSuffix(textFragment.suffix, potentialMatch, searchRange);

          if (suffixResult === CheckSuffixResult.NO_SUFFIX_MATCH) {
            break;
          } else if (suffixResult === CheckSuffixResult.SUFFIX_MATCH) {
            matchFound = true;
            results.push(potentialMatch.cloneRange());
            continue;
          } else if (suffixResult === CheckSuffixResult.MISPLACED_SUFFIX) {
            continue;
          }
        } else {
          matchFound = true;
          results.push(potentialMatch.cloneRange());
        }
      } 
      
      if (!matchFound) {
        break;
      }
    } else if (textFragment.suffix) {
      const suffixResult = checkSuffix(textFragment.suffix, potentialMatch, searchRange);

      if (suffixResult === CheckSuffixResult.NO_SUFFIX_MATCH) {
        break;
      } else if (suffixResult === CheckSuffixResult.SUFFIX_MATCH) {
        results.push(potentialMatch.cloneRange());
        advanceRangeStartPastOffset(searchRange, searchRange.startContainer, searchRange.startOffset);
        continue;
      } else if (suffixResult === CheckSuffixResult.MISPLACED_SUFFIX) {
        continue;
      }
    } else {
      results.push(potentialMatch.cloneRange());
    }
  }

  return results;
};


const CheckSuffixResult = {
  NO_SUFFIX_MATCH: 0,
  SUFFIX_MATCH: 1,
  MISPLACED_SUFFIX: 2 
};


const checkSuffix = (suffix, potentialMatch, searchRange) => {
  const suffixRange = document.createRange();
  suffixRange.setStart(potentialMatch.endContainer, potentialMatch.endOffset);
  suffixRange.setEnd(searchRange.endContainer, searchRange.endOffset);
  advanceRangeStartToNonWhitespace(suffixRange);
  const suffixMatch = findTextInRange(suffix, suffixRange); 

  if (suffixMatch == null) {
    return CheckSuffixResult.NO_SUFFIX_MATCH;
  } 

  if (suffixMatch.compareBoundaryPoints(Range.START_TO_START, suffixRange) !== 0) {
    return CheckSuffixResult.MISPLACED_SUFFIX;
  }

  return CheckSuffixResult.SUFFIX_MATCH;
};


// True when a candidate range's start is at or after the positional anchor.
// Used to reject matches that landed on an earlier duplicate occurrence so the
// highlighter reads forward instead of jumping back to the first one on the
// page. Fails open (returns true) when the anchor is missing or detached.
const isRangeAtOrAfterAnchor = (range, anchor) => {
  if (!anchor || !anchor.node) return true;
  try {
    const anchorRange = document.createRange();
    anchorRange.setStart(anchor.node, anchor.offset || 0);
    anchorRange.collapse(true);
    return anchorRange.compareBoundaryPoints(Range.START_TO_START, range) <= 0;
  } catch (e) {
    return true;
  }
};


const advanceRangeStartPastOffset = (range, node, offset) => {
  try {
    range.setStart(node, offset + 1);
  } catch (err) {
    range.setStartAfter(node);
  }
};


const advanceRangeStartToNonWhitespace = range => {
  const walker = makeTextNodeWalker(range);
  let node = walker.nextNode();

  while (!range.collapsed && node != null) {
    if (node !== range.startContainer) {
      range.setStart(node, 0);
    }

    if (node.textContent.length > range.startOffset) {
      const firstChar = node.textContent[range.startOffset];

      if (!firstChar.match(/\s/)) {
        return;
      }
    }

    try {
      range.setStart(node, range.startOffset + 1);
    } catch (err) {
      node = walker.nextNode();

      if (node == null) {
        range.collapse();
      } else {
        range.setStart(node, 0);
      }
    }
  }
};


const makeTextNodeWalker = range => {
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, node => {
    return acceptTextNodeIfVisibleInRange(node, range);
  });
  return walker;
};


const acceptNodeIfVisibleInRange = (node, range) => {
  if (range != null && !range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
  return isNodeVisible(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
};


const acceptTextNodeIfVisibleInRange = (node, range) => {
  if (range != null && !range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;

  if (!isNodeVisible(node)) {
    return NodeFilter.FILTER_REJECT;
  }

  return node.nodeType === Node.TEXT_NODE ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
};


const getAllTextNodes = (root, range) => {
  const blocks = [];
  let tmp = [];
  const nodes = Array.from(getElementsIn(root, node => {
    return acceptNodeIfVisibleInRange(node, range);
  }));

  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      tmp.push(node);
    } else if (node instanceof HTMLElement && BLOCK_ELEMENTS.includes(node.tagName) && tmp.length > 0) {
      blocks.push(tmp);
      tmp = [];
    }
  }

  if (tmp.length > 0) blocks.push(tmp);
  return blocks;
};


const getTextContent = (nodes, startOffset, endOffset) => {
  let str = '';

  if (nodes.length === 1) {
    str = nodes[0].textContent.substring(startOffset, endOffset);
  } else {
    str = nodes[0].textContent.substring(startOffset) + nodes.slice(1, -1).reduce((s, n) => s + n.textContent, '') + nodes.slice(-1)[0].textContent.substring(0, endOffset);
  }

  return str.replace(/[\t\n\r ]+/g, ' ');
};


function* getElementsIn(root, filter) {
  const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: filter
  });
  const finishedSubtrees = new Set();

  while (forwardTraverse(treeWalker, finishedSubtrees) !== null) {
    yield treeWalker.currentNode;
  }
}


const findTextInRange = (query, range) => {
  const textNodeLists = getAllTextNodes(range.commonAncestorContainer, range);
  const segmenter = makeNewSegmenter();

  for (const list of textNodeLists) {
    const found = findRangeFromNodeList(query, range, list, segmenter);
    if (found !== undefined) return found;
  }

  return undefined;
};


const findRangeFromNodeList = (query, range, textNodes, segmenter) => {
  if (!query || !range || !(textNodes || []).length) return undefined;
  const data = normalizeString(getTextContent(textNodes, 0, undefined));
  const normalizedQuery = normalizeString(query);
  let searchStart = textNodes[0] === range.startContainer ? range.startOffset : 0;
  let start;
  let end;

  while (searchStart < data.length) {
    const matchIndex = data.indexOf(normalizedQuery, searchStart);
    if (matchIndex === -1) return undefined;

    if (isWordBounded(data, matchIndex, normalizedQuery.length, segmenter)) {
      start = getBoundaryPointAtIndex(matchIndex, textNodes,
      /* isEnd=*/
      false);
      end = getBoundaryPointAtIndex(matchIndex + normalizedQuery.length, textNodes,
      /* isEnd=*/
      true);
    }

    if (start != null && end != null) {
      const foundRange = document.createRange();
      foundRange.setStart(start.node, start.offset);
      foundRange.setEnd(end.node, end.offset); // Verify that |foundRange| is a subrange of |range|

      if (range.compareBoundaryPoints(Range.START_TO_START, foundRange) <= 0 && range.compareBoundaryPoints(Range.END_TO_END, foundRange) >= 0) {
        return foundRange;
      }
    }

    searchStart = matchIndex + 1;
  }

  return undefined;
};


// True when an apostrophe-merge in normalizeString spans the boundary between
// two text nodes, i.e. normalizeString(a + b) removes one more space than the
// per-node normalizations account for ("Townfall" + " 's" -> "townfall's").
const mergeSpansNodeBoundary = (leftNorm, rightNorm) => {
  const leftEndsWord = /[a-z0-9]$/.test(leftNorm);
  const leftEndsWordSpace = /[a-z0-9] $/.test(leftNorm);
  const rightStartsApostropheWord = /^'[a-z0-9]/.test(rightNorm) || /^ '[a-z0-9]/.test(rightNorm);
  const joinHasSpace = leftEndsWordSpace || /^ /.test(rightNorm);
  return (leftEndsWord || leftEndsWordSpace) && joinHasSpace && rightStartsApostropheWord;
};

const getBoundaryPointAtIndex = (index, textNodes, isEnd) => {
  let counted = 0;
  let normalizedData;

  for (let i = 0; i < textNodes.length; i++) {
    const node = textNodes[i];
    if (!normalizedData) normalizedData = normalizeString(node.data);
    let nodeEnd = counted + normalizedData.length;
    if (isEnd) nodeEnd += 1;

    if (nodeEnd > index) {
      const normalizedOffset = index - counted;
      let denormalizedOffset = Math.min(index - counted, node.data.length); 
      const targetSubstring = isEnd ? normalizedData.substring(0, normalizedOffset) : normalizedData.substring(normalizedOffset);
      let candidateSubstring = isEnd ? normalizeString(node.data.substring(0, denormalizedOffset)) : normalizeString(node.data.substring(denormalizedOffset)); 

      const direction = (isEnd ? -1 : 1) * (targetSubstring.length > candidateSubstring.length ? -1 : 1);

      while (denormalizedOffset >= 0 && denormalizedOffset <= node.data.length) {
        if (candidateSubstring.length === targetSubstring.length) {
          return {
            node: node,
            offset: denormalizedOffset
          };
        }

        denormalizedOffset += direction;
        candidateSubstring = isEnd ? normalizeString(node.data.substring(0, denormalizedOffset)) : normalizeString(node.data.substring(denormalizedOffset));
      }
    }

    counted += normalizedData.length;

    if (i + 1 < textNodes.length) {
      const nextNormalizedData = normalizeString(textNodes[i + 1].data);

      if (normalizedData.slice(-1) === ' ' && nextNormalizedData.slice(0, 1) === ' ') {
        counted -= 1;
      }

      if (mergeSpansNodeBoundary(normalizedData, nextNormalizedData)) {
        counted -= 1;
      }

      normalizedData = nextNormalizedData;
    }
  }

  return undefined;
};


const isWordBounded = (text, startPos, length, segmenter) => {
  if (startPos < 0 || startPos >= text.length || length <= 0 || startPos + length > text.length) {
    return false;
  }

  if (segmenter) {
    const segments = segmenter.segment(text);
    const startSegment = segments.containing(startPos);
    if (!startSegment) return false; 

    if (startSegment.isWordLike && startSegment.index != startPos) return false; 

    const endPos = startPos + length;
    const endSegment = segments.containing(endPos); 

    if (endSegment && endSegment.isWordLike && endSegment.index != endPos) return false;
  } else {
    if (text[startPos].match(BOUNDARY_CHARS)) {
      ++startPos;
      --length;

      if (!length) {
        return false;
      }
    } 

    if (text[startPos + length - 1].match(BOUNDARY_CHARS)) {
      --length;

      if (!length) {
        return false;
      }
    }

    if (startPos !== 0 && !text[startPos - 1].match(BOUNDARY_CHARS)) return false;
    if (startPos + length !== text.length && !text[startPos + length].match(BOUNDARY_CHARS)) return false;
  }

  return true;
};


const makeNewSegmenter = () => {
  if (Intl.Segmenter) {
    let lang = document.documentElement.lang;

    if (!lang) {
      lang = navigator.languages;
    }

    return new Intl.Segmenter(lang, {
      granularity: 'word'
    });
  }

  return undefined;
};


const forwardTraverse = (walker, finishedSubtrees) => {
  if (!finishedSubtrees.has(walker.currentNode)) {
    const firstChild = walker.firstChild();

    if (firstChild !== null) {
      return firstChild;
    }
  } 

  const nextSibling = walker.nextSibling();

  if (nextSibling !== null) {
    return nextSibling;
  } 

  const parent = walker.parentNode();

  if (parent !== null) {
    finishedSubtrees.add(parent);
  }

  return parent;
};


const backwardTraverse = (walker, finishedSubtrees) => {
  if (!finishedSubtrees.has(walker.currentNode)) {
    const lastChild = walker.lastChild();

    if (lastChild !== null) {
      return lastChild;
    }
  } 

  const previousSibling = walker.previousSibling();

  if (previousSibling !== null) {
    return previousSibling;
  } 

  const parent = walker.parentNode();

  if (parent !== null) {
    finishedSubtrees.add(parent);
  }

  return parent;
};


const internal = {
  BLOCK_ELEMENTS: BLOCK_ELEMENTS,
  BOUNDARY_CHARS: BOUNDARY_CHARS,
  NON_BOUNDARY_CHARS: NON_BOUNDARY_CHARS,
  acceptNodeIfVisibleInRange: acceptNodeIfVisibleInRange,
  normalizeString: normalizeString,
  makeNewSegmenter: makeNewSegmenter,
  forwardTraverse: forwardTraverse,
  backwardTraverse: backwardTraverse,
  makeTextNodeWalker: makeTextNodeWalker,
  isNodeVisible: isNodeVisible
}; 

if (typeof goog !== 'undefined') {
  // clang-format off
  goog.declareModuleId('googleChromeLabs.textFragmentPolyfill.textFragmentUtils'); // clang-format on
}

const MAX_EXACT_MATCH_LENGTH = 300;
const MIN_LENGTH_WITHOUT_CONTEXT = 20;
const ITERATIONS_BEFORE_ADDING_CONTEXT = 1;
const WORDS_TO_ADD_FIRST_ITERATION = 3;
const WORDS_TO_ADD_SUBSEQUENT_ITERATIONS = 1;
const TRUNCATE_RANGE_CHECK_CHARS = 10000;
const MAX_DEPTH = 500; 

let timeoutDurationMs = 500;
let t0; 

const GenerateFragmentStatus = {
  SUCCESS: 0,
  INVALID_SELECTION: 1,
  AMBIGUOUS: 2,
  TIMEOUT: 3,
  EXECUTION_FAILED: 4 
};

globalThis.GenerateFragmentStatus = GenerateFragmentStatus;

const generateFragment = (selection, startTime = Date.now()) => {
  try {
    return doGenerateFragment(selection, startTime);
  } catch (err) {
    if (err.isTimeout) {
      return {
        status: GenerateFragmentStatus.TIMEOUT
      };
    } else {
      return {
        status: GenerateFragmentStatus.EXECUTION_FAILED
      };
    }
  }
};

globalThis.generateFragment = generateFragment;

const isValidRangeForFragmentGeneration = range => {
  if (!range.toString().substring(0, TRUNCATE_RANGE_CHECK_CHARS).match(internal.NON_BOUNDARY_CHARS)) {
    return false;
  } 

  try {
    if (range.startContainer.ownerDocument.defaultView !== window.top) {
      return false;
    }
  } catch {
    return false;
  } 

  let node = range.commonAncestorContainer;
  let numIterations = 0;

  while (node) {
    if (node.nodeType == Node.ELEMENT_NODE) {
      if (['TEXTAREA', 'INPUT'].includes(node.tagName)) {
        return false;
      }

      const editable = node.attributes.getNamedItem('contenteditable');

      if (editable && editable.value !== 'false') {
        return false;
      } 

      numIterations++;

      if (numIterations >= MAX_DEPTH) {
        return false;
      }
    }

    node = node.parentNode;
  }

  return true;
};


globalThis.isValidRangeForFragmentGeneration = isValidRangeForFragmentGeneration;

const doGenerateFragment = (selection, startTime) => {
  recordStartTime(startTime);
  let range;

  try {
    range = selection.getRangeAt(0);
  } catch {
    return {
      status: GenerateFragmentStatus.INVALID_SELECTION
    };
  }

  expandRangeStartToWordBound(range);
  expandRangeEndToWordBound(range); 

  const rangeBeforeShrinking = range.cloneRange();
  moveRangeEdgesToTextNodes(range);

  if (range.collapsed) {
    return {
      status: GenerateFragmentStatus.INVALID_SELECTION
    };
  }

  let factory;

  if (canUseExactMatch(range)) {
    const exactText = internal.normalizeString(range.toString());
    const fragment = {
      textStart: exactText
    }; 

    if (exactText.length >= MIN_LENGTH_WITHOUT_CONTEXT && isUniquelyIdentifying(fragment)) {
      return {
        status: GenerateFragmentStatus.SUCCESS,
        fragment: fragment
      };
    }

    factory = new FragmentFactory().setExactTextMatch(exactText);
  } else {
    const startSearchSpace = getSearchSpaceForStart(range);
    const endSearchSpace = getSearchSpaceForEnd(range);

    if (startSearchSpace && endSearchSpace) {
      factory = new FragmentFactory().setStartAndEndSearchSpace(startSearchSpace, endSearchSpace);
    } else {
      factory = new FragmentFactory().setSharedSearchSpace(range.toString().trim());
    }
  }

  const prefixRange = document.createRange();
  prefixRange.selectNodeContents(document.body);
  const suffixRange = prefixRange.cloneRange();
  prefixRange.setEnd(rangeBeforeShrinking.startContainer, rangeBeforeShrinking.startOffset);
  suffixRange.setStart(rangeBeforeShrinking.endContainer, rangeBeforeShrinking.endOffset);
  const prefixSearchSpace = getSearchSpaceForEnd(prefixRange);
  const suffixSearchSpace = getSearchSpaceForStart(suffixRange);

  if (prefixSearchSpace || suffixSearchSpace) {
    factory.setPrefixAndSuffixSearchSpace(prefixSearchSpace, suffixSearchSpace);
  }

  factory.useSegmenter(internal.makeNewSegmenter());
  let didEmbiggen = false;

  do {
    checkTimeout();
    didEmbiggen = factory.embiggen();
    const fragment = factory.tryToMakeUniqueFragment();

    if (fragment != null) {
      return {
        status: GenerateFragmentStatus.SUCCESS,
        fragment: fragment
      };
    }
  } while (didEmbiggen);

  return {
    status: GenerateFragmentStatus.AMBIGUOUS
  };
};


const checkTimeout = () => {
  if (timeoutDurationMs === null) {
    return;
  }

  const delta = Date.now() - t0;

  if (delta > timeoutDurationMs) {
    const timeoutError = new Error(`Fragment generation timed out after ${delta} ms.`);
    timeoutError.isTimeout = true;
    throw timeoutError;
  }
};


const recordStartTime = newStartTime => {
  t0 = newStartTime;
};


const getSearchSpaceForStart = range => {
  let node = getFirstNodeForBlockSearch(range);
  const walker = makeWalkerForNode(node, range.endContainer);

  if (!walker) {
    return undefined;
  }

  const finishedSubtrees = new Set(); 

  if (range.startContainer.nodeType === Node.ELEMENT_NODE && range.startOffset === range.startContainer.childNodes.length) {
    finishedSubtrees.add(range.startContainer);
  }

  const origin = node;
  const textAccumulator = new BlockTextAccumulator(range, true); 
  const tempRange = range.cloneRange();

  while (!tempRange.collapsed && node != null) {
    checkTimeout(); 

    if (node.contains(origin)) {
      tempRange.setStartAfter(node);
    } else {
      tempRange.setStartBefore(node);
    } 
    textAccumulator.appendNode(node); 

    if (textAccumulator.textInBlock !== null) {
      return textAccumulator.textInBlock;
    }

    node = internal.forwardTraverse(walker, finishedSubtrees);
  }

  return undefined;
};


const getSearchSpaceForEnd = range => {
  let node = getLastNodeForBlockSearch(range);
  const walker = makeWalkerForNode(node, range.startContainer);

  if (!walker) {
    return undefined;
  }

  const finishedSubtrees = new Set(); 

  if (range.endContainer.nodeType === Node.ELEMENT_NODE && range.endOffset === 0) {
    finishedSubtrees.add(range.endContainer);
  }

  const origin = node;
  const textAccumulator = new BlockTextAccumulator(range, false); 

  const tempRange = range.cloneRange();

  while (!tempRange.collapsed && node != null) {
    checkTimeout(); 

    if (node.contains(origin)) {
      tempRange.setEnd(node, 0);
    } else {
      tempRange.setEndAfter(node);
    } 

    textAccumulator.appendNode(node); 

    if (textAccumulator.textInBlock !== null) {
      return textAccumulator.textInBlock;
    }

    node = internal.backwardTraverse(walker, finishedSubtrees);
  }

  return undefined;
};


const FragmentFactory = class {
  constructor() {
    this.Mode = {
      ALL_PARTS: 1,
      SHARED_START_AND_END: 2,
      CONTEXT_ONLY: 3
    };
    this.startOffset = null;
    this.endOffset = null;
    this.prefixOffset = null;
    this.suffixOffset = null;
    this.prefixSearchSpace = '';
    this.backwardsPrefixSearchSpace = '';
    this.suffixSearchSpace = '';
    this.numIterations = 0;
  }
 

  tryToMakeUniqueFragment() {
    let fragment;

    if (this.mode === this.Mode.CONTEXT_ONLY) {
      fragment = {
        textStart: this.exactTextMatch
      };
    } else {
      fragment = {
        textStart: this.getStartSearchSpace().substring(0, this.startOffset).trim(),
        textEnd: this.getEndSearchSpace().substring(this.endOffset).trim()
      };
    }

    if (this.prefixOffset != null) {
      const prefix = this.getPrefixSearchSpace().substring(this.prefixOffset).trim();

      if (prefix) {
        fragment.prefix = prefix;
      }
    }

    if (this.suffixOffset != null) {
      const suffix = this.getSuffixSearchSpace().substring(0, this.suffixOffset).trim();

      if (suffix) {
        fragment.suffix = suffix;
      }
    }

    return isUniquelyIdentifying(fragment) ? fragment : undefined;
  }


  embiggen() {
    let canExpandRange = true;

    if (this.mode === this.Mode.SHARED_START_AND_END) {
      if (this.startOffset >= this.endOffset) {
        canExpandRange = false;
      }
    } else if (this.mode === this.Mode.ALL_PARTS) {
      if (this.startOffset === this.getStartSearchSpace().length && this.backwardsEndOffset() === this.getEndSearchSpace().length) {
        canExpandRange = false;
      }
    } else if (this.mode === this.Mode.CONTEXT_ONLY) {
      canExpandRange = false;
    }

    if (canExpandRange) {
      const desiredIterations = this.getNumberOfRangeWordsToAdd();

      if (this.startOffset < this.getStartSearchSpace().length) {
        let i = 0;

        if (this.getStartSegments() != null) {
          while (i < desiredIterations && this.startOffset < this.getStartSearchSpace().length) {
            this.startOffset = this.getNextOffsetForwards(this.getStartSegments(), this.startOffset, this.getStartSearchSpace());
            i++;
          }
        } else {
          let oldStartOffset = this.startOffset;

          do {
            checkTimeout();
            const newStartOffset = this.getStartSearchSpace().substring(this.startOffset + 1).search(internal.BOUNDARY_CHARS);

            if (newStartOffset === -1) {
              this.startOffset = this.getStartSearchSpace().length;
            } else {
              this.startOffset = this.startOffset + 1 + newStartOffset;
            } 


            if (this.getStartSearchSpace().substring(oldStartOffset, this.startOffset).search(internal.NON_BOUNDARY_CHARS) !== -1) {
              oldStartOffset = this.startOffset;
              i++;
            }
          } while (this.startOffset < this.getStartSearchSpace().length && i < desiredIterations);
        } 

        if (this.mode === this.Mode.SHARED_START_AND_END) {
          this.startOffset = Math.min(this.startOffset, this.endOffset);
        }
      }

      if (this.backwardsEndOffset() < this.getEndSearchSpace().length) {
        let i = 0;

        if (this.getEndSegments() != null) {
          while (i < desiredIterations && this.endOffset > 0) {
            this.endOffset = this.getNextOffsetBackwards(this.getEndSegments(), this.endOffset);
            i++;
          }
        } else {
          let oldBackwardsEndOffset = this.backwardsEndOffset();

          do {
            checkTimeout();
            const newBackwardsOffset = this.getBackwardsEndSearchSpace().substring(this.backwardsEndOffset() + 1).search(internal.BOUNDARY_CHARS);

            if (newBackwardsOffset === -1) {
              this.setBackwardsEndOffset(this.getEndSearchSpace().length);
            } else {
              this.setBackwardsEndOffset(this.backwardsEndOffset() + 1 + newBackwardsOffset);
            } 


            if (this.getBackwardsEndSearchSpace().substring(oldBackwardsEndOffset, this.backwardsEndOffset()).search(internal.NON_BOUNDARY_CHARS) !== -1) {
              oldBackwardsEndOffset = this.backwardsEndOffset();
              i++;
            }
          } while (this.backwardsEndOffset() < this.getEndSearchSpace().length && i < desiredIterations);
        } 


        if (this.mode === this.Mode.SHARED_START_AND_END) {
          this.endOffset = Math.max(this.startOffset, this.endOffset);
        }
      }
    }

    let canExpandContext = false;

    if (!canExpandRange || this.startOffset + this.backwardsEndOffset() < MIN_LENGTH_WITHOUT_CONTEXT || this.numIterations >= ITERATIONS_BEFORE_ADDING_CONTEXT) {
      if (this.backwardsPrefixOffset() != null && this.backwardsPrefixOffset() !== this.getPrefixSearchSpace().length || this.suffixOffset != null && this.suffixOffset !== this.getSuffixSearchSpace().length) {
        canExpandContext = true;
      }
    }

    if (canExpandContext) {
      const desiredIterations = this.getNumberOfContextWordsToAdd();

      if (this.backwardsPrefixOffset() < this.getPrefixSearchSpace().length) {
        let i = 0;

        if (this.getPrefixSegments() != null) {
          while (i < desiredIterations && this.prefixOffset > 0) {
            this.prefixOffset = this.getNextOffsetBackwards(this.getPrefixSegments(), this.prefixOffset);
            i++;
          }
        } else {
          let oldBackwardsPrefixOffset = this.backwardsPrefixOffset();

          do {
            checkTimeout();
            const newBackwardsPrefixOffset = this.getBackwardsPrefixSearchSpace().substring(this.backwardsPrefixOffset() + 1).search(internal.BOUNDARY_CHARS);

            if (newBackwardsPrefixOffset === -1) {
              this.setBackwardsPrefixOffset(this.getBackwardsPrefixSearchSpace().length);
            } else {
              this.setBackwardsPrefixOffset(this.backwardsPrefixOffset() + 1 + newBackwardsPrefixOffset);
            } 


            if (this.getBackwardsPrefixSearchSpace().substring(oldBackwardsPrefixOffset, this.backwardsPrefixOffset()).search(internal.NON_BOUNDARY_CHARS) !== -1) {
              oldBackwardsPrefixOffset = this.backwardsPrefixOffset();
              i++;
            }
          } while (this.backwardsPrefixOffset() < this.getPrefixSearchSpace().length && i < desiredIterations);
        }
      }

      if (this.suffixOffset < this.getSuffixSearchSpace().length) {
        let i = 0;

        if (this.getSuffixSegments() != null) {
          while (i < desiredIterations && this.suffixOffset < this.getSuffixSearchSpace().length) {
            this.suffixOffset = this.getNextOffsetForwards(this.getSuffixSegments(), this.suffixOffset, this.suffixOffset);
            i++;
          }
        } else {
          let oldSuffixOffset = this.suffixOffset;

          do {
            checkTimeout();
            const newSuffixOffset = this.getSuffixSearchSpace().substring(this.suffixOffset + 1).search(internal.BOUNDARY_CHARS);

            if (newSuffixOffset === -1) {
              this.suffixOffset = this.getSuffixSearchSpace().length;
            } else {
              this.suffixOffset = this.suffixOffset + 1 + newSuffixOffset;
            } 


            if (this.getSuffixSearchSpace().substring(oldSuffixOffset, this.suffixOffset).search(internal.NON_BOUNDARY_CHARS) !== -1) {
              oldSuffixOffset = this.suffixOffset;
              i++;
            }
          } while (this.suffixOffset < this.getSuffixSearchSpace().length && i < desiredIterations);
        }
      }
    }

    this.numIterations++; 

    return canExpandRange || canExpandContext;
  }


  setStartAndEndSearchSpace(startSearchSpace, endSearchSpace) {
    this.startSearchSpace = startSearchSpace;
    this.endSearchSpace = endSearchSpace;
    this.backwardsEndSearchSpace = reverseString(endSearchSpace);
    this.startOffset = 0;
    this.endOffset = endSearchSpace.length;
    this.mode = this.Mode.ALL_PARTS;
    return this;
  }


  setSharedSearchSpace(sharedSearchSpace) {
    this.sharedSearchSpace = sharedSearchSpace;
    this.backwardsSharedSearchSpace = reverseString(sharedSearchSpace);
    this.startOffset = 0;
    this.endOffset = sharedSearchSpace.length;
    this.mode = this.Mode.SHARED_START_AND_END;
    return this;
  }


  setExactTextMatch(exactTextMatch) {
    this.exactTextMatch = exactTextMatch;
    this.mode = this.Mode.CONTEXT_ONLY;
    return this;
  }


  setPrefixAndSuffixSearchSpace(prefixSearchSpace, suffixSearchSpace) {
    if (prefixSearchSpace) {
      this.prefixSearchSpace = prefixSearchSpace;
      this.backwardsPrefixSearchSpace = reverseString(prefixSearchSpace);
      this.prefixOffset = prefixSearchSpace.length;
    }

    if (suffixSearchSpace) {
      this.suffixSearchSpace = suffixSearchSpace;
      this.suffixOffset = 0;
    }

    return this;
  }


  useSegmenter(segmenter) {
    if (segmenter == null) {
      return this;
    }

    if (this.mode === this.Mode.ALL_PARTS) {
      this.startSegments = segmenter.segment(this.startSearchSpace);
      this.endSegments = segmenter.segment(this.endSearchSpace);
    } else if (this.mode === this.Mode.SHARED_START_AND_END) {
      this.sharedSegments = segmenter.segment(this.sharedSearchSpace);
    }

    if (this.prefixSearchSpace) {
      this.prefixSegments = segmenter.segment(this.prefixSearchSpace);
    }

    if (this.suffixSearchSpace) {
      this.suffixSegments = segmenter.segment(this.suffixSearchSpace);
    }

    return this;
  }


  getNumberOfContextWordsToAdd() {
    return this.backwardsPrefixOffset() === 0 && this.suffixOffset === 0 ? WORDS_TO_ADD_FIRST_ITERATION : WORDS_TO_ADD_SUBSEQUENT_ITERATIONS;
  }


  getNumberOfRangeWordsToAdd() {
    return this.startOffset === 0 && this.backwardsEndOffset() === 0 ? WORDS_TO_ADD_FIRST_ITERATION : WORDS_TO_ADD_SUBSEQUENT_ITERATIONS;
  }


  getNextOffsetForwards(segments, offset, searchSpace) {
    let currentSegment = segments.containing(offset);

    while (currentSegment != null) {
      checkTimeout();
      const currentSegmentEnd = currentSegment.index + currentSegment.segment.length;

      if (currentSegment.isWordLike) {
        return currentSegmentEnd;
      }

      currentSegment = segments.containing(currentSegmentEnd);
    } 

    return searchSpace.length;
  }


  getNextOffsetBackwards(segments, offset) {
    let currentSegment = segments.containing(offset); 

    if (!currentSegment || offset == currentSegment.index) {
      currentSegment = segments.containing(offset - 1);
    }

    while (currentSegment != null) {
      checkTimeout();

      if (currentSegment.isWordLike) {
        return currentSegment.index;
      }

      currentSegment = segments.containing(currentSegment.index - 1);
    } 

    return 0;
  }


  getStartSearchSpace() {
    return this.mode === this.Mode.SHARED_START_AND_END ? this.sharedSearchSpace : this.startSearchSpace;
  }


  getStartSegments() {
    return this.mode === this.Mode.SHARED_START_AND_END ? this.sharedSegments : this.startSegments;
  }


  getEndSearchSpace() {
    return this.mode === this.Mode.SHARED_START_AND_END ? this.sharedSearchSpace : this.endSearchSpace;
  }


  getEndSegments() {
    return this.mode === this.Mode.SHARED_START_AND_END ? this.sharedSegments : this.endSegments;
  }


  getBackwardsEndSearchSpace() {
    return this.mode === this.Mode.SHARED_START_AND_END ? this.backwardsSharedSearchSpace : this.backwardsEndSearchSpace;
  }


  getPrefixSearchSpace() {
    return this.prefixSearchSpace;
  }


  getPrefixSegments() {
    return this.prefixSegments;
  }


  getBackwardsPrefixSearchSpace() {
    return this.backwardsPrefixSearchSpace;
  }


  getSuffixSearchSpace() {
    return this.suffixSearchSpace;
  }


  getSuffixSegments() {
    return this.suffixSegments;
  }


  backwardsEndOffset() {
    return this.getEndSearchSpace().length - this.endOffset;
  }


  setBackwardsEndOffset(backwardsEndOffset) {
    this.endOffset = this.getEndSearchSpace().length - backwardsEndOffset;
  }


  backwardsPrefixOffset() {
    if (this.prefixOffset == null) return null;
    return this.getPrefixSearchSpace().length - this.prefixOffset;
  }


  setBackwardsPrefixOffset(backwardsPrefixOffset) {
    if (this.prefixOffset == null) return;
    this.prefixOffset = this.getPrefixSearchSpace().length - backwardsPrefixOffset;
  }

};


const BlockTextAccumulator = class {
  constructor(searchRange, isForwardTraversal) {
    this.searchRange = searchRange;
    this.isForwardTraversal = isForwardTraversal;
    this.textFound = false;
    this.textNodes = [];
    this.textInBlock = null;
  }

  appendNode(node) {
    if (this.textInBlock !== null) {
      return;
    } 

    if (isBlock(node)) {
      if (this.textFound) {
        if (!this.isForwardTraversal) {
          this.textNodes.reverse();
        } 

        this.textInBlock = this.textNodes.map(textNode => textNode.textContent).join('').trim();
      } else {
        this.textNodes = [];
      }

      return;
    } 

    if (!isText(node)) return; 

    const nodeToInsert = this.getNodeIntersectionWithRange(node); 

    this.textFound = this.textFound || nodeToInsert.textContent.trim() !== '';
    this.textNodes.push(nodeToInsert);
  }


  getNodeIntersectionWithRange(node) {
    let startOffset = null;
    let endOffset = null;

    if (node === this.searchRange.startContainer && this.searchRange.startOffset !== 0) {
      startOffset = this.searchRange.startOffset;
    }

    if (node === this.searchRange.endContainer && this.searchRange.endOffset !== node.textContent.length) {
      endOffset = this.searchRange.endOffset;
    }

    if (startOffset !== null || endOffset !== null) {
      return {
        textContent: node.textContent.substring(startOffset ?? 0, endOffset ?? node.textContent.length)
      };
    }

    return node;
  }

};

const isUniquelyIdentifying = fragment => {
  return processTextFragmentDirective(fragment).length === 1;
};


const reverseString = string => {
  return [...(string || '')].reverse().join('');
};


const canUseExactMatch = range => {
  if (range.toString().length > MAX_EXACT_MATCH_LENGTH) return false;
  return !containsBlockBoundary(range);
};


const getFirstNodeForBlockSearch = range => {
  let node = range.startContainer;

  if (node.nodeType == Node.ELEMENT_NODE && range.startOffset < node.childNodes.length) {
    node = node.childNodes[range.startOffset];
  }

  return node;
};


const getLastNodeForBlockSearch = range => {
  let node = range.endContainer;

  if (node.nodeType == Node.ELEMENT_NODE && range.endOffset > 0) {
    node = node.childNodes[range.endOffset - 1];
  }

  return node;
};


const getFirstTextNode = range => {
  const firstNode = getFirstNodeForBlockSearch(range);

  if (isText(firstNode) && internal.isNodeVisible(firstNode)) {
    return firstNode;
  } 

  const walker = internal.makeTextNodeWalker(range);
  walker.currentNode = firstNode;
  return walker.nextNode();
};


const getLastTextNode = range => {
  const lastNode = getLastNodeForBlockSearch(range);

  if (isText(lastNode) && internal.isNodeVisible(lastNode)) {
    return lastNode;
  } 

  const walker = internal.makeTextNodeWalker(range);
  walker.currentNode = lastNode;
  return internal.backwardTraverse(walker, new Set());
};


const containsBlockBoundary = range => {
  const tempRange = range.cloneRange();
  let node = getFirstNodeForBlockSearch(tempRange);
  const walker = makeWalkerForNode(node);

  if (!walker) {
    return false;
  }

  const finishedSubtrees = new Set();

  while (!tempRange.collapsed && node != null) {
    if (isBlock(node)) return true;
    if (node != null) tempRange.setStartAfter(node);
    node = internal.forwardTraverse(walker, finishedSubtrees);
    checkTimeout();
  }

  return false;
};


const findWordStartBoundInTextNode = (node, startOffset) => {
  if (node.nodeType !== Node.TEXT_NODE) return -1;
  const offset = startOffset != null ? startOffset : node.data.length; 

  if (offset < node.data.length && internal.BOUNDARY_CHARS.test(node.data[offset])) return offset;
  const precedingText = node.data.substring(0, offset);
  const boundaryIndex = reverseString(precedingText).search(internal.BOUNDARY_CHARS);

  if (boundaryIndex !== -1) {
    return offset - boundaryIndex;
  }

  return -1;
};


const findWordEndBoundInTextNode = (node, endOffset) => {
  if (node.nodeType !== Node.TEXT_NODE) return -1;
  const offset = endOffset != null ? endOffset : 0; 

  if (offset < node.data.length && offset > 0 && internal.BOUNDARY_CHARS.test(node.data[offset - 1])) {
    return offset;
  }

  const followingText = node.data.substring(offset);
  const boundaryIndex = followingText.search(internal.BOUNDARY_CHARS);

  if (boundaryIndex !== -1) {
    return offset + boundaryIndex;
  }

  return -1;
};


const makeWalkerForNode = (node, endNode) => {
  if (!node) {
    return undefined;
  } 

  let blockAncestor = node;
  const endNodeNotNull = endNode != null ? endNode : node;

  while (!blockAncestor.contains(endNodeNotNull) || !isBlock(blockAncestor)) {
    if (blockAncestor.parentNode) {
      blockAncestor = blockAncestor.parentNode;
    }
  }

  const walker = document.createTreeWalker(blockAncestor, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, node => {
    return internal.acceptNodeIfVisibleInRange(node);
  });
  walker.currentNode = node;
  return walker;
};


const expandRangeStartToWordBound = range => {
  const segmenter = internal.makeNewSegmenter();

  if (segmenter) {
    const startNode = getFirstNodeForBlockSearch(range);

    if (startNode !== range.startContainer) {
      range.setStartBefore(startNode);
    }

    expandToNearestWordBoundaryPointUsingSegments(segmenter,
    /* expandForward= */
    false, range);
  } else {
    const newOffset = findWordStartBoundInTextNode(range.startContainer, range.startOffset);

    if (newOffset !== -1) {
      range.setStart(range.startContainer, newOffset);
      return;
    } 

    if (isBlock(range.startContainer) && range.startOffset === 0) {
      return;
    }

    const walker = makeWalkerForNode(range.startContainer);

    if (!walker) {
      return;
    }

    const finishedSubtrees = new Set();
    let node = internal.backwardTraverse(walker, finishedSubtrees);

    while (node != null) {
      const newOffset = findWordStartBoundInTextNode(node);

      if (newOffset !== -1) {
        range.setStart(node, newOffset);
        return;
      } 

      if (isBlock(node)) {
        if (node.contains(range.startContainer)) {
          range.setStart(node, 0);
        } else {
          range.setStartAfter(node);
        }

        return;
      }

      node = internal.backwardTraverse(walker, finishedSubtrees); 

      range.collapse();
    }
  }
};


const moveRangeEdgesToTextNodes = range => {
  const firstTextNode = getFirstTextNode(range); 

  if (firstTextNode == null) {
    range.collapse();
    return;
  }

  const firstNode = getFirstNodeForBlockSearch(range); 

  if (firstNode !== firstTextNode) {
    range.setStart(firstTextNode, 0);
  }

  const lastNode = getLastNodeForBlockSearch(range);
  const lastTextNode = getLastTextNode(range); 

  if (lastNode !== lastTextNode) {
    range.setEnd(lastTextNode, lastTextNode.textContent.length);
  }
};


const expandToNearestWordBoundaryPointUsingSegments = (segmenter, isRangeEnd, range) => {
  const boundary = isRangeEnd ? {
    node: range.endContainer,
    offset: range.endOffset
  } : {
    node: range.startContainer,
    offset: range.startOffset
  };
  const nodes = getTextNodesInSameBlock(boundary.node);
  const preNodeText = nodes.preNodes.reduce((prev, cur) => {
    return prev.concat(cur.textContent);
  }, '');
  const innerNodeText = nodes.innerNodes.reduce((prev, cur) => {
    return prev.concat(cur.textContent);
  }, '');
  let offsetInText = preNodeText.length;

  if (boundary.node.nodeType === Node.TEXT_NODE) {
    offsetInText += boundary.offset;
  } else if (isRangeEnd) {
    offsetInText += innerNodeText.length;
  } 

  const postNodeText = nodes.postNodes.reduce((prev, cur) => {
    return prev.concat(cur.textContent);
  }, '');
  const allNodes = [...nodes.preNodes, ...nodes.innerNodes, ...nodes.postNodes]; 

  if (allNodes.length == 0) {
    return;
  }

  const text = preNodeText.concat(innerNodeText, postNodeText);
  const segments = segmenter.segment(text);
  const foundSegment = segments.containing(offsetInText);

  if (!foundSegment) {
    if (isRangeEnd) {
      range.setEndAfter(allNodes[allNodes.length - 1]);
    } else {
      range.setEndBefore(allNodes[0]);
    }

    return;
  } 

  if (!foundSegment.isWordLike) {
    return;
  } 

  if (offsetInText === foundSegment.index || offsetInText === foundSegment.index + foundSegment.segment.length) {
    return;
  } 

  const desiredOffsetInText = isRangeEnd ? foundSegment.index + foundSegment.segment.length : foundSegment.index;
  let newNodeIndexInText = 0;

  for (const node of allNodes) {
    if (newNodeIndexInText <= desiredOffsetInText && desiredOffsetInText < newNodeIndexInText + node.textContent.length) {
      const offsetInNode = desiredOffsetInText - newNodeIndexInText;

      if (isRangeEnd) {
        if (offsetInNode >= node.textContent.length) {
          range.setEndAfter(node);
        } else {
          range.setEnd(node, offsetInNode);
        }
      } else {
        if (offsetInNode >= node.textContent.length) {
          range.setStartAfter(node);
        } else {
          range.setStart(node, offsetInNode);
        }
      }

      return;
    }

    newNodeIndexInText += node.textContent.length;
  } 

  if (isRangeEnd) {
    range.setEndAfter(allNodes[allNodes.length - 1]);
  } else {
    range.setStartBefore(allNodes[0]);
  }
};


const getTextNodesInSameBlock = node => {
  const preNodes = []; 

  const backWalker = makeWalkerForNode(node);

  if (!backWalker) {
    return;
  }

  const finishedSubtrees = new Set();
  let backNode = internal.backwardTraverse(backWalker, finishedSubtrees);

  while (backNode != null && !isBlock(backNode)) {
    checkTimeout();

    if (backNode.nodeType === Node.TEXT_NODE) {
      preNodes.push(backNode);
    }

    backNode = internal.backwardTraverse(backWalker, finishedSubtrees);
  }

  preNodes.reverse();
  const innerNodes = [];

  if (node.nodeType === Node.TEXT_NODE) {
    innerNodes.push(node);
  } else {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, node => {
      return internal.acceptNodeIfVisibleInRange(node);
    });
    walker.currentNode = node;
    let child = walker.nextNode();

    while (child != null) {
      checkTimeout();

      if (child.nodeType === Node.TEXT_NODE) {
        innerNodes.push(child);
      }

      child = walker.nextNode();
    }
  }

  const postNodes = [];
  const forwardWalker = makeWalkerForNode(node);

  if (!forwardWalker) {
    return;
  } 

  const finishedSubtreesForward = new Set([node]);
  let forwardNode = internal.forwardTraverse(forwardWalker, finishedSubtreesForward);

  while (forwardNode != null && !isBlock(forwardNode)) {
    checkTimeout();

    if (forwardNode.nodeType === Node.TEXT_NODE) {
      postNodes.push(forwardNode);
    }

    forwardNode = internal.forwardTraverse(forwardWalker, finishedSubtreesForward);
  }

  return {
    preNodes: preNodes,
    innerNodes: innerNodes,
    postNodes: postNodes
  };
};


const expandRangeEndToWordBound = range => {
  const segmenter = internal.makeNewSegmenter();

  if (segmenter) {
    const endNode = getLastNodeForBlockSearch(range);

    if (endNode !== range.endContainer) {
      range.setEndAfter(endNode);
    }

    expandToNearestWordBoundaryPointUsingSegments(segmenter,
    /* expandForward= */
    true, range);
  } else {
    let initialOffset = range.endOffset;
    let node = range.endContainer;

    if (node.nodeType === Node.ELEMENT_NODE) {
      if (range.endOffset < node.childNodes.length) {
        node = node.childNodes[range.endOffset];
      }
    }

    const walker = makeWalkerForNode(node);

    if (!walker) {
      return;
    } 

    const finishedSubtrees = new Set([node]);

    while (node != null) {
      checkTimeout();
      const newOffset = findWordEndBoundInTextNode(node, initialOffset); 

      initialOffset = null;

      if (newOffset !== -1) {
        range.setEnd(node, newOffset);
        return;
      } 

      if (isBlock(node)) {
        if (node.contains(range.endContainer)) {
          range.setEnd(node, node.childNodes.length);
        } else {
          range.setEndBefore(node);
        }

        return;
      }

      node = internal.forwardTraverse(walker, finishedSubtrees);
    } 

    range.collapse();
  }
};


const isBlock = node => {
  return node.nodeType === Node.ELEMENT_NODE && (internal.BLOCK_ELEMENTS.includes(node.tagName) || node.tagName === 'HTML' || node.tagName === 'BODY');
};


const isText = node => {
  return node.nodeType === Node.TEXT_NODE;
};

const forTesting = {
  containsBlockBoundary: containsBlockBoundary,
  doGenerateFragment: doGenerateFragment,
  expandRangeEndToWordBound: expandRangeEndToWordBound,
  expandRangeStartToWordBound: expandRangeStartToWordBound,
  findWordEndBoundInTextNode: findWordEndBoundInTextNode,
  findWordStartBoundInTextNode: findWordStartBoundInTextNode,
  FragmentFactory: FragmentFactory,
  getSearchSpaceForEnd: getSearchSpaceForEnd,
  getSearchSpaceForStart: getSearchSpaceForStart,
  getTextNodesInSameBlock: getTextNodesInSameBlock,
  recordStartTime: recordStartTime,
  BlockTextAccumulator: BlockTextAccumulator,
  getFirstTextNode: getFirstTextNode,
  getLastTextNode: getLastTextNode,
  processTextFragmentDirective:processTextFragmentDirective,
  moveRangeEdgesToTextNodes: moveRangeEdgesToTextNodes
}; 

globalThis.forTesting = forTesting;

if (typeof goog !== 'undefined') {
  // clang-format off
  goog.declareModuleId('googleChromeLabs.textFragmentPolyfill.fragmentGenerationUtils'); // clang-format on
}


const FRAGMENT_DIRECTIVES = ['text'];

globalThis.TEXT_FRAGMENT_CSS_CLASS_NAME =
'text-fragments-vrr ';

globalThis.getFragmentDirectives = (hash) => {
  const fragmentDirectivesStrings =
      hash.replace(/#.*?:~:(.*?)/, '$1').split(/&?text=/).filter(Boolean);
  if (!fragmentDirectivesStrings.length) {
    return {};
  } else {
    return {text: fragmentDirectivesStrings};
  }
};


globalThis.parseFragmentDirectives = (fragmentDirectives) => {
  const parsedFragmentDirectives = {};
  for (const
           [fragmentDirectiveType,
            fragmentDirectivesOfType,
  ] of Object.entries(fragmentDirectives)) {
    if (FRAGMENT_DIRECTIVES.includes(fragmentDirectiveType)) {
      parsedFragmentDirectives[fragmentDirectiveType] =
          fragmentDirectivesOfType.map((fragmentDirectiveOfType) => {
            return parseTextFragmentDirective(fragmentDirectiveOfType);
          });
    }
  }
  return parsedFragmentDirectives;
};


const parseTextFragmentDirective = (textFragment) => {
  const TEXT_FRAGMENT = /^(?:(.+?)-,)?(?:(.+?))(?:,([^-]+?))?(?:,-(.+?))?$/;
  return {
    prefix: decodeURIComponent(textFragment.replace(TEXT_FRAGMENT, '$1')),
    textStart: decodeURIComponent(textFragment.replace(TEXT_FRAGMENT, '$2')),
    textEnd: decodeURIComponent(textFragment.replace(TEXT_FRAGMENT, '$3')),
    suffix: decodeURIComponent(textFragment.replace(TEXT_FRAGMENT, '$4')),
  };
};

export function injectOverlayStyles() {
    // Create style element if it doesn't exist, or select it if it does (to update it)
    let style = document.getElementById('vrr-overlay-styles');
    if (!style) {
        style = document.createElement('style');
        style.id = 'vrr-overlay-styles';
        document.head.appendChild(style);
    }

    // 1. Get User Preference (Default to 'auto')
    const themeState = VR_Reader.savedLocalStorageGlobal['DEFAULT_HIGHLIGHT_THEME_STATE'] || 'auto';

    // 2. Define Variable Sets
    const lightVars = `
        /* ☀️ LIGHT MODE VALUES */
        --vrr-sentence-bg: rgba(216, 180, 254, 0.4);
        --vrr-sentence-shadow: rgba(216, 180, 254, 0.3);
        --vrr-blend-mode: multiply;
    `;

    const darkVars = `
        /* 🌙 DARK MODE VALUES */
        --vrr-blend-mode: screen; 
        --vrr-sentence-bg: rgba(190, 160, 255, 0.35); 
        --vrr-sentence-shadow: rgba(190, 160, 255, 0.25);
    `;

    // 3. Construct CSS Variables based on state
    let cssVariables = '';

    if (themeState === 'dark') {
        // FORCE DARK: Apply dark vars directly to :root
        cssVariables = `:root { ${darkVars} }`;
    } else if (themeState === 'light') {
        // FORCE LIGHT: Apply light vars directly to :root
        cssVariables = `:root { ${lightVars} }`;
    } else {
        // AUTO: Apply light defaults, override with media query
        cssVariables = `
            :root { ${lightVars} }
            @media (prefers-color-scheme: dark) {
                :root { ${darkVars} }
            }
        `;
    }

    // 4. Inject Final CSS
    style.textContent = `
        ${cssVariables}

        /* 1. SENTENCE BACKGROUND */
        .vrr-overlay-highlight {
            background-color: var(--vrr-sentence-bg) !important;
            
            position: absolute !important;
            pointer-events: none !important;
            z-index: 2147483600 !important;
            display: block !important;
            
            /* DYNAMIC BLEND MODE */
            mix-blend-mode: var(--vrr-blend-mode);
            
            transition: opacity 0.2s ease-out;
            
            /* Matching Grout */
            box-shadow: 0 0 0 0.5px var(--vrr-sentence-shadow);
        }

        /* 1b. PENDING (PRELOADED) OVERLAYS — kept invisible until activated */
        .vrr-overlay-highlight-pending {
            opacity: 0 !important;
            /* Blend is meaningless while invisible; dropping it avoids the
               compositor creating isolated blend layers for the batch of
               preloaded overlays on first start, which caused a momentary
               layout/compositing glitch. */
            mix-blend-mode: normal !important;
        }
    `;
}

globalThis.processFragmentDirectives = (parsedFragmentDirectives, skipSuffix, createOverlays = true, searchStartAnchor = null) => {
  const processedFragmentDirectives = {};
  
  // Collect mark elements for deferred overlay creation
  const marksToOverlay = [];
  
  for (const [fragmentDirectiveType, fragmentDirectivesOfType] of Object.entries(parsedFragmentDirectives)) {
    if (FRAGMENT_DIRECTIVES.includes(fragmentDirectiveType)) {
      processedFragmentDirectives[fragmentDirectiveType] =
          fragmentDirectivesOfType.map((fragmentDirectiveOfType) => {
            
            // 1. Find the text range. A sentence may legitimately appear more than
            // once on a page (e.g. article body + a summary/related-posts block).
            // The original polyfill treats 2+ matches as ambiguous and fails, which
            // forced callers to fall back to the native browser selection. For the
            // reading highlighter that is too strict: the native fallback itself
            // also just picks the first match in document order, so we do the same
            // here and keep the primary highlight path working.
            const result = processTextFragmentDirective(fragmentDirectiveOfType, skipSuffix, searchStartAnchor);
            
            if (result.length > 0) {
                const range = result[0];

                // 2. GENERATE LOGIC MARK FIRST (inserts <mark> tags into DOM)
                // We do this first so the DOM is updated before we calculate overlay positions
                const markElements = markRange(range);
                
                // 3. Store mark elements for deferred overlay creation
                if (markElements && markElements.length > 0) {
                  marksToOverlay.push(markElements);
                }

                // 4. Return the mark elements
                return markElements;
            }
            return [];
          });
    }
  }
  
  // 5. Defer overlay creation until after all marks are inserted and layout has recalculated
  // Use requestAnimationFrame to ensure browser has computed final positions.
  // Overlays are only painted when createOverlays is true (i.e. visible highlighting is enabled).
  if (marksToOverlay.length > 0 && createOverlays) {
    requestAnimationFrame(() => {
      marksToOverlay.forEach(markElements => {
        globalThis.createOverlayFromMarks(markElements);
      });
    });
  }
  
  return processedFragmentDirectives;
};

globalThis.processFragmentDirectivesTextOnly = (parsedFragmentDirectives,skipSuffix) => {
  const processedFragmentDirectives = {};
  for (const
           [fragmentDirectiveType,
            fragmentDirectivesOfType,
  ] of Object.entries(parsedFragmentDirectives)) {
    if (FRAGMENT_DIRECTIVES.includes(fragmentDirectiveType)) {
      processedFragmentDirectives[fragmentDirectiveType] =
          fragmentDirectivesOfType.map((fragmentDirectiveOfType) => {
            const result =
                processTextFragmentDirective(fragmentDirectiveOfType,skipSuffix);
            if (result.length > 0) return markRangeTextOnly(result[0]);
            return [];
          });
    }
  }
  return processedFragmentDirectives;
};


globalThis.processTextFragmentDirective = (textFragment, _skipSuffix, searchStartAnchor) => {
  const results = [];

  const searchRange = document.createRange();
  searchRange.selectNodeContents(document.body);

  // The plain-branch anchor restriction must be applied only once. Re-applying
  // it on later loop iterations would undo the forward progression made by
  // advanceRangeStartPastOffset and re-match the same occurrence forever.
  let anchorApplied = false;

  while (!searchRange.collapsed && results.length < 2) {
    let potentialMatch;
    if (textFragment.prefix) {
      const prefixMatch = findTextInRange(textFragment.prefix, searchRange);
      if (prefixMatch == null) {
        break;
      }
      
      advanceRangeStartPastOffset(
          searchRange,
          prefixMatch.startContainer,
          prefixMatch.startOffset,
      );

      const matchRange = document.createRange();
      matchRange.setStart(prefixMatch.endContainer, prefixMatch.endOffset);
      matchRange.setEnd(searchRange.endContainer, searchRange.endOffset);

      advanceRangeStartToNonWhitespace(matchRange);
      if (matchRange.collapsed) {
        break;
      }

      potentialMatch = findTextInRange(textFragment.textStart, matchRange);
      
      if (potentialMatch == null) {
        break;
      }

      if (potentialMatch.compareBoundaryPoints(
              Range.START_TO_START,
              matchRange,
              ) !== 0) {
        continue;
      }

      // Reject prefix+textStart pairs that land before the positional anchor.
      // Repeated metadata blocks can make the first prefix match appear earlier
      // in the DOM than the current reading position; skip it and keep scanning
      // for the at-or-after-anchor copy so the highlight reads forward.
      if (searchStartAnchor && !isRangeAtOrAfterAnchor(potentialMatch, searchStartAnchor)) {
        continue;
      }
    } else {
      // When a positional anchor is present, restrict the search to text
      // at-or-after the anchor so the NEXT duplicate occurrence is chosen
      // instead of the first one on the page.
      if (searchStartAnchor && searchStartAnchor.node && !anchorApplied) {
        anchorApplied = true;
        try {
          searchRange.setStart(searchStartAnchor.node, searchStartAnchor.offset || 0);
        } catch (e) { }
      }

      potentialMatch = findTextInRange(textFragment.textStart, searchRange);

      if (potentialMatch == null) {
        break;
      }
      advanceRangeStartPastOffset(
          searchRange,
          potentialMatch.startContainer,
          potentialMatch.startOffset,
      );
    }

    if (textFragment.textEnd) {
      const textEndRange = document.createRange();
      textEndRange.setStart(
          potentialMatch.endContainer, potentialMatch.endOffset);
      textEndRange.setEnd(searchRange.endContainer, searchRange.endOffset);

      while (!textEndRange.collapsed && results.length < 2) {
        const textEndMatch =
            findTextInRange(textFragment.textEnd, textEndRange);
        if (textEndMatch == null) {
          break;
        }
        advanceRangeStartPastOffset(
            textEndRange, textEndMatch.startContainer,
            textEndMatch.startOffset);

        potentialMatch.setEnd(
            textEndMatch.endContainer, textEndMatch.endOffset);

        if (textFragment.suffix) {
          const suffixResult =
              checkSuffix(textFragment.suffix, potentialMatch, searchRange);
          if (suffixResult === CheckSuffixResult.NO_SUFFIX_MATCH) {
            break;
          } else if (suffixResult === CheckSuffixResult.SUFFIX_MATCH) {
            results.push(potentialMatch.cloneRange());
            continue;
          } else if (suffixResult === CheckSuffixResult.MISPLACED_SUFFIX) {
            continue;
          }
        } else {
          results.push(potentialMatch.cloneRange());
        }
      }
    } else if (textFragment.suffix) {
      const suffixResult =
          checkSuffix(textFragment.suffix, potentialMatch, searchRange);
      if (suffixResult === CheckSuffixResult.NO_SUFFIX_MATCH) {
        break;
      } else if (suffixResult === CheckSuffixResult.SUFFIX_MATCH) {
        results.push(potentialMatch.cloneRange());
        advanceRangeStartPastOffset(
            searchRange, searchRange.startContainer, searchRange.startOffset);
        continue;
      } else if (suffixResult === CheckSuffixResult.MISPLACED_SUFFIX) {
        continue;
      }
    } else {
      results.push(potentialMatch.cloneRange());
    }
  }
  return results;
};


globalThis.removeMarks = (marks) => {
  for (const mark of marks) {
    const range = document.createRange();
    range.selectNodeContents(mark);
    const fragment = range.extractContents();
    const parent = mark.parentNode;
    parent.insertBefore(fragment, mark);
    parent.removeChild(mark);
  }
};



globalThis.markRangeTextOnly = (range) => {
  if (range.startContainer.nodeType != Node.TEXT_NODE ||
      range.endContainer.nodeType != Node.TEXT_NODE)
    return [];

  if (range.startContainer === range.endContainer) {
    return [range.endContainer.nodeValue];
  }

  const startNode = range.startContainer;
  const startNodeSubrange = range.cloneRange();
  startNodeSubrange.setEndAfter(startNode);

  const endNode = range.endContainer;
  const endNodeSubrange = range.cloneRange();
  endNodeSubrange.setStartBefore(endNode);

  const marks = [];
  range.setStartAfter(startNode);
  range.setEndBefore(endNode);
  const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;

          if (BLOCK_ELEMENTS.includes(node.tagName) ||
              node.nodeType === Node.TEXT_NODE)
            return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        },
      },
  );
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      marks.push(node.nodeValue);
    }
    node = walker.nextNode();
  }


  return [startNodeSubrange.startContainer.nodeValue,...marks,endNodeSubrange.endContainer.nodeValue];
};



globalThis.markRange = (range) => {
  if (range.startContainer.nodeType != Node.TEXT_NODE ||
      range.endContainer.nodeType != Node.TEXT_NODE)
    return [];

  if (range.startContainer === range.endContainer) {
    const trivialMark = document.createElement('mark');
    trivialMark.setAttribute('class', TEXT_FRAGMENT_CSS_CLASS_NAME);
    range.surroundContents(trivialMark);
    return [trivialMark];
  }

  const startNode = range.startContainer;
  const startNodeSubrange = range.cloneRange();
  startNodeSubrange.setEndAfter(startNode);

  const endNode = range.endContainer;
  const endNodeSubrange = range.cloneRange();
  endNodeSubrange.setStartBefore(endNode);

  const marks = [];
  range.setStartAfter(startNode);
  range.setEndBefore(endNode);
  const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;

          if (BLOCK_ELEMENTS.includes(node.tagName) ||
              node.nodeType === Node.TEXT_NODE)
            return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        },
      },
  );
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const mark = document.createElement('mark');
      mark.setAttribute('class', TEXT_FRAGMENT_CSS_CLASS_NAME);
      node.parentNode.insertBefore(mark, node);
      mark.appendChild(node);
      marks.push(mark);
    }
    node = walker.nextNode();
  }

  const startMark = document.createElement('mark');
  startMark.setAttribute('class', TEXT_FRAGMENT_CSS_CLASS_NAME);
  startNodeSubrange.surroundContents(startMark);
  const endMark = document.createElement('mark');
  endMark.setAttribute('class', TEXT_FRAGMENT_CSS_CLASS_NAME);
  endNodeSubrange.surroundContents(endMark);

  return [startMark, ...marks, endMark];
};


globalThis.scrollElementIntoView = (element) => {

  const behavior = {
    behavior: 'auto',
    block: 'center',
    inline: 'nearest',
  };
  element.scrollIntoView(behavior);
};


const filterFunction = (node, range) => {
  if (range != null && !range.intersectsNode(node))
    return NodeFilter.FILTER_REJECT;

  let elt = node;
  while (elt != null && !(elt instanceof HTMLElement)) elt = elt.parentNode;
  if (elt != null) {
    const nodeStyle = window.getComputedStyle(elt);

    if (nodeStyle.visibility === 'hidden' 
    ) {
      return NodeFilter.FILTER_REJECT;
    }
  }
  return NodeFilter.FILTER_ACCEPT;
};


// Global tracker for the overlay elements
globalThis.activeOverlayElements = [];

globalThis.createOverlayFromRange = (range) => {
    if (!range) return [];
    injectOverlayStyles();

    const rawRects = range.getClientRects();
    if (!rawRects.length) return [];

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // --- 1. TYPOGRAPHY ANALYSIS ---
    let textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) {
        textNode = range.startContainer.childNodes[0] || range.startContainer;
    }
    const parentElement = textNode.nodeType === Node.TEXT_NODE 
        ? textNode.parentElement 
        : textNode;

    const computedStyle = window.getComputedStyle(parentElement);
    const fontSize = parseFloat(computedStyle.fontSize);
    const lineHeight = computedStyle.lineHeight === 'normal' 
        ? fontSize * 1.2 
        : parseFloat(computedStyle.lineHeight);

    // --- 2. CONFIGURATION ---
    // Padding for the outer edges (Top of first line, Bottom of last line)
    const outerEdgePadding = (lineHeight - fontSize) / 2 + 2; 

    const horizontalInflate = 4;
    const radius = 4;
    
    const xTolerance = 8; 
    const scanDistance = lineHeight * 0.6;
    // ------------------------

    const rects = Array.from(rawRects).filter(r => r.width > 1 && r.height > 1);
    const createdElements = [];

    for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        const div = document.createElement('div');
        div.classList.add('vrr-overlay-highlight');
        
        let tl = radius, tr = radius, br = radius, bl = radius;

        // --- 3. NEIGHBOR DETECTION (For Smart Corners & Midpoints) ---
        
        // Find Line ABOVE
        let prevLine = null;
        for (let k = i - 1; k >= 0; k--) {
            const p = rects[k];
            const dist = rect.top - p.bottom;
            if (dist < scanDistance && dist > -(lineHeight * 0.5)) {
                prevLine = p;
                break;
            }
        }

        // Find Line BELOW
        let nextLine = null;
        for (let k = i + 1; k < rects.length; k++) {
            const n = rects[k];
            const dist = n.top - rect.bottom;
            if (dist < scanDistance && dist > -(lineHeight * 0.5)) {
                nextLine = n;
                break;
            }
        }

        // --- 4. RADIUS LOGIC (Unchanged) ---
        if (prevLine) {
            if (prevLine.left <= rect.left + xTolerance) tl = 0;
            if (prevLine.right >= rect.right - xTolerance) tr = 0;
        }
        if (nextLine) {
            if (nextLine.left <= rect.left + xTolerance) bl = 0;
            if (nextLine.right >= rect.right - xTolerance) br = 0;
        }

        // Apply Radius
        div.style.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;

        // --- 5. POSITIONING & MIDPOINT LOGIC (The Fix) ---
        div.style.setProperty('position', 'absolute', 'important');
        div.style.setProperty('box-sizing', 'border-box', 'important');

        // Horizontal (Unchanged)
        div.style.left = `${rect.left + scrollX - horizontalInflate}px`;
        div.style.width = `${rect.width + (horizontalInflate * 2)}px`;

        // Vertical Calculation:
        // Instead of inflating both up and down arbitrarily, we calculate the 
        // exact midpoint of the gap between lines.
        
        let topPixel, bottomPixel;

        // Calculate TOP edge
        if (prevLine) {
            // If there is a line above, start exactly halfway between them
            // This creates a perfect seam with 0 overlap
            topPixel = (prevLine.bottom + rect.top) / 2;
        } else {
            // First line: Use standard padding
            topPixel = rect.top - outerEdgePadding;
        }

        // Calculate BOTTOM edge
        if (nextLine) {
            // If there is a line below, end exactly halfway between them
            bottomPixel = (rect.bottom + nextLine.top) / 2;
        } else {
            // Last line: Use standard padding
            bottomPixel = rect.bottom + outerEdgePadding;
        }

        // Apply calculated coordinates (Adding scrollY here)
        div.style.top = `${topPixel + scrollY}px`;
        div.style.height = `${bottomPixel - topPixel}px`;

        div._sourceRange = range.cloneRange(); 

        document.body.appendChild(div);
        createdElements.push(div);
    }

    if (createdElements.length > 0) {
        globalThis.activeOverlayElements.push(...createdElements);
    }

    return createdElements;
};

// New function: Creates overlays from mark elements instead of ranges
// This ensures overlays are positioned correctly after DOM mutations
//
// When `{ pending: true }` is passed the overlays are created but kept hidden
// (`.vrr-overlay-highlight-pending`, opacity 0) and are NOT registered in
// activeOverlayElements. This is used for preloaded sentence highlights so the
// overlay rects are computed before the sentence's words get wrapped into
// separate spans — wrapping would otherwise fragment the overlay into one box
// per word. Reveal them later with revealPendingOverlayElements().
globalThis.createOverlayFromMarks = (markElements, { pending = false } = {}) => {
    if (!markElements || markElements.length === 0) return [];
    injectOverlayStyles();

    // Collect all rects from all mark elements
    const allRects = [];
    markElements.forEach(mark => {
        const rects = mark.getClientRects();
        for (let i = 0; i < rects.length; i++) {
            const rect = rects[i];
            if (rect.width > 1 && rect.height > 1) {
                allRects.push(rect);
            }
        }
    });

    if (allRects.length === 0) return [];

    // Make first mark the containing block for our absolute overlays
    const firstMark = markElements[0];
    firstMark.style.setProperty('position', 'relative', 'important');
    const referenceRect = firstMark.getClientRects()[0];

    if (!referenceRect) return [];

    const computedStyle = window.getComputedStyle(firstMark);
    const fontSize = parseFloat(computedStyle.fontSize);
    const lineHeight = computedStyle.lineHeight === 'normal' 
        ? fontSize * 1.2 
        : parseFloat(computedStyle.lineHeight);

    // Configuration
    const outerEdgePadding = (lineHeight - fontSize) / 2 + 2;
    const horizontalInflate = 4;
    const radius = 4;
    const xTolerance = 8;
    const scanDistance = lineHeight * 0.6;

    const createdElements = [];
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < allRects.length; i++) {
        const rect = allRects[i];
        const div = document.createElement('div');
        div.classList.add('vrr-overlay-highlight');

        let tl = radius, tr = radius, br = radius, bl = radius;

        // Neighbor detection: scan in DOM order to find the nearest previous/
        // next line rect within the vertical tolerance. This preserves the
        // original rounded-corner merging behavior that keeps overlays aligned
        // to sentence boundaries.
        let prevLine = null;
        for (let k = i - 1; k >= 0; k--) {
            const p = allRects[k];
            const dist = rect.top - p.bottom;
            if (dist < scanDistance && dist > -(lineHeight * 0.5)) {
                prevLine = p;
                break;
            }
        }

        let nextLine = null;
        for (let k = i + 1; k < allRects.length; k++) {
            const n = allRects[k];
            const dist = n.top - rect.bottom;
            if (dist < scanDistance && dist > -(lineHeight * 0.5)) {
                nextLine = n;
                break;
            }
        }

        // Radius logic
        if (prevLine) {
            if (prevLine.left <= rect.left + xTolerance) tl = 0;
            if (prevLine.right >= rect.right - xTolerance) tr = 0;
        }
        if (nextLine) {
            if (nextLine.left <= rect.left + xTolerance) bl = 0;
            if (nextLine.right >= rect.right - xTolerance) br = 0;
        }

        div.style.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;

        div.style.setProperty('position', 'absolute', 'important');
        div.style.setProperty('box-sizing', 'border-box', 'important');

        div.style.left = `${rect.left - referenceRect.left - horizontalInflate}px`;
        div.style.width = `${rect.width + (horizontalInflate * 2)}px`;

        let topPixel, bottomPixel;

        if (prevLine) {
            topPixel = (prevLine.bottom + rect.top) / 2;
        } else {
            topPixel = rect.top - outerEdgePadding;
        }

        if (nextLine) {
            bottomPixel = (rect.bottom + nextLine.top) / 2;
        } else {
            bottomPixel = rect.bottom + outerEdgePadding;
        }

        div.style.top = `${topPixel - referenceRect.top}px`;
        div.style.height = `${bottomPixel - topPixel}px`;

        fragment.appendChild(div);
        createdElements.push(div);
    }

    firstMark.appendChild(fragment);

    if (createdElements.length > 0) {
        if (pending) {
            createdElements.forEach((el) => el.classList.add('vrr-overlay-highlight-pending'));
        } else {
            globalThis.activeOverlayElements.push(...createdElements);
        }
    }

    return createdElements;
};

// Reveals overlays that were created via createOverlayFromMarks(markElements,
// { pending: true }). Registers them with activeOverlayElements so they are
// cleaned up by removeHiglightOnPage() when the sentence ends.
globalThis.revealPendingOverlayElements = (elements) => {
    if (!elements || !Array.isArray(elements)) return;
    elements.forEach((el) => {
        if (el && el.parentNode) {
            el.classList.remove('vrr-overlay-highlight-pending');
            if (globalThis.activeOverlayElements.indexOf(el) === -1) {
                globalThis.activeOverlayElements.push(el);
            }
        }
    });
};

globalThis.applyTargetTextStyle = () => {
  const styles = document.getElementsByTagName('style');
  if (!styles) return;

  for (const style of styles) {
    const cssRules = style.innerHTML;
    const targetTextRules =
        cssRules.match(/(\w*)::target-text\s*{\s*((.|\n)*?)\s*}/g);
    if (!targetTextRules) continue;

    const markCss = targetTextRules.join('\n');
    const newNode = document.createTextNode(markCss.replaceAll(
        '::target-text', ` .${TEXT_FRAGMENT_CSS_CLASS_NAME}`));
    style.appendChild(newNode);
  }
};


globalThis.setDefaultTextFragmentsStyle = ({backgroundColor, color}) => {
  const styles = document.getElementsByTagName('style');
  const defaultStyle = `.${TEXT_FRAGMENT_CSS_CLASS_NAME} {
    background-color: ${backgroundColor};
    color: ${color};
  }`
  if (styles.length === 0) {
    document.head.insertAdjacentHTML(
        'beforeend', `<style type="text/css">${defaultStyle}</style>`);
  }
  else {
    applyTargetTextStyle();
    const defaultStyleNode = document.createTextNode(defaultStyle);
    styles[0].insertBefore(defaultStyleNode, styles[0].firstChild);
  }
};