/**
 * ============================================================================
 * selectionHintPopup Module
 * ============================================================================
 * Standalone "Press Enter to play" hint shown near the bottom-right of the page
 * when the user highlights a substantial amount of text AND the primary
 * Quick Access play button is NOT available to carry the hint.
 *
 * It appears when either:
 *   1. The user turned off the VR-Reader play button in settings
 *      (`DEFAULT_QUICK_ACCESS_CONTROLS_STATE === false`), or
 *   2. The TTS Widget reader panel is already open (`#shadowdom-vr-reader` exists).
 *
 * This popup lives OUTSIDE of Start_VRR so it can still guide the user even
 * when the quick-access bubble is hidden. It uses the same Enter-to-play
 * behavior as Start_VRR's inline hint (captures the highlighted text and reads
 * it via `VR_Reader.readHighlightedText`).
 */
window.VR_Reader = window.VR_Reader || {};
const VR_Reader = window.VR_Reader;

// Must match the Start_VRR inline hint threshold.
const SELECTION_HINT_MIN_CHARS = 170;

let hintHost = null;
let hintBox = null;
let enterKeyBound = false;
let leaveTimer = null;
let pendingSelectionText = "";

function isPageEligible() {
    // Don't show while a highlighted-text read was just initiated (e.g. the
    // user pressed Enter from the primary hint, which opens the TTS widget and
    // briefly satisfies the "widget open" condition).
    if (VR_Reader._selectionHintSuppressUntil && Date.now() < VR_Reader._selectionHintSuppressUntil) {
        return false;
    }

    // The entire Enter-to-play / selection hint feature can be disabled from
    // settings (Quick Access controls). When off, never show the popup.
    if (VR_Reader.savedLocalStorageGlobal['DEFAULT_ENTER_KEY_PLAY_STATE'] === false) {
        return false;
    }

    const quickAccessEnabled = VR_Reader.savedLocalStorageGlobal['DEFAULT_QUICK_ACCESS_CONTROLS_STATE'];
    const playButtonHidden = quickAccessEnabled === false;
    const widgetOpen = document.querySelector('#shadowdom-vr-reader') !== null;
    // The quick-access bubble is created only on non "/" pages (see
    // content_script.js loadUserAndAutoSettings). When it's absent the primary
    // hint/Enter handler won't bind, so fall back to this standalone popup.
    const bubbleAbsent = document.querySelector('#vrr-quick-access-host') === null;
    return playButtonHidden || widgetOpen || bubbleAbsent;
}

function hasNonEditableSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const container = selection.getRangeAt(0).commonAncestorContainer;
    const node = container && container.nodeType === 1 ? container : (container && container.parentElement);
    if (node && node.closest && node.closest('input, textarea, [contenteditable="true"]')) {
        return null;
    }

    const text = selection.toString().trim();
    return text.length > 0 ? text : null;
}

function triggerPlay(text) {
    if (!text) return;
    VR_Reader.readHighlightedTextSelection = text;
    VR_Reader.readHighlightedText(text);
    if (typeof VR_Reader.changeActiveVoice === 'function') {
        VR_Reader.changeActiveVoice();
    }
}

function enterKeyHandler(e) {
    if (e.key !== 'Enter' || e.repeat) return;

    // The Enter-to-play shortcut can be disabled from settings.
    if (VR_Reader.savedLocalStorageGlobal['DEFAULT_ENTER_KEY_PLAY_STATE'] === false) {
        return;
    }

    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
    }

    const text = hasNonEditableSelection();
    if (!text) return;

    e.preventDefault();

    triggerPlay(text);
}

