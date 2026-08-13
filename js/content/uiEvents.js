/**
 * ============================================================================
 * uiEvents Module
 * ============================================================================
 * Initializes global UI event listeners on the webpage. Specifically, it tracks
 * clicks on special routing links (e.g., "voicerankings-link") to perform actions
 * like setting default voices, signing in, or opening the settings panel.
 */
import { saveToLocalStorage } from '../utils/helpers.js';

export function initializeLinkRouting() {
    // Link event listener for navigation
    // Lets you trigger actions  on the page, outside the content script (sign in, set default voice, open side panel settings)
    document.addEventListener('click', async (e) => {

        const link = e.target.closest('.voicerankings-link');

        if (!link) return;

        e.preventDefault();

        const linkType = link.getAttribute('data-type');

        const linkData = link.dataset;

        switch (linkType) {

            case 'set-default':
                console.log(linkData);
                let defaultVoiceData = {};

                defaultVoiceData['ACTIVE_PREMIUM_VOICE_SERVICE'] = linkData['voiceService']
                defaultVoiceData['ACTIVE_PREMIUM_VOICE_ID'] = linkData['voiceId']
                defaultVoiceData['ACTIVE_PREMIUM_VOICE_NAME'] = linkData['voiceName']
                defaultVoiceData['ACTIVE_PREMIUM_VOICE_GENDER'] = linkData['voiceGender']
                defaultVoiceData['ACTIVE_PREMIUM_VOICE_INSTRUCTIONS'] = linkData['voiceInstructions']
                defaultVoiceData['ACTIVE_PREMIUM_VOICE_LANGUAGE_CODE'] = linkData['voiceLanguageCode']
                defaultVoiceData['ACTIVE_PREMIUM_VOICE_SPEAKER_ID'] = linkData['voiceSpeakerId']
                defaultVoiceData['ACTIVE_PREMIUM_VOICE_WORDS_PER_MINUTE'] = linkData['voiceWordsPerMinute']
                defaultVoiceData['ACTIVE_PREMIUM_VOICE_SPEED'] = Number(linkData['voiceSpeed'])

                defaultVoiceData['ACTIVE_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT'] =
                    String(linkData['voiceHasVoiceSpeedSupport']).toLowerCase() === 'true';

                defaultVoiceData['ACTIVE_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT'] =
                    String(linkData['voiceHasWordTimestampSupport']).toLowerCase() === 'true';

                defaultVoiceData['DEFAULT_PREMIUM_VOICE_SERVICE'] = linkData['voiceService']
                defaultVoiceData['DEFAULT_PREMIUM_VOICE_ID'] = linkData['voiceId']
                defaultVoiceData['DEFAULT_PREMIUM_VOICE_NAME'] = linkData['voiceName']
                defaultVoiceData['DEFAULT_PREMIUM_VOICE_GENDER'] = linkData['voiceGender']
                defaultVoiceData['DEFAULT_PREMIUM_VOICE_INSTRUCTIONS'] = linkData['voiceInstructions']
                defaultVoiceData['DEFAULT_PREMIUM_VOICE_LANGUAGE_CODE'] = linkData['voiceLanguageCode']
                defaultVoiceData['DEFAULT_PREMIUM_VOICE_SPEAKER_ID'] = linkData['voiceSpeakerId']
                defaultVoiceData['DEFAULT_PREMIUM_VOICE_WORDS_PER_MINUTE'] = linkData['voiceWordsPerMinute']
                defaultVoiceData['DEFAULT_PREMIUM_VOICE_SPEED'] = Number(linkData['voiceSpeed'])

                defaultVoiceData['DEFAULT_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT'] =
                    String(linkData['voiceHasVoiceSpeedSupport']).toLowerCase() === 'true';

                defaultVoiceData['DEFAULT_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT'] =
                    String(linkData['voiceHasWordTimestampSupport']).toLowerCase() === 'true';

                Object.assign(defaultVoiceData, linkData)

                chrome.runtime.sendMessage({
                    action: "saveVoiceDefaultOnServer",
                    payload: defaultVoiceData
                });

                await saveToLocalStorage(defaultVoiceData, true);

                if (window.VR_Reader && window.VR_Reader.changeActiveVoice) {
                    await window.VR_Reader.changeActiveVoice();
                }

                chrome.runtime.sendMessage({ action: "UPDATE_CONTEXT_MENU_VOICES" });
                break;

            case 'sign-in':
                chrome.runtime.sendMessage({
                    action: "open-sidepanel",
                    route: "/main-menu",
                    data: {
                        openLoginModal: true
                    }
                });
                break;

            case 'openrouter':
                chrome.runtime.sendMessage({
                    action: "open-sidepanel",
                    route: "/main-menu",
                    data: {
                        openOpenRouterModal: true
                    }
                });
                break;

            case 'settings':
                chrome.runtime.sendMessage({
                    action: "open-sidepanel",
                    key: "settings",
                    data: linkData
                });
                break;

            case 'open-byok':
                chrome.runtime.sendMessage({
                    action: "open-sidepanel",
                    route: "/settings",
                    data: {
                        tab: 'byok',
                        provider: linkData.provider
                    }
                });
                break;

            case 'open-voice-list':
                chrome.runtime.sendMessage({
                    action: "open-sidepanel",
                    route: "/voices",
                    data: {
                        provider: linkData.provider
                    }
                });
                break;

            default:
                console.log('Unknown link type:', linkType);
        }
    });
}
