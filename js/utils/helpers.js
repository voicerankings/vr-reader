const noop = () => { };
let cancel = noop;
const registerCancel = fn => cancel = fn;
import { htmlToText } from 'html-to-text';

export function saveVoiceDefaultToLocalStorage(voiceData) {
    chrome.runtime.sendMessage({
        action: "update-contentscript-storage",
        key: 'DEFAULT_PREMIUM_VOICE_SPEAKER_ID', value: voiceData.DEFAULT_PREMIUM_VOICE_SPEAKER_ID
    });
}

// Helper to find the actual article element
export function findArticleElement(doc) {
    // Try semantic article tag first
    const article = doc.querySelector('article');
    if (article) return article;

    // Try main content containers
    const mainSelectors = [
        'main',
        '[role="main"]',
        '.article-content',
        '.post-content',
        '.entry-content',
        '.content-body',
        '#article-body',
        '.story-body',
        '[itemtype*="Article"]'
    ];

    for (const selector of mainSelectors) {
        const element = doc.querySelector(selector);
        const textLength = (element?.innerText || element?.textContent || '').trim().length;
        if (element && textLength > 200) {
            return element;
        }
    }

    return null;
}

// Extract JSON-LD Article/NewsArticle/BlogPosting
export function extractJsonLdArticle(doc) {
    const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));

    for (const s of scripts) {
        try {
            const data = JSON.parse(s.textContent || "null");
            const nodes = Array.isArray(data) ? data : [data];

            for (const n of nodes) {
                if (!n || !n["@type"]) continue;
                const types = Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]];

                if (types.some(t => ["Article", "NewsArticle", "BlogPosting"].includes(t))) {
                    const headline = n.headline || n.name || n.alternativeHeadline || "";

                    // Try to find the actual article element in the DOM
                    const articleElement = findArticleElement(doc);

                    if (articleElement) {
                        return {
                            title: headline,
                            element: articleElement,
                            source: "jsonld"
                        };
                    }
                }
            }
        } catch (e) {
            console.log("JSON-LD parse error:", e);
        }
    }
    return null;
}

// Trims site-banner suffixes (e.g. "Title - IGN.com", "Title | CNN") off a page
// title while preserving hyphens that join words ("well-known" stays intact).
export function cleanTitleForPlayback(title) {
    if (typeof title !== 'string' || title.trim().length === 0) return title;

    // Only a dash surrounded by whitespace (or a pipe) acts as a separator.
    return title.split(/\s+[-–—]\s+|\s*\|/)[0].trim();
}

