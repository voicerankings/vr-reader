/**
 * AudioEngine (Offscreen Audio Delegator)
 * Handles sending messages to the background offscreen document
 * to actually instantiate and play the HTML5 Audio objects.
 */
export default class AudioEngine {
    constructor(player) {
        this.player = player;
    }

    playAudioInOffscreen({ audioBlobURL, ignoreFirstQueue, index, onPlayCallbackID, onEndedCallbackID, onTimeUpdateCallbackID, onErrorCallbackID }) {
        chrome.runtime.sendMessage({
            action: "play-audio",
            target: 'offscreen',
            tabId: VR_Reader.currentTabId,
            data: { audioBlobURL, ignoreFirstQueue, index, onPlayCallbackID, onTimeUpdateCallbackID, onEndedCallbackID, onErrorCallbackID, tabId: VR_Reader.currentTabId }
        });
    }

    stopPlayingAudioInOffscreen() {
        this.player.resetPlaybackState();
        this.player.externalAudioSpeaking = false;
        this.player.lastPlayAttemptTime = null;
        this.player.lastPlayAttemptIndex = null;
        this.player.lastTimeUpdateTimestamp = null;

        chrome.runtime.sendMessage({
            action: "stop-audio",
            target: "offscreen",
            tabId: VR_Reader.currentTabId
        });
    }

    checkAudioPlayingInOffscreen({ index, callbackID }) {
        chrome.runtime.sendMessage({
            action: "check-audio-playing",
            target: "offscreen",
            tabId: VR_Reader.currentTabId,
            data: { index, callbackID, tabId: VR_Reader.currentTabId }
        });
    }

    base64ToBlob(base64, mimeType, audioObj) {
        const sliceSize = 1024;
        const byteCharacters = atob(base64);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            const slice = byteCharacters.slice(offset, offset + sliceSize);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
            byteArrays.push(new Uint8Array(byteNumbers));
        }
        const blob = new Blob(byteArrays, { type: mimeType });
        const blobURL = URL.createObjectURL(blob);
        if (audioObj) audioObj.audioBlobURL = blobURL;
        return blobURL;
    }

    decodeHtmlEntities(text) {
        const tempElement = document.createElement('div');
        let intermediateText = text.replace(/&amp;([#a-zA-Z0-9]+);/g, '&$1;');
        tempElement.innerHTML = intermediateText;
        return tempElement.textContent;
    }

    fixProcessBugsForService(text, serviceName) {
        if (!text) return '';
        let textWithFixes = this.decodeHtmlEntities(text)
            .replace(/%/g, ' percent')
            .replace(/-!/g, '')
            .replace(/&/g, ' and ')
            .replace(/\s+/g, ' ');
        return textWithFixes.trim();
    }
}