function ensureHintElement() {
    if (hintHost) return;

    hintHost = document.createElement('div');
    hintHost.id = 'vrr-selection-hint-popup';
    hintHost.style.position = 'fixed';
    hintHost.style.right = '16px';
    hintHost.style.bottom = '16px';
    hintHost.style.zIndex = '10000000000';
    hintHost.style.pointerEvents = 'none';

    const shadow = hintHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
        <style>
            .hint-box {
                display: flex;
                align-items: center;
                width: fit-content;
                min-width: 0;
                max-width: 280px;
                padding: 8px 14px;
                background-color: rgba(20, 20, 28, 0.96);
                color: #e5e7eb;
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 12px;
                box-shadow: 0 6px 20px rgba(0,0,0,0.4);
                font-size: 13px;
                line-height: 1;
                text-align: left;
                white-space: nowrap;

                pointer-events: auto;
                cursor: pointer;

                opacity: 0;
                visibility: hidden;
                transform: translateY(10px);
                transition: opacity 0.3s ease, transform 0.3s ease, visibility 0.3s;
                transition-delay: 0.1s;
            }

            .hint-box:hover {
                background-color: rgba(34, 34, 46, 0.98);
                border-color: rgba(167, 139, 250, 0.45);
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            }

            .hint-box b {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
                padding: 2px 8px;
                margin: 0 6px;
                background-color: rgba(167, 139, 250, 0.15);
                border: 1px solid rgba(167, 139, 250, 0.35);
                border-radius: 6px;
                color: #c4b5fd;
                font-size: 12px;
                font-weight: 600;
                box-shadow: 0 1px 2px rgba(0,0,0,0.2);
            }

            .hint-box.show {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
            }

            .hint-box.leaving {
                opacity: 0;
                visibility: hidden;
                transform: translateY(14px);
                transition: opacity 0.3s ease, transform 0.3s ease, visibility 0.3s;
                transition-delay: 0s;
            }
        </style>
        <div class="hint-box">Press <b>Enter</b> to play</div>
    `;

    document.body.appendChild(hintHost);
    hintBox = shadow.querySelector('.hint-box');

    // Capture the highlighted text on mousedown (before the click would
    // collapse the selection) and play it on click — same as pressing Enter.
    hintBox.addEventListener("mousedown", (e) => {
        const text = hasNonEditableSelection();
        if (text) {
            pendingSelectionText = text;
            e.preventDefault();
        } else {
            pendingSelectionText = "";
        }
    });

    hintBox.addEventListener("click", (e) => {
        const text = pendingSelectionText || "";
        pendingSelectionText = "";
        if (!text) return;

        e.preventDefault();
        e.stopPropagation();

        triggerPlay(text);
        hideHint();
    });
}

function destroyHintElement() {
    if (leaveTimer) {
        clearTimeout(leaveTimer);
        leaveTimer = null;
    }
    unbindEnterKey();
    if (hintHost) {
        hintHost.remove();
        hintHost = null;
        hintBox = null;
    }
}

function bindEnterKey() {
    if (!enterKeyBound) {
        document.addEventListener('keydown', enterKeyHandler);
        enterKeyBound = true;
    }
}

function unbindEnterKey() {
    if (enterKeyBound) {
        document.removeEventListener('keydown', enterKeyHandler);
        enterKeyBound = false;
    }
}

function showHint() {
    ensureHintElement();
    if (!hintBox) return;

    bindEnterKey();

    if (leaveTimer) {
        clearTimeout(leaveTimer);
        leaveTimer = null;
    }
    hintBox.classList.remove('leaving');
    hintBox.classList.add('show');
}

function hideHint() {
    if (!hintBox) return;

    if (!hintBox.classList.contains('show')) return;

    unbindEnterKey();

    hintBox.classList.add('leaving');
    leaveTimer = setTimeout(() => {
        hintBox.classList.remove('show');
        hintBox.classList.remove('leaving');
        leaveTimer = null;
    }, 300);
}

function selectionChangeHandler() {
    const selection = window.getSelection();
    const selectionText = selection ? selection.toString().trim() : '';
    const hasSelection = selectionText.length > 0;

    if (hasSelection && isPageEligible() && selectionText.length >= SELECTION_HINT_MIN_CHARS) {
        // Only show if the selection is outside editable content.
        const container = selection.rangeCount > 0 ? selection.getRangeAt(0).commonAncestorContainer : null;
        const node = container && container.nodeType === 1 ? container : (container && container.parentElement);
        const insideEditable = node && node.closest && node.closest('input, textarea, [contenteditable="true"]');
        if (!insideEditable) {
            showHint();
            return;
        }
    }

    hideHint();
}

function init() {
    document.addEventListener('selectionchange', selectionChangeHandler);

    if (!document.documentElement) {
        setTimeout(init, 50);
        return;
    }

    // Keep the hint in sync when the TTS widget is opened or closed (the
    // widget open state is one of the two conditions for showing the popup).
    const observer = new MutationObserver(() => {
        const selection = window.getSelection();
        const hasSelection = selection && selection.toString().trim().length > 0;
        if (hasSelection) {
            selectionChangeHandler();
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Allow the sidepanel settings to force a re-evaluation immediately when
    // the "Enable [Enter] to play shortcut" option is toggled.
    VR_Reader.refreshSelectionHintPopup = selectionChangeHandler;
}

init();
