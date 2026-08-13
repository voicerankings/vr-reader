import { removeHiglightOnPage } from "../../../utils/helpers";

/**
 * ============================================================================
 * ClickToReadHandler (Text Selector DOM Interceptor)
 * ============================================================================
 * Manages the "Click to Read" feature. Intercepts DOM clicks on websites,
 * expands coordinate locations to logical DOM blocks, and routes text payloads 
 * directly to the TTS queue to jump playback.
 */
export default class ClickToReadHandler {
    constructor(voicePlayer) {
        this.player = voicePlayer;
        this.listenerActive = false;
    }

    bind() {
        this.boundHandleClick = this.handleTextElementClick.bind(this);
    }

    handleTextElementClick(e) {
        const target = e.target;
        const tagName = target.tagName;

        // 1. Fast Exit: Ignore known interactive elements
        if (tagName === 'BUTTON' || tagName === 'INPUT' || tagName === 'TEXTAREA' || 
            tagName === 'VIDEO' || tagName === 'AUDIO' || tagName === 'IMG' || 
            tagName === 'SVG' || tagName === 'PATH' || tagName === 'SELECT' || tagName === 'LABEL') {
            return;
        }
        
        if (target.closest('a, button, [role="button"], .player-controls, .no-read')) {
            return;
        }

        const isSemantic = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE'].includes(tagName);
        
        let textToRead = "";
        let rangeToSelect = null;

        if (isSemantic) {
            textToRead = target.innerText;
            rangeToSelect = document.createRange();
            rangeToSelect.selectNodeContents(target);
        } else {
            const hitResult = this.getTextBlockFromPoint(e.clientX, e.clientY);
            
            if (hitResult) {
                textToRead = hitResult.text;
                rangeToSelect = hitResult.range;
            } else {
                if (target.innerText && target.innerText.length < 500) {
                    textToRead = target.innerText;
                    rangeToSelect = document.createRange();
                    rangeToSelect.selectNodeContents(target);
                }
            }
        }

        if (!textToRead || textToRead.trim().length < 2) return;

        removeHiglightOnPage();
        this.player.clearWordHighlights();

        let jumpIndex = -1;
        if (this.player.replayQueue && this.player.replayQueue.length > 0) {
            jumpIndex = this.findQueueIndexFromText(textToRead);
        }

        if (jumpIndex !== -1) {
            console.log(`🎯 Jump target found: Index ${jumpIndex}`);
            
            const feedbackTarget = isSemantic ? target : (rangeToSelect.commonAncestorContainer.parentElement || target);
            this.visualFeedbackOnJump(feedbackTarget);

            if (this.player.externalAudioSpeaking) {
                this.player.stopPlayingAudioInOffscreen();
            }
            
            this.player.currentAudioTime = 0;
            this.player.currentSentenceStartTime = null;
            window.getSelection().removeAllRanges();

            setTimeout(() => {
                this.player.playbackListNewStartQueue(jumpIndex);
                this.player.playbackListSelectOption(jumpIndex);
            }, 50);

        } else {
            console.log(`🆕 Starting fresh read using ${isSemantic ? 'Semantic' : 'Precision'} strategy`);
            
            this.player.stop(true, true); 
            this.player.currentAudioTime = 0; 
            
            window.getSelection().removeAllRanges();

            if (rangeToSelect) {
                window.getSelection().addRange(rangeToSelect);
            }

            if (window.VR_Reader && window.VR_Reader.readHighlightedText) {
                window.VR_Reader.readHighlightedTextSelection = textToRead;
                window.VR_Reader.readHighlightedText(textToRead);
                if (typeof window.VR_Reader.changeActiveVoice === 'function') {
                    window.VR_Reader.changeActiveVoice();
                }
            } else {
                chrome.runtime.sendMessage({
                    action: "readHighlightWithVRR",
                    selection: textToRead
                });
            }
        }
    }

    getTextBlockFromPoint(x, y) {
        if (document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(x, y);
            if (!range) return null;

            let node = range.startContainer;

            if (node.nodeType !== Node.TEXT_NODE) {
                if (node.childNodes[range.startOffset]) {
                    node = node.childNodes[range.startOffset];
                }
                if (node.nodeType !== Node.TEXT_NODE) return null; 
            }

            return this.expandToLogicalBlock(node);
        }
        return null;
    }

