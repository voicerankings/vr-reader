/**
 * ============================================================================
 * VoiceSpeedAdjuster Module
 * ============================================================================
 * Manages the playback speed controls (0.5x to 2.0x) within the widget UI.
 * Handles reading/writing the active speed state from local storage and updates
 * the TTS engine when the user selects a new playback speed.
 */
import { saveToLocalStorage, readLocalStorage } from "../../utils/helpers";

export default class VoiceSpeedAdjuster {
    constructor() {
        this.el = null;
        this.componentDiv = null;
        this.componentIDNAME = "SPEEDADJUSTER";

        this.activeSpeed = 1.0;
        this.supportsSpeedControl = true;
        this.speedOptions = this.generateSpeedOptions();
    }

    initDOM(DOMElement) {
        this.el = DOMElement;
    }

    async init() {
        try {
            await this.loadState();
            // Render the buttons on init, but DO NOT scroll yet, as the component may be hidden.
            this.renderSpeedButtons();
            this.componentDiv.querySelector("#SpeedListContainer").addEventListener('click', (e) => this.handleSpeedClick(e));
        } catch (e) {
            console.error("Error initializing SpeedAdjuster:", e);
        }
    }

    /**
     * MUST be called when the component's container becomes visible (e.g., after style.display is set to 'block').
     * This ensures the browser can calculate the correct scroll position.
     */
    onVisible() {
        // We use a timeout to push the scrolling to the end of the browser's execution queue.
        // This gives the browser a moment to paint the element and calculate its dimensions.
        setTimeout(() => {
            this.centerActiveButton(false); // Scroll instantly the first time it's shown.
        }, 0);
    }

    /**
     * Rerenders the component state and UI.
     * This method can be called from other parts of the application when the active voice changes.
     */
    async rerender() {
        await this.loadState();
        this.renderSpeedButtons();
        // When rerendering, the component is likely already visible,
        // so we can try to scroll immediately. The smooth scroll provides good UX here.
        this.centerActiveButton(true);
    }

    /**
     * Loads the necessary state from local storage and updates the class properties.
     */
    async loadState() {
        const storage = await readLocalStorage([
            'ACTIVE_PREMIUM_VOICE_SPEED',
            'DEFAULT_PREMIUM_VOICE_SPEED',
            'ACTIVE_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT'
        ]);

        // Determine if the current voice supports speed control. Default to true if not set.
        this.supportsSpeedControl = storage.ACTIVE_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT ?? true;

        // Set the active speed. Fallback chain: Active Speed -> Default Speed -> 1.0
        // Use parseFloat to ensure it's a number for comparisons.
        this.activeSpeed = parseFloat(storage.ACTIVE_PREMIUM_VOICE_SPEED || storage.DEFAULT_PREMIUM_VOICE_SPEED || 1.0);
    }

    /**
     * Generates the list of speed options from 0.5 to 2.0.
     */
    generateSpeedOptions() {
        const options = [];
        // Use integer iteration to avoid floating point precision issues
        for (let i = 50; i <= 200; i += 10) {
            options.push(i / 100);
        }
        return options;
    }

    handleSpeedClick(e) {
        const speedButton = e.target.closest('.speed-button:not([disabled])');
        if (speedButton) {
            const newSpeed = parseFloat(speedButton.dataset.speed);
            this.selectSpeed(newSpeed);
        }
    }

    async selectSpeed(speed) {
        // Update local state
        this.activeSpeed = speed;

        // Save to local storage
        await saveToLocalStorage({ 'ACTIVE_PREMIUM_VOICE_SPEED': speed }, true);
        await saveToLocalStorage({ 'DEFAULT_PREMIUM_VOICE_SPEED': speed }, true);

        // Notify other parts of the app that the voice settings have changed
        await VR_Reader.changeActiveVoice();
        if (VR_Reader.ttsWidget && VR_Reader.ttsWidget.voiceClass) {
            VR_Reader.ttsWidget.voiceClass.voiceChanged();
        }

        // Update the UI to highlight the newly selected speed
        this.highlightSelectedSpeed(speed);
    }

