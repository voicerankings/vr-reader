/**
 * ============================================================================
 * Background API Client Module
 * ============================================================================
 * Centralized API client for all backend network requests originating from the 
 * background service worker. Handles authentication, error tracking, and routing 
 * for external TTS providers, saving ratings, fetching user settings, and more.
 */
import { getHandler, getProviderUrl } from '../tts-providers/index.js';
import { SERVICE_TO_STORAGE_KEY_MAP, readLocalStorage, CONSTANTS, API_NUXT_DOMAIN } from './config.js';
import { contentScriptPorts } from './ports.js';
import { enqueueErrorLog } from './error-telemetry.js';

const PROVIDER_CONCURRENCY_GATES = new Map();

function clampConcurrent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return CONSTANTS.DEFAULT_MAX_CONCURRENT || 2;
  return Math.min(5, Math.max(1, Math.round(num)));
}

async function resolveMaxConcurrent(serviceName, customOptions) {
  if (customOptions && typeof customOptions.max_concurrent !== 'undefined') {
    return clampConcurrent(customOptions.max_concurrent);
  }
  try {
    const data = await chrome.storage.local.get('PROVIDER_CONCURRENCY_MAP');
    const map = data.PROVIDER_CONCURRENCY_MAP || {};
    if (typeof map[serviceName] !== 'undefined') {
      return clampConcurrent(map[serviceName]);
    }
  } catch (e) {
    console.warn('Failed to read PROVIDER_CONCURRENCY_MAP:', e);
  }
  return clampConcurrent(CONSTANTS.DEFAULT_MAX_CONCURRENT);
}

function getConcurrencyGate(serviceName, maxConcurrent) {
  let gate = PROVIDER_CONCURRENCY_GATES.get(serviceName);
  if (!gate) {
    gate = { max: maxConcurrent, active: 0, queue: [] };
    PROVIDER_CONCURRENCY_GATES.set(serviceName, gate);
  }
  if (gate.max !== maxConcurrent) gate.max = maxConcurrent;
  return gate;
}

function drainConcurrencyGate(gate) {
  while (gate.active < gate.max && gate.queue.length > 0) {
    const next = gate.queue.shift();
    next();
  }
}

function runWithConcurrencyGate(gate, task) {
  return new Promise((resolve, reject) => {
    const run = () => {
      gate.active++;
      task().then(
        (result) => {
          gate.active--;
          drainConcurrencyGate(gate);
          resolve(result);
        },
        (error) => {
          gate.active--;
          drainConcurrencyGate(gate);
          reject(error);
        }
      );
    };
    if (gate.active < gate.max) {
      run();
    } else {
      gate.queue.push(run);
    }
  });
}

