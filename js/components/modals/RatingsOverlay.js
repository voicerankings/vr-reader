/**
 * RatingsOverlay.js
 * 
 * OPEN SOURCE ARCHITECTURE NOTE:
 * 
 * 1. FEEDBACK & CREDIT TRACKING:
 *    - Manages the user feedback loop when a TTS generation finishes or is paused.
 *    - Communicates with the VoiceRankings backend to track `saveVoiceRating`.
 *    - Tracks generated characters and deducts credits accordingly.
 * 
 * 2. UI LIFECYCLE:
 *    - Renders an overlay for saving articles to "Read Later" or providing voice feedback.
 */
import CommentModal from './CommentModal.js'; 
import RatingSummaryModal from './RatingSummaryModal.js'; 
import {
    readLocalStorage
} from "../../utils/helpers";
import {
    getOpenGraphImageWithFallbacks
} from "../../utils/opengraph.js";

export default class RatingsOverlay {
    constructor({
        voice,
        generation_credits = 0,
        replayQueue = [],
        index = 0,
        callback,
        sessionId,
        showCreditWarning = false,
        voice_reviews_count = 0,
        hasOwnKey = false, 
        forceTokenDisplay = false,
        showRatingUI = true,
        showContinueUI = true
        }) {

        this.canRateVoice = true; 
        this.showCreditWarning = showCreditWarning;
        this.showRatingUI = showRatingUI;
        this.showContinueUI = showContinueUI;
        this.percentageRead = 0;
        this.voice_reviews_count = voice_reviews_count;
        this.hasOwnKey = hasOwnKey; // Store key status
        this.forceTokenDisplay = forceTokenDisplay;

        this.showContinueReading = false;
        this.remainingTextPercentage = 0;
        this.isCalculatingRemaining = false;

        this.hostElement = null;
        this.shadow = null;
        this.voice = voice;
        this.generation_credits = generation_credits;
        this.replayQueue = replayQueue;
        this.index = (replayQueue && replayQueue[index] && replayQueue[index].audioData) ? index : Math.max(0, index - 1);
        this.callback = callback;
        this.communicationHelper = VR_Reader;
        this.sessionId = sessionId;

        if (this.communicationHelper) {
            this.communicationHelper.sessionCharsRead = 0;
        }

        this.rating = 0;
        this.maxSamples = 10;
        this.isVisible = false;
        
        this.isRated = false;
        this.isLoading = true;
        this.audioBlockRange = null;
        this.existingComment = '';
        this.existingPageSourceCheck = true;
        this.existingReviwewType = 'voice';
        this.existingAudioUrl = null;
    }

