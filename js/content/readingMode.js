/**
 * ============================================================================
 * readingMode Module
 * ============================================================================
 * Orchestrates the "Reading Mode" experience. It is responsible for parsing
 * the page content (using Readability or custom extractors), calculating read times,
 * and managing the initialization and lifecycle of the TTSWidget UI.
 */
window.VR_Reader = window.VR_Reader || {};
const VR_Reader = window.VR_Reader;
import {
    addLoader,
    removeLoader,
    removeHiglightOnPage,
    extractJsonLdArticle,
    extractFromSemanticHtml,
    getInnerText_pageReader,
    cleanTitleForPlayback,
    extractCompletePageText,
    applyCustomCssSelectors
} from '../utils/helpers.js';
import { extractFromHtml } from '../vendor/article-extractor.esm.js';
import Readability from '../vendor/Readability.js';
import { calculateReadTimeFromGlobal } from '../utils/readEstimateCalculator.js';
import { CONSTANTS } from '../constants/constants.js';
import TTSWidget from '../components/tts-widget/TTSWidget.js';


async function openVR_Reader(reopen = true, readMode = "") {
    if (document.querySelector("#shadowdom-vr-reader") !== null && reopen === false) {
        return false;
    }

    if (VR_Reader.ttsWidget && VR_Reader.ttsWidget.voiceClass) {
        if (VR_Reader.ttsWidget.voiceClass.getAudioStatus() === "PLAYING") {
            return false;
        }
    }

    let shadowDomDiv;
    try {
        if (document.querySelector("#shadowdom-vr-reader")) {
            VR_Reader.ttsWidget.close();
        }

        shadowDomDiv = document.createElement('div');
        shadowDomDiv.setAttribute('id', 'shadowdom-vr-reader');     
        shadowDomDiv.setAttribute('class', 'vr-shadowdom'); 
        var parentElement = document.body.parentNode;                       
        parentElement.insertBefore(shadowDomDiv, document.body.nextSibling);
    
        if(!window.VR_Reader.ttsWidget){
            window.VR_Reader.ttsWidget = new TTSWidget(readMode);					
        }    
        window.VR_Reader.ttsWidget.initShadowDOM(shadowDomDiv);
        await window.VR_Reader.ttsWidget.render();

        VR_Reader.loadDomainFilters()

        window.VR_Reader.addListener(document.body, 'click', (e) => {  
            VR_Reader.windowInFocus = true;
            removeHiglightOnPage()
        })

        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                VR_Reader.windowInFocus = true;
            }
        });

        window.onfocus = function() {
            VR_Reader.windowInFocus = true;
        };
        
        window.onblur = function() {
            VR_Reader.windowInFocus = false;
        };

        chrome.runtime.sendMessage({
            action: "getCurrentTabId",
            url: window.location.href 
        });

    } catch(e) {
        shadowDomDiv = null;
    }
}

VR_Reader.openVR_Reader = openVR_Reader;

async function openVR_ReaderFromMenureadWithVRR(readMode) {
    if (VR_Reader.vrrQuickAccessButton) {
        const btn = VR_Reader.vrrQuickAccessButton;
        if (btn.fadeOutHintAndClose) {
            // Wait until the play button has finished its click animation and
            // faded out, so the widget opens right after — one flow, no overlap.
            await btn.fadeOutHintAndClose();
        } else {
            btn.close(true);
        }
    }
    if (VR_Reader.ttsWidget && !VR_Reader.ttsWidget.voiceClass) {
        try { VR_Reader.ttsWidget.close(); } catch(e) {}
        delete VR_Reader.ttsWidget;
        const el = document.querySelector('#shadowdom-vr-reader');
        if (el) el.remove();
    }
    if (!VR_Reader.ttsWidget || !VR_Reader.ttsWidget.voiceClass) {
        await openVR_Reader(true, readMode);
    }
}

VR_Reader.openVR_ReaderFromMenureadWithVRR = openVR_ReaderFromMenureadWithVRR;

