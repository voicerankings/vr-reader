/**
 * ============================================================================
 * messageListeners Module
 * ============================================================================
 * Sets up the primary message listeners for the content script to communicate
 * with the background script. Handles incoming commands to trigger text reading,
 * highlighting, and text fragment extraction on the current page.
 */
window.VR_Reader = window.VR_Reader || {};
const VR_Reader = window.VR_Reader;
import { getFormattedSelection } from '../utils/helpers.js';
import * as CONSTANTS from '../constants/constants.js';

chrome.runtime.onMessage.addListener(async function (message, sender, sendResponse) {

     if (message.action === "vrrPageRead") {
        VR_Reader.readWithVRR();
        await VR_Reader.changeActiveVoice();
    } 

    if (message.action === "readHighlightWithVRR") {
        let selectText = getFormattedSelection();
        if (selectText.length > 0) {
            console.log("selectText", selectText)
            VR_Reader.readHighlightedTextSelection = selectText
            VR_Reader.readHighlightedText(selectText)
        } else {
            VR_Reader.readHighlightedTextSelection = message.selection;
            VR_Reader.readHighlightedText(message.selection)
        }
        await VR_Reader.changeActiveVoice();
    }

    if (message.action === "errorMessage") {
        VR_Reader.makePrompt({
            posX: 50, 
            posY: 50,
            action: 'vrr-theme ', 
            icon: CONSTANTS.NOTIFICATION_ICON.ERROR_32,
            title: `<div style="width:274px;">${message.data.errorTitle}</div>`,
            message: message.data.errorMessage,
            cancel: {
                buttonText: 'Close'
            }
        })
    }

    if (message.action === "playback-pause-play") {
        VR_Reader.ttsWidget.playbackClass.playbackShortcuts(message.action);
    } else if (message.action === "playback-previous-line") {
        VR_Reader.ttsWidget.playbackClass.playbackShortcuts(message.action);
    } else if (message.action === "playback-next-line") {
        VR_Reader.ttsWidget.playbackClass.playbackShortcuts(message.action);
    } else if (message.action === "VRR_Requests") {
        VR_Reader.completeRequest(message.callbackID, message.data, message.data.deleteFromQueue);
    } else if (message.action === "getCurrentTabId") {
        VR_Reader.currentTabId = message.data.tabId;
    } else if (message.action === "auto-start-reader") {
        let selectText = getFormattedSelection();
        if (selectText.length > 0) {
            VR_Reader.readHighlightedTextSelection = selectText;
            VR_Reader.readHighlightedText(selectText);
            await VR_Reader.changeActiveVoice();
        } else {
            VR_Reader.readWithVRR();
            await VR_Reader.changeActiveVoice();
        }
    } else if (message.action === "updateUserStatus") {
        if (VR_Reader.loadUserAndAutoSettings) {
            VR_Reader.loadUserAndAutoSettings();
        }
    } else if (message.action === "resumeReadLater") {
        console.log("✅ Received resumeReadLater push from background");
        if (VR_Reader.triggerReadLaterOverlay) {
            VR_Reader.triggerReadLaterOverlay(message.bookmark);
        }
    }
    sendResponse(true);
});