    initShadowDOM(shadowDomDiv) {
        this.hostElement = shadowDomDiv;
        this.shadow = this.hostElement.attachShadow({ mode: 'open' });

        // Add styles
        const style = document.createElement('style');

        style.textContent = `
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: sans-serif;
            }

            .overlay-container {
                position: fixed;
                bottom: 0;
                left: 50%;
                transform: translate(-50%, 100%);
                z-index: 99999999999;
                width: 100%;
                max-width: 700px;
                transition: transform 0.3s ease-out;
            }

            .overlay-container.visible {
                transform: translate(-50%, 0);
            }

            /* --- WARNING BARS --- */
            
            /* Standard Credit Warning (Yellow/Orange) */
            .credit-warning-bar {
                background: linear-gradient(to right, rgba(255, 193, 7, 0.95), rgba(255, 152, 0, 0.95));
                border-radius: 16px 16px 0 0;
                padding: 12px 24px;
                box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.2);
            }

            /* Developer Limit Warning (Red) */
            .dev-limit-warning-bar {
                background: linear-gradient(to right, rgba(220, 38, 38, 0.95), rgba(185, 28, 28, 0.95));
                border-radius: 16px 16px 0 0;
                padding: 12px 24px;
                box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.2);
            }

            .warning-content {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
            }

            .warning-text {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #fff;
                font-size: 14px;
                font-weight: 500;
            }

            .warning-icon {
                font-size: 18px;
            }

            .warning-stats {
                display: flex;
                align-items: center;
                gap: 16px;
                white-space: nowrap;
            }

            .percentage-read {
                color: #fff;
                font-size: 14px;
                font-weight: 600;
            }

            .buy-credits-link, .add-key-link, .unlock-link {
                background: #fff;
                cursor:pointer;
                color: #ff9800;
                padding: 6px 16px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 700;
                font-size: 14px;
                transition: all 0.2s;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }

            .unlock-link {
                color: #dc2626; /* Dark Red text for dev warning */
            }

            .buy-credits-link:hover, .add-key-link:hover, .unlock-link:hover {
                background: #f5f5f5;
                transform: translateY(-1px);
                box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
            }

            /* --- MAIN CONTENT AREA --- */

            .overlay-content {
                /* Default Blue Theme */
                background: linear-gradient(to bottom, #2563eb, #1e3a8a);
                box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
                border-radius: 0 0 0 0; /* Handled by logic below */
                padding: 16px 24px;
                position: relative; 
            }

            /* Purple Theme for Developer Mode (Own Key) */
            .overlay-content.own-key-theme {
                /* Balanced Purple: Not too neon, not too black. Matches the weight of the blue theme. */
                background: linear-gradient(to bottom, #7c3aed, #4c1d95); 
            }

            /* If no warning bar exists, round the top corners */
            .overlay-content.rounded-top {
                 border-radius: 16px 16px 0 0;
            }

            /* Find and replace .continue-reading-bar styles */

            .continue-reading-bar {
                position: absolute;
                /* Anchor to the TOP of the purple bar so it moves with it */
                top: 0; 
                left: 12px;
                right: 12px;
                
                background: linear-gradient(to right, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95));
                
                /* CRITICAL: Add extra bottom padding to account for the overlap */
                padding: 10px 19px 25px 19px; 
                
                /* Animation Start: Hidden behind the purple bar */
                transform: translateY(10px); 
                transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                
                /* Put it behind the purple bar */
                z-index: -1;
                
                border-radius: 12px 12px 0 0;
            }

            .continue-reading-bar.visible {
                /* Animation End: Slide up, but keep 15px TUCKED BEHIND */
                /* This overlap eliminates the white gap */
                transform: translateY(calc(-100% + 15px));
            }

            /* Rating UI hidden: render the continue bar as a standalone card */
            .overlay-content.continue-only {
                background: transparent;
                padding: 0;
                box-shadow: none;
            }

            .continue-reading-bar.standalone {
                position: static;
                transform: none;
                z-index: auto;
                border-radius: 12px;
            }

            .continue-reading-bar.standalone.visible {
                transform: none;
            }

            .continue-content {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
            }

            .continue-text {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #fff;
                font-size: 14px;
                font-weight: 500;
            }

            .continue-icon {
                font-size: 18px;
            }

            .continue-stats {
                display: flex;
                align-items: center;
                gap: 16px;
                white-space: nowrap;
            }

            .remaining-percentage {
                color: #fff;
                font-size: 14px;
                font-weight: 600;
            }

            .continue-button {
                background: #fff;
                color: #059669;
                padding: 8px 20px;
                border-radius: 6px;
                border: none;
                font-weight: 700;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }

            .continue-button:hover {
                background: #f5f5f5;
                transform: translateY(-1px);
                box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
            }

            .progress-bar-container {
                width: 100%;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 9999px;
                height: 8px;
                overflow: hidden;
                margin-bottom: 12px;
            }

            .progress-bar {
                background: white;
                height: 100%;
                border-radius: 9999px;
                transition: width 0.4s ease, background 0.4s ease;
            }

            .main-content {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
            }

            .stars-container {
                display: flex;
                align-items: center;
                gap: 4px;
                transition: opacity 0.3s ease;
            }

            .stars-container.loading,
            .stars-container.disabled {
                opacity: 0.6;
            }

            .stars-container.disabled .star-button {
                cursor: default;
            }

            .star-button {
                background: none;
                border: none;
                cursor: pointer;
                padding: 0;
                transition: transform 0.2s;
                outline: none;
            }

            .star-button:hover:not(:disabled) {
                transform: scale(1.1);
            }
            
            .star-button:disabled {
                pointer-events: none; 
            }

            .star-button.disabled {
                cursor: not-allowed;
            }

            .star-button svg {
                width: 28px;
                height: 28px;
                transition: all 0.2s;
            }

            .star-empty {
                fill: none;
                stroke: rgba(255, 255, 255, 0.4);
                stroke-width: 2;
            }

            .star-button.disabled .star-filled{
                fill: none;
                stroke: rgba(255, 255, 255, 0.4);
            }

            .star-filled {
                fill: #fcd34d;
                stroke: #fcd34d;
                stroke-width: 2;
            }
            
            .action-buttons-container {
                justify-content: center;
                display: flex;
                gap: 12px;
                flex: 1;
            }
            
            .echo-btn{
                color: white;
                background: transparent;
                border: none;
                cursor:pointer;
            }
            .echo-btn:hover {
                color: yellow;
            }

            .rate-button {
                min-width: 130px;
                padding: 8px 12px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 14px;
                border: none;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
                background: white;
                color: #2563eb;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            /* Update rate button color for purple theme */
            .own-key-theme .rate-button {
                color: #7c3aed;
            }
            
            .rate-button:hover:not(:disabled) {
                background: rgba(255, 255, 255, 0.9);
                transform: translateY(-1px);
            }

            .rate-button:disabled {
                opacity: 0.7;
                cursor: not-allowed;
                background: #e5e7eb;
                color: #9ca3af;
            }

            .samples-counter {
                color: white;
                font-weight: 600;
                font-size: 18px;
                white-space: nowrap;
            }

            .close-button {
                background: none;
                border: none;
                cursor: pointer;
                padding: 0;
                margin-left: 8px;
                color: white;
                transition: opacity 0.2s;
                outline: none;
            }

            .close-button:hover {
                opacity: 0.8;
            }

            .close-button svg {
                width: 24px;
                height: 24px;
            }

            [data-tooltip] {
                position: relative; 
            }

            [data-tooltip]::after {
                content: attr(data-tooltip);
                position: absolute;
                bottom: calc(100% + 12px); 
                left: 50%;
                opacity: 0;
                pointer-events: none;
                transform: translate(-50%, 5px) scale(0.95); 
                background: #111827; 
                color: #fff;
                font-size: 13px;
                font-weight: 500;
                padding: 8px 14px;
                border-radius: 8px;
                white-space: nowrap; 
                box-shadow: 0 4px 12px rgba(0,0,0,0.25);
                transition: opacity 0.2s ease-out, transform 0.2s ease-out;
                z-index: 1000;
            }

            [data-tooltip].continue-button::after {
                white-space: normal; 
                width: 255px; 
            }

            [data-tooltip]::before {
                content: '';
                position: absolute;
                bottom: calc(100% + 8px); 
                left: 50%;
                opacity: 0;
                pointer-events: none;
                transform: translate(-50%, 5px); 
                border-left: 6px solid transparent;
                border-right: 6px solid transparent;
                border-top: 6px solid #111827; 
                transition: opacity 0.2s ease-out, transform 0.2s ease-out;
                z-index: 1001;
            }

            [data-tooltip]:hover::after,
            [data-tooltip]:hover::before {
                opacity: 1;
                transform: translate(-50%, 0) scale(1); 
            }
        `;
        this.shadow.appendChild(style);
    }

