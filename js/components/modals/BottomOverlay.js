export default class BottomOverlay {
    constructor({
        message = '',
        hasSkip = true,
        callback
    }) {
        this.shadow = null;
        this.message = message;
        this.hasSkip = hasSkip;
        this.callback = callback;
    }
    init(){

            const skipIcon = this.shadow.querySelector('.skip-icon');
            if (skipIcon) {
                skipIcon.addEventListener('click', () => {
                    this.close(false);
                });
            }
        
    }
    initShadowDOM(DOMElement) {
        this.shadow = DOMElement.attachShadow({mode: 'open'});
    }
    clearCallback() {
        this.callback = null;
    }
    close(force = false) {
        const elem = document.querySelector('#shadowdom-summ-bottom-overlay');
        if(elem) {
            const content = this.shadow.querySelector('.overlay-content');
            if (content && !force) {
                // Add slide down animation
                content.classList.add('slide-down');
                
                // Wait for animation to complete before removing
                setTimeout(() => {
                    elem.parentNode.removeChild(elem);
                    if(VR_Reader.bottomOverlayClass) {
                        delete VR_Reader.bottomOverlayClass;
                    }
                    if(this.callback) {
                        this.callback();
                    }
                }, 300); // Match animation duration
            } else {
                // Immediate close if forced
                elem.parentNode.removeChild(elem);
                if(VR_Reader.bottomOverlayClass) {
                    delete VR_Reader.bottomOverlayClass;
                }
                if(!force && this.callback) {
                    this.callback();
                }
            }
        }
    }

    createHTML() {
        return `
            <div class="overlay-wrapper">
                <div class="overlay-container">
                    <div class="smoke-effect"></div>
                    <div class="overlay-content">
                        ${this.message ? `
                            <div class="message">
                                ${this.message}
                            </div>
                        ` : ''}
                        ${this.hasSkip ? `
                            <div class="skip-icon" data-tooltip="Skip back to reading mode" >
                                Skip <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="34" height="34" viewBox="0 -960 960 960"><path d="M660-240v-480h80v480zm-440 0v-480l360 240zm80-150 136-90-136-90z"/></svg>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            ${this.style()}
        `;
    }

    style() {
        return `
        <style>
            .overlay-wrapper {
                position: fixed;
                bottom: 12px;
                left: 0;
                right: 0;
                z-index: 100000000000;
                background-color: transparent;
                justify-content: center;
                align-items: center;
                display: flex;

            }

            .overlay-container {
                margin: 0 auto;
                display: inline-block;
                min-width: 300px;
                position: relative;
            }

.smoke-effect {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 14px;
    z-index: -1;
    opacity: 0;
    pointer-events: none;
    animation: smokeAppear 0.6s ease-out forwards 0.3s;  /* Initial appear animation */
}


            .overlay-content {
                background: linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%);
                color: white;
                border-radius: 8px;
                padding: 10px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                position: relative;
                z-index: 1;
                border: 1px solid black;
                animation: slideUp 0.3s ease-out forwards, glowPulse 4s infinite alternate;
                background-clip: padding-box;
            }

            .message {
                flex-grow: 1;
                font-size: 24px;
                line-height: 1.5;
                margin-left: 20px;
            }

            .skip-icon {
                color: #4f46e5;
                animation: pulse 2s infinite;
                position: relative;
                cursor:pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .skip-icon::before {
                content: attr(data-tooltip);
                position: absolute;
                bottom: 100%;
                right: 50%;
                transform: translateX(50%) translateY(-8px);
                padding: 8px 12px;
                background: rgba(0, 0, 0, 0.85);
                color: white;
                font-size: 12px;
                border-radius: 6px;
                white-space: nowrap;
                pointer-events: none;
                opacity: 0;
                transition: all 0.2s ease-in-out;
            }

            .skip-icon::after {
                content: '';
                position: absolute;
                bottom: 100%;
                right: 50%;
                transform: translateX(50%) translateY(4px);
                border: 6px solid transparent;
                border-top-color: rgba(0, 0, 0, 0.85);
                pointer-events: none;
                opacity: 0;
                transition: all 0.2s ease-in-out;
            }

            .skip-icon:hover::before,
            .skip-icon:hover::after {
                opacity: 1;
                transform: translateX(50%) translateY(0);
            }
            @keyframes slideUp {
                from {
                    transform: translateY(100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0px);
                    opacity: 1;
                }
            }

            @keyframes slideDown {
                from {
                    transform: translateY(0);
                    opacity: 1;
                }
                to {
                    transform: translateY(100%);
                    opacity: 0;
                }
            }

            .slide-down {
                animation: slideDown 0.3s ease-in forwards;
            }

            @keyframes pulse {
                0% {
                    opacity: 0.6;
                }
                50% {
                    opacity: 1;
                }
                100% {
                    opacity: 0.6;
                }
            }

            @keyframes smokeAppear {
                0% {
                    opacity: 0;
                    box-shadow:
                        0 0 0 0 rgba(79, 70, 229, 0),
                        0 0 0 0 rgba(79, 70, 229, 0),
                        0 0 0 0 rgba(79, 70, 229, 0),
                        0 0 0 0 rgba(138, 43, 226, 0);
                }
                100% {
                    opacity: 0.5;
                    box-shadow:
                        0 0 7px 2px rgba(79, 70, 229, 0.5),
                        0 0 15px 7px rgba(79, 70, 229, 0.4),
                        0 0 25px 12px rgba(79, 70, 229, 0.3),
                        0 0 40px 20px rgba(138, 43, 226, 0.2);
                }
                        
            }

            @keyframes glowPulse {
                0% {
                    box-shadow: 0 0 10px rgba(79, 70, 229, 0.4);
                }
                50% {
                    box-shadow: 0 0 15px rgba(138, 43, 226, 0.4);
                }
                100% {
                    box-shadow: 0 0 10px rgba(79, 70, 229, 0.4);
                }
            }
        </style>
        `;
    }

    render() {
        this.shadow.innerHTML = this.createHTML();
        this.init()

    }
}