const VRR_Requests = {
  recordPlayEvent: async function ({
    play_duration_seconds,
    session_id,
    sessionStartTime,
    voice_id,
    url_full,
    character_count,
    has_own_key
  }) {
    const response = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/voice/play-event`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voice_id,
        session_id,
        play_duration_seconds: play_duration_seconds,
        platform: 'chrome_extension',
        play_started_at: sessionStartTime,
        play_finished_at: new Date().toISOString(),
        character_count,
        has_own_key
      })
    });

    const data = await response.json();
    console.log('Play recorded:', data);
  },

  saveVoiceDefaultOnServer: async function (voiceDefaultPayload) {
    const urlWithParams = `https://${API_NUXT_DOMAIN}/api/v1/voice/make-default`;
    let response = await fetch(urlWithParams, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voice_id: voiceDefaultPayload['DEFAULT_PREMIUM_VOICE_ID'],
        voice_speaker_id: voiceDefaultPayload['DEFAULT_PREMIUM_VOICE_SPEAKER_ID'],
        voice_words_per_minute: voiceDefaultPayload['DEFAULT_PREMIUM_VOICE_WORDS_PER_MINUTE'],
        voice_instructions: voiceDefaultPayload['DEFAULT_PREMIUM_VOICE_INSTRUCTIONS'],
        voice_language_code: voiceDefaultPayload['DEFAULT_PREMIUM_VOICE_LANGUAGE_CODE'],
        voice_speed: voiceDefaultPayload['DEFAULT_PREMIUM_VOICE_SPEED'],
        voice_has_voice_speed_support: voiceDefaultPayload['DEFAULT_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT'],
        voice_has_word_timestamp_support: voiceDefaultPayload['DEFAULT_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT']
      })
    });

    const data = await response.json();
  },

  getAudioDataFromExternalTTS: async function ({
    index,
    text,
    serviceName,
    serviceOptions,
    requestID,
    tabId,
    sessionId,
    attemptNumber = 0,
    testKeyOptions = null
  }) {
    let serviceKey = null;

    const serviceToStorageKey = SERVICE_TO_STORAGE_KEY_MAP;
    const storageKey = serviceToStorageKey[serviceName];
    let userApiKey = null;
    let customOptions = {};

    if (testKeyOptions) {
      userApiKey = testKeyOptions.apiKey;
      customOptions = testKeyOptions.customOptionsValues || {};
    } else if (storageKey) {
      const optionsStorageKey = `${storageKey}_options`;
      const storageData = await chrome.storage.local.get([storageKey, optionsStorageKey]);
      userApiKey = storageData[storageKey];
      customOptions = storageData[optionsStorageKey] || {};
    }

    if (!userApiKey || !userApiKey.trim()) {
      return {
        status: 'error',
        message: `API Key required for ${serviceName}. Please add your key in the BYOK settings.`,
        audioData: null, index, requestID
      };
    }

    console.log(`Routing TTS request for ${serviceName} to local provider function.`);
    try {
      const handler = getHandler(serviceName);
      if (!handler) throw new Error(`Client-side handler for ${serviceName} is not implemented.`);

      const maxConcurrent = await resolveMaxConcurrent(serviceName, customOptions);
      const gate = getConcurrencyGate(serviceName, maxConcurrent);
      const result = await runWithConcurrencyGate(gate, () => handler({
        text,
        serviceOptions,
        userApiKey,
        customOptions,
        serviceName
      }));

      if (storageKey) {
        const usageKey = `BYOK_USAGE_${storageKey}`;
        const currentData = await chrome.storage.local.get(usageKey);
        const currentUsage = currentData[usageKey] || 0;
        await chrome.storage.local.set({ [usageKey]: currentUsage + text.length });
      }

      return {
        audioData: result.audioData,
        wordTimestamps: result.speechMarks,
        index, requestID, tabId,
        status: 'success',
        generationTime: 0,
        textLength: text.length
      };

    } catch (error) {
      console.error(`Client-side TTS Error for ${serviceName}:`, error);
      const errorObj = {
        status: 'error',
        message: error.message,
        customErrorMessage: true,
        audioData: null, index, requestID,
        errorRequest: {
          serviceName,
          url: error.requestUrl || getProviderUrl(serviceName),
          payload: serviceOptions || null,
          requestPayload: error.requestPayload || null,
          text: text?.substring(0, 500) || null,
          textFullLength: text?.length || 0
        },
        errorResponse: error.responseBody || null,
        errorStatusCode: error.statusCode || null
      };

      try {
        if (attemptNumber > 0 || error.statusCode === 401 || error.statusCode === 403) {
          const result = await chrome.storage.local.get('TTS_ERROR_LOGS');
          const logs = result.TTS_ERROR_LOGS || [];
          const log = {
            timestamp: Date.now(),
            serviceName: errorObj.errorRequest.serviceName || 'Unknown',
            message: errorObj.message,
            request: errorObj.errorRequest,
            response: errorObj.errorResponse,
            statusCode: errorObj.errorStatusCode
          };
          logs.unshift(log);
          await chrome.storage.local.set({ 'TTS_ERROR_LOGS': logs.slice(0, 50) });
          enqueueErrorLog(log);
        }
      } catch (e) {
        console.error('Failed to log TTS error globally', e);
      }

      return errorObj;
    }
  },

  getPresignedUrl: async function (payload) {
    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/upload/presigned-url`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    const responseData = await rawResponse.json();
    return responseData;
  },

  mergeAudioClips: async function (payload) {
    let rawResponse = await fetch(`https://api.soundranks.com/voice-merge`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioDataUris: payload.audioDataUris
      })
    });
    const responseData = await rawResponse.json();
    return responseData;
  },

  getVoiceRatingsList: async function (payload) {
    const voiceId = payload.voice_id;
    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/voice/ratings/list?voice_id=${voiceId}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
    const responseData = await rawResponse.json();
    return responseData;
  },

  getVoiceRatingsSummary: async function (payload) {
    const voiceId = payload.voice_id;
    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/voice/get-overview?voice_id=${voiceId}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
    const responseData = await rawResponse.json();
    return responseData;
  },

  getVoiceRankings: async function (payload) {
    const voiceId = payload.voice_id;
    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/voice/style-rankings?voiceId=${voiceId}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
    const responseData = await rawResponse.json();
    return responseData;
  },

  saveVoiceRating: async function (payload) {
    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/voice/save_rating`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voice_id: payload.voice_id,
        voice_speed: payload.voice_speed,
        voice_text: payload.text,
        rating_comment: payload.comment,
        vote_value: payload.rating,
        voice_audio_url: payload.voice_audio_url || null,
        voice_page_url: payload.page_url,
        voice_page_title: payload.page_title,
        voice_page_image: payload.page_image || null,
        voice_show_page_source: payload.showPageSource || true,
        voice_review_type: payload.voice_review_type || 'voice'
      })
    });
    const responseData = await rawResponse.json();
    return responseData;
  },

  uploadAudioAndSaveRating: async function (payload) {
    let voice_audio_url = null;

    if (payload.audioBase64) {
      try {
        const presignedData = await this.getPresignedUrl({
          fileName: payload.fileName || `echo_${Date.now()}.mp3`,
          fileType: 'audio/mpeg',
          directory: payload.directory || 'echo-audio'
        });

        if (presignedData && presignedData.presignedUrl && presignedData.fileUrl) {
          const base64Data = payload.audioBase64.includes(',')
            ? payload.audioBase64.split(',')[1]
            : payload.audioBase64;
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const audioBlob = new Blob([byteArray], { type: 'audio/mpeg' });

          const uploadRes = await fetch(presignedData.presignedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'audio/mpeg' },
            body: audioBlob
          });

          if (uploadRes.ok) {
            voice_audio_url = presignedData.fileUrl;
          } else {
            console.error("Failed to upload audio blob to presigned URL:", uploadRes.statusText);
          }
        }
      } catch (e) {
        console.error("Error uploading audio to presigned URL:", e);
      }
    }

    return await this.saveVoiceRating({
      voice_speed: payload.voice?.voice_speed || 1,
      voice_id: payload.voice?.voice_id || payload.voice_id,
      rating: payload.rating,
      comment: payload.comment,
      text: payload.text,
      page_url: payload.page_url,
      page_title: payload.page_title,
      page_image: payload.page_image,
      voice_audio_url: voice_audio_url,
      voice_review_type: payload.voice_review_type || 'content',
      showPageSource: payload.showPageSource
    });
  },

  writeReviewNudgeEvent: async function (payload) {
    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/events/review-nudge`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: payload.event_type,
        voice_id: payload.voice_id || null
      })
    });
    const responseData = await rawResponse.json();
    return responseData;
  },

  saveReadLater: async function (payload) {
    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/user/bookmarks/save`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    const responseData = await rawResponse.json();
    return responseData;
  },

  getReadLater: async function () {
    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/user/bookmarks/list`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
    const responseData = await rawResponse.json();
    return responseData;
  },

  markReadLater: async function (payload) {
    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/user/bookmarks/mark-read`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    const responseData = await rawResponse.json();
    return responseData;
  },

  getVoiceFavorites: async function () {
    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/voice/favorites?extension_only=true`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    });
    const responseData = await rawResponse.json();
    return responseData;
  },

  getVoiceCollections: async function () {
    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/collections/list?extension_only=true`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    });
    const responseData = await rawResponse.json();
    return responseData;
  },

  getVoiceList: async function (params) {
    const paramsWithExtension = { ...params, extension_only: 'true' };

    const filteredParams = Object.fromEntries(
      Object.entries(paramsWithExtension).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );

    const queryParams = new URLSearchParams(filteredParams);

    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/voice/list?${queryParams.toString()}`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    });
    const responseData = await rawResponse.json();
    return responseData;
  },

  getVoiceSearch: async function (payload) {
    const url = `https://${API_NUXT_DOMAIN}/api/v1/voice/search?search=${encodeURIComponent(payload.search)}&extension_only=true`;
    let rawResponse = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    });
    const responseData = await rawResponse.json();
    return responseData;
  },

  saveChat: async function ({
    new_session,
    conversation_session,
    question,
    question_date,
    answer_date,
    answer_text,
    answer_html,
    chat_url,
    chat_iframe_url,
    chat_id,
    chatbox_settings,
    conversation_id,
    chat_url_title
  }) {
    let chat_icon_url = null;
    for (const key in contentScriptPorts) {
      if (key.endsWith("-" + chat_url.replace(/\/$/, ''))) {
        if (contentScriptPorts[key] &&
          contentScriptPorts[key].sender &&
          contentScriptPorts[key].sender.tab &&
          contentScriptPorts[key].sender.tab.favIconUrl) {
          chat_icon_url = contentScriptPorts[key].sender.tab.favIconUrl;
        }
        break;
      }
    }

    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/chat/save`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        new_session,
        conversation_session,
        question,
        question_date,
        answer_date,
        answer_text,
        answer_html,
        chat_url,
        chat_iframe_url,
        chat_id,
        chatbox_settings,
        conversation_id,
        chat_icon_url,
        chat_url_title
      })
    });
    const responseData = await rawResponse.json();
    return responseData
  },

  saveUserSettings: async function () {
    let storage = await readLocalStorage(CONSTANTS.USER_SETTINGS);

    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/user/settings`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '',
        chatbox_settings_json: storage || {}
      })
    });
    const responseData = await rawResponse.json();

    chrome.storage.local.set({
      [CONSTANTS.SAVED_SETTINGS_KEYNAME]: {
        id: responseData.chatbox_settings_id,
        updated: responseData.chatbox_settings_updated_unix
      }
    });

    return responseData
  },

  getUserAndAutoSettings: async function ({
    id, updated
  }) {


    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/settings/auto`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id,
        updated,
        platform: 'chrome_extension',
        source: 'chrome_extension',
        is_extension: true
      })
    });
    const responseData = await rawResponse.json();
    return responseData
  },

  getDomainFilters: async function ({ domain }) {
    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/settings/filters?domain=${domain}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
    const responseData = await rawResponse.json();
    return responseData
  },

  action: async function ({ url, action, speech_on, browser, voice_lang, voice_name, voice_speed }) {
    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/action`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        action,
        speech_on, browser, voice_lang, voice_name, voice_speed
      })
    });
    const responseData = await rawResponse.json();
    return responseData;
  },
}

export { VRR_Requests };
