import { ref, watch, computed } from 'vue';
import { readLocalStorage, fnBrowserDetect, saveToLocalStorage } from '../../js/utils/helpers'
import { CONSTANTS } from "../../js/constants/constants";
import { usePagination } from './usePagination';

const providersList = ref([]);

const filterByDomainsList = ref([]);
const sortByDomainsList = ref('total_chats');
const pageRoute = ref("/main-menu");
const voiceFilterOptions = ref({
  gender: 'female', languageCode: 'en', countryCode: 'US', service: ''
});
const voiceFilterOpenTriggerCounter = ref(0);
const voiceFilterUpdatesCounter = ref(0);
const voiceSwitchOnPremium = ref(false);
const voiceShowFavoritesOn = ref(false);
const voiceShowCollectionsOn = ref(false);

const showProviderKeyModal = ref(false);
const showProviderKeyModalProvider = ref();
const allowTelemetry = ref(false);


const voiceTestText = ref("");
const voiceTextPlaceholder = ref("Hi, my name is [voice_name]")

const browserVoicesList = ref([]);
const totalVoices = ref(null);

const pendingRequests = ref({});
const voiceDefaultPayload = ref({});

const API_NUXT_DOMAIN = ref("");
const APP_WEB_DOMAIN = ref("voicerankings.com");
const APP_WS_DOMAIN = ref("ws.voicerankings.com");

const triggerLoginPopup = ref(0);
const isUserLogged = ref(null);
const isFirstTimeLoggedIn = ref(null);
const userProfile = ref({});
const chatModels = ref([]);
const voiceProviders = ref([]);
const resetLoginStep = ref(0);

const showLoginModalCount = ref(0);
const showCommunityHelpCount = ref(0);
const showOpenRouterModalCount = ref(0);

const activeTabId = ref();
const newChatTrigger = ref(0);
const showMoreSuggestionsList = ref(false);
const localSettingsTab = ref("general");
const globalSearch = ref("");
const switchOnSources = ref(false);

const toastData = ref({
  title: '',
  message: '',
  callback: () => { },
  icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" height="25" viewBox="0 -960 960 960" width="27"><path d="M80-80v-80q46 0 91-6t88-22q-46-23-72.5-66.5T160-349v-91h160v-120h135L324-822l72-36 131 262q20 40-3 78t-68 38h-56v40q0 33-23.5 56.5T320-360h-80v11q0 35 21.5 61.5T316-252l12 3q40 10 45 50t-31 60q-60 33-126.5 46T80-80Zm572-114-57-56q21-21 33-48.5t12-59.5q0-32-12-59.5T595-466l57-57q32 32 50 74.5t18 90.5q0 48-18 90t-50 74ZM765-80l-57-57q43-43 67.5-99.5T800-358q0-66-24.5-122T708-579l57-57q54 54 84.5 125T880-358q0 81-30.5 152.5T765-80Z"/></svg>',
  delay: 5000,
  hideProgressBar: false
});
const toastTrigger = ref(0);

const ttsErrorLogs = ref([]);

async function loadErrorLogs() {
  try {
    const result = await chrome.storage.local.get('TTS_ERROR_LOGS');
    ttsErrorLogs.value = result.TTS_ERROR_LOGS || [];
  } catch (e) {
    ttsErrorLogs.value = [];
  }
}

async function persistErrorLogs() {
  try {
    await chrome.storage.local.set({ 'TTS_ERROR_LOGS': ttsErrorLogs.value.slice(0, 50) });
  } catch (e) {
    console.error('Failed to persist error logs:', e);
  }
}

const openErrorLogsOnMount = ref(false);
const openByokProvider = ref('');


