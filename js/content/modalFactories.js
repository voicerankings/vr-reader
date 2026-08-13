/**
 * ============================================================================
 * modalFactories Module
 * ============================================================================
 * Provides factory functions to dynamically create, render, and manage various
 * UI modals and overlays (Toast, Prompt, Ratings, BottomOverlay, ModalLarge).
 * Ensures only one instance of each modal type exists and mounts them within Shadow DOMs.
 */
window.VR_Reader = window.VR_Reader || {};
const VR_Reader = window.VR_Reader;

import VRR_Toast from '../components/notifications/VRR_Toast.js';
import VRR_Prompt from '../components/notifications/VRR_Prompt.js';
import RatingsOverlay from '../components/modals/RatingsOverlay.js';
import BottomOverlay from '../components/modals/BottomOverlay.js';
import ModalLarge from '../components/modals/ModalLarge.js';

function makeToast({hideProgressBar, icon, title, message, posX, posY, posX2, posY2, action, delay = undefined, callback, forceCloseCallback}) {
    if (!VR_Reader.toastClass) {
        VR_Reader.toastClass = new VRR_Toast({hideProgressBar, icon, title, message, action, delay, callback, forceCloseCallback});
    } else if (document.getElementById("shadowdom-vrr-toast")) {
        const elem = document.querySelector('#shadowdom-vrr-toast');
        if (elem) { elem.parentNode.removeChild(elem); }
    }

    if (!document.getElementById("shadowdom-vrr-toast")) {
        const shadowDomDiv = document.createElement('div');
        shadowDomDiv.setAttribute('id', 'shadowdom-vrr-toast');  
        shadowDomDiv.setAttribute('class', 'vr-shadowdom');                         
        document.body.appendChild(shadowDomDiv);

        VR_Reader.toastClass.initShadowDOM(shadowDomDiv)
        VR_Reader.toastClass.render(posX, posY, posX2, posY2);
    }
}

VR_Reader.makeToast = makeToast;

function makePrompt({posX, posY, action, title, icon, className = '', message, promptType, promptInfo, actions, cancel = undefined}) {
    if (document.getElementById("shadowdom-highlight-prompt")) {
        if (!VR_Reader.promptClass) {
            VR_Reader.promptClass = new VRR_Prompt({action, className, title, icon, message, promptInfo, promptType, actions, cancel});
        } else {
            const elem = document.querySelector('#shadowdom-highlight-prompt');
            if (elem) { elem.parentNode.removeChild(elem); }
        }
    }

    if (!document.getElementById("shadowdom-highlight-prompt")) {
        const shadowDomDiv = document.createElement('div');
        shadowDomDiv.setAttribute('id', 'shadowdom-highlight-prompt');     
        shadowDomDiv.setAttribute('class', `hili-shadowdom ${className}`);                        
        document.body.appendChild(shadowDomDiv);

        VR_Reader.promptClass = new VRR_Prompt({
            action, className, title, icon, message, promptInfo, promptType, actions, cancel
        });	
        VR_Reader.promptClass.initShadowDOM(shadowDomDiv)
        VR_Reader.promptClass.render(posX, posY);
    }
}

VR_Reader.makePrompt = makePrompt;

function makeBottomOverlay({message, hasSkip = true, callback}) {
    if (VR_Reader.bottomOverlayClass) {
        VR_Reader.bottomOverlayClass.close(true)
    } else if (document.getElementById("shadowdom-summ-bottom-overlay")) {
        const elem = document.querySelector('#shadowdom-summ-bottom-overlay');
        if (elem) { elem.parentNode.removeChild(elem); }
    }

    if (!document.getElementById("shadowdom-summ-bottom-overlay")) {
        const shadowDomDiv = document.createElement('div');
        shadowDomDiv.setAttribute('id', 'shadowdom-summ-bottom-overlay');  
        shadowDomDiv.setAttribute('class', 'vr-shadowdom');                         
        document.body.appendChild(shadowDomDiv);

        VR_Reader.bottomOverlayClass = new BottomOverlay({message, hasSkip, callback});		
        VR_Reader.bottomOverlayClass.initShadowDOM(shadowDomDiv)
        VR_Reader.bottomOverlayClass.render();
    }
}

VR_Reader.makeBottomOverlay = makeBottomOverlay;

function makeRatingsOverlay({voice, generation_credits, replayQueue, index, 
    callback, sessionId, showCreditWarning = false, hasOwnKey = false}) {
 
    // Step 1: ALWAYS clean up any previous overlay first.
    // The DOM is the single source of truth.
    const existingElement = document.getElementById("shadowdom-vk-ratings-overlay");
    if (existingElement) {
        existingElement.remove(); // The simplest way to remove an element.
    }

    // Step 2: ALWAYS create the new overlay. No more complex `if` conditions.
    const shadowDomDiv = document.createElement('div');
    shadowDomDiv.id = 'shadowdom-vk-ratings-overlay';
    shadowDomDiv.className = 'vr-shadowdom';
    document.body.appendChild(shadowDomDiv);

    // Create and render the new instance. We don't need to store it globally anymore.

    VR_Reader.ratingsOverlayClass = new RatingsOverlay({
        voice, 
        generation_credits, 
        replayQueue, 
        index, 
        callback, 
        sessionId, 
        showCreditWarning, 
        hasOwnKey
    });	
    VR_Reader.ratingsOverlayClass.initShadowDOM(shadowDomDiv)
    VR_Reader.ratingsOverlayClass.render();

    // The overlayInstance will be garbage collected automatically when it destroys itself.
}

VR_Reader.makeRatingsOverlay = makeRatingsOverlay;

function makeModalLarge({customFunction, styleCSS, title, message, actions, callbackData, closeCallback}) {
    if (document.querySelector("#shadowdom-modal-large") !== null) {
        VR_Reader.modalLargeClass.close(true);
    }
    const shadowDomDiv = document.createElement('div');
    shadowDomDiv.setAttribute('id', 'shadowdom-modal-large');     
    shadowDomDiv.setAttribute('class', 'hili-shadowdom');                        
    document.body.appendChild(shadowDomDiv);

    VR_Reader.modalLargeClass = new ModalLarge({
        customFunction, styleCSS, title, message, actions, callbackData, closeCallback
    });	
    VR_Reader.modalLargeClass.initShadowDOM(shadowDomDiv);
    VR_Reader.modalLargeClass.render();
}

VR_Reader.makeModalLarge = makeModalLarge;