    async _calculateRemainingText() {
        if (!this.showContinueUI) {
            this.showContinueReading = false;
            return;
        }
        if (this.skipCalculateRemaining) return;
        if (window.VR_Reader && window.VR_Reader.hasContinuedReading) {
            this.showContinueReading = false;
            const continueBar = this.shadow.querySelector('.continue-reading-bar');
            if (continueBar) continueBar.style.display = 'none';
            return;
        }
        
        if (!VR_Reader.storedSelectionData) {
            console.log('No stored selection data - not in highlight mode');
            this.showContinueReading = false;
            return;
        }

        this.isCalculatingRemaining = true;
        console.log('🔄 Calculating remaining text from highlight...');

        try {
            const result = await VR_Reader.calculateRemainingText();
            VR_Reader.remainingTextResult = result;
    
            if (result && result.remainingText && result.remainingText.length > 0) {
                // Safety net: if remainingText starts mid-word (the character before it
                // in the article is a letter), drop the leading truncated token so we
                // never continue reading from a partial word (e.g. "ls." from "feels.").
                let remainingText = result.remainingText;
                const articleTextRaw = result.articleText || '';
                if (articleTextRaw) {
                    const pos = articleTextRaw.indexOf(remainingText);
                    if (pos > 0 && /[A-Za-z]/.test(articleTextRaw[pos - 1])) {
                        const token = remainingText.match(/^\S+\s+/);
                        if (token && token[0].length < 20) {
                            remainingText = remainingText.slice(token[0].length);
                        }
                    }
                }
                
                const totalText = result.articleText || '';
                if (totalText.length > 0) {
                    this.fullArticleLength = totalText.length;
                    this.fullArticleRemaining = remainingText.length;
                    
                    this.remainingTextPercentage = Math.round(
                        (remainingText.length / totalText.length) * 100
                    );
                    
                    const previewText = remainingText.slice(0, 100).trim() + 
                        (remainingText.length > 100 ? '...' : '');
                    
                    this.showContinueReading = true;
                    const remainingLabel = this.shadow.querySelector('.remaining-percentage');
                    if(remainingLabel) remainingLabel.innerHTML = `${this.remainingTextPercentage}% remaining`;
                    
                    const continueButton = this.shadow.querySelector('.continue-button');
                    if (continueButton) {
                        continueButton.setAttribute('data-tooltip', previewText);
                    }
                    
                    console.log(`✅ ${this.remainingTextPercentage}% of article remaining`);
                }
            } else {
                this.showContinueReading = false;
                console.log('No remaining text found');
            }
        } catch (error) {
            console.error('Error calculating remaining text:', error);
            this.showContinueReading = false;
        } finally {
            this.isCalculatingRemaining = false;
            if (this.showContinueReading) {
                this._showContinueReadingBar();
            }
        }
    }