async function getFromStorageFilterByDomainsList() {
  let result = await readLocalStorage(['VOICE_FILTER_OPTIONS']);
  const voiceOpts = {};
  voiceOpts.gender = result.VOICE_FILTER_OPTIONS ? result.VOICE_FILTER_OPTIONS.gender : 'female';
  voiceOpts.service = result.VOICE_FILTER_OPTIONS ? result.VOICE_FILTER_OPTIONS.service : '';

  voiceOpts.languageCode = result.VOICE_FILTER_OPTIONS ? result.VOICE_FILTER_OPTIONS.languageCode : 'en';
  voiceOpts.countryCode = result.VOICE_FILTER_OPTIONS ? result.VOICE_FILTER_OPTIONS.countryCode : 'US';

  voiceFilterOptions.value.gender = voiceOpts.gender;
  voiceFilterOptions.value.service = voiceOpts.service;
  voiceFilterOptions.value.languageCode = voiceOpts.languageCode;
  voiceFilterOptions.value.countryCode = voiceOpts.countryCode;

  return voiceOpts
}

watch(voiceSwitchOnPremium, (newState) => {
  chrome.storage.local.set({ 'VOICE_SWITCH_ON_PREMIUM': newState });
})



async function getFromStorageVoiceSwitchDefault() {
  let result = await readLocalStorage(['VOICE_SWITCH_ON_PREMIUM']);
  voiceSwitchOnPremium.value = (result.VOICE_SWITCH_ON_PREMIUM === undefined) ? false : result.VOICE_SWITCH_ON_PREMIUM;
  return (result.VOICE_SWITCH_ON_PREMIUM === undefined) ? false : result.VOICE_SWITCH_ON_PREMIUM;
}

async function getFromStorageVoiceTestTextDefault() {
  let result = await readLocalStorage(['VOICE_TEST_TEXT']);
  voiceTestText.value = (result.VOICE_TEST_TEXT === undefined) ? "" : result.VOICE_TEST_TEXT;
  return (result.VOICE_TEST_TEXT === undefined) ? "" : result.VOICE_TEST_TEXT;
}

async function getFromStorageAllowTelemetry() {
  let result = await readLocalStorage(['ALLOW_TELEMETRY']);
  allowTelemetry.value = (result.ALLOW_TELEMETRY === undefined) ? true : result.ALLOW_TELEMETRY;
  return allowTelemetry.value;
}

async function getFromStorageVoiceDefaultPayload() {
  let result = await readLocalStorage([
    'DEFAULT_TTS_VOICE_SERVICE',

    'DEFAULT_VOICE_NAME',
    'DEFAULT_VOICE_LANGUAGE_CODE',
    'DEFAULT_VOICE_SPEAKER_ID',
    'DEFAULT_VOICE_SPEED',

    'DEFAULT_PREMIUM_VOICE_SERVICE',
    'DEFAULT_PREMIUM_VOICE_ID',
    'DEFAULT_PREMIUM_VOICE_NAME',
    'DEFAULT_PREMIUM_VOICE_GENDER',
    'DEFAULT_PREMIUM_VOICE_INSTRUCTIONS',
    'DEFAULT_PREMIUM_VOICE_LANGUAGE_CODE',
    'DEFAULT_PREMIUM_VOICE_SPEAKER_ID',
    'DEFAULT_PREMIUM_VOICE_WORDS_PER_MINUTE',
    'DEFAULT_PREMIUM_VOICE_SPEED',
    'DEFAULT_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT',
    'DEFAULT_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT'

  ]);

  const isPremium = (result.DEFAULT_TTS_VOICE_SERVICE === CONSTANTS.TTS_VOICE_SERVICE.BROWSER_VOICE) ? false : true;

  voiceDefaultPayload.value.voice_service = isPremium ? result.DEFAULT_PREMIUM_VOICE_SERVICE : "free";
  voiceDefaultPayload.value.voice_id = result.DEFAULT_PREMIUM_VOICE_ID;
  voiceDefaultPayload.value.voice_name = isPremium ? result.DEFAULT_PREMIUM_VOICE_NAME : result.DEFAULT_VOICE_NAME;
  voiceDefaultPayload.value.voice_gender = isPremium ? result.DEFAULT_PREMIUM_VOICE_GENDER : "";
  voiceDefaultPayload.value.voice_language_code = isPremium ? result.DEFAULT_PREMIUM_VOICE_LANGUAGE_CODE : result.DEFAULT_VOICE_LANGUAGE_CODE;
  voiceDefaultPayload.value.voice_speaker_id = isPremium ? result.DEFAULT_PREMIUM_VOICE_SPEAKER_ID : result.DEFAULT_VOICE_SPEAKER_ID;
  voiceDefaultPayload.value.voice_words_per_minute = isPremium ? result.DEFAULT_PREMIUM_VOICE_WORDS_PER_MINUTE : 150;
  voiceDefaultPayload.value.voice_instructions = isPremium ? result.DEFAULT_PREMIUM_VOICE_INSTRUCTIONS : "";
  voiceDefaultPayload.value.voice_speed = isPremium ? result.DEFAULT_PREMIUM_VOICE_SPEED : result.DEFAULT_VOICE_SPEED;
  voiceDefaultPayload.value.voice_has_voice_speed_support = result.DEFAULT_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT;
  voiceDefaultPayload.value.voice_has_word_timestamp_support = result.DEFAULT_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT;
}

