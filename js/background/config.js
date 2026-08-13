/**
 * ============================================================================
 * Background Configuration Module
 * ============================================================================
 * Defines global constants, service aliases, default settings keys, and 
 * hardcoded fallback values for the extension. Also contains helper functions 
 * to fetch these values from Chrome's local storage.
 */
let SERVICE_TO_STORAGE_KEY_MAP = {
  'OpenAI': 'OPENAI_API_KEY',
  'GPT-4o-mini-tts': 'GPT_4O_MINI_TTS_API_KEY',
  'Google': 'GOOGLE_API_KEY',
  'Google-Chirp-3-HD': 'GOOGLE_CHIRP3_HD_API_KEY',
  'Azure': 'AZURE_API_KEY',
  'AWS': 'AWS_API_KEY',
  'Deepgram': 'DEEPGRAM_API_KEY',
  'Deepgram-A2': 'DEEPGRAM_A2_API_KEY',
  'Speechify': 'SPEECHIFY_API_KEY',
  'ResembleAI': 'RESEMBLEAI_API_KEY',
  'Inworld': 'INWORLD_API_KEY',
  'MurfAI': 'MURFAI_API_KEY',
  'AsyncAI': 'ASYNCAI_API_KEY',
  'orpheus-tts': 'ORPHEUSTTS_API_KEY',
  'kokoro-82M': 'KOKORO82M_API_KEY',
  'grok-tts': 'GROK_API_KEY',
  'voxtral-tts': 'MISTRAL_API_KEY',
  'gemini-3-1-flash-tts': 'GEMINI_3_1_FLASH_TTS_API_KEY',
  'gemini-3-1-flash-tts-vd': 'GEMINI_3_1_FLASH_TTS_API_KEY',
  'gemini-2-5-flash-tts': 'GEMINI_2_5_FLASH_TTS_API_KEY',
  'gemini-2-5-flash-tts-vd': 'GEMINI_2_5_FLASH_TTS_API_KEY',
  'qwen3-tts-flash': 'QWEN_API_KEY',
  'Rime-Mist': 'RIME_API_KEY',
  'Rime-MistV2': 'RIME_API_KEY',
  'Rime-Arcana': 'RIME_API_KEY',
  'Rime-Coda': 'RIME_API_KEY',
  'MiMo-V2-5-TTS': 'MIMO_API_KEY',
  'MiMo-V2-5-TTS-vd': 'MIMO_API_KEY',
  'StepFun-TTS-2': 'STEPFUN_API_KEY',
  'MAI-Voice-1': 'MAI_VOICE_1_AZURE_API_KEY',
  'MAI-Voice-2': 'MAI_VOICE_2_AZURE_API_KEY'
};

async function readLocalStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, function (result) {
      resolve(result);
    });
  });
}

const CONSTANTS = {
  SAVED_SETTINGS_KEYNAME: 'SAVED_SETTINGS',
  // Mirror of js/constants/constants.js DEFAULT_MAX_CONCURRENT (2). Used by the
  // background gate when no server default (max_concurrent) or user override is set.
  DEFAULT_MAX_CONCURRENT: 2,
  USER_SETTINGS: [
    'WIDGET_PIN_EXPANDED',
    'DEFAULT_QUICK_ACCESS_CONTROLS_PANEL_PLACEMENT_STATE',
    'DEFAULT_QUICK_ACCESS_CONTROLS_STATE',
    'SAVED_SETTINGS',
    'DEFAULT_READER_STATE',
    'DEFAULT_AUTO_PLAY_WITH_ENTER_KEY_STATE',
    'DEFAULT_AUTO_SETTINGS_STATE',
    'DEFAULT_HIGHLIGHT_READING_STATE',
    'DEFAULT_AUTOSCROLL_READING_STATE',
    'DEFAULT_AUTO_READ_TITLE_STATE',
    'DEFAULT_READER_STRICT_MODE',
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
    'DOMAIN_SETTINGS'
  ]
};

async function runServericeToStorageMap() {
  let storage = await readLocalStorage(['SERVICE_TO_STORAGE_KEY_MAP']);
  if (storage.SERVICE_TO_STORAGE_KEY_MAP) {
    SERVICE_TO_STORAGE_KEY_MAP = storage.SERVICE_TO_STORAGE_KEY_MAP;
  }
}

const API_NUXT_DOMAIN = "voicerankings.com";
const APP_WEB_DOMAIN = "voicerankings.com";

const APP_WS_DOMAIN = "ws.voicerankings.com";

const DEFAULT_KEYS = [
  'DEFAULT_PREMIUM_VOICE_ID',
  'DEFAULT_PREMIUM_VOICE_NAME',
  'DEFAULT_PREMIUM_VOICE_GENDER',
  'DEFAULT_PREMIUM_VOICE_INSTRUCTIONS',
  'DEFAULT_PREMIUM_VOICE_LANGUAGE_CODE',
  'DEFAULT_PREMIUM_VOICE_SPEAKER_ID',
  'DEFAULT_PREMIUM_VOICE_WORDS_PER_MINUTE',
  'DEFAULT_PREMIUM_VOICE_SERVICE',
  'DEFAULT_PREMIUM_VOICE_SERVICE_ALIAS',
  'DEFAULT_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT',
  'DEFAULT_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT'
];

const HARDCODED_DEFAULTS = {
  'DEFAULT_PREMIUM_VOICE_ID': '133e2d36-1a18-41c3-9146-886423d5a35d',
  'DEFAULT_PREMIUM_VOICE_NAME': 'Mark',
  'DEFAULT_PREMIUM_VOICE_GENDER': 'male',
  'DEFAULT_PREMIUM_VOICE_INSTRUCTIONS': '',
  'DEFAULT_PREMIUM_VOICE_LANGUAGE_CODE': 'en-US',
  'DEFAULT_PREMIUM_VOICE_SPEAKER_ID': 'Mark',
  'DEFAULT_PREMIUM_VOICE_WORDS_PER_MINUTE': 233.96,
  'DEFAULT_PREMIUM_VOICE_SERVICE': 'Inworld',
  'DEFAULT_PREMIUM_VOICE_SERVICE_ALIAS': 'inworld.ai',
  'DEFAULT_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT': true,
  'DEFAULT_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT': true,
};

function setServiceToStorageKeyMap(newValue) {
  SERVICE_TO_STORAGE_KEY_MAP = newValue;
}

export {
  SERVICE_TO_STORAGE_KEY_MAP,
  readLocalStorage,
  CONSTANTS,
  API_NUXT_DOMAIN,
  APP_WEB_DOMAIN,
  APP_WS_DOMAIN,
  runServericeToStorageMap,
  setServiceToStorageKeyMap,
  DEFAULT_KEYS,
  HARDCODED_DEFAULTS
};