    _showContinueReadingBar() {
        const continueBar = this.shadow.querySelector('.continue-reading-bar');
        if (continueBar && this.showContinueReading && this.showContinueUI) {
            setTimeout(() => {
                continueBar.classList.add('visible');
            }, 1000); 
        }
    }

    async _handleContinueReading() {
        console.log('📖 Continue reading button clicked');
        this.close(true);
        if (window.VR_Reader) window.VR_Reader.hasContinuedReading = true;
        if (VR_Reader.ttsWidget && VR_Reader.ttsWidget.voiceClass) {
            await VR_Reader.ttsWidget.voiceClass.continueReadingAfterHighlight();
        }
    }

    _calculatePercentageRead() {
        if (!this.replayQueue || this.replayQueue.length === 0) {
            return 100;
        }
        let charsRead = 0;
        let totalChars = 0;
        
        for (let i = 0; i < this.replayQueue.length; i++) {
            const clip = this.replayQueue[i];
            const charCount = clip?.text?.length || 0;
            totalChars += charCount;
            if (i <= this.index) {
                charsRead += charCount;
            }
        }
        
        if (totalChars === 0) return 100;
        const percentage = Math.round((charsRead / totalChars) * 100);
        return percentage;
    }

    _getAudioTextBlock() {
        const totalLimit = 400; 
        let combinedTextParts = [];
        let totalLength = 0;
        let startIndex = this.index;

        for (let i = this.index; i >= 0; i--) {
            const currentClip = this.replayQueue[i];
            if (!currentClip || !currentClip.text) break;

            const newLength = totalLength + currentClip.text.length;
            if (newLength > totalLimit && totalLength > 0) {
                break;
            }

            combinedTextParts.unshift(currentClip.text);
            totalLength = newLength;
            startIndex = i;

            const previousClip = this.replayQueue[i - 1];
            if (previousClip && previousClip.audioData === null) {
                break;
            }
        }

        return {
            text: combinedTextParts.join(' '),
            startIndex: startIndex,
            endIndex: this.index
        };
    }

    _saveRating(newRating) {
        if (!this.communicationHelper) return;

        const audioBlock = this._getAudioTextBlock();
        const textBlock = audioBlock.text;

        if (!textBlock) {
            console.error("Cannot save rating: text block is empty.");
            return;
        }

        const audioData = this.replayQueue[this.index]?.audioData;

        const requestID = `save_rating_${Date.now()}`;
        const callbackID = `callback_${requestID}`;

        this.communicationHelper.saveRequest(callbackID, (response) => {
            console.log('Save rating response:', response);
        });

        if (audioData) {
            chrome.runtime.sendMessage({
                action: "uploadAudioAndSaveRating",
                callbackID,
                payload: {
                    voice: this.voice,
                    rating: newRating,
                    comment: '',
                    text: textBlock,
                    page_url: this._cleanUrl(window.location.href),
                    page_title: document.title,
                    page_image: getOpenGraphImageWithFallbacks(),
                    audioBase64: audioData,
                    voice_review_type: 'voice',
                    showPageSource: true,
                    fileName: `rating_${this.voice.voice_id}_${Date.now()}.mp3`,
                    directory: 'chrome-rating-audio'
                }
            });
        } else {
            chrome.runtime.sendMessage({
                action: "saveVoiceRating",
                callbackID,
                payload: {
                    voice_speed: this.voice.voice_speed,
                    voice_id: this.voice.voice_id,
                    rating: newRating,
                    text: textBlock,
                    page_url: this._cleanUrl(window.location.href),
                    page_title: document.title,
                    page_image: getOpenGraphImageWithFallbacks(),
                    comment: ''
                }
            });
        }
    }

    handleStarClick(starIndex) {
        if (this.isRated || this.isLoading) {
            return;
        }
        
        this.rating = starIndex;
        this.isRated = true; 
        
        this._saveRating(this.rating);
        
        this.updateStars();
        this._updateUiForState();
        
        this.generation_credits = Math.min(this.generation_credits + 2, this.maxSamples);
        this.updateProgressBar();
        
        if (this.callback) {
            this.callback({
                voice: this.voice,
                rating: this.rating,
                generation_credits: this.generation_credits,
                text: this.replayQueue[this.index]?.text || '' 
            });
        }
        
        setTimeout(() => this.close(), 800);
        setTimeout(() => this._openRatingSummaryModal(), 850);
    }

    _openRatingSummaryModal() {
        let modalHost = document.getElementById('shadowdom-vk-rating-summary-modal');
        if (!modalHost) {
            modalHost = document.createElement('div');
            modalHost.id = 'shadowdom-vk-rating-summary-modal';
            document.body.appendChild(modalHost);
        }

        const modal = new RatingSummaryModal({
            voice: this.voice,
            onClose: () => {}
        });

        modal.initShadowDOM(modalHost);
        modal.render();
    }