async function getVoiceTestTextOrPlaceholder(voice_name) {
  let voiceTestTextDefault = await getFromStorageVoiceTestTextDefault()

  if (voiceTestTextDefault.trim().length > 0) {
    return voiceTestTextDefault.replace("[voice_name]", voice_name);
  } else {
    return voiceTextPlaceholder.value.replace("[voice_name]", voice_name);
  }
}

function getFreeBrowserVoicesList() {
  if (browserVoicesList.value.length > 0) return;

  if (typeof speechSynthesis === 'undefined') return;
  const voices = speechSynthesis.getVoices();

  for (let i = 0; i < voices.length; i++) {
    browserVoicesList.value.push(voices[i])
  }
}

const saveRequest = function (callbackID, callback) {
  pendingRequests[callbackID] = callback;
}

const completeRequest = function (callbackID, payload) {
  if (pendingRequests[callbackID]) {
    if (payload.status === 'error' && payload.message) {

      toastData.value.title = payload.title;
      toastData.value.message = payload.message;
      toastData.value.action = payload.status;
      toastData.value.delay = 3500;
      toastTrigger.value += 1;

    }

    if (payload.status === 'error') {
      ttsErrorLogs.value.unshift({
        timestamp: Date.now(),
        serviceName: payload.errorRequest?.serviceName || payload.title || 'Unknown',
        message: payload.message,
        request: payload.errorRequest || null,
        response: payload.errorResponse || null,
        statusCode: payload.errorStatusCode || null
      });
      if (ttsErrorLogs.value.length > 50) {
        ttsErrorLogs.value = ttsErrorLogs.value.slice(0, 50);
      }
      persistErrorLogs();
    }

    pendingRequests[callbackID](payload);


    delete pendingRequests[callbackID];
  }
}

const sidepanelMakeToast = function (title, message, status, delay) {
  toastData.value.title = title;
  toastData.value.message = message;
  toastData.value.action = status;
  toastData.value.delay = delay;
  toastTrigger.value += 1;
}

async function saveVoiceDefaultToLocalStorage(type) {

  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DEFAULT_PREMIUM_VOICE_SERVICE', value: voiceDefaultPayload.value.voice_service
  });

  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DEFAULT_PREMIUM_VOICE_ID', value: voiceDefaultPayload.value.voice_id
  });

  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DEFAULT_PREMIUM_VOICE_NAME', value: voiceDefaultPayload.value.voice_name
  });

  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DEFAULT_PREMIUM_VOICE_GENDER', value: voiceDefaultPayload.value.voice_gender
  });

  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DEFAULT_PREMIUM_VOICE_INSTRUCTIONS', value: voiceDefaultPayload.value.voice_instructions
  });

  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DEFAULT_PREMIUM_VOICE_LANGUAGE_CODE', value: voiceDefaultPayload.value.voice_language_code
  });

  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DEFAULT_PREMIUM_VOICE_SPEAKER_ID', value: voiceDefaultPayload.value.voice_speaker_id
  });

  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DEFAULT_PREMIUM_VOICE_WORDS_PER_MINUTE', value: voiceDefaultPayload.value.voice_words_per_minute
  });



  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DEFAULT_PREMIUM_VOICE_SPEED', value: voiceDefaultPayload.value.voice_speed
  });

  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DEFAULT_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT', value: voiceDefaultPayload.value.voice_has_voice_speed_support
  });

  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DEFAULT_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT', value: voiceDefaultPayload.value.voice_has_word_timestamp_support
  });



  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DEFAULT_TTS_VOICE_SERVICE', value: CONSTANTS.TTS_VOICE_SERVICE.PREMIUM_VOICE
  });




}

