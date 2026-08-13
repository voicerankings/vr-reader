/**
 * ============================================================================
 * Background Voice Utilities Module
 * ============================================================================
 * Handles the logic for updating the active/default voice settings in local 
 * storage and maintaining a rotating list of the user's recently used voices.
 */
import { readLocalStorage } from './config.js';

async function makeActiveVoice(newVoice) {
  console.log("Making new voice default:", newVoice);

  const dataToSave = {
    'ACTIVE_PREMIUM_VOICE_ID': newVoice.voice_id,
    'ACTIVE_PREMIUM_VOICE_NAME': newVoice.voice_name,
    'ACTIVE_PREMIUM_VOICE_GENDER': newVoice.voice_gender,
    'ACTIVE_PREMIUM_VOICE_INSTRUCTIONS': newVoice.voice_instructions,
    'ACTIVE_PREMIUM_VOICE_LANGUAGE_CODE': newVoice.voice_language_code,
    'ACTIVE_PREMIUM_VOICE_SPEAKER_ID': newVoice.voice_speaker_id,
    'ACTIVE_PREMIUM_VOICE_WORDS_PER_MINUTE': newVoice.voice_words_per_minute,
    'ACTIVE_PREMIUM_VOICE_SERVICE': newVoice.voice_service,
    'ACTIVE_PREMIUM_VOICE_SERVICE_ALIAS': newVoice.voice_service_alias,
    'ACTIVE_PREMIUM_VOICE_SPEED': (newVoice.voice_speed) ? newVoice.voice_speed : 1,
    'ACTIVE_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT': newVoice.voice_has_voice_speed_support,
    'ACTIVE_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT': newVoice.voice_has_word_timestamp_support,
  };

  await chrome.storage.local.set(dataToSave);
  await updateRecentVoices(newVoice);
}

async function updateRecentVoices(selectedVoice) {
  try {
    const storage = await readLocalStorage(['voiceRecentSearches']);
    let recentSearches = storage.voiceRecentSearches || [];

    const voiceForList = {
      voice_id: selectedVoice.voice_id,
      voice_name: selectedVoice.voice_name,
      voice_gender: selectedVoice.voice_gender,
      voice_instructions: selectedVoice.voice_instructions,
      voice_language_codes: selectedVoice.voice_language_code ? [selectedVoice.voice_language_code] : [],
      voice_speaker_id: selectedVoice.voice_speaker_id,
      voice_words_per_minute: selectedVoice.voice_words_per_minute,
      voice_service: selectedVoice.voice_service,
      voice_service_alias: selectedVoice.voice_service_alias,
      voice_speed: selectedVoice.voice_speed || 1,
      voice_has_voice_speed_support: selectedVoice.voice_has_voice_speed_support,
      voice_has_word_timestamp_support: selectedVoice.voice_has_word_timestamp_support,
      voice_review_average: selectedVoice.voice_review_average,
      voice_review_count: selectedVoice.voice_review_count,
    };

    const existingIndex = recentSearches.findIndex(item => item.voice_id === selectedVoice.voice_id);
    if (existingIndex > -1) {
      recentSearches.splice(existingIndex, 1);
    }

    recentSearches.unshift(voiceForList);

    if (recentSearches.length > 6) {
      recentSearches = recentSearches.slice(0, 6);
    }

    await chrome.storage.local.set({ 'voiceRecentSearches': recentSearches });
    console.log("Updated recent voices list");
  } catch (e) {
    console.error("Failed to update recent voices:", e);
  }
}

export { makeActiveVoice, updateRecentVoices };
