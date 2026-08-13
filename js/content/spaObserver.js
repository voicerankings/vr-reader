/**
 * ============================================================================
 * spaObserver Module
 * ============================================================================
 * Manages the initialization of the TTS reader in Single Page Applications (SPA).
 * It provides functions to start the reader widget ("vrr-quick-access-host") and 
 * correctly reset the reader's state and UI when navigating between virtual pages.
 */
window.VR_Reader = window.VR_Reader || {};
const VR_Reader = window.VR_Reader;
import Start_VRR from '../components/core/Start_VRR.js';
import { sleep } from '../utils/helpers.js';
import { CONSTANTS } from '../constants/constants.js';

function start_VRR() {

    if (!document.body) {
        setTimeout(start_VRR, 100);
        return false;
    }

    if (VR_Reader.savedLocalStorageGlobal['DEFAULT_QUICK_ACCESS_CONTROLS_STATE'] === false) {
        return false;
    }

    if (VR_Reader.savedLocalStorageDomain && VR_Reader.savedLocalStorageDomain[CONSTANTS.DOMAIN_QUICK_ACCESS_STATE_KEYNAME] === false) {
        return false;
    }

    if (document.querySelector("#shadowdom-vr-reader") !== null) {
        return false;
    }
    if (document.querySelector("#vrr-quick-access-host")) {
        return false;
    }

    if (VR_Reader.vrrQuickAccessButton) {
        VR_Reader.vrrQuickAccessButton.close(true)
    }

    const shadowDomDiv = document.createElement('div');
    shadowDomDiv.id = "vrr-quick-access-host";
    shadowDomDiv.style.height = "30px";
    shadowDomDiv.style.width = "60px";
    shadowDomDiv.style.bottom = "0px";
    shadowDomDiv.style.position = "absolute";
    shadowDomDiv.style.whiteSpace = "normal !important";
    shadowDomDiv.style.display = "-webkit-inline-box";
    shadowDomDiv.setAttribute('class', 'vrr-quick-access');               
    document.body.appendChild(shadowDomDiv);

    VR_Reader.vrrQuickAccessButton = new Start_VRR({});	
    VR_Reader.vrrQuickAccessButton.initShadowDOM(shadowDomDiv)
    VR_Reader.vrrQuickAccessButton.render();
}

VR_Reader.start_VRR = function() {
    start_VRR();
}

/**
 * ============================================================================
 * SPA Navigation Detection
 * ============================================================================
 * Client-side routers (React/Vue/Substack-style) navigate via the History API
 * without reloading the page, so the content script never re-runs and
 * start_VRR() is never called again.
 *
 * NOTE: Content scripts run in an isolated world, so patching
 * history.pushState here cannot intercept the page's own router. Instead we
 * watch shared DOM mutations and compare location.href (DOM is shared across
 * worlds), plus popstate and a low-frequency interval as safety nets.
 */
let lastUrl = window.location.href;
let spaNavTimer = null;

function handleSPANavigation() {
    if (window.location.href === lastUrl) return;
    lastUrl = window.location.href;
    console.log('[VRR] SPA navigation detected:', window.location.href);
    clearTimeout(spaNavTimer);
    spaNavTimer = setTimeout(() => {
        if (window.location.pathname === '/') {
            if (VR_Reader.vrrQuickAccessButton) {
                VR_Reader.vrrQuickAccessButton.destroy()
                VR_Reader.vrrQuickAccessButton = null;
            }
            const leftoverHost = document.querySelector('#vrr-quick-access-host');
            if (leftoverHost) leftoverHost.remove();
            return;
        }
        start_VRR();
    }, 200);
}

(function initSPAObserver() {
    if (!document.documentElement) {
        setTimeout(initSPAObserver, 50);
        return;
    }
    const observer = new MutationObserver(handleSPANavigation);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    window.addEventListener('popstate', handleSPANavigation);
    setInterval(handleSPANavigation, 1000);
})();

VR_Reader.closeVR_ReaderAndReloadQuickAccess = async() => {
    if (VR_Reader.ttsWidget && VR_Reader.ttsWidget.getReadMode() === "") {
        return false;
    }

    if (VR_Reader.ttsWidget) {
        VR_Reader.ttsWidget.close(false);
    }
    
    VR_Reader.readWithVRRBoolean = null
    VR_Reader.readHighlightedTextSelection = "";
    VR_Reader.readWithVRRPageText = ""; 
    VR_Reader.readWithVRRPageTitle = ""; 
    VR_Reader.readWithVRRPagePublished = ""; 
    VR_Reader.readWithVRRPageAuthor = "";

    if (VR_Reader.ttsWidget && VR_Reader.ttsWidget.highlightsClass) {
        VR_Reader.ttsWidget.highlightsClass.resetTimestamps()
    }

    

    if (VR_Reader.vrrQuickAccessButton) {
        VR_Reader.vrrQuickAccessButton.destroy()
        VR_Reader.vrrQuickAccessButton = null;
    }

    await sleep(100);
    
    try {
        var doc = document.cloneNode(true);
        console.log("isProbablyReaderable", window.isProbablyReaderable(doc))
        if (window.isProbablyReaderable(doc) === true && window.location.pathname !== '/') { 
            start_VRR()
        }
    } catch(e) {
        if (window.location.pathname !== '/') {
            start_VRR()
        }
    }
}

