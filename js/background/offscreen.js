/**
 * ============================================================================
 * Background Offscreen Module
 * ============================================================================
 * Manages the lifecycle and communication of the Chrome Offscreen Document.
 * Because Manifest V3 service workers cannot play audio directly, this module 
 * spawns a hidden HTML document (off_screen.html) solely for audio playback.
 */
const OFFSCREEN_DOCUMENT_PATH = '/off_screen.html';

async function sendAudioDataToOffscreenDocument(type, data) {
  try {
    if (!(await hasOffscreenDocument())) {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
        justification: 'Play text-speech-audio requested by the user'
      });
    }

    chrome.runtime.sendMessage({
      type,
      target: 'offscreen',
      data
    });
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

async function stopPlayingAudioOffscreenDocument() {
  try {
    if ((await hasOffscreenDocument())) {
      chrome.runtime.sendMessage({
        type: 'stop-audio',
        target: 'offscreen',
        data: null
      });
    }
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

async function hasOffscreenDocument() {
  try {
    const matchedClients = await clients.matchAll();
    for (const client of matchedClients) {
      if (client.url.endsWith(OFFSCREEN_DOCUMENT_PATH)) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error(`Error in hasDocument: ${error}`);
    return false;
  }
}

export {
  sendAudioDataToOffscreenDocument,
  stopPlayingAudioOffscreenDocument,
  hasOffscreenDocument
};