async function saveVoiceDefaultOnServer() {

  const urlWithParams = `https://${API_NUXT_DOMAIN.value}/api/v1/voice/make-default`;
  let rawResponse = await fetch(urlWithParams, {
    method: 'PUT',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      voice_id: voiceDefaultPayload.value.voice_id,
      voice_speaker_id: voiceDefaultPayload.value.voice_speaker_id,
      voice_words_per_minute: voiceDefaultPayload.value.voice_words_per_minute,
      voice_instructions: voiceDefaultPayload.value.voice_instructions,
      voice_language_code: voiceDefaultPayload.value.voice_language_code,
      voice_speed: voiceDefaultPayload.value.voice_speed,
      voice_has_voice_speed_support: voiceDefaultPayload.value.voice_has_voice_speed_support,
      voice_has_word_timestamp_support: voiceDefaultPayload.value.voice_has_word_timestamp_support,
      browser: fnBrowserDetect()
    })
  });

  const responseData = await rawResponse.json();
}

async function getUserStatus() {
  const urlWithParams = `https://${API_NUXT_DOMAIN.value}/api/v1/user/status?extension_only=true`;
  try {
    let rawResponse = await fetch(urlWithParams, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });

    const responseData = await rawResponse.json();

    chatModels.value = responseData.chatModels;
    voiceProviders.value = responseData.voiceProviders;
    if (responseData.user) {
      userProfile.value = responseData.user;
    } else {
      userProfile.value = responseData.guest;
      userProfile.value = false;
    }
    isUserLogged.value = (userProfile.value !== false) ? true : false;

    chrome.runtime.sendMessage({ action: "resetTokenAction" });
  } catch (error) {
    console.warn('Failed to fetch user status:', error);
  }
}

async function copyTextToClipboardFallback(text) {
  // Create a temporary textarea element
  const textarea = document.createElement('textarea');
  // Set its value to the text you want to copy
  textarea.value = text;
  // Make sure it's not visible
  textarea.setAttribute('readonly', ''); // Prevents keyboard from showing on mobile
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px'; // Move it off-screen
  document.body.appendChild(textarea);
  // Select the text
  textarea.select();
  // Attempt to copy
  try {
    const successful = document.execCommand('copy');
    const msg = successful ? 'successful' : 'unsuccessful';
    console.log(`Copying text command was ${msg}`);
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
  }
  // Remove the temporary textarea
  document.body.removeChild(textarea);
}


function sidePanelPort() {



  const port = chrome.runtime.connect({ name: "sidepanel-opened-port" });
  port.onMessage.addListener(async (message) => {

    const { key, value, data, tab_id, callbackID } = message;

    if (key === "play-audio") {
      completeRequest(callbackID, data);
    } else if (key === "stop-audio") {
      completeRequest(callbackID, data);
    } else if (key === "load-audio") {
      completeRequest(callbackID, data);
    }

    if (key === "login-fail") {
      await getUserStatus();
      resetLoginStep.value++;
    }
    if (key === "saveChat") {
      newChatTrigger.value++;
    }

    if (key === "API_NUXT_DOMAIN" && value !== "") {

      API_NUXT_DOMAIN.value = value;

      await getUserStatus()
    }
    if (key === "APP_WEB_DOMAIN" && value !== "") {
      APP_WEB_DOMAIN.value = value;
    }
    if (key === "APP_WS_DOMAIN" && value !== "") {
      APP_WS_DOMAIN.value = value;
    }
    //console.log("message", message);



    if (key === "route" && value !== "") {
      handleRouteMessage(value, data);
    }
  })
}

/**
 * Applies a routing request coming from the background (originally triggered by
 * a content-script action such as "open-sidepanel" / "Sign In"). Shared by both
 * the long-lived port listener and the chrome.runtime.onMessage fallback so an
 * already-open side panel is reachable even when the background service worker's
 * in-memory port reference was lost on suspension.
 */