    handleRateAndComment(forcedReviewType) {
        let modalHost = document.getElementById('shadowdom-vk-comment-modal');
        if (!modalHost) {
            modalHost = document.createElement('div');
            modalHost.id = 'shadowdom-vk-comment-modal';
            document.body.appendChild(modalHost);
        }

        const targetReviewType = forcedReviewType || this.existingReviwewType || 'voice';
        const shouldLoadPreference = !forcedReviewType;

        if (!this.audioBlockRange) {
            const audioBlock = this._getAudioTextBlock();
            this.audioBlockRange = { start: audioBlock.startIndex, end: audioBlock.endIndex };
        }

        const modal = new CommentModal({
            voice: this.voice,
            replayQueue: this.replayQueue,
            audioBlockRange: this.audioBlockRange,
            existingRating: this.rating,
            existingComment: this.existingComment,
            existingPageSourceCheck: this.existingPageSourceCheck || true,
            existingReviewType: targetReviewType,
            existingAudioUrl: this.existingAudioUrl,
            canRateVoice: true, 
            loadPreference: shouldLoadPreference, 
            onClose: () => {}
        });
                
        modal.initShadowDOM(modalHost);
        modal.render();

        this.close(true); 
    }
    
    updateProgressBar() {
        const progressBar = this.shadow.querySelector('.progress-bar');
        const samplesCounter = this.shadow.querySelector('.samples-counter');
        const progressBarContainer = this.shadow.querySelector('.progress-bar-container');
        
        if (!progressBar || !samplesCounter) return;

        // Reset visibility (assume visible by default, hide in specific cases)
        if (progressBarContainer) progressBarContainer.style.display = 'block';
        samplesCounter.style.display = 'block';

        // --- SCENARIO 1: BYOK (Developer Mode) ---
        if (this.hasOwnKey) {
            // A. Paid Unlock -> VISUAL SILENCE
            if (true) {
                if (progressBarContainer) progressBarContainer.style.display = 'none';
                samplesCounter.style.display = 'none';
                return;
            }

            // B. Free Developer -> SHOW DAILY LIMIT
            const limit = VR_Reader.developerModeDailyLimit || 15000;
            const usage = VR_Reader.developerModeDailyUsage || 0;
            
            let percentageUsed = (usage / limit) * 100;
            if (percentageUsed > 100) percentageUsed = 100;
            
            progressBar.style.width = `${percentageUsed}%`;
            
            // Color Logic
            let color = '#10b981'; // Green
            if (percentageUsed > 90) color = '#ef4444'; // Red
            else if (percentageUsed > 75) color = '#fcd34d'; // Yellow
            progressBar.style.background = color;

            const kUsage = (usage / 1000).toFixed(1) + 'k';
            const kLimit = (limit / 1000).toFixed(0) + 'k';
            
            samplesCounter.innerHTML = `${kUsage} / ${kLimit} Daily Limit`;
            samplesCounter.setAttribute('data-tooltip', `Free Tier Limit. Login in to increase capacity.`);
            return;
        }

        // --- SCENARIO 2: STANDARD VOICE GENERATION ---

        // C. Logged In User -> VISUAL SILENCE
        // We assume they have credits or we don't want to stress them with a counter
        if (VR_Reader.isUserLogged) {
            if (progressBarContainer) progressBarContainer.style.visibilty = 'none';
            samplesCounter.style.display = 'none';
            return;
        }

        // D. Guest User -> SHOW FREE TOKENS (Gamification)
        const progressPercentage = (this.generation_credits / this.maxSamples) * 100;
        progressBar.style.width = `${progressPercentage}%`;

        let color = '#fff';
        if (this.generation_credits < 3) color = '#ef4444'; 
        else if (this.generation_credits < 5) color = '#fcd34d'; 
        progressBar.style.background = color;
        
        samplesCounter.innerHTML = `${this.generation_credits}/${this.maxSamples} Tokens`;
        samplesCounter.setAttribute('data-tooltip', `Free Generation Tokens. Rate how this voice sounds to earn more.`);
    }

    handleStarHover(starIndex) {
        if (this.isRated) return;
        this.updateStars(starIndex);
    }

    handleStarLeave() {
        if (this.isRated) return;
        this.updateStars();
    }

    updateStars(hoverIndex = 0) {
        const starButtons = this.shadow.querySelectorAll('.star-button');
        const activeRating = hoverIndex || this.rating;
        
        starButtons.forEach((button, index) => {
            const star = button.querySelector('svg');
            const starNum = index + 1;

            button.disabled = this.isRated;
            
            if (starNum <= activeRating) {
                star.classList.remove('star-empty');
                star.classList.add('star-filled');
            } else {
                star.classList.remove('star-filled');
                star.classList.add('star-empty');
            }
        });
    }