VR_Reader.readWithVRR = async () => {
    
    // Helper function to initiate playback
    const generatePlay = async (docText, docTitle) => {
        console.log(`📝 Processing text for playback. Length: ${docText ? docText.length : 0}`);
        
        try {
            // CRITICAL CHECK: If text is empty or just whitespace, stop immediately.
            if (!docText || docText.trim().length === 0) {
                throw new Error("Extracted text is empty or null");
            }

            let cleanedTitle = cleanTitleForPlayback(docTitle);

            VR_Reader.readWithVRRPageText = docText; 
            VR_Reader.readWithVRRPageTitle = cleanedTitle; 

            // Ensure any previous instance is cleaned up to prevent "hanging" state
            if (VR_Reader.ttsWidget) {
                if (VR_Reader.ttsWidget.voiceClass && !VR_Reader.ttsWidget.voiceClass.speaking()) {
                    console.log("♻️ Resetting existing widget for new content...");
                    VR_Reader.ttsWidget.close(false); 
                }
            }

            await openVR_ReaderFromMenureadWithVRR("readWithVRR");
            await VR_Reader.storeDefaults();

            if (VR_Reader.ttsWidget && VR_Reader.ttsWidget.voiceClass) {
                VR_Reader.ttsWidget.voiceClass.setAnswerElement(document.body);

                // Determine the text that will be read
                let textToRead;
                if(VR_Reader.savedLocalStorageGlobal['DEFAULT_AUTO_READ_TITLE_STATE']){
                    textToRead = cleanedTitle + "\n" + docText;
                } else {
                    textToRead = docText;
                }
                
                VR_Reader.ttsWidget.voiceClass.setOutput(textToRead);
                
                // Calculate and update read estimate time
                const estimatedTime = calculateReadTimeFromGlobal(textToRead);
                if (VR_Reader.ttsWidget.updateReadEstimateTime) {
                    VR_Reader.ttsWidget.updateReadEstimateTime(estimatedTime);
                    if (VR_Reader.ttsWidget.playbackClass) {
                        VR_Reader.ttsWidget.playbackClass.updateTimerDisplay("00:00", estimatedTime, estimatedTime);
                    }
                }

                console.log("▶️ Triggering playback list generation...");
                setTimeout(() => {
                    const isOpenChat = VR_Reader.savedLocalStorageGlobal['DEFAULT_VRR_READER_PAGE_STATE'] === "OPEN_CHAT";
                    VR_Reader.ttsWidget.voiceClass.makePlayUtteranceList(!isOpenChat);
                }, 1000);


            } else {
                console.error("❌ Failed to initialize ttsWidget or voiceClass");
            }

        } catch (e) {
            console.error("Error inside generatePlay:", e);
            // This catches errors occurring specifically during the UI setup phase
            VR_Reader.makeToast({
                delay: 8000,
                posX: window.innerWidth / 2,
                posY: 250, 
                action: 'normal', 
                title: `Not able to detect content automatically.`,
                message: "Please highlight the text you want to read."
            });
        }
    };
    
    addLoader();



    try {


        // --- PRE-PROCESSING HELPER FUNCTION ---
        const removeJunk = (container) => {
            console.log("Pre-processing document with a safer junk removal method...");

            // 1. Detect Table-Based Layouts (like Hacker News)
            const tableCount = container.querySelectorAll('table').length;
            const isTableLayout = tableCount > 3; 

            const junkSelectors = [
                'footer', 'nav', 'aside',
                '[class*="ad-"]', '[id*="ad-"]', '.ad', '.advert',
                '[class*="cookie"]', '[id*="cookie"]',
                '[class*="related"]', '[id*="related"]',
                '[class*="comment"]', '[id*="comment"]',
                '[class*="share"]', '.social', '.sharing',
                '[class*="modal"]', '[id*="modal"]',
                '[class*="popup"]', '[id*="popup"]',
                '.content-listing', '.latest-posts', '.popular-posts'
            ];

            const safeKeywords = [
                'article', 'content', 'post', 'body', 'main', 'story', 'entry', 'text'
            ];

            container.querySelectorAll(junkSelectors.join(', ')).forEach(element => {
                if (element === container) return;
                
                // CRITICAL FIX: Do not remove tables on table-heavy sites like HN
                if (isTableLayout && (element.tagName === 'TABLE' || element.tagName === 'TBODY' || element.tagName === 'TR' || element.tagName === 'TD')) {
                    return;
                }

                const className = (element.className && typeof element.className === 'string') ? element.className.toLowerCase() : '';
                const idName = (element.id && typeof element.id === 'string') ? element.id.toLowerCase() : '';
                
                let isSafe = false;

                for (const keyword of safeKeywords) {
                    const regex = new RegExp(`\\b${keyword}\\b|${keyword}-`);
                    if (regex.test(className) || regex.test(idName)) {
                        isSafe = true;
                        break; 
                    }
                }

                if (!isSafe) {
                    element.remove();
                } 
            });

            // Apply user-defined CSS-selector rules (dynamic, local + remote).
            // These are precise user choices applied exactly on the clone.
            applyCustomCssSelectors(container, VR_Reader.cssSelectorList || []);
        };
        // --- END OF HELPER ---

        let result = null;
        let targetElement = null;

        // Strategy A: JSON-LD
        result = extractJsonLdArticle(document);
        if (result?.element) {
            targetElement = result.element;
            console.log("✅ Found article location via JSON-LD");
        }

        // Strategy B: Semantic HTML
        if (!targetElement) {
            result = extractFromSemanticHtml(document);
            if (result?.element) {
                targetElement = result.element;
                console.log("✅ Found article location via semantic HTML");
            }
        }

        // Strategy B.5: Relaxed / non-strict extraction
        // When the user disables strict mode, prefer the most complete text
        // (raw body or located element after junk removal) over Readability.
        const strictMode = VR_Reader.savedLocalStorageGlobal['DEFAULT_READER_STRICT_MODE'] !== false;
        if (!strictMode) {
            console.log("🧘 Relaxed mode: trying complete page extraction...");
            try {
                const relaxedRoot = targetElement || document.body;
                const relaxedText = extractCompletePageText(document, relaxedRoot);
                if (relaxedText && relaxedText.trim().length > 50) {
                    await generatePlay(relaxedText, document.title);
                    removeLoader();
                    return;
                }
            } catch (relaxedError) {
                console.warn("Relaxed extraction failed, continuing to strict fallback:", relaxedError);
            }
        }
        
        // Strategy C: Target Element via Readability on Clone
        if (targetElement) {
            console.log("Using intelligent extraction on located element...", targetElement);
            try {
                // Safe DOM creation
                const newDocument = document.implementation.createHTMLDocument();
                const importedElement = newDocument.importNode(targetElement, true);
                
                removeJunk(importedElement);
                newDocument.body.appendChild(importedElement);
                
                const intelligentResult = new Readability(newDocument).parse();

                if (intelligentResult && intelligentResult.content) {
                    const tempDivElement = document.createElement("div");
                    tempDivElement.innerHTML = intelligentResult.content;
                    const documentText = getInnerText_pageReader(tempDivElement);
                    
                    // Check if text is valid before proceeding
                    if(documentText && documentText.trim().length > 50) {
                        await generatePlay(documentText, intelligentResult.title || document.title);
                        removeLoader();
                        return;
                    }
                }
            } catch (intelligentError) {
                console.log("Intelligent extraction failed, falling back...", intelligentError);
            }
        }

        // FALLBACK: Full Document Readability
        console.log("Falling back to full document Readability parse...");
        
        // Use createHTMLDocument to avoid ShadowDOM/WebComponent crashes
        let documentClone = document.implementation.createHTMLDocument();
        try {
            documentClone.documentElement.innerHTML = document.documentElement.innerHTML;
        } catch (err) {
            console.warn("Deep HTML clone failed, attempting body-only clone", err);
            documentClone.body.innerHTML = document.body.innerHTML;
        }
        
        removeJunk(documentClone.body); 

        const article = new Readability(documentClone).parse();
    
        if (article && article.content) {
            const tempDivElement = document.createElement("div");
            tempDivElement.innerHTML = article.content;
            const documentText = getInnerText_pageReader(tempDivElement);        
            
            // ✅ Explicit Check: Ensure we actually got text, otherwise throw to reach fallback
            if (documentText && documentText.trim().length > 50) {
                console.log("✅ Full document Readability parse successful. Text Length:", documentText.length);        
                await generatePlay(documentText, article.title);
                removeLoader();
                return;
            } else {
                throw new Error("Readability returned empty text content.");
            }
        } else {
            throw new Error("Full document Readability parse returned no content object.");
        }
 
    } catch (e) {
        console.log("All Readability strategies failed, trying final fallback:", e);
        try {
            // Absolute final fallback: Use simple text extraction
            const result = await extractFromHtml(document.body.parentNode.outerHTML);

            if (result && result.content) {
                const tempDivElement = document.createElement("div");
                tempDivElement.innerHTML = result.content;
                const documentText = getInnerText_pageReader(tempDivElement);
                
                // Check if final fallback produced text
                if (documentText && documentText.trim().length > 20) {
                    await generatePlay(documentText, result.title);
                } else {
                    throw new Error("Final fallback text empty");
                }
            } else {
                throw new Error("Final fallback returned null");
            }
        } catch (finalError) {
            console.error("Final fallback failed:", finalError);
            // ✅ This is the user-facing message you requested
            // ✅ UPDATED PROMPT WITH SELECTOR ACTION
            VR_Reader.makePrompt({
                posX: 50,
                posY: 50,
                action: 'vrr-theme',
                icon: CONSTANTS.NOTIFICATION_ICON.ERROR_32,
                title: 'Content Detection Failed',
                message: `We couldn't automatically detect the main article content.<br><br>
                          <b>Options:</b><br>
                          1. Highlight text and right-click to read.<br>
                          2. Turn on <b>Click to Read</b> mode to tap any text and hear it read aloud.`,
                cancel: { buttonText: 'Close' },
                actions: [
                    {
                        buttonText: 'Turn on Click to Read',
                        callback: () => {
                            VR_Reader.toggleTextSelector(true);
                        }
                    }
                ]
            });
        }
    } finally {
        removeLoader();
    }
};

