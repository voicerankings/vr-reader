/**
 * ============================================================================
 * readLater Module
 * ============================================================================
 * Manages the "Read Later" functionality. Detects when a page is loaded from a
 * saved bookmark (via URL hashes or background messages) and triggers the appropriate
 * overlay to resume text-to-speech reading from the saved position.
 */
export function checkReadLaterStatus() {
    // 1. Tell background we are fully loaded and ready to receive instructions
    chrome.runtime.sendMessage({ action: "checkPendingReadLater" });

    // 2. Fallback: check if URL has hash (for direct page refreshes/loads)
    if (window.location.hash.includes('#:~:text=')) {
        triggerReadLaterOverlay(null);
    }
}

export function triggerReadLaterOverlay(bookmark = null) {
    setTimeout(() => {
        if (window.VR_Reader && window.VR_Reader.makeRatingsOverlay) {
            window.VR_Reader.sessionCharsRead = 0; // Reset session count when popup appears
            window.VR_Reader.makeRatingsOverlay({
                voice: { character_name: 'Continue' },
                generation_credits: 0,
                replayQueue: [],
                index: 0
            });

            if (window.VR_Reader.ratingsOverlayClass) {
                window.VR_Reader.ratingsOverlayClass.showContinueReading = true;
                window.VR_Reader.ratingsOverlayClass.skipCalculateRemaining = true;

                if (bookmark && bookmark.percentage_remaining !== undefined) {
                    window.VR_Reader.ratingsOverlayClass.remainingTextPercentage = bookmark.percentage_remaining;
                    window.VR_Reader.ratingsOverlayClass.initialPercentageRemaining = bookmark.percentage_remaining; // Store original
                    window.VR_Reader.ratingsOverlayClass.initialTotalChars = bookmark.total_chars;
                    window.VR_Reader.ratingsOverlayClass.initialCurrentCharPosition = bookmark.current_char_position;
                    const barText = window.VR_Reader.ratingsOverlayClass.shadow.querySelector('.remaining-percentage');
                    if (barText) {
                        barText.innerText = bookmark.percentage_remaining + "% remaining";
                    }
                }

                const continueBtn = window.VR_Reader.ratingsOverlayClass.shadow.querySelector('.continue-button');
                if (continueBtn) {
                    continueBtn.setAttribute('data-tooltip', 'Resume playing from this spot');
                }

                window.VR_Reader.ratingsOverlayClass._showContinueReadingBar();

                window.VR_Reader.ratingsOverlayClass._handleContinueReading = async () => {
                    console.log('📖 Continue reading from Read Later');
                    window.VR_Reader.ratingsOverlayClass.close(true);
                    window.VR_Reader.hasContinuedReading = true;

                    try {
                        let parsedText = "";

                        if (bookmark && bookmark.text_fragment_url) {
                            // Extract from bookmark data (reliable)
                            parsedText = bookmark.text_fragment_url.split('#:~:text=')[1]
                                ? decodeURIComponent(bookmark.text_fragment_url.split('#:~:text=')[1])
                                : "";
                        } else {
                            // Extract from current hash (fallback)
                            const hashText = window.location.hash.split('#:~:text=')[1];
                            if (hashText) {
                                parsedText = decodeURIComponent(hashText);
                            }
                        }

                        const mockData = {
                            fragmentInfo: {
                                fullText: parsedText,
                                textStart: parsedText
                            },
                            selectionText: parsedText,
                            capturedAt: Date.now(),
                            pageUrl: window.location.href,
                            pageTitle: document.title
                        };

                        window.VR_Reader.storedSelectionData = mockData;
                        window.VR_Reader.isTrackingReadLater = true;

                        // Show loading state on button
                        const continueBtn = window.VR_Reader.ratingsOverlayClass.shadow.querySelector('.continue-button');
                        if (continueBtn) continueBtn.innerText = "Loading...";

                        const result = await window.VR_Reader.calculateRemainingText();
                        window.VR_Reader.remainingTextResult = result;

                        let textToRead = (result && result.articleText) ? result.articleText : parsedText;
                        window.VR_Reader.resumeSentenceText = (bookmark && bookmark.last_read_text) ? bookmark.last_read_text : null;
                        await window.VR_Reader.readHighlightedText(textToRead, mockData);
                    } catch (e) {
                        console.error('Error starting Read Later', e);
                    }
                };
            }
        }
    }, 1500); // Allow DOM to settle and native highlight to apply
}