    highlightSelectedSpeed(speed) {
        const allButtons = this.componentDiv.querySelectorAll('.speed-button');
        allButtons.forEach(button => {
            // Compare floating point numbers with a tolerance by converting to fixed string
            if (parseFloat(button.dataset.speed).toFixed(2) === speed.toFixed(2)) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

   renderSpeedButtons() {
        const container = this.componentDiv.querySelector("#SpeedListContainer");
        const messageEl = this.componentDiv.querySelector("#SpeedUnsupportedMessage");

        if (!container || !messageEl) return;

        if (this.supportsSpeedControl) {
            messageEl.style.display = 'none';
        } else {
            messageEl.style.display = 'block';
            this.activeSpeed = 1.0;
        }

        const html = this.speedOptions.map(option => {
            const isSelected = option.toFixed(2) === this.activeSpeed.toFixed(2);
            const isDisabled = !this.supportsSpeedControl && option !== 1.0;
            return `
                <button 
                    class="speed-button ${isSelected ? 'active' : ''}" 
                    data-speed="${option.toFixed(2)}"
                    ${isDisabled ? 'disabled' : ''}
                >
                    ${option.toFixed(2)}x
                </button>
            `;
        }).join('');

        container.innerHTML = html;
    }

    centerActiveButton(isSmooth = false) {
        // This is a crucial check. `offsetParent` is null if the element or any of its
        // ancestors has `display: none`. This prevents the function from running when hidden.
        if (!this.componentDiv || this.componentDiv.offsetParent === null) {
            return;
        }

        const container = this.componentDiv.querySelector("#SpeedListContainer");
        if (!container) return;

        const activeButton = container.querySelector('.speed-button.active');
        if (activeButton) {
            activeButton.scrollIntoView({
                behavior: isSmooth ? 'smooth' : 'auto', // Use smooth scrolling only when requested
                block: 'center', // This is the key to vertical centering
                inline: 'center' // For horizontal centering if ever needed
            });
        }
    }

    createHTML() {
        return `
            <div class="speed-adjuster-container">
                <div id="SpeedUnsupportedMessage" class="unsupported-message" style="display: none;">
                    The current voice does not support speed adjustments.
                </div>
                <div id="SpeedListContainer" class="speed-list-container">
                    <!-- Speed buttons will be rendered here by JavaScript -->
                </div>
            </div>
            ${this.style()}
        `;
    }

    style() {
        if (!this.el.querySelector(`#${this.componentIDNAME}_STYLE`)) {
            return `
                <style id="${this.componentIDNAME}_STYLE">
                    .speed-adjuster-container {
                        height: 100%;
                        display: flex;
                        flex-direction: column;
                        background: white;
                        border-radius: 8px;
                        padding: 8px;
                        box-sizing: border-box;
                    }

                    .speed-list-container {
                        height: 300px; /* As per your code */
                        flex-grow: 1;
                        overflow-y: auto;
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
                        gap: 8px;
                        padding: 4px;
                    }

                    .unsupported-message {
                        padding: 12px;
                        margin-bottom: 8px;
                        text-align: center;
                        font-size: 13px;
                        color: #666;
                        background-color: #f8f9fa;
                        border-radius: 6px;
                        border: 1px solid #e0e0e0;
                    }

                    .speed-button {
                        padding: 10px 0;
                        border: 1px solid #e0e0e0;
                        background: #fdfdfd;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        color: #555;
                        transition: all 0.2s ease-in-out;
                        text-align: center;
                    }

                    .speed-button:hover:not([disabled]) {
                        background: #f0f0f0;
                        border-color: #ccc;
                    }

                    .speed-button.active {
                        background: #3b82f6;
                        color: white;
                        border-color: #3b82f6;
                        box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
                        transform: translateY(-1px);
                    }

                    .speed-button[disabled] {
                        background: #f5f5f5;
                        color: #bbb;
                        cursor: not-allowed;
                        border-color: #eee;
                    }
                    
                    .speed-button[disabled].active {
                         background: #d1d5db;
                         color: #6b7280;
                         border-color: #9ca3af;
                         box-shadow: none;
                         transform: none;
                    }

                    /* Scrollbar Styles */
                    .speed-list-container::-webkit-scrollbar {
                        width: 6px;
                    }
                    .speed-list-container::-webkit-scrollbar-track {
                        background: #f1f1f1;
                        border-radius: 3px;
                    }
                    .speed-list-container::-webkit-scrollbar-thumb {
                        background: #ccc;
                        border-radius: 3px;
                    }
                    .speed-list-container::-webkit-scrollbar-thumb:hover {
                        background: #999;
                    }
                </style>
            `;
        }
        return '';
    }

    render() {
        this.componentDiv = document.createElement("div");
        this.componentDiv.id = `${this.componentIDNAME}_Component`;
        this.componentDiv.style.height = `100%`;
        this.componentDiv.innerHTML = this.createHTML();

        this.el.append(this.componentDiv);
        this.init();
    }
}