    _updateUiForState() {
        const starsContainer = this.shadow.querySelector('.stars-container');
        if (!starsContainer) return;

        starsContainer.classList.toggle('loading', this.isLoading);
        starsContainer.classList.toggle('disabled', this.isRated);
    }
    
    async handleReadLater(buttonEl, isSilent = false) {
        if (!isSilent && !VR_Reader.isUserLogged) {
            VR_Reader.makePrompt({
                posX: 50,
                posY: 50,
                action: 'vrr-theme',
                title: 'Sign In Required',
                message: 'Please log in via the side panel to save articles for later.',
                cancel: { buttonText: 'Maybe later' },
                actions: [
                    {
                        buttonText: 'Sign In',
                        callback: () => {
                            chrome.runtime.sendMessage({
                                action: "open-sidepanel",
                                route: "/main-menu",
                                data: { openLoginModal: true }
                            });
                        }
                    }
                ]
            });
            return;
        }

        const currentSentence = (this.replayQueue[this.index]?.text || "").trim();
        const textFragment = currentSentence ? `#:~:text=${encodeURIComponent(currentSentence)}` : "";
        const url = this._cleanUrl(window.location.href);
        const text_fragment_url = `${url}${textFragment}`;
        const page_image_url = getOpenGraphImageWithFallbacks() || "";

        let total_chars = 0;
        let current_char_position = 0;
        
        if (this.initialTotalChars !== undefined && this.initialCurrentCharPosition !== undefined) {
            total_chars = this.initialTotalChars;
            current_char_position = this.initialCurrentCharPosition;
        } else if (this.fullArticleLength) {
            total_chars = this.fullArticleLength;
            current_char_position = this.fullArticleLength - (this.fullArticleRemaining || this.fullArticleLength);
        } else {
            total_chars = this.replayQueue.reduce((acc, curr) => acc + (curr.text?.length || 0), 0);
        }
        
        let session_chars_read = 0;
        for (let i = 0; i < this.index; i++) {
            session_chars_read += this.replayQueue[i].text?.length || 0;
        }
        
        current_char_position += session_chars_read;
        if (current_char_position > total_chars && total_chars > 0) {
            current_char_position = total_chars;
        }
        
        let percentage_remaining = total_chars > 0 ? Math.max(0, 100 - Math.round((current_char_position / total_chars) * 100)) : 0;
        
        percentage_remaining = Math.max(0, percentage_remaining);
        
        if (percentage_remaining === 0 && window.VR_Reader) {
            window.VR_Reader.isTrackingReadLater = false;
        }

        if (!isSilent && buttonEl) {
            buttonEl.innerHTML = "✓ Saved";
            buttonEl.style.background = "rgba(74, 222, 128, 0.2)";
            buttonEl.style.borderColor = "rgba(74, 222, 128, 0.4)";
            
            window.VR_Reader.isTrackingReadLater = true;
        }

        chrome.runtime.sendMessage({
            action: "saveReadLater",
            payload: {
                url,
                title: document.title,
                text_fragment_url,
                last_read_text: currentSentence.trim(),
                total_chars,
                current_char_position,
                percentage_remaining,
                page_image_url
            }
        });
    }

    close(immediate = false) {
        if(!this.shadow) return false;
        const container = this.shadow.querySelector('.overlay-container');
        if (container) {
            container.classList.remove('visible');
            setTimeout(() => this.destroy(), immediate ? 0 : 300);
        }
    }

    destroy() {
        if (this.hostElement && this.hostElement.parentNode) {
            this.hostElement.parentNode.removeChild(this.hostElement);
        }
        this.hostElement = null; 
        this.shadow = null;
        if(VR_Reader.ratingsOverlayClass){
            VR_Reader.ratingsOverlayClass = null;
        }
    }

    _cleanUrl(urlString) {
        try {
            const url = new URL(urlString);
            const paramsToDelete = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
            paramsToDelete.forEach(param => url.searchParams.delete(param));
            return url.toString();
        } catch (error) {
            return urlString;
        }
    }