async function readHighlightedText(selectionText, mockSelectionData = null) {
    // A highlighted-text read is starting. Suppress the standalone selection
    // hint popup for a short window so it doesn't flash right after Enter /
    // play is pressed (the TTS widget opens, which normally satisfies one of
    // the popup's show conditions).
    VR_Reader._selectionHintSuppressUntil = Date.now() + 2000;

    const generatePlay = async (docSelectionText, docTitle) => {
        if (docSelectionText.length > 0) {
            // Store basic info
            VR_Reader.readWithVRRPageTitle = docTitle;
            
            // IMPORTANT: Capture selection data IMMEDIATELY before it's lost
            if (mockSelectionData) {
                VR_Reader.storedSelectionData = mockSelectionData;
                console.log('✅ Using mock selection data from URL fragment');
            } else {
                const selectionData = VR_Reader.captureSelectionData();
                if (!selectionData) {
                    console.warn('Failed to capture selection data');
                }
            }

            await openVR_ReaderFromMenureadWithVRR("readHighlightedText");
            await VR_Reader.storeDefaults();

            VR_Reader.ttsWidget.voiceClass.setAnswerElement(document.body);
            VR_Reader.ttsWidget.voiceClass.setOutput(docSelectionText);

            // Calculate and update read estimate time for highlighted text
            const estimatedTime = calculateReadTimeFromGlobal(docSelectionText);
            if (VR_Reader.ttsWidget.updateReadEstimateTime) {
                VR_Reader.ttsWidget.updateReadEstimateTime(estimatedTime);

                if (VR_Reader.ttsWidget.playbackClass) {
                    VR_Reader.ttsWidget.playbackClass.updateTimerDisplay("00:00", estimatedTime, estimatedTime)
                }

            }
            
            setTimeout(() => {
                VR_Reader.ttsWidget.voiceClass.setReaderMode = "readWithVRR";
                VR_Reader.ttsWidget.voiceClass.makePlayUtteranceList(true);
            }, 1000);


        }
    };
    
    addLoader();
    
    // Just start playing the selection immediately
    await generatePlay(selectionText, document.title);
    
    removeLoader();
}

VR_Reader.readHighlightedText = readHighlightedText;

VR_Reader.unwrapSentenceSpans = () => {
    const sentenceSpans = document.querySelectorAll("span.sentence");
    
    sentenceSpans.forEach(span => {
        span.outerHTML = span.innerHTML;
    });

    document.querySelectorAll("p").forEach(p => p.normalize());
}