function handleRouteMessage(value, data) {
  pageRoute.value = value;

  if (value === "/main-menu" && data && data.openUpgradeModal) {
    showUpgradeModalCount.value++;
  } else if (value === "/main-menu" && data && data.openLoginModal) {
    showLoginModalCount.value++;
  } else if (value === "/main-menu" && data && data.openCommunityHelpModal) {
    showCommunityHelpCount.value++;
  } else if (value === "/main-menu" && data && data.openOpenRouterModal) {
    showOpenRouterModalCount.value++;
  } else if (value === "/main-menu" && data && data.openProviderKeyModal) {
    showProviderKeyModal.value = true;
    showProviderKeyModalProvider.value = data.provider;
  } else if ((value === "/recent-chats" || value === "/session-chats") && data) {
    filterByDomainsList.value = [data.hostname]
  } else if (value === "/voices" && data && data.provider) {
    const { resetPagination } = usePagination();
    resetPagination();

    const filterOptions = {
      'gender': '',
      'service': data.provider,
      'languageCode': 'en',
      'countryCode': 'all'
    };

    chrome.storage.local.set({ 'VOICE_FILTER_OPTIONS': filterOptions });

    voiceFilterOptions.value.gender = filterOptions.gender;
    voiceFilterOptions.value.service = filterOptions.service;
    voiceFilterOptions.value.languageCode = filterOptions.languageCode;
    voiceFilterOptions.value.countryCode = filterOptions.countryCode;

    voiceSwitchOnPremium.value = true;
    voiceShowFavoritesOn.value = false;
    voiceShowCollectionsOn.value = false;

    voiceFilterUpdatesCounter.value++;
  } else if (value === "/settings") {
    localSettingsTab.value = data.tab
    if (data && data.provider) {
      openByokProvider.value = data.provider;
    }
    if (data && data.showErrorLogs) {
      openErrorLogsOnMount.value = true;
    }
  }
}

// Reliable fallback: reach the side panel even when the background worker has
// restarted and lost its in-memory port to an already-open panel.
chrome.runtime.onMessage.addListener((request) => {
  if (request && request.action === "navigate-sidepanel" && request.value) {
    handleRouteMessage(request.value, request.data);
  }
});

export default function useMyComposable() {
  return {
    voiceFilterOpenTriggerCounter,
    isFirstTimeLoggedIn,
    globalSearch,
    localSettingsTab,
    showMoreSuggestionsList,
    newChatTrigger,
    sidePanelPort,
    copyTextToClipboardFallback,
    activeTabId,
    getUserStatus,
    isUserLogged,
    triggerLoginPopup,
    resetLoginStep,
    userProfile,
    chatModels,
    API_NUXT_DOMAIN,
    APP_WEB_DOMAIN,
    APP_WS_DOMAIN,
    getFromStorageFilterByDomainsList,
    filterByDomainsList,
    pageRoute,
    sortByDomainsList,
    voiceFilterOptions,
    voiceFilterUpdatesCounter,
    voiceSwitchOnPremium,
    getFromStorageVoiceSwitchDefault,
    voiceTextPlaceholder,
    getFromStorageVoiceTestTextDefault,
    voiceTestText,
    getFreeBrowserVoicesList,
    browserVoicesList,
    getVoiceTestTextOrPlaceholder,
    saveRequest,
    completeRequest,
    getFromStorageVoiceDefaultPayload,
    voiceDefaultPayload,
    saveVoiceDefaultOnServer,
    saveVoiceDefaultToLocalStorage,
    voiceShowFavoritesOn,
    voiceShowCollectionsOn,
    showLoginModalCount,
    showCommunityHelpCount,
    showOpenRouterModalCount,
    switchOnSources,
    toastData,
    toastTrigger,
    sidepanelMakeToast,

    totalVoices,
    providersList,

    showProviderKeyModal,
    showProviderKeyModalProvider,
    allowTelemetry,
    getFromStorageAllowTelemetry,
    ttsErrorLogs,
    loadErrorLogs,
    openErrorLogsOnMount,
    openByokProvider

  }
}