    expandToLogicalBlock(startNode) {
        const range = document.createRange();
        const blockTags = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'TR', 'TABLE', 'UL', 'OL', 'SECTION', 'ARTICLE', 'BLOCKQUOTE']);
        
        let start = startNode;
        let end = startNode;

        while (start.previousSibling) {
            const sib = start.previousSibling;
            
            if (sib.nodeName === 'BR') break;
            if (sib.nodeType === Node.ELEMENT_NODE && blockTags.has(sib.tagName)) break;
            
            start = sib;
        }

        while (end.nextSibling) {
            const sib = end.nextSibling;
            
            if (sib.nodeName === 'BR') break;
            if (sib.nodeType === Node.ELEMENT_NODE && blockTags.has(sib.tagName)) break;
            
            end = sib;
        }

        try {
            range.setStartBefore(start);
            range.setEndAfter(end);
            
            return {
                text: range.toString().trim(),
                range: range
            };
        } catch (e) {
            console.warn("Precision range creation failed", e);
            return null;
        }
    }

    findQueueIndexFromText(domText) {
        if (!domText) return -1;

        const cleanDomText = this.normalizeForMatching(domText);
        if (cleanDomText.length < 5) return -1;

        const domFingerprint = cleanDomText.substring(0, 60);

        for (let i = 0; i < this.player.replayQueue.length; i++) {
            const item = this.player.replayQueue[i];
            if (!item || !item.text) continue;

            const cleanQueueText = this.normalizeForMatching(item.text);
            if (cleanQueueText.length < 5) continue;

            if (cleanDomText.startsWith(cleanQueueText)) {
                return i;
            }
            
            if (cleanQueueText.startsWith(cleanDomText)) {
                return i;
            }

            if (cleanQueueText.includes(domFingerprint)) {
                if (cleanQueueText.indexOf(domFingerprint) < 150) {
                    return i;
                }
            }
        }

        const domStartSnippet = cleanDomText.substring(0, 200); 
        for (let i = 0; i < this.player.replayQueue.length; i++) {
            const item = this.player.replayQueue[i];
            if (!item || !item.text) continue;
            const cleanQueueText = this.normalizeForMatching(item.text);
            
            if (cleanQueueText.length > 10 && domStartSnippet.includes(cleanQueueText)) {
                return i;
            }
        }

        return -1;
    }

    normalizeForMatching(str) {
        return str.toLowerCase()
            .replace(/\[\d+\]/g, '')
            .replace(/\[edit\]/g, '')
            .replace(/['"“‘”’]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    toggleTextSelection(enable) {
        if (enable) {
            if (!this.listenerActive) {
                document.addEventListener('click', this.player.boundHandleTextElementClick);
                this.addClickableStyles();
                this.listenerActive = true;
                console.log("Text Selector: ENABLED");
            }
        } else {
            if (this.listenerActive) {
                document.removeEventListener('click', this.player.boundHandleTextElementClick);
                
                const styleTag = document.getElementById('vrrClickableStyles');
                if (styleTag) {
                    styleTag.remove();
                }
                
                this.listenerActive = false;
                console.log("Text Selector: DISABLED");
            }
        }
    }

    addClickableStyles() {
        if (document.getElementById('vrrClickableStyles')) return;

        const style = document.createElement('style');
        style.id = 'vrrClickableStyles';
        style.textContent = `
            article p, article li, article h1, article h2, article h3, article h4,
            main p, main li, main h1, main h2, main h3, main h4,
            .prose p, .prose li,
            blockquote, 
            div[class*="post-body"], div[class*="message-content"], 
            div[class*="comment-body"], div.text-content {
                cursor: pointer; 
                border-radius: 3px;
                transition: background-color 0.1s ease;
            }
            
            p:hover, li:hover, h1:hover, h2:hover, h3:hover, blockquote:hover {
                background-color: rgba(121, 156, 255, 0.15) !important;
                box-shadow: 0 0 0 2px rgba(121, 156, 255, 0.05);
            }

            @media (prefers-color-scheme: dark) {
                p:hover, li:hover, h1:hover, h2:hover, h3:hover, blockquote:hover {
                    background-color: rgba(255, 255, 255, 0.08) !important;
                }
            }

            @keyframes vrr-flash {
                0% { background-color: rgba(255, 223, 0, 0.4); }
                100% { background-color: transparent; }
            }
            .vrr-jump-flash {
                animation: vrr-flash 0.8s ease-out;
                border-radius: 3px;
            }
        `;
        document.head.appendChild(style);
    }

    visualFeedbackOnJump(element) {
        element.classList.remove('vrr-jump-flash');
        void element.offsetWidth;
        element.classList.add('vrr-jump-flash');
    }
}