    render() {
        if (this.showCreditWarning) {
            this.percentageRead = this._calculatePercentageRead();
        }
        
        const starTooltips = [
            "😖 Unnatural / Very bad", 
            "😒 Flawed Delivery",    
            "😐 Decent, but not great", 
            "🙂 Very good, nice flow",  
            "😄 Excellent, sounds human!" 
        ];
        
        // Dynamic Text for Review Button
        // If 0 reviews -> Call to Action ("Write Review")
        // If 1+ reviews -> Social Proof ("12 Reviews")
        const reviewBtnContent = this.voice_reviews_count > 0 
            ? `<span style="display:flex; align-items:center; gap:6px;">💬 ${this.voice_reviews_count} Reviews</span>` 
            : `<span style="display:flex; align-items:center; gap:6px;">✍️ Write Review</span>`;

        const container = document.createElement('div');
        container.className = 'overlay-container';

        // --- DETERMINE STATE ---
        const isOwnKey = this.hasOwnKey;
        const isUnlocked = true;
        // Check if free developer limit is hit (e.g. > 15k chars)
        const devLimitReached = isOwnKey && !isUnlocked && (VR_Reader.developerModeDailyUsage >= VR_Reader.developerModeDailyLimit);
        
        // --- CONSTRUCT WARNING BAR ---
        let warningHTML = '';
        let hasWarning = false;

        if (devLimitReached) {
            hasWarning = true;
            warningHTML = `
                <div class="dev-limit-warning-bar">
                    <div class="warning-content">
                        <div class="warning-text">
                            <span class="warning-icon">⛔</span>
                            <span>Daily developer limit reached</span>
                        </div>
                        <div class="warning-stats">
                             <a class="unlock-link">Unlock Unlimited</a>
                        </div>
                    </div>
                </div>
            `;
        } else if (this.showCreditWarning && !isOwnKey) {
            // Only show standard credit warning if NOT using own key
            hasWarning = true;
            warningHTML = `
                <div class="credit-warning-bar">
                    <div class="warning-content">
                        <div class="warning-text">
                            <span class="warning-icon">⚠️</span>
                            <span>Add an API key or credits to continue listening</span>
                        </div>
                        <div class="warning-stats">
                            <span class="percentage-read">${this.percentageRead}% read</span>
                            <a class="add-key-link" data-provider="${this.voice.voice_service}">Add Key</a>
                            <a class="buy-credits-link">Buy Credits</a>
                        </div>
                    </div>
                </div>
            `;
        }

        // --- DETERMINE MAIN THEME CLASSES ---
        // If hasOwnKey is true, we use the purple theme
        const contentClasses = `overlay-content ${isOwnKey ? 'own-key-theme' : ''} ${!hasWarning ? 'rounded-top' : ''} ${!this.showRatingUI && this.showContinueUI ? 'continue-only' : ''}`;

        // Global setting: both reader prompts disabled -> never render the overlay.
        if (!this.showRatingUI && !this.showContinueUI) {
            this.destroy();
            return;
        }

        // --- RATING SECTION (hideable via the global "voice rating prompt" setting) ---
        let mainContentHTML;
        if (this.showRatingUI) {
            mainContentHTML = `
                <div class="main-content">

                    <!-- Stars and Title -->
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="stars-container" style="opacity: 1.0;"> 
                            ${[1, 2, 3, 4, 5].map(i => `
                            <button class="star-button" 
                            data-star="${i}" data-tooltip="${starTooltips[i - 1]}">
                                <svg class="star-empty" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                            </button>
                            `).join('')}
                        </div>
                        <span style="color: white; font-weight: 600; font-size: 14px; white-space: nowrap;">
                            Rate ${this.voice?.voice_name || this.voice?.name || 'this voice'}'s reading
                        </span>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="action-buttons-container">
                        
                        <!-- Read Later Button -->
                        <button class="read-later-btn" style="display:flex; align-items:center; gap:6px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; padding: 6px 12px; color: white; cursor: pointer; font-weight: 500; font-size: 14px; transition: background 0.2s;" data-tooltip="Save this article to read later">
                            🔖 Read Later
                        </button>

                        <!-- Share Button -->
                        <button class="share-btn" style="display:flex; align-items:center; gap:6px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; padding: 6px 12px; color: white; cursor: pointer; font-weight: 500; font-size: 14px; transition: background 0.2s;" data-tooltip="Share a clip or create a note">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                            Share
                        </button>
                        
                    </div>

                    <!-- Usage Counter -->
                    <!-- This text is updated dynamically by updateProgressBar() -->
                    <!-- It will be HIDDEN for paid users -->
                    <div class="samples-counter"></div>

                    <!-- Close -->
                    <button class="close-button">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            `;
        } else {
            mainContentHTML = `
                <div class="main-content" style="justify-content: flex-end; padding: 8px 12px;">
                    <!-- Close -->
                    <button class="close-button">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            `;
        }

        // --- CONTINUE READING BAR (hideable via the global "continue reading" setting) ---
        const continueBarHTML = this.showContinueUI ? `
            <div class="continue-reading-bar ${this.showRatingUI ? '' : 'standalone'}">
                <div class="continue-content">
                    <div class="continue-text">
                        <span class="continue-icon">📖</span>
                        <span>Continue reading the rest of the page</span>
                    </div>
                    <div class="continue-stats">
                        <span class="remaining-percentage">${this.remainingTextPercentage}% remaining</span>
                        <button 
                        data-tooltip="Calculating preview..."
                        class="continue-button">Continue</button>
                    </div>
                </div>
            </div>
        ` : '';

        container.innerHTML = `
            ${warningHTML}
            <div class="${contentClasses}">
                
                <!-- Progress Bar Container -->
                <!-- Note: This will be hidden via updateProgressBar() for Paid Users -->
                ${this.showRatingUI ? `
                    <div class="progress-bar-container">
                        <div class="progress-bar"></div>
                    </div>
                ` : ''}

                ${mainContentHTML}

                ${continueBarHTML}

            </div>
        `;

        // Re-entrancy: remove any previously rendered container so the overlay
        // can rebuild itself in place when the global settings change live.
        const renderedContainer = this.shadow?.querySelector('.overlay-container');
        if (renderedContainer) renderedContainer.remove();

        this.shadow.appendChild(container);

        // --- EVENT LISTENERS ---

        const continueButton = this.shadow.querySelector('.continue-button');
        if (continueButton) {
            continueButton.addEventListener('click', () => this._handleContinueReading());
        }

        const buyCreditsButton = this.shadow.querySelector('.buy-credits-link');
        if (buyCreditsButton) {
            buyCreditsButton.addEventListener('click', () => {
                chrome.runtime.sendMessage({
                    action: "open-sidepanel",
                    route:"/buy-credits"
                });
            });
        }
        
        // Add listener for new Unlock Link in Dev Warning
        const unlockLink = this.shadow.querySelector('.unlock-link');
        if (unlockLink) {
            unlockLink.addEventListener('click', () => {
                 chrome.runtime.sendMessage({
                    action: "open-sidepanel",
                    route:"/buy-credits"
                });
            });
        }

        const addKeyButton = this.shadow.querySelector('.add-key-link');
        if (addKeyButton) {
            addKeyButton.addEventListener('click', (e) => {
                chrome.runtime.sendMessage({
                    action: "open-sidepanel",
                    route: "/settings",
                    data: {
                        tab: 'byok',
                        provider: e.target.dataset.provider
                    }
                });
            });
        }

        const starButtons = this.shadow.querySelectorAll('.star-button');
        starButtons.forEach(button => {
            const starIndex = parseInt(button.dataset.star, 10);
            button.addEventListener('click', () => this.handleStarClick(starIndex));
            button.addEventListener('mouseenter', () => this.handleStarHover(starIndex));
            button.addEventListener('mouseleave', () => this.handleStarLeave());
        });

        const readLaterBtn = this.shadow.querySelector('.read-later-btn');
        if (readLaterBtn) {
            readLaterBtn.addEventListener('click', (e) => this.handleReadLater(e.currentTarget));
        }

        const shareBtn = this.shadow.querySelector('.share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.handleRateAndComment('content'));
        }

        const closeButton = this.shadow.querySelector('.close-button');
        closeButton.addEventListener('click', () => this.close());
        
        // Initial setup
        this.isLoading = false;
        this._updateUiForState(); 
        
        // This is where the Magic happens: 
        // Checks if paid -> Hides bars. Checks if free -> Shows bars.
        this.updateProgressBar(); 
  
        // Check if we should auto-save read later
        if (window.VR_Reader && window.VR_Reader.isTrackingReadLater) {
            this.handleReadLater({}, true);
            setTimeout(() => {
                const readLaterBtn = this.shadow.querySelector('.read-later-btn');
                if (readLaterBtn) {
                    readLaterBtn.innerHTML = "✓ Saved";
                    readLaterBtn.style.background = "rgba(74, 222, 128, 0.2)";
                    readLaterBtn.style.borderColor = "rgba(74, 222, 128, 0.4)";
                }
            }, 100);
        }

        setTimeout(() => {
            this._calculateRemainingText();
        }, 200);

        setTimeout(() => {
            container.classList.add('visible');
        }, 10);

        // On an in-place rebuild (e.g. settings changed while the overlay is showing),
        // the continue bar may already be flagged as visible but needs its animation
        // re-armed against the freshly rendered markup.
        if (this.showContinueReading) {
            this._showContinueReadingBar();
        }
    }

    /**
     * Re-syncs visibility from the global "reader overlay" settings while the overlay
     * is open, so toggling the side panel settings applies immediately without a
     * page reload. If every reader prompt is disabled the overlay closes entirely.
     */
    applyGlobalOverlaySettings() {
        if (!VR_Reader || !VR_Reader.savedLocalStorageGlobal) return;

        this.showRatingUI = VR_Reader.savedLocalStorageGlobal['DEFAULT_SHOW_VOICE_RATING_PROMPT'] !== false;
        this.showContinueUI = VR_Reader.savedLocalStorageGlobal['DEFAULT_SHOW_CONTINUE_READING_PROMPT'] !== false;

        if (!this.showRatingUI && !this.showContinueUI) {
            this.destroy();
            return;
        }

        if (this.shadow) {
            this.render();
        }
    }
}
