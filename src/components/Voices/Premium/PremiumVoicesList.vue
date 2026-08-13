// -------- VoiceList.vue (Parent) --------

<script setup>
import VoiceItem from './VoiceItem.vue';
import PreloaderAnimation from '../../Shared/PreloaderAnimation.vue';
import useMyComposable from '../../../composables/Composable';
import { usePagination } from '../../../composables/usePagination';
import { ref, watch, onMounted } from 'vue';
import { saveToLocalStorage } from '../../../../js/utils/helpers';
import { CONSTANTS } from "../../../../js/constants/constants";

const { 
  API_NUXT_DOMAIN, voiceFilterOptions, voiceFilterUpdatesCounter, getFromStorageFilterByDomainsList,
  // --> Add dependencies needed for making a voice default
  saveVoiceDefaultOnServer, voiceDefaultPayload, saveVoiceDefaultToLocalStorage 
} = useMyComposable();

const { limit, currentOffset, setTotalItems, resetPagination } = usePagination();

// --- STATE ---
const loadedVoices = ref([]);
const loading = ref(false);
const defaultVoiceId = ref(null); // <-- 1. STATE for the default voice ID

const props = defineProps({
  selectedVoiceCallback: Function
});

// --- LIFECYCLE HOOKS ---
onMounted(async () => {
  await getFromStorageFilterByDomainsList();
  await loadDefaultVoiceId(); // <-- 2. Load the default ID on mount
  await fetchVoices(true);
});

// --- WATCHERS ---
watch(voiceFilterUpdatesCounter, () => {
  resetPagination();
  fetchVoices(true);
});

watch(currentOffset, () => {
  fetchVoices();
});

// --- NEW: Function to load the default voice ID once ---
async function loadDefaultVoiceId() {
  try {
    const result = await chrome.storage.local.get(['DEFAULT_PREMIUM_VOICE_ID']);
    defaultVoiceId.value = result.DEFAULT_PREMIUM_VOICE_ID || null;
  } catch (e) {
    console.error("Error loading default voice ID from storage", e);
  }
}

// --- NEW: Function to handle the update event from a child ---
async function handleUpdateDefaultVoice(voice) {
  // This logic is moved from VoiceItem to here
  chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_ID': voice.voice_id });
  voiceDefaultPayload.value.voice_id = voice.voice_id;
  
  // Update the reactive state immediately for instant UI feedback
  defaultVoiceId.value = voice.voice_id; 

  chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_NAME': voice.voice_name });
  voiceDefaultPayload.value.voice_name = voice.voice_name;

  chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_GENDER': voice.voice_gender });
  voiceDefaultPayload.value.voice_gender = voice.voice_gender;

  chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_INSTRUCTIONS': voice.voice_instructions ?? null });
  voiceDefaultPayload.value.voice_instructions = voice.voice_instructions ?? null;

  const languageCode = voice.voice_language_code || (Array.isArray(voice.voice_language_codes) ? voice.voice_language_codes[0] : null);
  chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_LANGUAGE_CODE': languageCode });
  voiceDefaultPayload.value.voice_language_code = languageCode;

  chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_SPEAKER_ID': voice.voice_speaker_id });
  voiceDefaultPayload.value.voice_speaker_id = voice.voice_speaker_id;

  chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_WORDS_PER_MINUTE': voice.voice_words_per_minute });
  voiceDefaultPayload.value.voice_words_per_minute = voice.voice_words_per_minute;

  chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_SERVICE': voice.voice_service });
  voiceDefaultPayload.value.voice_service = voice.voice_service;

  chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT': voice.voice_has_voice_speed_support });
  voiceDefaultPayload.value.voice_has_voice_speed_support = voice.voice_has_voice_speed_support;

  chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT': voice.voice_has_word_timestamp_support });
  voiceDefaultPayload.value.voice_has_word_timestamp_support = voice.voice_has_word_timestamp_support;

  chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_SPEED': voice.voice_speed || 1 });
  voiceDefaultPayload.value.voice_speed = voice.voice_speed || 1;

  saveToLocalStorage({ 'DEFAULT_TTS_VOICE_SERVICE': CONSTANTS.TTS_VOICE_SERVICE.PREMIUM_VOICE }, true);

  await saveVoiceDefaultOnServer();
  saveVoiceDefaultToLocalStorage('premium');
}


async function fetchVoices(isInitialLoad = false) {
  if (loading.value) return;
  loading.value = true;
  if (isInitialLoad) {
    loadedVoices.value = [];
  }
  try {
    const { service = '', gender = '', languageCode = '', countryCode = '' } = voiceFilterOptions.value || {};
    const queryParams = new URLSearchParams({
      service, gender, language: languageCode, country: countryCode,
      limit: limit.value,
      includeCustomVoiceDesignSample: true,
      offset: currentOffset.value,
      extension_only: 'true',
    });
    const url = `https://${API_NUXT_DOMAIN.value}/api/v1/voice/list?${queryParams.toString()}`;
    const rawResponse = await fetch(url);
    if (!rawResponse.ok) throw new Error(`API error ${rawResponse.status}`);
    const responseData = await rawResponse.json();
    loadedVoices.value = responseData.voices || [];
    setTotalItems(responseData.total || 0);
  } catch (error) {
    console.error('Error fetching voices:', error);
    loadedVoices.value = [];
    setTotalItems(0);
  } finally {
    loading.value = false;
  }
}

function updateFavorite(index, voice_favorite_id = null) {
  if (loadedVoices.value[index]) {
    loadedVoices.value[index].voice_favorite_id = voice_favorite_id;
  }
}

function updateLike(index, voice_like_id = null) {
  const listItem = loadedVoices.value[index];
  if (!listItem) return;
  listItem.voice_likes += (voice_like_id === null ? -1 : 1);
  listItem.voice_like_id = voice_like_id;
}
</script>

<template>
  <div class="w-full premium-voices-container">
    <div class="flex flex-col w-full bg-white dark:bg-gray-800 dark:border-gray-600" :class="{'min-h-[300px] relative': loading}">
      <PreloaderAnimation v-if="loading"></PreloaderAnimation>
      <div v-else-if="loadedVoices.length > 0">
        <div v-for="(voice, index) in loadedVoices" :key="voice.voice_id || index" class="w-full my-2">
          <VoiceItem
            :voice="voice"
            :index="index"
            :is-favorite-list="false"
            :like-change="updateLike"
            :selected-voice-callback="selectedVoiceCallback"
            :favorite-change="updateFavorite"
            :current-default-voice-id="defaultVoiceId"         
            @update-default-voice="handleUpdateDefaultVoice"   
          ></VoiceItem>
        </div>
      </div>
      <div v-else class="text-center text-gray-500 py-4">
        No voices found matching your criteria
      </div>
    </div>
  </div>
</template>