// Extract from semantic HTML
export function extractFromSemanticHtml(doc) {
    const getTitle = () => {
        return doc.querySelector('meta[property="og:title"]')?.content
            || doc.querySelector('meta[name="twitter:title"]')?.content
            || doc.title
            || "";
    };

    // Try to find article element
    const articleElement = findArticleElement(doc);

    if (articleElement && articleElement.innerText?.trim().length > 0) {
        return {
            title: getTitle(),
            element: articleElement,
            source: "semantic-html"
        };
    }

    return null;
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert seconds to formatted time string
 * @param {number} seconds - Time in seconds
 * @returns {string} - Formatted time string in "hh:mm:ss" or "mm:ss" format
 */
export function debounce2(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

import { CONSTANTS } from '../constants/constants';

export function getFormattedSelection() {
    console.log("Executing NEW STRATEGY: Pre-processing HTML to remove images.");

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return '';
    }

    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();

    // Create a temporary container div for our fragment
    const div = document.createElement('div');
    div.appendChild(fragment);

    // --- THIS IS THE NEW AND IMPORTANT PART ---
    // Use standard DOM methods to find and remove all <img> elements
    // from our temporary container *before* conversion.
    const imagesInSelection = div.querySelectorAll('img');
    imagesInSelection.forEach(img => img.remove());
    // ------------------------------------------

    // Now, get the HTML of the cleaned-up fragment
    const cleanedHtml = div.innerHTML;

    // Convert the cleaned HTML to text. We will use the library's
    // default behavior, which is stable and avoids the 'selectors' bug.
    const text = htmlToText(cleanedHtml, {
        wordwrap: null, // This is a safe and simple option
        selectors: [
            {
                selector: 'a',
                options: {
                    ignoreHref: true
                }
            },
            { selector: 'ul', format: 'block', options: { itemPrefix: '' } },
            { selector: 'ol', format: 'block', options: { itemPrefix: '' } },
            // ensure each item has no prefix (covers cases where 'li' adds its own)
            { selector: 'li', format: 'block', options: { prefix: '' } },

            // --- blockquotes: no leading ">" ---
            {
                selector: 'blockquote',
                format: 'block',
                options: {
                    leadingLineBreaks: 1,
                    trailingLineBreaks: 1
                }
            },

            // --- Skip preformatted text (code blocks) ---
            { selector: 'pre', format: 'skip' },

            // --- Structural elements: trigger sentence breaks for TTS ---
            // Headings represent section transitions and should be treated as sentence boundaries
            { selector: 'h1', format: 'block', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
            { selector: 'h2', format: 'block', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
            { selector: 'h3', format: 'block', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
            { selector: 'h4', format: 'block', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
            { selector: 'h5', format: 'block', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
            { selector: 'h6', format: 'block', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
            
            // --- Custom table formatter: adds newlines between cells ---
            // html-to-text's built-in table formatter doesn't use th/td selectors,
            // so we override it entirely to ensure each cell becomes a sentence break
            {
                selector: 'table',
                format: function (elem, walk, builder, options) {
                    builder.openBlock({ leadingLineBreaks: 1 });
                    
                    // Recursive function to process table rows and cells
                    const processTableChildren = (children) => {
                        children.forEach(child => {
                            if (child.type === 'tag') {
                                if (child.name === 'tr') {
                                    // Process each cell in the row
                                    child.children.forEach(cell => {
                                        if (cell.name === 'th' || cell.name === 'td') {
                                            walk(cell.children, builder);
                                            builder.addInline('\n');
                                        }
                                    });
                                } else if (child.name === 'thead' || child.name === 'tbody' || child.name === 'tfoot') {
                                    processTableChildren(child.children);
                                }
                            }
                        });
                    };
                    
                    processTableChildren(elem.children);
                    
                    builder.closeBlock({ trailingLineBreaks: 1 });
                }
            }
        ]
    });

    return text.trim();
}
export function isYoutubeVideoPage() {
    const url = window.location.href;
    // Match URLs like:
    // https://www.youtube.com/watch?v=VIDEOID
    // https://www.youtube.com/live/VIDEOID 
    return /^https?:\/\/(www\.)?youtube\.com\/(watch\?v=|live\/)[\w-]+/.test(url);
}

export function getCharacterThumbnail(character) {
    if (typeof character === "string") {
        return character.replace("buddies-images", "buddies-thumbnails");
    } else {
        return character;
    }
}

async function delay(millisecondDelay, registerCancel) {

    return new Promise(resolve => {

        const start = new Date().getTime();

        const loop = () => {
            const delta = new Date().getTime() - start;

            if (delta >= millisecondDelay) {
                resolve();
                registerCancel(noop);
                return;
            }

            const raf = requestAnimationFrame(loop);
            registerCancel(() => cancelAnimationFrame(raf));
        };

        const raf = requestAnimationFrame(loop);
        registerCancel(() => cancelAnimationFrame(raf));

    });
}

export const isNotEqualToNullorUndefined = (value) => {
    if (value != null) {
        return true
    } else {
        return false;
    }
}

export const readLocalStorage = async (keys) => {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(keys, function (result) {
            resolve(result);
        });
    });
};

export const saveToLocalStorage = async (objectKeyValue, sendToServer = false) => {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(objectKeyValue, function (result) {
            if (sendToServer) {
                chrome.runtime.sendMessage({ action: "save-user-settings-to-server" });
            }
            resolve(result);
        })
    });
};

export const getHostName = () => {
    return (new URL(getChatURL())).hostname.replace("www.", "").toLowerCase();
}
/**
 * Detects if a line is likely forum metadata based on keywords and length.
 */
export function isForumMetadata(text) {
    // 1. Normalize spaces immediately (turn "Reply      Share" into "Reply Share")
    const t = text.replace(/\s+/g, ' ').toLowerCase().trim();

    // 2. Immediate Keyword Flags (Forum Actions)
    const metaKeywords = [
        'reply share', 'give award', 'share save', 'report save', 'follow',
        'level 1', 'level 2', 'top 1%', 'commenter', 'op •', 'score hidden',
        'edited', 'points', 'karma', 'ago'
    ];

    if (metaKeywords.some(keyword => t.includes(keyword))) return true;

    // 3. Regex Patterns (Timestamps like 1mo ago, 2hr ago)
    if (/\b\d+\s*(mo|yr|hr|min|day|sec|m|h|d)s?\s*ago\b/.test(t)) return true;

    // 4. Structural Flags (Bullets/Pipes at start)
    if (t.startsWith('•') || t.startsWith('|')) return true;

    return false;
}

export const getChatURL = () => {
    return (window.location.ancestorOrigins[0]) ? window.location.ancestorOrigins[0] : window.location.href
}

export const setDomainSettings = async (domain, SETTING_TYPE, SETTING_DATA) => {

    let { DOMAIN_SETTINGS } = await readLocalStorage(['DOMAIN_SETTINGS']);

    DOMAIN_SETTINGS = (DOMAIN_SETTINGS === undefined) ? {} : DOMAIN_SETTINGS;
    DOMAIN_SETTINGS[domain] = (DOMAIN_SETTINGS[domain] === undefined) ? {} : DOMAIN_SETTINGS[domain];

    DOMAIN_SETTINGS[domain][SETTING_TYPE] = SETTING_DATA;



    await saveToLocalStorage({ 'DOMAIN_SETTINGS': DOMAIN_SETTINGS }, true);
}

export const deleteSettingPropertyInAllDomains = async (SETTING_TYPE) => {

    let { DOMAIN_SETTINGS } = await readLocalStorage(['DOMAIN_SETTINGS']);
    for (const key in DOMAIN_SETTINGS) {
        delete DOMAIN_SETTINGS[key][SETTING_TYPE];
    }

    await saveToLocalStorage({ 'DOMAIN_SETTINGS': DOMAIN_SETTINGS }, true);
}

export function getRankSuffix(number) {
    const suffixes = ["th", "st", "nd", "rd"];
    const v = number % 100;
    return number + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}


export const copyTextToClipboardFallback = async (text) => {
    // Create a temporary textarea element
    const textarea = document.createElement('textarea');
    // Set its value to the text you want to copy
    textarea.value = text;
    // Make sure it's not visible
    textarea.setAttribute('readonly', ''); // Prevents keyboard from showing on mobile
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px'; // Move it off-screen
    document.body.appendChild(textarea);
    // Select the text
    textarea.select();
    // Attempt to copy
    try {
        const successful = document.execCommand('copy');
        const msg = successful ? 'successful' : 'unsuccessful';

    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
    }
    // Remove the temporary textarea
    document.body.removeChild(textarea);
}

export const encodeURIComponentCustom = (str) => encodeURIComponent(str).replace(/-/g, '%2D');

export const createTextFragment = (customSelection = null) => {
    let selection, result;

    if (customSelection) {
        result = customSelection
    } else {
        selection = window.getSelection();
        result = generateFragment(selection);
    }


    // eslint-disable-next-line no-undef

    let url = `${location.origin}${location.pathname}${location.search}`;

    if (result.status === 0) {
        const fragment = result.fragment;
        const prefix = fragment.prefix ?
            `${encodeURIComponentCustom(fragment.prefix)}-,` :
            '';
        const suffix = fragment.suffix ?
            `,-${encodeURIComponentCustom(fragment.suffix)}` :
            '';
        const textStart = encodeURIComponentCustom(fragment.textStart);
        const textEnd = fragment.textEnd ?
            `,${encodeURIComponentCustom(fragment.textEnd)}` :
            '';

        return `#:~:text=${prefix}${textStart}${textEnd}${suffix}`;
    } else {
        return `#ERROR_${result.status}`;
    }
};

export function getSelectionText() {
    let text = "";
    if (window.getSelection) {
        text = window.getSelection().toString();
    } else if (document.selection && document.selection.type != "Control") {
        text = document.selection.createRange().text;
    }
    return text;
}

export function isElement(obj) {
    return obj != null && obj.nodeType === 1;
}

let lastReadingScrollTime = 0;

export function findScrollableAncestor(element) {
    let current = element.parentElement;
    while (current) {
        const style = getComputedStyle(current);
        const overflowY = style.overflowY;
        const canScroll = (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
            current.scrollHeight > current.clientHeight;
        if (canScroll) return current;
        current = current.parentElement;
    }
    return null;
}

export function scrollElementToReadingPosition(element, { ratio = 0.4, coalesce = 200 } = {}) {
    if (!element) return;

    const now = Date.now();
    if (coalesce && now - lastReadingScrollTime < coalesce) return;
    lastReadingScrollTime = now;

    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const comfortTop = viewportHeight * 0.15;
    const comfortBottom = viewportHeight * 0.65;

    if (rect.top < comfortTop || rect.bottom > comfortBottom) {
        const scroller = findScrollableAncestor(element) || window;
        const delta = rect.top - viewportHeight * ratio;
        scroller.scrollBy({ top: delta, behavior: 'smooth' });
    }
}

export async function createHighlightOnPage(textFragment, highlightDateList = [], scrollToElement = false, clickable = true, answerListId, createOverlay = true, searchStartAnchor = null, inactive = false) {

    console.log("scrollToElement", scrollToElement)
    const directives = getFragmentDirectives(textFragment);
    const parsedDirectives = parseFragmentDirectives(directives);
    let processedDirectives = [];

    // Inactive/preloaded highlights must not scroll, paint overlays, or register
    // as active marks until playback reaches them.
    if (inactive) {
        scrollToElement = false;
        createOverlay = false;
    }

    for (const item of parsedDirectives['text']) {
        processedDirectives.push((await processFragmentDirectives({ 'text': [item] }, true, createOverlay, searchStartAnchor)['text'][0]));
        await delay(0, registerCancel);
    }

    let hasScrolledToFirstElement = false;

    processedDirectives.forEach((marksGroup, index) => {
        const markGroupId = 'mark-' + Math.floor(Math.random() * 1000000);

        marksGroup.forEach((markElement, mark_index) => {
            if (isElement(markElement)) {

                if (hasScrolledToFirstElement === false && scrollToElement) {
                    scrollElementToReadingPosition(markElement)
                    hasScrolledToFirstElement = true;
                }

                if (!inactive) {
                    window.VR_Reader.savedMarkElements.push(markElement);
                }

                markElement.dataset.markid = markGroupId;

                const activeClass = clickable ? "vrr-highlight-on" : "vrr-streaming";
                markElement.classList.add(activeClass);

                if (inactive) {
                    markElement.classList.add("vrr-highlight-pending");
                }

                markElement.dataset.answerListId = answerListId;

                if (mark_index === 0) {
                    markElement.dataset.fragment = directives.text[index];

                    if (!inactive) {
                        window.VR_Reader.savedHighlightedElements["#:~:text=" + directives.text[index]] = markElement;
                    }
                }
            }
        })
    })

    return { processedDirectives, parsedDirectives, directives }
}

export async function removeHiglightOnPage() {
    // 1. Remove the <mark> tags (Logic Layer)
    // Track which parent elements had marks removed so we can normalize them
    // after. extractContents() splits text nodes; without a subsequent
    // normalize() the sentence fragments into many adjacent text nodes, which
    // causes markRange() to create a separate <mark> per word on the next
    // highlight cycle (especially noticeable after backward seeks).
    const parentsToNormalize = new Set();

    if (window.VR_Reader.savedMarkElements.length > 0) {
        window.VR_Reader.savedMarkElements.forEach((item) => {
            if (item && item.parentNode) {
                const parent = item.parentNode;
                const range = document.createRange();
                range.selectNodeContents(item);
                const fragment = range.extractContents();
                parent.insertBefore(fragment, item);
                parent.removeChild(item);
                parentsToNormalize.add(parent);
            }
        });
        window.VR_Reader.savedMarkElements = [];
    }

    // normalize() only the parents that just had marks extracted. The anchor
    // text node (captured by captureHighlightAnchor) lives AFTER the last mark,
    // in a different part of the DOM, so this doesn't destroy it.
    parentsToNormalize.forEach(p => p.normalize());

    // 2. Remove the Overlay DIVs (Visual Layer)
    if (globalThis.activeOverlayElements && globalThis.activeOverlayElements.length > 0) {
        globalThis.activeOverlayElements.forEach(el => {
            if (el && el.parentNode) el.remove();
        });
        globalThis.activeOverlayElements = [];
    }
}

export function getInnerText(el) {
    //console.log(  el.innerHTML.replace(/<[^>]+>/g, '\n') )
    if (el && el.innerHTML) {
        let v = el.innerHTML.replace(/<\/li>/g, '.');
        el.innerHTML.replace("..", '.');
        // v = v.replace(/:\n/gi, '. ');
        // v = v.replace(/\n/gi, '. ');

        v = v.replace(/<img[^>]*>/gi, '');
        v = v.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, '');
        v = v.replace(/```[\s\S]+?```/g, '')
        v = v.replace(/`/g, "")
        v = v.replace(/###/g, "")
        v = v.replace(/##/g, "")
        v = v.replace(/&nbsp;/g, "")
        v = stripEmojis(v)

        return v.replace(/<[^>]+>/g, ' ')
    } else {
        return "";
    }
}

export function stripEmojis(str) {
    return str
        .replace(
            /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
            ''
        )
        .replace(/\s+/g, ' ')
        .trim();
}

export function regexIndexOf(text, regex, startIndex) {
    //Search for the regex pattern match in the text string
    //Return the regex character found and return position in string it was found
    const indexInSuffix = text.slice(startIndex).search(regex);
    const pos = indexInSuffix < 0 ? indexInSuffix : indexInSuffix + startIndex;
    const matches = text.matchAll(regex);
    let matchText;
    for (const match of matches) {
        matchText = match[0];
        break;
    }

    return {
        delimeter: (pos === -1) ? false : text.slice(pos, pos + 1),
        pos: pos,
        matchText
    };
}

export function removeTimeAndAvatarTitleFromSpeech(speechString) {
    //why showing ranges like 0-9 instead of 1-9
    // I was orignally using 1-9 range. I didn't catch this bug until I was testing it on lowes.com chatbot at 12:40am which was 
    // show times like this Leo0:41 AM
    // Regular expression to match a time format (HH:MM AM/PM)
    //const timeRegex = /\b(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM)\b/ig;
    const timeRegex = /\b(1[0-2]|0?[0-9]):([0-5][0-9])(:[0-5][0-9])?\s?(AM|PM)\b|\b(1[0-2]|0?[0-9]):([0-5][0-9])\s?(AM|PM)\b|\b(1[0-2]|0?[0-9]):([0-5][0-9]) (a.m.|p.m.) \b|\bjust now\b|\bfew seconds ago\b|\bfew moments ago\b|\bin a few seconds\b/gi;
    //supported formats
    //(1[0-2]|0?[1-9]):([0-5][0-9])(:[0-5][0-9])?\s?(AM|PM) matches the time in the format "9:23:56 AM" 
    //(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM) matches the time in the format "08:25 AM" without seconds.
    //|\b(1[0-2]|0?[1-9]):([0-5][0-9]) (a.m.|p.m.) \b| matches the time in the format "08:25 a.m"
    //The existing checks for phrases like "just now", "few seconds ago", and "few moments ago" are retained.
    let str = stripEmojis(speechString)

    const timeMatch = regexIndexOf(str, timeRegex, 0);

    if (timeMatch.delimeter === false) return speechString;

    let inputString = removeDateTimeFromChatSpeech(str, timeMatch)

    const firstLowercaseWordOrNumber = findFirstLowercaseWordOrNumber(inputString);

    if (firstLowercaseWordOrNumber === null) return inputString

    let firstLowercaseWordIndex = inputString.split(" ").findIndex((word) => word === firstLowercaseWordOrNumber)

    if (firstLowercaseWordIndex < 2) return inputString;

    const newString = inputString.split(" ").slice(firstLowercaseWordIndex - 1).join(" ");

    return newString;
}

export function hasTimeInString(speechString) {
    const timeRegex = /(1[0-2]|0?[0-9]):([0-5][0-9])(:[0-5][0-9])?(\s?(AM|PM))?\b|\b(1[0-2]|0?[0-9]):([0-5][0-9])(\s?(AM|PM))?\b|\b(1[0-2]|0?[0-9]):([0-5][0-9]) (a.m.|p.m.) \b|\bjust now\b|\bfew seconds ago\b|\bfew moments ago\b|\bin a few seconds/gi;
    const timeMatch = regexIndexOf(speechString, timeRegex, 0);

    return timeMatch.pos > -1;
}

export function levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
        matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
        matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
        for (let i = 1; i <= str1.length; i++) {
            if (str1[i - 1] === str2[j - 1]) {
                matrix[j][i] = matrix[j - 1][i - 1];
            } else {
                matrix[j][i] = Math.min(
                    matrix[j - 1][i] + 1, // deletion
                    matrix[j][i - 1] + 1, // insertion
                    matrix[j - 1][i - 1] + 1 // substitution
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}

export function getInnerText_pageReader(el, wrap = false) {
    if (el.innerHTML) {
        return htmlToText(el.innerHTML, {
            selectors: [

                { selector: '.infobox', format: 'skip' },
                { selector: 'hr', format: 'skip' },
                { selector: 'img', format: 'skip' },
                { selector: 'a', options: { ignoreHref: true } },
                { selector: 'ul', format: 'block', options: { itemPrefix: '' } },
                { selector: 'ol', format: 'block', options: { itemPrefix: '' } },
                // ensure each item has no prefix (covers cases where 'li' adds its own)
                { selector: 'li', format: 'block', options: { prefix: '' } },

                // --- Definition lists: keep label/value pairs on separate lines ---
                { selector: 'dl', format: 'block', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
                { selector: 'dt', format: 'block', options: { leadingLineBreaks: 0, trailingLineBreaks: 0 } },
                { selector: 'dd', format: 'block', options: { leadingLineBreaks: 0, trailingLineBreaks: 0 } },

                // --- blockquotes: no leading ">" ---
                {
                    selector: 'blockquote',
                    format: 'block',
                    options: {
                        leadingLineBreaks: 1,
                        trailingLineBreaks: 1
                    }
                },

                // --- Skip preformatted text (code blocks) ---
                { selector: 'pre', format: 'skip' },

                // --- Structural elements: trigger sentence breaks for TTS ---
                // Headings represent section transitions and should be treated as sentence boundaries
                { selector: 'h1', format: 'block', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
                { selector: 'h2', format: 'block', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
                { selector: 'h3', format: 'block', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
                { selector: 'h4', format: 'block', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
                { selector: 'h5', format: 'block', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
                { selector: 'h6', format: 'block', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },

                // --- Custom table formatter: converts each cell to its own line ---
                // Previously tables were skipped entirely, which dropped useful info
                // (e.g. GameRant definition-list-style tables, OpenCritic details).
                {
                    selector: 'table',
                    format: function (elem, walk, builder, options) {
                        builder.openBlock({ leadingLineBreaks: 1 });

                        const processTableChildren = (children) => {
                            children.forEach(child => {
                                if (child.type === 'tag') {
                                    if (child.name === 'tr') {
                                        child.children.forEach(cell => {
                                            if (cell.name === 'th' || cell.name === 'td') {
                                                walk(cell.children, builder);
                                                builder.addInline('\n');
                                            }
                                        });
                                    } else if (child.name === 'thead' || child.name === 'tbody' || child.name === 'tfoot') {
                                        processTableChildren(child.children);
                                    }
                                }
                            });
                        };

                        processTableChildren(elem.children);

                        builder.closeBlock({ trailingLineBreaks: 1 });
                    }
                }
            ],
            wordwrap: wrap,
            // Custom text processing for cleaner output
            transform: {
                'a': ({ text }) => text, // Keeps anchor text only, removes URLs
                'img': () => '', // Skips images entirely,
            }
        }).replace(/&nbsp;/g, ' ')
            .trim(); // Cleans up trailing/leading whitespace
    } else {
        return '';
    }
}

/**
 * Remove common non-content elements from a container.
 * Used by the relaxed/non-strict page extractor to keep the reading text
 * as clean as possible while still preserving metadata that Readability strips.
 */
export function removeJunkElements(container) {
    const junkSelectors = [
        // Generic non-content elements
        'footer', 'nav', 'aside',
        '[class*="ad-"]', '[id*="ad-"]', '.ad', '.advert',
        '[class*="cookie"]', '[id*="cookie"]',
        '[class*="related"]', '[id*="related"]',
        '[class*="comment"]', '[id*="comment"]',
        '[class*="share"]', '.social', '.sharing',
        '[class*="modal"]', '[id*="modal"]',
        '[class*="popup"]', '[id*="popup"]',
        '.ribbon', '.navbar', '.dropdown-menu',
        '[class*="sidebar"]', '[class*="left-nav"]', '[class*="right-nav"]',
        '.top-ad', '.ad-container',
        '.content-listing', '.latest-posts', '.popular-posts',

        // -----------------------------------------------------------------
        // Site-specific filters
        // Add your own site-specific selectors here. Be careful not to
        // remove elements that contain the main article/content text.
        // See docs/RELAXED_MODE_CUSTOMIZATION.md for examples.
        // -----------------------------------------------------------------
        // Example (OpenCritic): '.game-row', '.oc-ad',
        // -----------------------------------------------------------------
    ];

    container.querySelectorAll(junkSelectors.join(', ')).forEach(element => {
        if (element === container) return;
        element.remove();
    });

    // Apply user-defined CSS-selector rules (local + remote). These are precise
    // choices made by the user and are applied exactly - no safe-keyword guard.
    applyCustomCssSelectors(container, (typeof VR_Reader !== 'undefined' && VR_Reader.cssSelectorList) || []);
}

/**
 * Remove elements matching the user's dynamic CSS-selector rules from a
 * container (a cloned document, never the live page). Each selector is applied
 * independently inside a try/catch so one invalid selector can't break the rest.
 */
export function applyCustomCssSelectors(container, selectors) {
    if (!container || !container.querySelectorAll || !selectors || selectors.length === 0) {
        return;
    }

    selectors.forEach(selector => {
        if (typeof selector !== 'string' || !selector.trim()) return;
        try {
            container.querySelectorAll(selector.trim()).forEach(element => {
                if (element !== container) {
                    element.remove();
                }
            });
        } catch (e) {
            console.warn(`[VRR] Skipping invalid CSS selector "${selector}":`, e);
        }
    });
}

const BLOCK_TAGS = new Set([
    'DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'LI', 'ARTICLE', 'SECTION', 'HEADER', 'FOOTER',
    'BLOCKQUOTE', 'PRE', 'UL', 'OL', 'TR', 'NAV', 'ASIDE'
]);

/**
 * Walk a DOM subtree and insert explicit \n line breaks around block-level
 * elements. This mirrors the original raw-body parser behavior so that each
 * block container becomes its own TTS line.
 */
export function extractTextWithBlockBreaks(root) {
    let text = '';
    const blockStack = [];
    const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG', 'PATH']);

    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                if (node.nodeType === Node.ELEMENT_NODE && skipTags.has(node.tagName)) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    let currentNode;
    while ((currentNode = walker.nextNode())) {
        while (blockStack.length > 0 && !blockStack[blockStack.length - 1].contains(currentNode)) {
            blockStack.pop();
            if (text.length > 0 && !text.endsWith('\n')) text += '\n';
        }

        if (currentNode.nodeType === Node.ELEMENT_NODE) {
            const tag = currentNode.tagName;
            if (tag === 'BR') {
                if (text.length > 0 && !text.endsWith('\n')) text += '\n';
            } else if (BLOCK_TAGS.has(tag)) {
                if (text.length > 0 && !text.endsWith('\n')) text += '\n';
                blockStack.push(currentNode);
            }
        } else if (currentNode.nodeType === Node.TEXT_NODE) {
            const cleanVal = currentNode.nodeValue.replace(/[\r\n\t]+/g, ' ').replace(/  +/g, ' ');
            if (cleanVal.length > 0) text += cleanVal;
        }
    }

    while (blockStack.length > 0) {
        blockStack.pop();
        if (text.length > 0 && !text.endsWith('\n')) text += '\n';
    }

    return text.trim();
}

/**
 * Extract the most complete page text available.
 * Clones the body (or a provided root), strips common junk, and converts the
 * remainder to readable text while preserving block-element line breaks.
 */
export function extractCompletePageText(doc, root = null) {
    if (!doc) return '';
    const sourceRoot = root || doc.body;
    if (!sourceRoot) return '';

    const clone = sourceRoot.cloneNode(true);
    removeJunkElements(clone);
    return extractTextWithBlockBreaks(clone);
}

export function getInnerText3_raw(el) {
    if (el.innerHTML) {
        return htmlToText(el.innerHTML, {
            selectors: [
                { selector: 'hr', format: 'skip' },
                { selector: 'img', format: 'skip' },
                { selector: 'pre', format: 'skip' }
            ],
            wordwrap: false
        }).replace(/\n/g, ' ').replace(/&nbsp;/g, " ");
    } else {
        return '';
    }
}

import { detect } from "detect-browser";

export function fnBrowserDetect() {

    const browser = detect();

    // handle the case where we don't detect the browser
    if (browser) {
        return browser.name;
    } else {
        return ""
    }
}

export function isNodeBefore(node1, node2) {
    // https://developer.mozilla.org/en-US/docs/Web/API/Node/compareDocumentPosition
    return (node2.compareDocumentPosition(node1) & (Node.DOCUMENT_POSITION_PRECEDING | Node.DOCUMENT_POSITION_CONTAINS)) != 0;
}

export function svgLogo(size) {
    return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${size}" height="${size}" viewBox="0 0 512 512">
  <!-- Define the gradient -->
  <defs>
    <linearGradient id="blueToViolet" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1881FD" /> <!-- Bright blue color -->
      <stop offset="100%" stop-color="#CE1CFF" /> <!-- Vibrant purple color -->
    </linearGradient>
  </defs>
  
  <!-- Main rounded square background -->
  <path d="M0 0 C1.42944279 -0.0046229 2.8588808 -0.01098504 4.2883091 -0.01890898 C8.17053694 -0.03543518 12.05236585 -0.02743328 15.93459415 -0.0149641 C20.13918165 -0.00584656 24.34370451 -0.01991629 28.54827881 -0.03088379 C36.76697238 -0.04860262 44.98551924 -0.04485877 53.20421839 -0.03323323 C59.88804985 -0.02417292 66.57184041 -0.0229861 73.25567627 -0.02732849 C74.20958807 -0.02794142 75.16349986 -0.02855436 76.14631808 -0.02918586 C78.08461111 -0.03046486 80.02290413 -0.03176171 81.96119714 -0.03307623 C100.1056206 -0.04446258 118.24996301 -0.0313989 136.39437318 -0.00987476 C151.9385745 0.00799444 167.4826563 0.00488979 183.02685547 -0.0135498 C201.10957237 -0.03499094 219.19221837 -0.04336413 237.27494621 -0.03110075 C239.20581944 -0.02982665 241.13669267 -0.02856917 243.06756592 -0.02732849 C244.4923359 -0.02640284 244.4923359 -0.02640284 245.94588912 -0.02545848 C252.61606345 -0.02201531 259.28619254 -0.0278116 265.95635986 -0.0372467 C274.09314586 -0.04850418 282.22977766 -0.04534823 290.36654615 -0.02412373 C294.51229042 -0.01366351 298.65777825 -0.00940479 302.8035202 -0.02272034 C306.60835436 -0.03475545 310.4126976 -0.02790173 314.21748805 -0.00681013 C316.22480459 -0.00031835 318.232156 -0.01317995 320.2394352 -0.02703905 C332.27872704 0.07540388 343.8439219 2.62119297 354.53662109 8.32043457 C355.20089111 8.66372803 355.86516113 9.00702148 356.54956055 9.36071777 C364.03337066 13.33434945 370.3879216 18.30120762 376.16162109 24.50793457 C376.82806641 25.16922363 377.49451172 25.8305127 378.18115234 26.51184082 C390.0858792 38.82218018 398.26611397 56.18160516 398.29584217 73.48488426 C398.30030001 74.69084389 398.30475786 75.89680352 398.30935079 77.13930738 C398.3092615 78.4741277 398.30907166 79.80894802 398.30879211 81.14376831 C398.31209285 82.56457514 398.31581886 83.98538104 398.31993359 85.40618575 C398.32993824 89.31087576 398.33366793 93.2155504 398.3363229 97.12025142 C398.34023062 101.33181201 398.34980876 105.54336049 398.35853577 109.75491333 C398.37828888 119.92725653 398.38836576 130.09960071 398.39726356 140.27195829 C398.40164909 145.06571196 398.40701528 149.85946452 398.41225243 154.65321732 C398.42926495 170.59541024 398.44375761 186.53760248 398.45100117 202.47980309 C398.45291098 206.61597062 398.45483132 210.75213815 398.45678711 214.88830566 C398.45727085 215.91629621 398.45775459 216.94428676 398.45825299 218.00342853 C398.46654761 234.64431728 398.49187483 251.28513402 398.52436779 267.92599134 C398.55747678 285.02218111 398.57545347 302.11833434 398.57864541 319.21455634 C398.58080715 328.80875656 398.58950631 338.40285181 398.61510658 347.99702072 C398.63686623 356.17062463 398.64483825 364.34409807 398.6351398 372.51772766 C398.63061006 376.68367087 398.6324034 380.84934522 398.65190125 385.01525116 C398.66964185 388.83896274 398.66844815 392.66221149 398.65300395 396.48592873 C398.64953764 398.50368288 398.66557249 400.5214425 398.68260843 402.53912771 C398.59861057 414.59946686 396.061988 426.17220467 390.34912109 436.88293457 C389.82765503 437.88586548 389.82765503 437.88586548 389.2956543 438.90905762 C386.44208596 444.25925443 383.2626151 449.02221658 379.16162109 453.50793457 C378.36111328 454.39996582 377.56060547 455.29199707 376.73583984 456.21105957 C364.04878009 469.65089711 346.4443955 479.23151204 327.80143011 480.78857887 C324.09270242 480.89486064 320.39422809 480.91275313 316.68400574 480.89561462 C315.2571543 480.89979635 313.83030618 480.90527844 312.40346414 480.91193444 C308.51452362 480.92629801 304.62579666 480.92217303 300.7368449 480.91476762 C296.53016579 480.91001553 292.32353154 480.92256382 288.11686707 480.93278503 C279.8877618 480.94993897 271.658733 480.95082007 263.42961451 480.94557213 C256.73713436 480.94152257 250.04467673 480.94298331 243.35219765 480.94832039 C242.39787938 480.94906881 241.44356111 480.94981723 240.46032411 480.95058833 C238.52130648 480.95211989 236.58228886 480.95365824 234.64327125 480.9552033 C216.47884827 480.96891622 198.31446842 480.96349933 180.15004645 480.95201809 C163.55485997 480.94208867 146.95978504 480.9550235 130.36461576 480.97895228 C113.29983458 481.00337165 96.23510528 481.01294408 79.17030698 481.00629956 C69.59969769 481.00281342 60.02917413 481.00499921 50.45857811 481.02255058 C42.31074766 481.03730815 34.16306332 481.03786178 26.01523563 481.02047967 C21.86343116 481.01199617 17.71188728 481.00975471 13.56009674 481.02513123 C9.7496002 481.03906823 5.93958529 481.03410115 2.12911598 481.01489199 C0.11866748 481.00940861 -1.8918061 481.02332794 -3.90220672 481.0382461 C-15.94633452 480.94196637 -27.51731902 478.40047681 -38.21337891 472.69543457 C-38.88199951 472.34779053 -39.55062012 472.00014648 -40.23950195 471.64196777 C-45.58969877 468.78839944 -50.35266091 465.60892858 -54.83837891 461.50793457 C-55.73041016 460.70742676 -56.62244141 459.90691895 -57.54150391 459.08215332 C-70.98134145 446.39509356 -80.56195637 428.79070898 -82.1190232 410.14774358 C-82.22530497 406.43901589 -82.24319747 402.74054156 -82.22605896 399.03031921 C-82.23024069 397.60346777 -82.23572278 396.17661966 -82.24237877 394.74977762 C-82.25674235 390.86083709 -82.25261737 386.97211013 -82.24521196 383.08315837 C-82.24045986 378.87647927 -82.25300815 374.66984502 -82.26322937 370.46318054 C-82.28038331 362.23407527 -82.28126441 354.00504648 -82.27601647 345.77592798 C-82.2719669 339.08344784 -82.27342765 332.3909902 -82.27876472 325.69851112 C-82.27951315 324.74419286 -82.28026157 323.78987459 -82.28103267 322.80663759 C-82.28256423 320.86761996 -82.28410258 318.92860234 -82.28564764 316.98958472 C-82.29936055 298.82516175 -82.29394366 280.6607819 -82.28246243 262.49635992 C-82.27253301 245.90117345 -82.28546784 229.30609851 -82.30939662 212.71092924 C-82.33381598 195.64614805 -82.34338841 178.58141876 -82.33674389 161.51662046 C-82.33325776 151.94601117 -82.33544355 142.37548761 -82.35299492 132.80489159 C-82.36775249 124.65706114 -82.36830611 116.50937679 -82.35092401 108.3615491 C-82.3424405 104.20974463 -82.34019905 100.05820076 -82.35557556 95.90641022 C-82.36951257 92.09591368 -82.36454548 88.28589877 -82.34533633 84.47542945 C-82.33985295 82.46498096 -82.35377228 80.45450738 -82.36869043 78.44410676 C-82.2724107 66.39997895 -79.73092115 54.82899445 -74.02587891 44.13293457 C-73.67823486 43.46431396 -73.33059082 42.79569336 -72.97241211 42.10681152 C-70.11956754 36.75797171 -66.94353128 31.98850844 -62.83837891 27.50793457 C-62.01466797 26.60430176 -61.19095703 25.70066895 -60.34228516 24.76965332 C-44.06688627 7.70934159 -23.33527459 -0.16111659 0 0 Z " fill="url(#blueToViolet)" transform="translate(97.83837890625,15.4920654296875)"/>
  
  <!-- Inner white elements -->
  <path d="M0 0 C4.35699098 2.46622131 7.04335342 5.33670683 9.3125 9.875 C9.41687124 12.50645668 9.46029629 15.11183243 9.45967102 17.74383545 C9.46334771 18.56618848 9.4670244 19.38854151 9.4708125 20.23581433 C9.48187583 23.00715067 9.48569766 25.77844954 9.48950195 28.54980469 C9.4957646 30.53048828 9.50241122 32.51117069 9.50941467 34.49185181 C9.52684283 39.88452215 9.53738137 45.27718361 9.5456202 50.66987514 C9.55076649 54.03721459 9.55684238 57.40455125 9.56313133 60.77188873 C9.58218843 71.30217728 9.59641849 81.83245878 9.6047433 92.36276126 C9.61451877 104.52807238 9.6408443 116.6932017 9.68124419 128.85844874 C9.71138016 138.25468501 9.72620978 147.65086909 9.72952431 157.04715276 C9.73187767 162.66224171 9.74087526 168.27713655 9.76598549 173.89217377 C9.78922709 179.17482708 9.79351514 184.45715795 9.78322411 189.73984909 C9.78272768 191.67886043 9.78907936 193.61788743 9.80278015 195.55685043 C9.8204409 198.204365 9.81342182 200.85071509 9.80024719 203.49822998 C9.81121644 204.26536025 9.82218568 205.03249052 9.83348733 205.82286716 C9.77141769 210.99016098 8.55790362 213.88820086 5.3125 217.875 C0.31911882 222.27393104 -2.59765227 223.23176337 -9.1484375 223.15625 C-14.0995418 222.60781999 -16.78547414 219.87454217 -20 216.3125 C-23.00459082 211.97253548 -22.83588868 208.00452868 -22.83467102 202.9238739 C-22.84018605 201.69518805 -22.84018605 201.69518805 -22.8458125 200.44168025 C-22.85685656 197.68726947 -22.86069438 194.93289641 -22.86450195 192.1784668 C-22.87076598 190.20748779 -22.87741273 188.23650997 -22.88441467 186.26553345 C-22.90182816 180.90391309 -22.91237708 175.54230164 -22.9206202 170.18066001 C-22.92576891 166.83224377 -22.93184466 163.48383031 -22.93813133 160.13541603 C-22.95718314 149.66279601 -22.97141512 139.19018305 -22.9797433 128.71754903 C-22.98952107 116.62129813 -23.01585478 104.52522996 -23.05624419 92.42904347 C-23.08637974 83.08374203 -23.10120968 73.73849305 -23.10452431 64.39314395 C-23.10687742 58.80936856 -23.11587208 53.2257884 -23.14098549 47.64206505 C-23.16422678 42.38976664 -23.16851527 37.13779254 -23.15822411 31.88545609 C-23.1577277 29.95773173 -23.16407888 28.02999163 -23.17778015 26.1023159 C-23.19544185 23.47017934 -23.18842144 20.83921393 -23.17524719 18.20707703 C-23.19170106 17.06324123 -23.19170106 17.06324123 -23.20848733 15.89629763 C-23.14621466 10.7418565 -21.92193076 7.85255414 -18.6875 3.875 C-12.61421193 -1.47527758 -7.72899018 -2.357997 0 0 Z " fill="#FEFEFF" transform="translate(262.6875,145.125)"/>
  
  <path d="M0 0 C4.35699098 2.46622131 7.04335342 5.33670683 9.3125 9.875 C9.41226648 11.67323782 9.44758801 13.47518882 9.45294189 15.27618408 C9.45865204 16.42300156 9.46436218 17.56981903 9.47024536 18.75138855 C9.47136322 20.01582291 9.47248108 21.28025726 9.47363281 22.58300781 C9.47826037 23.92330563 9.48328494 25.26360213 9.48867798 26.60389709 C9.50181223 30.25075893 9.50824922 33.89760234 9.51268864 37.54448414 C9.51561842 39.82301138 9.51972311 42.10153358 9.52419281 44.38005829 C9.53787201 51.50917674 9.54753593 58.63828367 9.5513947 65.76741433 C9.55587311 73.9962804 9.57340902 82.22498017 9.6023953 90.45379567 C9.624021 96.81396552 9.6340995 103.17408862 9.63543582 109.53429484 C9.63648345 113.3328978 9.64238188 117.13134452 9.66025543 120.92990875 C9.67675101 124.50533643 9.67888456 128.08049071 9.67011642 131.65594292 C9.66898052 133.58948124 9.68268747 135.52301054 9.6968689 137.45649719 C9.66459727 144.16733175 9.54966658 149.32591893 4.8125 154.51953125 C-0.59470865 158.72983174 -4.96643677 159.70362423 -11.6875 158.875 C-16.6585149 156.34259618 -20.18180567 152.88638866 -22.6875 147.875 C-22.78942929 146.06415356 -22.82698191 144.24954863 -22.83467102 142.43585205 C-22.84182632 141.28062042 -22.84898163 140.12538879 -22.85635376 138.93515015 C-22.85904266 137.66136505 -22.86173157 136.38757996 -22.86450195 135.07519531 C-22.87076599 133.72504501 -22.87741274 132.37489643 -22.88441467 131.02474976 C-22.90183134 127.35103477 -22.91237853 123.67733281 -22.9206202 120.00358677 C-22.92576962 117.70830878 -22.93184542 115.41303484 -22.93813133 113.1177597 C-22.95718645 105.93631867 -22.97141613 98.75488794 -22.9797433 91.57342649 C-22.98951384 83.28395173 -23.01582698 74.99474413 -23.05624419 66.70536351 C-23.08641038 60.29848608 -23.10121269 53.89168519 -23.10452431 47.48473811 C-23.10687451 43.65813397 -23.11583026 39.83181512 -23.14098549 36.00528717 C-23.16427994 32.40353862 -23.16849428 28.80226291 -23.15822411 25.20045853 C-23.15749329 23.25258587 -23.17657561 21.30473715 -23.19628906 19.35696411 C-23.13279208 8.68993076 -23.13279208 8.68993076 -18.6875 3.875 C-12.61421193 -1.47527758 -7.72899018 -2.357997 0 0 Z " fill="#FEFEFF" transform="translate(326.6875,177.125)"/>
  
  <path d="M0 0 C1.91796875 0.06640625 1.91796875 0.06640625 4 1 C5.23828125 3.58984375 5.23828125 3.58984375 6.3125 6.9375 C9.43496221 15.69000177 14.08202551 22.75694985 21 29 C21.78890625 29.79470703 21.78890625 29.79470703 22.59375 30.60546875 C29.73932784 37.4634068 38.84168896 41.46430553 48 45 C47.87109375 46.85546875 47.87109375 46.85546875 47 49 C44.41015625 50.23828125 44.41015625 50.23828125 41.0625 51.3125 C34.52202466 53.6432615 29.41072302 56.69331996 24 61 C22.51306641 62.16208984 22.51306641 62.16208984 20.99609375 63.34765625 C11.986449 70.92976173 7.10689615 82.25764811 3 93 C1.171875 92.8984375 1.171875 92.8984375 -1 92 C-2.421875 89.2265625 -2.421875 89.2265625 -3.75 85.625 C-10.63426264 68.2703675 -22.76796445 58.49310409 -39.24853516 50.85253906 C-41.5905739 49.71253358 -43.79803014 48.38847616 -46 47 C-43.64883732 43.47325598 -42.45039559 43.18584181 -38.5625 41.75 C-21.96969583 35.09300671 -10.97704801 24.33208981 -3.64453125 7.9765625 C-2.96748665 6.27050788 -2.31262811 4.55528891 -1.69140625 2.828125 C-1 1 -1 1 0 0 Z " fill="#FDFDFE" transform="translate(142,203)"/>
  
  <path d="M0 0 C5.67476113 1.96434039 9.31400331 5.62800662 12 11 C12.10755938 13.2757621 12.14892529 15.55473804 12.16113281 17.83300781 C12.16858017 18.88700523 12.16858017 18.88700523 12.17617798 19.96229553 C12.19081101 22.29258192 12.19760453 24.62280017 12.203125 26.953125 C12.20887685 28.57257082 12.21463458 30.19201662 12.22039795 31.8114624 C12.2309121 35.2110628 12.23675161 38.61063953 12.24023438 42.01025391 C12.24571079 46.35923414 12.26971859 50.70789996 12.29820633 55.05678177 C12.31686569 58.40430604 12.32204013 61.75175521 12.32357025 65.09932709 C12.3265914 66.70205142 12.3346018 68.30477461 12.34775543 69.90744781 C12.36488043 72.15500993 12.36292002 74.40181252 12.35644531 76.64941406 C12.36191376 78.56563568 12.36191376 78.56563568 12.36749268 80.52056885 C11.89848637 84.96113395 10.5228778 88.33038657 7.5 91.64453125 C2.09279135 95.85483174 -2.27893677 96.82862423 -9 96 C-14.3035228 93.29820537 -18.09832298 89.70503105 -20 84 C-20.11013215 81.6863571 -20.15907767 79.36966007 -20.17700195 77.0534668 C-20.18357315 76.35065582 -20.19014435 75.64784485 -20.19691467 74.92373657 C-20.21661792 72.59889617 -20.22830345 70.27412027 -20.23828125 67.94921875 C-20.24235678 67.15408182 -20.2464323 66.35894489 -20.25063133 65.53971291 C-20.27147919 61.3312468 -20.28578656 57.12281319 -20.29516602 52.91430664 C-20.30622911 48.57310846 -20.3406311 44.23242303 -20.38033772 39.89140606 C-20.40651225 36.54817263 -20.41485856 33.20506127 -20.41844749 29.86173439 C-20.42331115 28.26178333 -20.43491894 26.66183764 -20.45348549 25.06198692 C-20.47789656 22.81915272 -20.47690917 20.57764383 -20.4699707 18.3347168 C-20.47583694 17.06025192 -20.48170319 15.78578705 -20.48774719 14.47270203 C-19.74666808 9.19630684 -17.30579646 6.1503445 -13.375 2.6875 C-8.92314854 -0.47565762 -5.3540278 -0.48837416 0 0 Z " fill="#FEFDFF" transform="translate(388,208)"/>
  
  <path xmlns="http://www.w3.org/2000/svg" d="M0 0 C0.66 0 1.32 0 2 0 C2.32871094 0.7734375 2.65742188 1.546875 2.99609375 2.34375 C7.75590842 12.7663252 13.62483117 19.1537792 24.34765625 23.40625 C24.89292969 23.6021875 25.43820313 23.798125 26 24 C26 24.66 26 25.32 26 26 C25.2265625 26.32871094 24.453125 26.65742188 23.65625 26.99609375 C13.2336748 31.75590842 6.8462208 37.62483117 2.59375 48.34765625 C2.3978125 48.89292969 2.201875 49.43820313 2 50 C1.34 50 0.68 50 0 50 C-0.37511719 49.27554688 -0.75023437 48.55109375 -1.13671875 47.8046875 C-1.64847656 46.83789062 -2.16023438 45.87109375 -2.6875 44.875 C-3.18636719 43.92367187 -3.68523437 42.97234375 -4.19921875 41.9921875 C-8.01057764 35.65921372 -11.70896037 32.11733515 -18.3125 29.125 C-18.95767578 28.81820312 -19.60285156 28.51140625 -20.26757812 28.1953125 C-21.83888701 27.4503957 -23.41861711 26.72328473 -25 26 C-25 25.34 -25 24.68 -25 24 C-24.07058594 23.59910156 -23.14117187 23.19820312 -22.18359375 22.78515625 C-10.77926075 17.63456381 -5.20940757 11.46069666 0 0 Z " fill="#FDFDFD" transform="translate(189,176)"/>
  
  <path xmlns="http://www.w3.org/2000/svg" d="M0 0 C0.66 0 1.32 0 2 0 C2.32871094 0.7734375 2.65742188 1.546875 2.99609375 2.34375 C7.75590842 12.7663252 13.62483117 19.1537792 24.34765625 23.40625 C24.89292969 23.6021875 25.43820313 23.798125 26 24 C26 24.66 26 25.32 26 26 C25.2265625 26.32871094 24.453125 26.65742188 23.65625 26.99609375 C13.2336748 31.75590842 6.8462208 37.62483117 2.59375 48.34765625 C2.3978125 48.89292969 2.201875 49.43820312 2 50 C1.34 50 0.68 50 0 50 C-0.42410156 49.13117188 -0.84820312 48.26234375 -1.28515625 47.3671875 C-7.23577861 35.67519543 -12.82230064 30.97678129 -25 26 C-25 25.34 -25 24.68 -25 24 C-24.07058594 23.59910156 -23.14117187 23.19820313 -22.18359375 22.78515625 C-10.77926075 17.63456381 -5.20940757 11.46069666 0 0 Z " fill="#FDFDFD" transform="translate(189,282)"/>
  
  </svg>`
}

// This function creates a modal for the welcome sign-in
//Promo for Pro Upgrade Voice Credits
// This function creates a promo for Pro Upgrade Voice Credits
export function addLoader() {
    const loaderContainer = document.createElement('div');
    loaderContainer.id = 'vrr-custom-loader';
    loaderContainer.style.position = 'fixed';
    loaderContainer.style.top = '50%';
    loaderContainer.style.width = '250px';
    loaderContainer.style.height = '250px';
    loaderContainer.style.left = '50%';
    loaderContainer.style.transform = 'translate(-50%, -50%)';
    loaderContainer.style.zIndex = '10000';
    loaderContainer.style.display = 'flex';
    loaderContainer.style.justifyContent = 'center';
    loaderContainer.style.alignItems = 'center';

    loaderContainer.innerHTML = `
        <svg width="250" height="250" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
            <radialGradient id="a12" cx=".66" fx=".66" cy=".3125" fy=".3125" gradientTransform="scale(1.5)">
                <stop offset="0" stop-color="#C4DCFF"></stop>
                <stop offset=".3" stop-color="#C4DCFF" stop-opacity=".9"></stop>
                <stop offset=".6" stop-color="#C4DCFF" stop-opacity=".6"></stop>
                <stop offset=".8" stop-color="#C4DCFF" stop-opacity=".3"></stop>
                <stop offset="1" stop-color="#C4DCFF" stop-opacity="0"></stop>
            </radialGradient>
            <circle transform-origin="center" fill="none" stroke="url(#a12)" stroke-width="15" 
                stroke-linecap="round" stroke-dasharray="200 1000" stroke-dashoffset="0" cx="100" cy="100" r="70">
                <animateTransform type="rotate" attributeName="transform" calcMode="spline" dur="2" 
                    values="360;0" keyTimes="0;1" keySplines="0 0 1 1" repeatCount="indefinite"></animateTransform>
            </circle>
            <circle transform-origin="center" fill="none" opacity=".2" stroke="#C4DCFF" 
                stroke-width="15" stroke-linecap="round" cx="100" cy="100" r="70"></circle>
        </svg>
    `;
    document.body.appendChild(loaderContainer);
}

export function removeLoader() {
    const loader = document.getElementById('vrr-custom-loader');
    if (loader) {
        loader.remove();
    }
}