export function openContentScriptPort() {
    window.VR_Reader.myPort = chrome.runtime.connect({ name: "contentscript-port" });
    window.VR_Reader.myPort.onMessage.addListener(async (m) => {
        if (m.action === "update-auto-save-and-play") {
            await VR_Reader.storeDefaults();
            if (VR_Reader.ttsWidget) {
                if (m.type === "auto-play") VR_Reader.ttsWidget.setDefaultReader();
            }
        } else if (m.action === "VRR_Requests") {
            VR_Reader.completeRequest(m.callbackID, m.data, m.data.deleteFromQueue);
        } else if (m.action === "getCurrentTabId") {
            VR_Reader.currentTabId = m.data.tabId;
        } else if (m.action === "update-contentscript-storage") {
            await VR_Reader.storeDefaults();

            if (m.key === 'DEFAULT_PREMIUM_VOICE_ID') {
                if (VR_Reader.vrrQuickAccessButton) {
                    VR_Reader.vrrQuickAccessButton.defaultVoiceId = m.value;
                    if (VR_Reader.vrrQuickAccessButton.shadow) {
                        const allDefaultButtons = VR_Reader.vrrQuickAccessButton.shadow.querySelectorAll('.default-voice-btn');
                        allDefaultButtons.forEach(btn => {
                            const btnVoiceId = btn.closest('.list-item')?.dataset.voiceId;
                            if (btnVoiceId === m.value) {
                                btn.classList.add('is-default');
                                btn.style.color = '#10b981';
                            } else {
                                btn.classList.remove('is-default');
                                btn.style.color = '#9ca3af';
                            }
                        });
                    }
                }

                // Propagate DEFAULT to ACTIVE immediately so open widgets play the new voice
                const keys = [
                    'PREMIUM_VOICE_SERVICE', 'PREMIUM_VOICE_ID', 'PREMIUM_VOICE_NAME',
                    'PREMIUM_VOICE_GENDER', 'PREMIUM_VOICE_INSTRUCTIONS', 'PREMIUM_VOICE_LANGUAGE_CODE',
                    'PREMIUM_VOICE_SPEAKER_ID', 'PREMIUM_VOICE_WORDS_PER_MINUTE', 'PREMIUM_VOICE_SPEED',
                    'PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT', 'PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT'
                ];
                let activeDataToSave = {};
                keys.forEach(k => {
                    if (VR_Reader.savedLocalStorageGlobal[`DEFAULT_${k}`] !== undefined) {
                        activeDataToSave[`ACTIVE_${k}`] = VR_Reader.savedLocalStorageGlobal[`DEFAULT_${k}`];
                    }
                });

                if (Object.keys(activeDataToSave).length > 0) {
                    await import('../utils/helpers.js').then(m => m.saveToLocalStorage(activeDataToSave, false));
                    await VR_Reader.changeActiveVoice();
                }
            }

            if (m.key === 'DEFAULT_TTS_VOICE_SERVICE' || m.key === 'DEFAULT_PREMIUM_VOICE_SPEED' || m.key === 'DEFAULT_VOICE_SPEED' || m.key === 'DEFAULT_PREMIUM_VOICE_SPEAKER_ID' || m.key === 'DEFAULT_PREMIUM_VOICE_ID') {
                if (VR_Reader.ttsWidget) {
                    VR_Reader.ttsWidget.setDefaultVoice();
                }
            }

            if (m.key === 'CUSTOM_DOMAIN_FILTERS' || m.key === 'DOMAIN_FILTER_ENABLED') {
                if (typeof VR_Reader.loadDomainFilters === 'function') {
                    VR_Reader.loadDomainFilters();
                }
            }

            if (m.key === 'DEFAULT_QUICK_ACCESS_CONTROLS_STATE') {
                if (m.value) {
                    if (window.location.pathname !== '/') {
                        VR_Reader.start_VRR();
                    }
                } else {
                    if (VR_Reader.vrrQuickAccessButton) {
                        VR_Reader.vrrQuickAccessButton.close(true);
                    }
                    const leftoverQuickAccess = document.querySelector('#vrr-quick-access-host');
                    if (leftoverQuickAccess) leftoverQuickAccess.remove();
                }
            }

            if (m.key === 'DEFAULT_ENTER_KEY_PLAY_STATE') {
                // Re-evaluate selection state so the hint / Enter shortcut react
                // immediately when the setting is toggled from the sidepanel.
                if (VR_Reader.vrrQuickAccessButton && typeof VR_Reader.vrrQuickAccessButton.selectionChangeHandler === 'function') {
                    VR_Reader.vrrQuickAccessButton.selectionChangeHandler();
                }
                if (typeof VR_Reader.refreshSelectionHintPopup === 'function') {
                    VR_Reader.refreshSelectionHintPopup();
                }
            }

            if (m.key === 'DEFAULT_SHOW_VOICE_RATING_PROMPT' || m.key === 'DEFAULT_SHOW_CONTINUE_READING_PROMPT') {
                // Live-apply the reader overlay settings to any overlay currently
                // showing on this page, so toggles take effect without a reload.
                if (VR_Reader.ratingsOverlayClass) {
                    VR_Reader.ratingsOverlayClass.applyGlobalOverlaySettings();
                }
            }

            if (m.key === 'DEFAULT_QUICK_ACCESS_CONTROLS_PANEL_PLACEMENT_STATE') {
                const placement = (m.value === 'middle' || m.value === 'bottom') ? m.value : 'bottom';
                if (VR_Reader.vrrQuickAccessButton && VR_Reader.vrrQuickAccessButton.shadow) {
                    const containerEl = VR_Reader.vrrQuickAccessButton.shadow.querySelector('.container');
                    if (containerEl) {
                        containerEl.classList.remove('placement-middle', 'placement-bottom');
                        containerEl.classList.add('placement-' + placement);
                    }
                }
                if (VR_Reader.ttsWidget && VR_Reader.ttsWidget.superUltraRoot) {
                    const vrReaderEl = VR_Reader.ttsWidget.superUltraRoot.querySelector('#VR-Reader');
                    if (vrReaderEl) {
                        vrReaderEl.classList.remove('placement-middle', 'placement-bottom');
                        vrReaderEl.classList.add('placement-' + placement);
                    }
                }
            }
        } else if (m.action === "update-contentscript-user-logged-in") {
            VR_Reader.loadUserAndAutoSettings();
            if (window.location.href.indexOf("extension/tour") > -1 && document.getElementById("hiddenUserLoggedInFlag")) {
                document.getElementById("hiddenUserLoggedInFlag").value = "true";
            }
        } else if (m.action === "save-user-settings-to-server") {
            await VR_Reader.storeDefaults();
        }
    });
}