// CommentModal.js

import {
    saveToLocalStorage,
    readLocalStorage
} from "../../utils/helpers";

import {
    getOpenGraphImageWithFallbacks
} from "../../utils/opengraph.js";

import {
    APP_WEB_DOMAIN
} from "../../background/config.js";

export default class CommentModal {
    constructor({
        voice,
        replayQueue,
        audioBlockRange,
        existingRating = 0,
        existingComment = '',
        existingAudioUrl = null,
        existingPageSourceCheck = true,
        existingReviewType = 'content',
        canRateVoice = true,
        loadPreference = true, // ADD THIS (Defaults to true)
        onClose
    }) {
        this.canRateVoice = canRateVoice;
        this.loadPreference = loadPreference; // ADD THIS

        this.shadow = null;
        this.voice = voice;
        this.replayQueue = replayQueue;
        this.audioBlockRange = audioBlockRange;
        this.communicationHelper = VR_Reader;
        this.onClose = onClose;

        this.rating = existingRating;
        this.comment = existingComment;
        this.existingAudioUrl = existingAudioUrl;

        this.canChangeRating = this.rating === 0;

        this.mergedAudioBlob = null;
        this.audioBlobURL = null;
        this.isPlaying = false;
        this.isLoadingAudio = true;
        this.isSubmitting = false;

        this.saveButtonPressed = false;

        // Review type (voice or content)
        this.reviewType = canRateVoice ? existingReviewType : 'content';

        // Content Echo reaction (1-5 or null)
        this.echoReaction = existingRating >= 1 && existingRating <= 5 ? existingRating : null;

        // Include source toggle
        this.showPageSource = existingPageSourceCheck;

        // Offscreen audio state tracking
        this.currentTime = 0;
        this.duration = 0;
        this.updateTimeInterval = null;

        // State for comments section
        this.recentComments = [];
        this.isLoadingComments = true;

        // --- FIXED: Context Tracking ---
        this.lastActiveSource = null; // 'main' or 'comment'

        this.activeCommentPlayer = {
            id: null,
            audioBlobURL: null,
            isPlaying: false
        };

        // Sentence selection state
        this.isEditingLength = false;
        this.tempSelectedStartIndex = audioBlockRange.start;
        this.tempSelectedEndIndex = audioBlockRange.end;
        this.isReloadingAudioAfterSave = false;

        // Echo info collapsed state
        this.echoInfoCollapsed = true;

        // Unique IDs for this modal's audio callbacks
        this.modalId = `modal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.mainAudioCallbacks = {
            onPlay: `${this.modalId}_main_play`,
            onTimeUpdate: `${this.modalId}_main_timeupdate`,
            onEnded: `${this.modalId}_main_ended`,
            onLoadedMetadata: `${this.modalId}_main_metadata`
        };
        this.commentAudioCallbacks = new Map();
    }

    initShadowDOM(shadowDomDiv) {
        this.shadow = shadowDomDiv.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        // ... (Styles remain exactly the same as previous version)
        style.textContent = `
        * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                    font-family: sans-serif;
            }
            :host {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            .modal-backdrop {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background-color: rgba(0, 0, 0, 0.6); z-index: 10000000000;
                display: flex; align-items: center; justify-content: center;
            }
            .modal-content {
                background: #fff; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                width: 95vw; max-width: 1100px; display: grid; grid-template-columns: 1fr;
                min-height: 400px;
            }
            @media (min-width: 768px) {
                .modal-content { grid-template-columns: 1fr 1fr; min-height: 500px; }
            }

            .left-panel { padding: 24px; border-bottom: 1px solid #e5e7eb; }
            .right-panel { padding: 24px; overflow-y: auto; max-height: 80vh; display: flex; flex-direction: column; }
            @media (min-width: 768px) {
                .left-panel { border-right: 1px solid #e5e7eb; border-bottom: none; }
                .right-panel { max-height: calc(100vh - 100px); }
            }

            .right-panel-content { flex: 1; overflow-y: auto; }
            .right-panel-audio { margin-top: auto; padding-top: 16px; border-top: 1px solid #e5e7eb; transition: opacity 0.3s, max-height 0.3s; overflow: hidden; }
            .right-panel-audio.hidden { opacity: 0; max-height: 0; padding-top: 0; border-top: none; pointer-events: none; }

            .modal-close-btn {
                position: absolute; top: 16px; right: 16px; background: none;
                border: none; cursor: pointer; font-size: 24px; color: #888;
            }

            h2 { font-size: 20px; font-weight: 600; color: #111827; margin-bottom: 20px; }
            .stars-container { display: flex; gap: 5px; margin-bottom: 20px; }
            .star-btn { background:none; border:none; padding:0; cursor:pointer; }
            .star-btn:disabled { cursor: default; opacity: 0.7; }
            .star-btn svg { width: 28px; height: 28px; transition: all 0.2s; }
            .star-empty { fill: #d1d5db; }
            .star-filled { fill: #f59e0b; }
            

           /* ADD THIS NEW STYLE FOR READ MORE BUTTON */
            .read-more-btn {
                color: #4f46e5;
                cursor: pointer;
                font-weight: 500;
                margin-left: 4px;
            }
            .read-more-btn:hover {
                text-decoration: underline;
            }

            .review-type-selector {
                margin-bottom: 20px;
                display: flex;
                gap: 8px;
                background: #f3f4f6;
                padding: 4px;
                border-radius: 8px;
            }
            .review-type-btn {
                flex: 1;
                padding: 8px 16px;
                border: none;
                background: transparent;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                color: #6b7280;
                transition: all 0.2s;
                display: flex;           /* Added */
                align-items: center;     /* Added */
                justify-content: center; /* Added */
                gap: 8px;    
            }


            .review-type-btn svg {
                width: 16px;
                height: 16px;
                opacity: 0.8;
            }

            .review-type-btn:hover {
                background: #e5e7eb;
            }
            .review-type-btn.active {
                background: white;
                color: #4f46e5;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }

            .review-type-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .review-type-btn[disabled]:hover {
                background: transparent;
            }

            .review-type-btn[disabled][data-tooltip]::after {
                content: attr(data-tooltip);
                position: absolute;
                bottom: calc(100% + 8px);
                left: 50%;
                transform: translateX(-50%);
                background: #111827;
                color: #fff;
                font-size: 12px;
                padding: 6px 12px;
                border-radius: 6px;
                white-space: nowrap;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s;
                z-index: 1000;
            }

            .review-type-btn[disabled]:hover::after {
                opacity: 1;
            }

            
            /* Echo Reactions */
            .reactions-container {
                margin-bottom: 20px;
            }
            .reactions-title {
                font-size: 14px;
                font-weight: 500;
                color: #374151;
                margin-bottom: 12px;
            }
            .reactions-list {
                display: flex;
                gap: 7px;
                flex-flow: row-reverse;
            }
            .reaction-item {
                display: flex;
                align-items: center;
                gap: 0px;
                padding: 1px;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                background: white;
            }
            .reaction-item:hover {
                border-color: #d1d5db;
                background: #f9fafb;
            }
            .reaction-item.selected {
                border-color: #4f46e5;
                background: #eff6ff;
            }
            .reaction-radio {
                width: 18px;
                height: 18px;
                cursor: pointer;
                flex-shrink: 0;
                display:none;
            }
            .reaction-emoji {
                font-size: 20px;
                flex-shrink: 0;
            }
            .reaction-label {
                font-size: 14px;
                color: #374151;
                font-weight: 500;
                white-space: nowrap;
                padding-right: 4px;
            }
            
            /* Source checkbox */
            .source-checkbox-container {
                margin-top: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .source-checkbox {
                width: 16px;
                height: 16px;
                cursor: pointer;
            }
            .source-checkbox-label {
                font-size: 14px;
                color: #374151;
                cursor: pointer;
            }
            .source-domain {
                color: #6b7280;
                font-weight: 400;
            }

            @keyframes spin {
                to {
                    transform: rotate(360deg);
                }
            }
            .animate-spin {
                animation: spin 1s linear infinite;
            }

            .play-btn svg {
                pointer-events: none;
            }
            
            label { font-weight: 500; color: #374151; display: block; margin-bottom: 8px; }
            textarea { width: 100%; height: 105px; border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; font-size: 14px; resize: vertical; }
            .submit-btn { width: 100%; padding: 12px; border: none; border-radius: 8px; background-color: #4f46e5; color: white; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 20px; transition: background-color 0.2s; }
            .submit-btn:hover:not(:disabled) { background-color: #4338ca; }
            .submit-btn:disabled { background-color: #a5b4fc; cursor: not-allowed; }

            .audio-player { margin-top: 24px; display: flex; align-items: center; gap: 12px; }
            .play-btn { width: 40px; height: 40px; border-radius: 50%; border: none; background: #4f46e5; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
            .waveform-placeholder { flex-grow: 1; height: 40px; background: #f3f4f6; border-radius: 4px; display:flex; align-items:center; justify-content:center; gap:8px; color:#9ca3af; font-size:12px;}
            .edit-length-btn { background: #4f46e5; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; }
            .edit-length-btn:hover { background: #4338ca; }
            .time-display { font-size: 14px; color: #6b7280; font-family: monospace; }
            
            /* Sentence Selection View */
            .sentence-selection-view {
                display: flex;
                flex-direction: column;
                height: 100%;
            }
            .selection-header {
                padding: 0 0 16px 0;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }
            .selection-title {
                font-size: 18px;
                font-weight: 600;
                color: #111827;
            }
            .selection-actions {
                display: flex;
                gap: 8px;
            }
            .selection-cancel-btn, .selection-save-btn {
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                border: none;
            }
            .selection-cancel-btn {
                background: #f3f4f6;
                color: #374151;
            }
            .selection-cancel-btn:hover {
                background: #e5e7eb;
            }
            .selection-save-btn {
                background: #4f46e5;
                color: white;
            }
            .selection-save-btn:hover {
                background: #4338ca;
            }
            .selection-save-btn:disabled {
                background: #a5b4fc;
                cursor: not-allowed;
            }
            .sentence-list {
                flex: 1;
                overflow-y: auto;
                padding: 0;
                max-height: 400px;
            }
            .sentence-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                margin-bottom: 8px;
                background: white;
                transition: background 0.2s;
            }
            .sentence-item:hover:not(.disabled) {
                background: #f9fafb;
            }
            .sentence-item.disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .sentence-item.selected {
                background: #eff6ff;
                border-color: #3b82f6;
            }
            .sentence-radio-group {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-shrink: 0;
            }
            .sentence-radio {
                width: 16px;
                height: 16px;
                cursor: pointer;
            }
            .sentence-radio:disabled {
                cursor: not-allowed;
            }
            .radio-label {
                font-size: 11px;
                color: #6b7280;
                font-weight: 500;
            }
            .sentence-index {
                font-size: 12px;
                font-weight: 600;
                color: #6b7280;
                min-width: 35px;
                flex-shrink: 0;
            }
            .sentence-text {
                flex: 1;
                font-size: 13px;
                color: #374151;
                line-height: 1.4;
            }
            .no-audio-badge {
                font-size: 10px;
                background: #fee2e2;
                color: #dc2626;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 500;
                flex-shrink: 0;
            }
            .selection-info {
                padding: 12px 0 0 0;
                background: #f9fafb;
                border-top: 1px solid #e5e7eb;
                font-size: 13px;
                color: #6b7280;
                text-align: center;
                margin-top: 12px;
            }
            .char-count {
                font-weight: 600;
                color: #111827;
            }
            .char-count.warning {
                color: #f59e0b;
            }

            .char-count.error {
                color: #dc2626;
                font-weight: 700;
            }


             /* ADD THE NEW, IMPROVED TOOLTIP STYLES */
            [data-tooltip] {
                position: relative; /* This is the anchor for the tooltip */
            }

            /* Tooltip bubble */
            [data-tooltip]::after {
                content: attr(data-tooltip);
                position: absolute;
                bottom: calc(100% + 12px); /* Position above the element */
                left: 0%;
                
                /* Start hidden */
                opacity: 0;
                pointer-events: none;
                transform: translate(-50%, 5px) scale(0.95); /* Start slightly down and scaled down */
                
                /* Appearance */
                background: #111827; /* A modern dark gray */
                color: #fff;
                font-size: 13px;
                font-weight: 500;
                padding: 8px 14px;
                border-radius: 8px;
                white-space: nowrap; /* Keep it on one line */
                box-shadow: 0 4px 12px rgba(0,0,0,0.25);
                
                /* Smooth transition */
                transition: opacity 0.2s ease-out, transform 0.2s ease-out;
                z-index: 1000;
            }

            [data-tooltip].continue-button::after {
                white-space: normal; /* CHANGED: Allow multi-line */
                width: 255px; /* ADD: Limit width */
            }

            
            /* Tooltip arrow */
            [data-tooltip]::before {
                content: '';
                position: absolute;
                bottom: calc(100% + 6px); /* Position between element and bubble */
                left: 50%;
                
                /* Start hidden */
                opacity: 0;
                pointer-events: none;
                transform: translate(-50%, 5px); /* Match the bubble's transform */
                
                /* Arrow shape */
                border-left: 6px solid transparent;
                border-right: 6px solid transparent;
                border-top: 6px solid #111827; /* Match bubble background */
                
                /* Smooth transition */
                transition: opacity 0.2s ease-out, transform 0.2s ease-out;
                z-index: 1001;
            }

            /* Show on hover */
            [data-tooltip]:hover::after,
            [data-tooltip]:hover::before {
                opacity: 1;
                transform: translate(0%, 0) scale(1); /* Move to final position */
            }

            
            /* --- Comments Section Styles --- */
            .comments-list { display: flex; flex-direction: column; gap: 20px; }
            .comment-item { padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; background: #f9fafb; }
            .comment-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
            .comment-meta { display: flex; flex-direction: column; gap: 2px; }
            .comment-date { font-size: 12px; color: #6b7280; }
            .comment-username { font-size: 14px; font-weight: 600; color: #111827; }
            .comment-rating { display: flex; gap: 2px; align-items: center; }
            .comment-star { width: 14px; height: 14px; color: #d1d5db; }
            .comment-star.filled { color: #f59e0b; }
            .review-type-badge {
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;
                margin-left: 6px;
            }
            .review-type-badge.voice {
                background: #dbeafe;
                color: #1e40af;
            }
            .review-type-badge.content {
                background: #fef3c7;
                color: #92400e;
            }
            .speech-excerpt { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding: 8px; background: white; border-radius: 6px; border: 1px solid #e5e7eb; }
            .comment-play-btn { width: 24px; height: 24px; border-radius: 50%; background: #4f46e5; color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
            .comment-play-btn svg { width: 12px; height: 12px; }
            .speech-text { font-size: 12px; color: #6b7280; flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
            .comment-timer { font-size: 11px; color: #9ca3af; font-family: monospace; min-width: 60px; text-align: right; }
            .comment-text { font-size: 14px; color: #374151; line-height: 1.4; margin: 0; word-break: break-word; }
            .comment-footer { margin-top: 8px; }
            .comment-link { display: inline-block; font-size: 12px; color: #4f46e5; text-decoration: none; }
            .comment-link:hover { text-decoration: underline; }
            .view-ratings-link {
                display: inline-block;
                margin-left: 8px;
                font-size: 13px;
                color: #4f46e5;
                text-decoration: none;
                font-weight: 500;
            }
            .view-ratings-link:hover { text-decoration: underline; }
            .loading-text, .empty-text { text-align: center; color: #6b7280; padding: 32px 0; }
            
            /* Echo Info */
            .echo-info {
                padding: 20px;
                background: #f9fafb;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
            }
            .echo-info h3 {
                font-size: 16px;
                font-weight: 600;
                color: #111827;
                margin-bottom: 12px;
            }
            .echo-info p {
                font-size: 14px;
                color: #6b7280;
                line-height: 1.6;
                margin-bottom: 10px;
            }
            .echo-info ul {
                list-style: none;
                padding: 0;
                margin: 12px 0;
            }
            .echo-info li {
                font-size: 13px;
                color: #374151;
                padding: 6px 0;
                padding-left: 20px;
                position: relative;
            }
            .echo-info li:before {
                content: "•";
                position: absolute;
                left: 8px;
                color: #4f46e5;
                font-weight: bold;
            }

            /* Audio Clip Text Section */
            .clip-text-section {
                margin-top: 20px;
                padding: 16px;
                background: #f9fafb;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
            }
            .clip-text-header {
                font-size: 14px;
                font-weight: 600;
                color: #374151;
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .clip-text-content {
                font-size: 13px;
                color: #6b7280;
                line-height: 1.5;
                max-height: 150px;
                overflow-y: auto;
                padding: 8px;
                background: white;
                border-radius: 6px;
                border: 1px solid #e5e7eb;
            }
            .clip-text-range {
                font-size: 11px;
                color: #9ca3af;
                font-weight: 500;
            }

            /* Collapsible Echo Info */
            .echo-info-toggle {
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
                padding: 8px 0;
                user-select: none;
            }
            .echo-info-toggle:hover {
                color: #4f46e5;
            }
            .echo-info-toggle svg {
                transition: transform 0.2s;
                flex-shrink: 0;
            }
            .echo-info-toggle.collapsed svg {
                transform: rotate(-90deg);
            }
            .echo-info-details {
                max-height: 500px;
                overflow: hidden;
                transition: max-height 0.3s ease-out, opacity 0.3s;
                opacity: 1;
            }
            .echo-info-details.collapsed {
                max-height: 0;
                opacity: 0;
            }

            /* Audio Generating Animation */
            .audio-generating-animation {
                flex-grow: 1;
                height: 40px;
                border-radius: 8px;
                overflow: hidden;
                position: relative;
                background: linear-gradient(90deg, #e0e7ff 0%, #c7d2fe 25%, #a5b4fc 50%, #c7d2fe 75%, #e0e7ff 100%);
                background-size: 200% 100%;
                animation: shimmer 2s ease-in-out infinite;
            }
            @keyframes shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            .audio-generating-animation::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
                animation: wave 1.5s ease-in-out infinite;
            }
            @keyframes wave {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            .audio-generating-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 12px;
                font-weight: 600;
                color: #4f46e5;
                white-space: nowrap;
                z-index: 1;
            }
            .audio-generating-bars {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                display: flex;
                gap: 3px;
                align-items: center;
                height: 20px;
                z-index: 1;
            }
            .audio-generating-bars span {
                display: block;
                width: 3px;
                background: #4f46e5;
                border-radius: 2px;
                animation: barPulse 1s ease-in-out infinite;
            }
            .audio-generating-bars span:nth-child(1) { height: 8px; animation-delay: 0s; }
            .audio-generating-bars span:nth-child(2) { height: 14px; animation-delay: 0.1s; }
            .audio-generating-bars span:nth-child(3) { height: 20px; animation-delay: 0.2s; }
            .audio-generating-bars span:nth-child(4) { height: 14px; animation-delay: 0.3s; }
            .audio-generating-bars span:nth-child(5) { height: 8px; animation-delay: 0.4s; }
            @keyframes barPulse {
                0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
                50% { transform: scaleY(1); opacity: 1; }
            }
        `;
        this.shadow.appendChild(style);
    }

    // ... (Helper methods: _blobToBase64, _base64ToBlobObject, _getSelectableSentences, _calculateSelectedCharCount, _openSentenceSelection, _closeSentenceSelection, _renderSentenceSelection, _updateSelectionView, _hideSentenceSelection remain the same)

    _blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    _base64ToBlobObject(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
            const slice = byteCharacters.slice(offset, offset + 1024);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            byteArrays.push(new Uint8Array(byteNumbers));
        }
        return new Blob(byteArrays, { type: mimeType });
    }

    _getSelectableSentences() {
        const endIndex = this.replayQueue.length - 1;
        const sentences = [];
        let hasGapFromEnd = false;

        const tempSentences = [];
        for (let i = endIndex; i >= 0; i--) {
            const clip = this.replayQueue[i];
            if (!clip || !clip.text) {
                continue;
            }

            const hasAudio = clip.audioData !== null && clip.audioData !== undefined;

            if (!hasAudio) {
                hasGapFromEnd = true;
            }

            tempSentences.unshift({
                index: i,
                text: clip.text,
                hasAudio: hasAudio,
                canSelectAsEnd: hasAudio && !hasGapFromEnd,
                charLength: clip.text.length
            });
        }

        let hasGapFromStart = false;
        for (let i = 0; i < tempSentences.length; i++) {
            const sentence = tempSentences[i];

            if (!sentence.hasAudio) {
                hasGapFromStart = true;
            }

            sentence.canSelectAsStart = sentence.hasAudio && !hasGapFromStart;

            sentences.push(sentence);
        }

        return sentences;
    }

    _calculateSelectedCharCount() {
        let count = 0;
        for (let i = this.tempSelectedStartIndex; i <= this.tempSelectedEndIndex; i++) {
            const clip = this.replayQueue[i];
            if (clip && clip.text) {
                count += clip.text.length;
            }
        }
        return count;
    }

    _openSentenceSelection() {
        this.isEditingLength = true;
        this.tempSelectedStartIndex = this.audioBlockRange.start;
        this.tempSelectedEndIndex = this.audioBlockRange.end;
        const audioSection = this.shadow.querySelector('.right-panel-audio');
        if (audioSection) audioSection.classList.add('hidden');
        this._renderSentenceSelection();
    }

    _closeSentenceSelection(save = false) {
        if (save && (this.tempSelectedStartIndex !== this.audioBlockRange.start ||
            this.tempSelectedEndIndex !== this.audioBlockRange.end)) {
            // Update the audio block range
            this.audioBlockRange.start = this.tempSelectedStartIndex;
            this.audioBlockRange.end = this.tempSelectedEndIndex;

            // Stop current audio
            this._stopMainAudio();

            // Reload audio with new range
            this.isLoadingAudio = true;
            this.isReloadingAudioAfterSave = true;
            if (this.audioBlobURL) {
                URL.revokeObjectURL(this.audioBlobURL);
                this.audioBlobURL = null;
            }
            this.mergedAudioBlob = null;
            this.currentTime = 0;
            this.duration = 0;

            this._updatePlayerUI();
            this._updateSubmitButton();
            this._loadAudio();
        }

        this.isEditingLength = false;
        this._hideSentenceSelection();
        const audioSection = this.shadow.querySelector('.right-panel-audio');
        if (audioSection) audioSection.classList.remove('hidden');
        this._renderCommentsList();
        this._updateSubmitButton();
    }

    _renderSentenceSelection() {
        const sentences = this._getSelectableSentences();
        const charCount = this._calculateSelectedCharCount();

        let charCountClass = '';
        if (charCount > 900) charCountClass = 'warning';
        if (charCount > 1000) charCountClass = 'error';

        const rightPanelContent = this.shadow.querySelector('.right-panel-content');
        if (!rightPanelContent) return;

        rightPanelContent.innerHTML = `
            <div class="selection-header">
                <div class="selection-title">Select Audio Length</div>
                <div class="selection-actions">
                    <button class="selection-cancel-btn">Cancel</button>
                    <button class="selection-save-btn" ${charCount > 2000 ? 'disabled' : ''}>Save Changes</button>
                </div>
            </div>
            <div class="sentence-list">
                ${sentences.map(sentence => {
            const isCurrentStart = sentence.index === this.tempSelectedStartIndex;
            const isCurrentEnd = sentence.index === this.tempSelectedEndIndex;
            const isSelected = sentence.index >= this.tempSelectedStartIndex && sentence.index <= this.tempSelectedEndIndex;
            const itemClass = `sentence-item ${!sentence.canSelectAsStart && !sentence.canSelectAsEnd ? 'disabled' : ''} ${isSelected ? 'selected' : ''}`;

            return `
                        <div class="${itemClass}" data-index="${sentence.index}">
                            <div class="sentence-radio-group">
                                <div style="display: flex; flex-direction: column; gap: 2px;">
                                    <input type="radio" 
                                        class="sentence-radio sentence-radio-start" 
                                        name="sentence-start" 
                                        value="${sentence.index}"
                                        ${!sentence.hasAudio ? 'disabled' : ''}
                                        ${isCurrentStart ? 'checked' : ''}
                                        data-index="${sentence.index}">
                                    <label class="radio-label">Start</label>
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 2px;">
                                    <input type="radio" 
                                        class="sentence-radio sentence-radio-end" 
                                        name="sentence-end" 
                                        value="${sentence.index}"
                                        ${!sentence.hasAudio ? 'disabled' : ''}
                                        ${isCurrentEnd ? 'checked' : ''}
                                        data-index="${sentence.index}">
                                    <label class="radio-label">End</label>
                                </div>
                            </div>
                            <div class="sentence-index">#${sentence.index}</div>
                            <div class="sentence-text" title="${sentence.text.replace(/"/g, '&quot;')}">${sentence.text}</div>
                            ${!sentence.hasAudio ? '<span class="no-audio-badge">No Audio</span>' : ''}
                        </div>
                    `;
        }).join('')}
            </div>
            <div class="selection-info">
                Selected range: <strong>#${this.tempSelectedStartIndex} - #${this.tempSelectedEndIndex}</strong> 
                (<span class="char-count ${charCountClass}">${charCount}</span> characters)
                ${charCount > 2000 ? '<div style="color: #dc2626; font-size: 12px; margin-top: 4px;">Maximum 2000 characters allowed</div>' : ''}
            </div>
        `;

        // Add event listeners
        this.shadow.querySelector('.selection-cancel-btn').addEventListener('click', () => {
            this._closeSentenceSelection(false);
        });

        this.shadow.querySelector('.selection-save-btn').addEventListener('click', () => {
            this._closeSentenceSelection(true);
        });

        // Handle start radio button changes
        this.shadow.querySelectorAll('.sentence-radio-start').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    const newStart = parseInt(e.target.dataset.index, 10);
                    // Ensure start doesn't go past end
                    if (newStart <= this.tempSelectedEndIndex) {
                        this.tempSelectedStartIndex = newStart;
                        this._updateSelectionView();
                    } else {
                        // Reset radio if invalid
                        e.target.checked = false;
                        this.shadow.querySelector(`.sentence-radio-start[data-index="${this.tempSelectedStartIndex}"]`).checked = true;
                    }
                }
            });
        });

        // Handle end radio button changes
        this.shadow.querySelectorAll('.sentence-radio-end').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    const newEnd = parseInt(e.target.dataset.index, 10);
                    // Ensure end doesn't go before start
                    if (newEnd >= this.tempSelectedStartIndex) {
                        this.tempSelectedEndIndex = newEnd;
                        this._updateSelectionView();
                    } else {
                        // Reset radio if invalid
                        e.target.checked = false;
                        this.shadow.querySelector(`.sentence-radio-end[data-index="${this.tempSelectedEndIndex}"]`).checked = true;
                    }
                }
            });
        });
    }

    _updateSelectionView() {
        const charCount = this._calculateSelectedCharCount();

        let charCountClass = '';
        if (charCount > 900) charCountClass = 'warning';
        if (charCount > 1000) charCountClass = 'error';

        // Update character count
        const infoDiv = this.shadow.querySelector('.selection-info');
        if (infoDiv) {
            infoDiv.innerHTML = `
                Selected range: <strong>#${this.tempSelectedStartIndex} - #${this.tempSelectedEndIndex}</strong> 
                (<span class="char-count ${charCountClass}">${charCount}</span> characters)
            `;
        }

        // Update selected state on items
        this.shadow.querySelectorAll('.sentence-item').forEach(item => {
            const index = parseInt(item.dataset.index, 10);
            const isSelected = index >= this.tempSelectedStartIndex && index <= this.tempSelectedEndIndex;
            item.classList.toggle('selected', isSelected);
        });

        // Dynamically enable/disable radio buttons based on current selection
        this.shadow.querySelectorAll('.sentence-radio-start').forEach(radio => {
            const index = parseInt(radio.dataset.index, 10);
            const sentence = this._getSelectableSentences().find(s => s.index === index);

            // Start can't be greater than current end
            if (sentence && sentence.hasAudio && index <= this.tempSelectedEndIndex) {
                radio.disabled = false;
            } else {
                radio.disabled = true;
            }
        });

        this.shadow.querySelectorAll('.sentence-radio-end').forEach(radio => {
            const index = parseInt(radio.dataset.index, 10);
            const sentence = this._getSelectableSentences().find(s => s.index === index);

            // End can't be less than current start
            if (sentence && sentence.hasAudio && index >= this.tempSelectedStartIndex) {
                radio.disabled = false;
            } else {
                radio.disabled = true;
            }
        });

        // Disable/enable save button based on character count
        const saveBtn = this.shadow.querySelector('.selection-save-btn');
        if (saveBtn) {
            saveBtn.disabled = charCount > 2000;
        }

        // Update submit button state for unsaved changes
        this._updateSubmitButton();
    }

    _hideSentenceSelection() {
        // Selection view is now rendered in right-panel-content, no need to remove overlay
    }

    async _loadAudio() {
        // --- FIXED: Metadata loading hacks the audio element, so stop any playing comments first ---
        this._resetActiveCommentPlayer();

        if (this.existingAudioUrl) {
            try {
                const response = await fetch(this.existingAudioUrl);
                const blob = await response.blob();
                this.audioBlobURL = URL.createObjectURL(blob);
                this._setupMainAudioCallbacks();
                this._loadAudioMetadata();
            } catch (error) {
                console.error('Failed to load existing audio:', error);
            }
            this.isLoadingAudio = false;
            this.isReloadingAudioAfterSave = false;
            this._updatePlayerUI();
            this._updateSubmitButton();
            return;
        }

        const audioDataUris = this.replayQueue
            .slice(this.audioBlockRange.start, this.audioBlockRange.end + 1)
            .map(clip => clip && clip.audioData ? (clip.audioData.startsWith('data:') ? clip.audioData : `data:audio/mp3;base64,${clip.audioData}`) : null)
            .filter(Boolean);

        if (audioDataUris.length === 0) {
            this.isLoadingAudio = false;
            this.isReloadingAudioAfterSave = false;
            this._updatePlayerUI();
            this._updateSubmitButton();
            return;
        }

        const requestID = `merge_audio_${Date.now()}`;
        const callbackID = `callback_${requestID}`;

        this.communicationHelper.saveRequest(callbackID, (response) => {
            if (response && response.audioData) {
                const base64Only = response.audioData.includes(',') ? response.audioData.split(',')[1] : response.audioData;
                const blob = this._base64ToBlobObject(base64Only, 'audio/mpeg');
                this.mergedAudioBlob = blob;
                this.audioBlobURL = URL.createObjectURL(blob);
                this._setupMainAudioCallbacks();
                this._loadAudioMetadata();
            } else {
                console.error("Audio merging failed:", response);
            }
            this.isLoadingAudio = false;
            this.isReloadingAudioAfterSave = false;
            this._updatePlayerUI();
            this._updateSubmitButton();
        });

        chrome.runtime.sendMessage({
            action: "mergeAudioClips",
            callbackID,
            payload: { audioDataUris }
        });
    }

    _setupMainAudioCallbacks() {
        const registerOnPlay = () => {
            VR_Reader.saveRequest(this.mainAudioCallbacks.onPlay, () => {
                this.isPlaying = true;
                this._updatePlayerUI();
                registerOnPlay(); // re-register because completeRequest deletes it
            });
        };
        registerOnPlay();

        VR_Reader.saveRequest(this.mainAudioCallbacks.onTimeUpdate, (data) => {
            this.currentTime = data.currentTime || 0;
            this.duration = data.duration || 0;
            this._updatePlayerUI();
        });

        const registerOnEnded = () => {
            VR_Reader.saveRequest(this.mainAudioCallbacks.onEnded, () => {
                this.isPlaying = false;
                this.currentTime = 0;
                this._updatePlayerUI();
                registerOnEnded();
            });
        };
        registerOnEnded();

        VR_Reader.saveRequest(this.mainAudioCallbacks.onLoadedMetadata, (data) => {
            console.log("metadata", data)
            this.duration = data.duration || 0;
            this._updatePlayerUI();
        });
    }

    _loadAudioMetadata() {
        if (!this.audioBlobURL) return;

        chrome.runtime.sendMessage({
            action: "load-audio-metadata",
            target: 'offscreen',
            tabId: VR_Reader.currentTabId,
            data: {
                audioBlobURL: this.audioBlobURL,
                index: 0,
                onLoadedMetadataCallbackID: this.mainAudioCallbacks.onLoadedMetadata,
                tabId: VR_Reader.currentTabId
            }
        });
    }

    _togglePlay() {
        if (this.isLoadingAudio || !this.audioBlobURL) return;

        if (this.isPlaying) {
            this._pauseMainAudio();
        } else {
            this._playMainAudio();
        }
    }

    _playMainAudio() {
        if (!this.audioBlobURL) return;

        // --- FIXED: Context Switching & Stop Comments ---
        // 1. Stop any comment that might be playing
        this._resetActiveCommentPlayer();

        // 2. If the last thing we played was a comment, we MUST use 'play-audio' (re-load blob)
        //    instead of 'resume-audio' because the background player holds the comment blob.
        const forceReload = this.lastActiveSource === 'comment';
        this.lastActiveSource = 'main';

        if (!forceReload && this.currentTime > 0 && !this.isPlaying) {
            chrome.runtime.sendMessage({
                action: "resume-audio",
                target: 'offscreen',
                tabId: VR_Reader.currentTabId
            });
            this.isPlaying = true;
            this._updatePlayerUI();
        } else {
            chrome.runtime.sendMessage({
                action: "play-audio",
                target: 'offscreen',
                tabId: VR_Reader.currentTabId,
                data: {
                    audioBlobURL: this.audioBlobURL,
                    index: 0,
                    ignoreFirstQueue: false, // Normal play
                    onPlayCallbackID: this.mainAudioCallbacks.onPlay,
                    onTimeUpdateCallbackID: this.mainAudioCallbacks.onTimeUpdate,
                    onEndedCallbackID: this.mainAudioCallbacks.onEnded,
                    tabId: VR_Reader.currentTabId
                }
            });
        }
    }

    _pauseMainAudio() {
        chrome.runtime.sendMessage({
            action: "pause-audio",
            target: "offscreen",
            tabId: VR_Reader.currentTabId
        });
        this.isPlaying = false;
        this._updatePlayerUI();
    }

    _stopMainAudio() {
        chrome.runtime.sendMessage({
            action: "stop-audio",
            target: "offscreen",
            tabId: VR_Reader.currentTabId
        });
        this.isPlaying = false;
        this.currentTime = 0;
        this._updatePlayerUI();
    }

    _formatTime(seconds) {
        const floor = Math.floor(seconds);
        if (isNaN(floor)) return '0:00';
        const min = Math.floor(floor / 60);
        const sec = floor % 60;
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }

    _updatePlayerUI() {
        const playBtn = this.shadow.querySelector('.play-btn');
        const playIcon = this.shadow.querySelector('.play-icon');
        const timeDisplay = this.shadow.querySelector('.time-display');
        const waveformPlaceholder = this.shadow.querySelector('.waveform-placeholder');

        if (!playBtn || !timeDisplay) return;

        playBtn.classList.toggle('loading', this.isLoadingAudio);
        playBtn.disabled = this.isLoadingAudio;

        if (this.isLoadingAudio) {
            playIcon.innerHTML = `
            <svg class="animate-spin mx-auto" style="color:#bdbdbd;display:block;" height="24" width="24" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>`;
            if (waveformPlaceholder) {
                waveformPlaceholder.innerHTML = `
                    <div class="audio-generating-animation">
                        <div class="audio-generating-bars">
                            <span></span><span></span><span></span><span></span><span></span>
                        </div>
                    </div>
                `;
            }
        } else if (!this.audioBlobURL) {
            if (waveformPlaceholder) {
                waveformPlaceholder.innerHTML = 'Audio unavailable';
            }
            playIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" style="display:block;" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>`;
        } else {
            if (waveformPlaceholder && !this.isEditingLength) {
                waveformPlaceholder.innerHTML = '<button class="edit-length-btn">Edit Length</button>';
                const editBtn = waveformPlaceholder.querySelector('.edit-length-btn');
                if (editBtn) {
                    editBtn.addEventListener('click', () => this._openSentenceSelection());
                }
            }
            playIcon.innerHTML = this.isPlaying
                ? `<svg style="width:16px;height:16px;display:block;" viewBox="0 0 1025 1024"><path fill="currentColor" d="M896.428 1024h-128q-53 0-90.5-37.5t-37.5-90.5V128q0-53 37.5-90.5t90.5-37.5h128q53 0 90.5 37.5t37.5 90.5v768q0 53-37.5 90.5t-90.5 37.5zm-640 0h-128q-53 0-90.5-37.5T.428 896V128q0-53 37.5-90.5t90.5-37.5h128q53 0 90.5 37.5t37.5 90.5v768q0 53-37.5 90.5t-90.5 37.5z"/></svg>`
                : `<svg style="width:24px;height:24px;display:block;" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>`;
        }

        if (this.audioBlobURL) {
            const currentTimeText = this._formatTime(this.currentTime);
            const durationText = this._formatTime(this.duration);
            timeDisplay.textContent = `${currentTimeText} / ${durationText}`;
        }
    }

    _updateStars(hoverIndex = 0) {
        const starButtons = this.shadow.querySelectorAll('.star-btn');
        const activeRating = (this.canChangeRating && hoverIndex) ? hoverIndex : this.rating;

        starButtons.forEach((button, index) => {
            const star = button.querySelector('svg');
            button.disabled = !this.canChangeRating;
            star.classList.toggle('star-filled', index < activeRating);
            star.classList.toggle('star-empty', index >= activeRating);
        });
    }

    // ... (_updateReviewTypeButtons, _updateReactionsUI, _getDomain, _showShareEchoPrompt, _handleSubmit, _handleApiResponse, _updateSubmitButton, _fetchRecentComments, _renderCommentsList, _createCommentHTML remain the same)

    _updateReviewTypeButtons() {
        const voiceBtn = this.shadow.querySelector('.review-type-btn[data-type="voice"]');
        const contentBtn = this.shadow.querySelector('.review-type-btn[data-type="content"]');

        if (voiceBtn && contentBtn) {
            voiceBtn.classList.toggle('active', this.reviewType === 'voice');
            contentBtn.classList.toggle('active', this.reviewType === 'content');
        }
    }

    _updateReactionsUI() {
        const reactionItems = this.shadow.querySelectorAll('.reaction-item');
        reactionItems.forEach(item => {
            const value = parseInt(item.dataset.value, 10);
            const radio = item.querySelector('.reaction-radio');
            const isSelected = this.echoReaction === value;

            item.classList.toggle('selected', isSelected);
            if (radio) {
                radio.checked = isSelected;
            }
        });
    }

    _getDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace(/^www\./, '');
        } catch {
            return 'this page';
        }
    }

    _showShareEchoPrompt(shortId) {
        const echoUrl = `https://${APP_WEB_DOMAIN}/echo/${shortId}`;

        VR_Reader.makePrompt({
            posX: 10,
            posY: 10,
            action: 'vrr-theme',
            title: 'Share your voice echo',
            message: `Your voice echo has been created! Share it with others.`,
            cancel: { buttonText: 'Close' },
            actions: [
                {
                    buttonText: 'Copy Link',
                    callback: () => {
                        navigator.clipboard.writeText(echoUrl).then(() => {
                            VR_Reader.makeToast({
                                title: "Link copied!",
                                message: "Echo link copied to clipboard",
                                action: 'vrr-theme'
                            });
                        }).catch(err => {
                            console.error('Failed to copy link:', err);
                            VR_Reader.makeToast({
                                title: "Copy failed",
                                message: "Please copy the link manually",
                                action: 'vrr-theme-error'
                            });
                        });
                    }
                },
                {
                    buttonText: 'View Echo',
                    callback: () => {
                        window.open(echoUrl, '_blank');
                    }
                }
            ]
        });
    }

    async _handleSubmit() {
        if (this.isSubmitting) return;

        if (!VR_Reader.isUserLogged) {
            const userConfirmed = confirm("You need to log in to leave a comment. Would you like to sign in now?");

            if (userConfirmed) {
                chrome.runtime.sendMessage({
                    action: "open-sidepanel",
                    route: "/main-menu",
                    data: {
                        openLoginModal: true
                    }
                });
            }
            return;

        }

        if (!this.audioBlobURL && !this.existingAudioUrl) {
            alert("No audio available - Reviews and Echoes require audio");
            return;
        }

        if (this.reviewType === 'voice' && !this.canRateVoice) {
            VR_Reader.makeToast({
                title: "Action blocked",
                message: "Cannot submit a review for an altered voice.",
                action: 'vrr-theme-error'
            });
            return;
        }

        this.saveButtonPressed = true;

        const commentText = this.shadow.querySelector('textarea').value.trim();
        if (!commentText) {
            VR_Reader.makeToast({
                title: "Comment Required",
                message: "Please enter a comment before submitting.",
                action: 'vrr-theme-error'
            });
            return;
        }

        this.isSubmitting = true;
        this._updateSubmitButton();

        const audioBlockText = this.replayQueue.slice(this.audioBlockRange.start, this.audioBlockRange.end + 1).map(c => c.text).join(' ');
        const needsUpload = this.mergedAudioBlob && !this.existingAudioUrl;

        const ratingValue = this.reviewType === 'content' ? this.echoReaction : this.rating;

        if (needsUpload) {
            const audioBase64 = await this._blobToBase64(this.mergedAudioBlob);
            const callbackID = `upload_save_${Date.now()}`;
            this.communicationHelper.saveRequest(callbackID, this._handleApiResponse.bind(this));
            chrome.runtime.sendMessage({
                action: "uploadAudioAndSaveRating",
                callbackID,
                payload: {
                    voice: this.voice,
                    rating: ratingValue,
                    comment: commentText,
                    text: audioBlockText,
                    page_url: window.location.href,
                    page_title: document.title,
                    page_image: getOpenGraphImageWithFallbacks(),
                    audioBase64: audioBase64,
                    voice_review_type: this.reviewType,
                    showPageSource: this.showPageSource
                }
            });
        } else {
            const callbackID = `save_only_${Date.now()}`;
            this.communicationHelper.saveRequest(callbackID, this._handleApiResponse.bind(this));
            chrome.runtime.sendMessage({
                action: "saveVoiceRating",
                callbackID,
                payload: {
                    voice_speed: this.voice.voice_speed,
                    voice_id: this.voice.voice_id,
                    rating: ratingValue,
                    comment: commentText,
                    text: audioBlockText,
                    page_url: window.location.href,
                    page_title: document.title,
                    page_image: getOpenGraphImageWithFallbacks(),
                    voice_audio_url: this.existingAudioUrl,
                    voice_review_type: this.reviewType,
                    showPageSource: this.showPageSource
                }
            });
        }
    }

    _handleApiResponse(response) {
        this.isSubmitting = false;
        this._updateSubmitButton();
        if (response && response.status !== 'error') {
            const toastTitle = this.reviewType === 'content' ? "Echo created!" : "Feedback submitted!";
            VR_Reader.makeToast({ title: toastTitle, action: 'vrr-theme' });

            if (response.shortId) {
                this._showShareEchoPrompt(response.shortId);
            }

            this.close();

        } else {
            VR_Reader.makeToast({ title: "Submission Failed", message: response.message || "Please try again.", action: 'vrr-theme-error' });
        }
    }

    _updateSubmitButton() {
        const submitBtn = this.shadow.querySelector('.submit-btn');
        const textarea = this.shadow.querySelector('textarea');

        if (!submitBtn || !textarea) return;

        const hasComment = textarea.value.trim() !== '';
        const hasUnsavedSelection = this.isEditingLength &&
            (this.tempSelectedStartIndex !== this.audioBlockRange.start ||
                this.tempSelectedEndIndex !== this.audioBlockRange.end);

        const isVoiceReviewDisabled = this.reviewType === 'voice' && !this.canRateVoice;

        const isDisabled = this.isSubmitting ||
            !hasComment ||
            (this.reviewType === 'voice' && this.rating === 0 && this.canChangeRating) ||
            isVoiceReviewDisabled ||
            hasUnsavedSelection ||
            this.isReloadingAudioAfterSave;

        submitBtn.disabled = isDisabled;

        if (this.isSubmitting) {
            submitBtn.textContent = this.reviewType === 'content' ? 'Creating Echo...' : 'Submitting...';
        } else if (this.isReloadingAudioAfterSave) {
            submitBtn.textContent = this.reviewType === 'content' ? 'Creating Echo...' : 'Submitting...';
        } else if (hasUnsavedSelection) {
            submitBtn.textContent = this.reviewType === 'content' ? 'Create Echo (Unsaved changes)' : 'Submit Rating & Comment (Unsaved changes)';
        } else {
            submitBtn.textContent = this.reviewType === 'content' ? 'Create Echo' : 'Submit Rating & Comment';
        }
    }

    _fetchRecentComments() {
        this.isLoadingComments = true;
        this._renderCommentsList();

        const requestID = `get_comments_${Date.now()}`;
        const callbackID = `callback_${requestID}`;

        this.communicationHelper.saveRequest(callbackID, (response) => {
            if (response && response.ratingsList) {
                this.recentComments = response.ratingsList;
            } else {
                this.recentComments = [];
                console.error("Failed to fetch comments:", response);
            }
            this.isLoadingComments = false;
            this._renderCommentsList();
        });

        chrome.runtime.sendMessage({
            action: "getVoiceRatingsList",
            callbackID,
            payload: { voice_id: this.voice.voice_id }
        });
    }

    _renderCommentsList() {
        const container = this.shadow.querySelector('.right-panel-content');
        if (!container) return;

        if (this.reviewType === 'content') {
            const clipText = this.replayQueue.slice(this.audioBlockRange.start, this.audioBlockRange.end + 1).map(c => c.text).join(' ');
            const charCount = clipText.length;
            const chevronIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;

            container.innerHTML = `
                <div class="echo-info">
                    <h3 class="echo-info-toggle ${this.echoInfoCollapsed ? 'collapsed' : ''}" id="echo-info-toggle">
                        <span>What is a Content Echo?</span>
                        ${chevronIcon}
                    </h3>
                    <div class="echo-info-details ${this.echoInfoCollapsed ? 'collapsed' : ''}" id="echo-info-details">
                        <p>Content Echoes are semi-private audio links that only those you share with can access.</p>
                        <h3 style="margin-top: 16px;">Use Content Echoes to:</h3>
                        <ul>
                            <li>Share your opinions on what you're listening to, like game reviews or blog posts</li>
                            <li>Create audio commentary on news stories or articles</li>
                            <li>Send audio notes through email or messaging</li>
                            <li>Capture your thoughts and reactions in your own voice</li>
                        </ul>
                        <p style="margin-top: 16px; font-size: 13px; color: #9ca3af;">
                            After creating your echo, you'll receive a shareable link. Only people with the link can listen to your echo.
                        </p>
                    </div>
                </div>
                <div class="clip-text-section">
                    <div class="clip-text-header">
                        <span>Audio Clip Text</span>
                        <span class="clip-text-range">#${this.audioBlockRange.start} - #${this.audioBlockRange.end} (${charCount} chars)</span>
                    </div>
                    <div class="clip-text-content">${clipText || '<em>No audio clip selected</em>'}</div>
                </div>
            `;

            const toggleBtn = container.querySelector('#echo-info-toggle');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    this.echoInfoCollapsed = !this.echoInfoCollapsed;
                    const details = container.querySelector('#echo-info-details');
                    toggleBtn.classList.toggle('collapsed', this.echoInfoCollapsed);
                    if (details) {
                        details.classList.toggle('collapsed', this.echoInfoCollapsed);
                    }
                });
            }
            return;
        }

        const ratingUrl = `https://${APP_WEB_DOMAIN}/voice/${this.voice.voice_service}/${this.voice.voice_gender || 'unknown'}/${this.voice.voice_speaker_id}/ratings`;

        let content = `
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
                <h2 style="margin-bottom:0;">Recent Comments</h2>
                <a href="${ratingUrl}" target="_blank" class="view-ratings-link">View all ratings</a>
            </div>
        `;

        if (this.isLoadingComments) {
            content += `<div class="loading-text">Loading comments...</div>`;
        } else if (this.recentComments.length === 0) {
            content += `<div class="empty-text">No comments on ${this.voice.voice_name} yet. Be the first!</div>`;
        } else {
            content += `<div class="comments-list">
                ${this.recentComments.map(comment => this._createCommentHTML(comment)).join('')}
            </div>`;
        }
        container.innerHTML = content;

        if (!this.isLoadingComments && this.recentComments.length > 0) {

            this.shadow.querySelectorAll('.comment-play-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const commentId = btn.dataset.commentId;
                    const commentData = this.recentComments.find(c => c.voice_rating_id == commentId);
                    if (commentData) this._handleCommentPlay(commentData);
                });
            });

            // --- ADD THIS BLOCK: Event Listeners for Read More ---
            this.shadow.querySelectorAll('.read-more-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const parent = e.target.closest('.comment-text');
                    const hiddenText = parent.querySelector('.hidden-text');
                    const visibleText = parent.querySelector('.visible-text');

                    if (hiddenText && visibleText) {
                        visibleText.innerHTML = hiddenText.innerHTML; // Reveal full text
                        e.target.style.display = 'none'; // Hide button
                    }
                });
            });
            // -----------------------------------------------------

        }
    }

    _createCommentHTML(comment) {
        const ratingStars = Array(5).fill(0).map((_, i) =>
            `<svg class="comment-star ${i < comment.vote_value ? 'filled' : ''}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z"/></svg>`
        ).join('');

        const reviewType = comment.voice_review_type || 'voice';

        const playIcon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>`;

        const footerLink = comment.voice_page_url
            ? `<div class="comment-footer">
                   <a href="${comment.voice_page_url}" target="_blank" data-tooltip="${comment.voice_page_title}" rel="noopener noreferrer" class="comment-link">
                       From: ${this._getDomain(comment.voice_page_url)}
                   </a>
               </div>`
            : '';

        // --- ADD THIS BLOCK: Long comment handling ---
        const commentText = comment.rating_comment || '';
        const words = commentText.split(/\s+/);
        let commentTextHtml = '';

        if (words.length > 40) {
            // Keep first 49 words visible, hide the rest
            const shortText = words.slice(0, 40).join(' ') + '...';
            commentTextHtml = `
                <p class="comment-text">
                    <span class="visible-text">${shortText}</span>
                    <span class="hidden-text" style="display:none;">${commentText}</span>
                    <span class="read-more-btn">...more</span>
                </p>
            `;
        } else {
            commentTextHtml = `<p class="comment-text">${commentText}</p>`;
        }
        // ---------------------------------------------

        return `
            <div class="comment-item">
                <div class="comment-header">
                    <div class="comment-meta">
                        <span class="comment-date">${this._formatDate(comment.rated_at)}</span>
                        <span class="comment-username">${comment.username || 'Anonymous'}</span>
                    </div>
                    <div class="comment-rating">
                        ${ratingStars}
                  
                    </div>
                </div>
                ${comment.speechText && comment.audioUrl ? `
                    <div class="speech-excerpt">
                        <button class="comment-play-btn" data-comment-id="${comment.voice_rating_id}">
                            ${playIcon}
                        </button>
                        <span class="speech-text">"${comment.speechText}"</span>
                         <span class="comment-timer" data-comment-id="${comment.voice_rating_id}"></span>
                    </div>` : ''}

                 ${commentTextHtml}

                ${footerLink}
            </div>
        `;
    }

    async _handleCommentPlay(comment) {
        const btn = this.shadow.querySelector(`.comment-play-btn[data-comment-id="${comment.voice_rating_id}"]`);

        // --- FIXED: Context Switching & Stop Main Audio ---
        // 1. Stop the Main Audio UI/Player
        this._stopMainAudio();

        // 2. Since we switched to comments, force reload next time main is played
        this.lastActiveSource = 'comment';

        // 3. Handle previous comment player switching
        if (this.activeCommentPlayer.audioBlobURL && this.activeCommentPlayer.id !== comment.voice_rating_id) {
            this._stopCommentAudio(this.activeCommentPlayer.id);
        }

        if (this.activeCommentPlayer.id === comment.voice_rating_id) {
            if (this.activeCommentPlayer.isPlaying) {
                this._pauseCommentAudio(comment.voice_rating_id);
            } else {
                this._resumeCommentAudio(comment.voice_rating_id);
            }
            return;
        }

        this._resetActiveCommentPlayer();

        try {
            const response = await fetch(comment.audioUrl);
            const blob = await response.blob();
            const audioBlobURL = URL.createObjectURL(blob);

            this.activeCommentPlayer = {
                id: comment.voice_rating_id,
                audioBlobURL: audioBlobURL,
                isPlaying: false
            };

            const callbackPrefix = `${this.modalId}_comment_${comment.voice_rating_id}`;
            const callbacks = {
                onPlay: `${callbackPrefix}_play`,
                onEnded: `${callbackPrefix}_ended`,
                onTimeUpdate: `${callbackPrefix}_timeupdate`
            };

            this.commentAudioCallbacks.set(comment.voice_rating_id, callbacks);

            const playIcon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>`;
            const pauseIcon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6V5zm10 0h2v14h-2V5z"/></svg>`;

            VR_Reader.saveRequest(callbacks.onPlay, () => {
                this.activeCommentPlayer.isPlaying = true;
                if (btn) btn.innerHTML = pauseIcon;
            });

            VR_Reader.saveRequest(callbacks.onEnded, () => {
                this._resetActiveCommentPlayer();
            });

            VR_Reader.saveRequest(callbacks.onTimeUpdate, (data) => {
                const timerSpan = this.shadow.querySelector(`.comment-timer[data-comment-id="${comment.voice_rating_id}"]`);
                if (timerSpan && data) {
                    const curr = this._formatTime(data.currentTime || 0);
                    const dur = this._formatTime(data.duration || 0);
                    timerSpan.textContent = `${curr} / ${dur}`;
                }
            });

            // Note: _playCommentAudio always forces a new 'play-audio' call
            this._playCommentAudio(comment.voice_rating_id);

        } catch (error) {
            console.error('Failed to load comment audio:', error);
        }
    }

    _playCommentAudio(commentId) {
        if (!this.activeCommentPlayer.audioBlobURL || this.activeCommentPlayer.id !== commentId) return;

        const callbacks = this.commentAudioCallbacks.get(commentId);
        if (!callbacks) return;

        chrome.runtime.sendMessage({
            action: "play-audio",
            target: 'offscreen',
            tabId: VR_Reader.currentTabId,
            data: {
                audioBlobURL: this.activeCommentPlayer.audioBlobURL,
                index: 0,
                ignoreFirstQueue: false,
                onPlayCallbackID: callbacks.onPlay,
                onEndedCallbackID: callbacks.onEnded,
                onTimeUpdateCallbackID: callbacks.onTimeUpdate,
                tabId: VR_Reader.currentTabId
            }
        });
    }

    _pauseCommentAudio(commentId) {
        chrome.runtime.sendMessage({
            action: "pause-audio",
            target: "offscreen",
            tabId: VR_Reader.currentTabId
        });

        const btn = this.shadow.querySelector(`.comment-play-btn[data-comment-id="${commentId}"]`);
        if (btn) {
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>`;
        }

        if (this.activeCommentPlayer.id === commentId) {
            this.activeCommentPlayer.isPlaying = false;
        }
    }

    _resumeCommentAudio(commentId) {
        chrome.runtime.sendMessage({
            action: "resume-audio",
            target: "offscreen",
            tabId: VR_Reader.currentTabId
        });

        const btn = this.shadow.querySelector(`.comment-play-btn[data-comment-id="${commentId}"]`);
        if (btn) {
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6V5zm10 0h2v14h-2V5z"/></svg>`;
        }

        if (this.activeCommentPlayer.id === commentId) {
            this.activeCommentPlayer.isPlaying = true;
        }
    }

    _stopCommentAudio(commentId) {
        chrome.runtime.sendMessage({
            action: "stop-audio",
            target: "offscreen",
            tabId: VR_Reader.currentTabId
        });

        const btn = this.shadow.querySelector(`.comment-play-btn[data-comment-id="${commentId}"]`);
        if (btn) {
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>`;
        }

        const timerSpan = this.shadow.querySelector(`.comment-timer[data-comment-id="${commentId}"]`);
        if (timerSpan) {
            timerSpan.textContent = '';
        }

        if (this.activeCommentPlayer.id === commentId) {
            this.activeCommentPlayer.isPlaying = false;
        }
    }

    _resetActiveCommentPlayer() {
        if (this.activeCommentPlayer.id) {
            const oldBtn = this.shadow.querySelector(`.comment-play-btn[data-comment-id="${this.activeCommentPlayer.id}"]`);
            if (oldBtn) oldBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>`;

            this._stopCommentAudio(this.activeCommentPlayer.id);

            if (this.activeCommentPlayer.audioBlobURL) {
                URL.revokeObjectURL(this.activeCommentPlayer.audioBlobURL);
            }

            const callbacks = this.commentAudioCallbacks.get(this.activeCommentPlayer.id);
            if (callbacks) {
                delete VR_Reader.pendingRequests[callbacks.onPlay];
                delete VR_Reader.pendingRequests[callbacks.onEnded];
                delete VR_Reader.pendingRequests[callbacks.onTimeUpdate];
                this.commentAudioCallbacks.delete(this.activeCommentPlayer.id);
            }
        }

        this.activeCommentPlayer = { id: null, audioBlobURL: null, isPlaying: false };
    }

    _formatDate(dateString) {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    async _loadSavedReviewType() {
        const storage = await readLocalStorage(['voiceReviewTypePreference']);

        if (storage.voiceReviewTypePreference) {
            this.reviewType = storage.voiceReviewTypePreference;
        }
    }
    async _loadSavedReviewType() {
        const storage = await readLocalStorage(['voiceReviewTypePreference']);
        if (storage.voiceReviewTypePreference) { this.reviewType = storage.voiceReviewTypePreference; }
    }
    async _saveReviewTypePreference() {
        await saveToLocalStorage({ 'voiceReviewTypePreference': this.reviewType }, true);
    }

    _hasUnsavedChanges() {
        if (this.saveButtonPressed === true) {
            return false;
        }
        const textarea = this.shadow.querySelector('textarea');
        return textarea && textarea.value.trim() !== '' && textarea.value !== this.comment;
    }

    _confirmClose() {
        if (this._hasUnsavedChanges()) {
            const userConfirmed = confirm('You have unsaved changes in your comment. Are you sure you want to leave?');
            return userConfirmed;
        }
        return true;
    }

    close() {
        if (!this._confirmClose()) {
            return;
        }

        this._stopMainAudio();
        this._resetActiveCommentPlayer();

        delete VR_Reader.pendingRequests[this.mainAudioCallbacks.onPlay];
        delete VR_Reader.pendingRequests[this.mainAudioCallbacks.onTimeUpdate];
        delete VR_Reader.pendingRequests[this.mainAudioCallbacks.onEnded];
        delete VR_Reader.pendingRequests[this.mainAudioCallbacks.onLoadedMetadata];

        if (this.audioBlobURL) {
            URL.revokeObjectURL(this.audioBlobURL);
        }

        const element = document.getElementById('shadowdom-vk-comment-modal');
        if (element && element.parentNode) element.parentNode.removeChild(element);
        if (this.onClose) this.onClose();
    }

    async render() {
        // ... (render method is largely the same, logic is inside helper methods)
        const currentDomain = this._getDomain(window.location.href);

        const container = document.createElement('div');
        container.className = 'modal-backdrop';
        // ... (rest of render implementation)
        // Note: I am pasting the innerHTML part again to ensure completeness of the thought process,
        // but the actual class logic above handles the user request.
        container.innerHTML = `
            <div class="modal-content">
                <button class="modal-close-btn">&times;</button>
                <div class="left-panel">
                    <!-- Header will be set dynamically by _toggleRatingReactionUI -->
                    <h2 class="main-header-label">Rate this Voice</h2>
                    
                    <div class="stars-container">
                        ${[1, 2, 3, 4, 5].map(i => `<button class="star-btn" data-star="${i}"><svg class="star-empty" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg></button>`).join('')}
                    </div>

                    <div class="reactions-container" style="display: none;">
                        <div class="reactions-title">Select a reaction (optional)</div>
                        <div class="reactions-list">
                            <div class="reaction-item" data-value="1"><input type="radio" name="echo-reaction" class="reaction-radio" value="1"><span class="reaction-emoji">🤔</span><span class="reaction-label">Interesting</span></div>
                            <div class="reaction-item" data-value="2"><input type="radio" name="echo-reaction" class="reaction-radio" value="2"><span class="reaction-emoji">😮</span><span class="reaction-label">Surprising</span></div>
                            <div class="reaction-item" data-value="3"><input type="radio" name="echo-reaction" class="reaction-radio" value="3"><span class="reaction-emoji">💭</span><span class="reaction-label">Thoughtful</span></div>
                            <div class="reaction-item" data-value="4"><input type="radio" name="echo-reaction" class="reaction-radio" value="4"><span class="reaction-emoji">🔥</span><span class="reaction-label">Powerful</span></div>
                            <div class="reaction-item" data-value="5"><input type="radio" name="echo-reaction" class="reaction-radio" value="5"><span class="reaction-emoji">❤️</span><span class="reaction-label">Loved It</span></div>
                        </div>
                    </div>

                    <label for="comment-box">Your comment</label>
                    <textarea id="comment-box" placeholder="Share your thoughts...">${this.comment}</textarea>
                    
                    <div class="source-checkbox-container">
                        <input type="checkbox" id="source-checkbox" class="source-checkbox" checked>
                        <label for="source-checkbox" class="source-checkbox-label">
                            Include source <span class="source-domain">(${currentDomain})</span>
                        </label>
                    </div>
                    
                    <button class="submit-btn">Submit Rating & Comment</button>
                </div>
                <div class="right-panel">
                    <div class="right-panel-content">
                        <!-- Content will be rendered here by _renderCommentsList -->
                    </div>
                    <div class="right-panel-audio">
                        <div class="audio-player">
                            <button class="play-btn"><span class="play-icon"></span></button>
                            <div class="waveform-placeholder"></div>
                            <div class="time-display">0:00 / 0:00</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.shadow.appendChild(container);

        this.shadow.querySelector('.modal-close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
        });
        this.shadow.querySelector('.modal-backdrop').addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) this.close();
        });

        this.shadow.querySelectorAll('.star-btn').forEach(btn => {
            const starIndex = parseInt(btn.dataset.star, 10);
            btn.addEventListener('click', () => {
                if (this.canChangeRating) {
                    this.rating = starIndex;
                    this._updateStars();
                    this._updateSubmitButton();
                }
            });
            btn.addEventListener('mouseenter', () => {
                if (this.canChangeRating) this._updateStars(starIndex);
            });
            btn.addEventListener('mouseleave', () => {
                if (this.canChangeRating) this._updateStars();
            });
        });

        this.shadow.querySelectorAll('.reaction-item').forEach(item => {
            const value = parseInt(item.dataset.value, 10);
            const radio = item.querySelector('.reaction-radio');

            item.addEventListener('click', () => {
                if (this.echoReaction === value) {
                    this.echoReaction = null;
                    radio.checked = false;
                } else {
                    this.echoReaction = value;
                    radio.checked = true;
                }
                this._updateReactionsUI();
            });

            radio.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.echoReaction === value) {
                    this.echoReaction = null;
                    radio.checked = false;
                } else {
                    this.echoReaction = value;
                }
                this._updateReactionsUI();
            });
        });

        this.shadow.querySelectorAll('.review-type-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (btn.disabled) return;

                this.reviewType = btn.dataset.type;
                this._updateReviewTypeButtons();
                this._toggleRatingReactionUI();
                this._updateSubmitButton();
                this._renderCommentsList();
                await this._saveReviewTypePreference();
            });
        });

        const sourceCheckbox = this.shadow.querySelector('#source-checkbox');
        if (sourceCheckbox) {
            sourceCheckbox.addEventListener('change', (e) => {
                this.showPageSource = e.target.checked;
            });
        }

        const textarea = this.shadow.querySelector('textarea');
        if (textarea) {
            textarea.addEventListener('input', () => {
                this._updateSubmitButton();
            });
        }

        this.shadow.querySelector('.submit-btn').addEventListener('click', () => this._handleSubmit());
        this.shadow.querySelector('.play-btn').addEventListener('click', () => this._togglePlay());


        // --- UPDATED LOGIC: Only load saved preference if allowed ---
        if (this.loadPreference) {
            await this._loadSavedReviewType();
        }
        this._updateStars();
        this._updateReviewTypeButtons();
        this._toggleRatingReactionUI();
        this._updatePlayerUI();
        this._updateSubmitButton();
        this._loadAudio();
        this._fetchRecentComments();
    }

    _toggleRatingReactionUI() {
        const starsContainer = this.shadow.querySelector('.stars-container');
        const reactionsContainer = this.shadow.querySelector('.reactions-container');

        // Elements to update text on
        const headerLabel = this.shadow.querySelector('.left-panel h2.main-header-label');
        const textarea = this.shadow.querySelector('textarea');
        const commentLabel = this.shadow.querySelector('label[for="comment-box"]');

        if (this.reviewType === 'voice') {
            // === VOICE REVIEW MODE ===

            // Dynamic Header: "Rate [Voice Name]"
            // Using bold color for the name to make it pop
            headerLabel.innerHTML = `Rate <span style="color:#4f46e5">${this.voice.voice_name}</span>`;

            // Specific Placeholder to guide quality data
            if (textarea) {
                textarea.placeholder = "Did it sound natural? Was the speed okay? Is this voice good for News or Stories?";
            }

            if (commentLabel) commentLabel.textContent = "Voice Performance Feedback";

            if (starsContainer) starsContainer.style.display = 'flex';
            if (reactionsContainer) reactionsContainer.style.display = 'none';

        } else {
            // === CONTENT ECHO MODE ===

            headerLabel.textContent = 'Share Audio Clip';

            // Contextual Placeholder for content
            if (textarea) {
                textarea.placeholder = "Add your commentary on this article, or explain why you are sharing this clip...";
            }

            if (commentLabel) commentLabel.textContent = "Your Thoughts on Content";

            if (starsContainer) starsContainer.style.display = 'none';
            if (reactionsContainer) reactionsContainer.style.display = 'block';
        }
    }
}
