<script setup>
import VoiceItem from './VoiceItem.vue';
import PreloaderAnimation from '../../Shared/PreloaderAnimation.vue';
import useMyComposable from '../../../composables/Composable';
import { ref, computed, onMounted } from 'vue';
import NoCountMessage from '../../Shared/NoCountMessage.vue';
import { saveToLocalStorage } from '../../../../js/utils/helpers';
import { CONSTANTS } from "../../../../js/constants/constants";

// --> 1. Add dependencies needed for making a voice default
const {  
  API_NUXT_DOMAIN, 
  saveVoiceDefaultOnServer, 
  voiceDefaultPayload, 
  saveVoiceDefaultToLocalStorage 
} = useMyComposable();

const voicesList = ref([]);
const loading = ref(false);
const defaultVoiceId = ref(null); // --> 2. STATE for the default voice ID

const props = defineProps({
  selectedVoiceCallback: Function
});

onMounted(async () => {
  await loadDefaultVoiceId(); // --> 3. Load the default ID on mount
  await getVoices();
});

// --> 4. Add function to load the default voice ID once
async function loadDefaultVoiceId() {
  try {
    const result = await chrome.storage.local.get(['DEFAULT_PREMIUM_VOICE_ID']);
    defaultVoiceId.value = result.DEFAULT_PREMIUM_VOICE_ID || null;
  } catch (e) {
    console.error("Error loading default voice ID from storage", e);
  }
}

// --> 5. Add function to handle the update event from a child
async function handleUpdateDefaultVoice(voice) {
  // Logic is identical to the VoiceList component
  chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_ID': voice.voice_id });
  voiceDefaultPayload.value.voice_id = voice.voice_id;
  
  defaultVoiceId.value = voice.voice_id; // Update reactive state immediately

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

async function getVoices() {
  loading.value = true;
  try {
    const urlWithParams = `https://${API_NUXT_DOMAIN.value}/api/v1/voice/favorites?extension_only=true`;
    const rawResponse = await fetch(urlWithParams);
    const responseData = await rawResponse.json(); 
    voicesList.value = responseData.favorites || [];
  } catch(error) {
    console.error("Failed to fetch favorites:", error);
    voicesList.value = [];
  } finally {
    loading.value = false;
  }
}

const voicesListMap = computed(() => {
  return voicesList.value.map((item)=>{
    item.audioModeOpened = false;
    item.audioBlobURL = null;
    return item;
  });
});

function updateFavorite(index, voice_favorite_id = null) {
  const listItem = voicesList.value[index];
  if (listItem) {
    listItem.voice_favorite_id = voice_favorite_id;
  }
}

function updateLike(index, voice_like_id = null) {
  const listItem = voicesList.value[index];
  if (!listItem) return;
  listItem.voice_likes += (voice_like_id === null ? -1 : 1);
  listItem.voice_like_id = voice_like_id;
}

const noCountMessage = ref(`
  <svg class="m-auto" xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24">
    <g fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="m9.99 16.5l-.975.474c-1.98.548-2.971.822-3.505.245c-.534-.576-.258-1.62.295-3.71l.142-.54c.157-.595.236-.891.197-1.186c-.04-.294-.193-.553-.499-1.07l-.278-.47C4.29 8.422 3.752 7.512 4.11 6.787c.36-.724 1.379-.783 3.418-.9l.527-.03c.58-.034.869-.05 1.122-.185c.252-.135.439-.372.813-.848l.34-.432c1.316-1.673 1.974-2.509 2.73-2.38s1.11 1.137 1.817 3.154l.183.522c.201.573.302.86.497 1.07c.196.212.464.324 1.001.547l.489.204c1.89.786 2.835 1.18 2.942 1.983c.092.686-.477 1.283-1.64 2.29" opacity=".5"/>
      <path d="M15.252 10.689c-.987-1.18-1.48-1.77-2.048-1.68c-.567.091-.832.803-1.362 2.227l-.138.368c-.15.405-.226.607-.373.756c-.146.149-.348.228-.75.386l-.367.143c-1.417.555-2.126.833-2.207 1.4c-.08.567.52 1.049 1.721 2.011l.31.25c.342.273.513.41.611.597c.1.187.115.404.146.837l.029.394c.11 1.523.166 2.285.683 2.545c.517.26 1.154-.155 2.427-.983l.329-.215c.362-.235.543-.353.75-.387c.208-.033.42.022.841.132l.385.1c1.485.386 2.228.58 2.629.173c.4-.407.193-1.144-.221-2.62l-.108-.38c-.117-.42-.176-.63-.147-.837c.03-.208.145-.39.374-.756l.21-.332c.807-1.285 1.21-1.927.94-2.438c-.269-.511-1.033-.553-2.562-.635l-.396-.022c-.434-.023-.652-.035-.841-.13c-.19-.095-.33-.263-.61-.599l-.255-.305Z"/>
    </g>
  </svg>
  <p>No premium voices favorited</p>
`);
</script>


<template>
  <div class="w-full">
    <div class="flex flex-col px-4 bg-white dark:bg-gray-800 dark:border-gray-600" :class="{'min-h-[300px] relative': loading || voicesListMap.length === 0}">      
      <PreloaderAnimation v-if="loading"></PreloaderAnimation>
      <template v-else>
        <NoCountMessage v-if="voicesListMap.length === 0" :message="noCountMessage"/>
        <div v-for="(voice, index) in voicesListMap" :key="'fav-' + index" :id="'fav_id-' + index">

          <VoiceItem 
            :voice="voice" 
            :index="index" 
            :is-favorite-list="true" 
            :like-change="updateLike"
            :selected-voice-callback="selectedVoiceCallback"
            :favorite-change="updateFavorite"
            :current-default-voice-id="defaultVoiceId"         
            @update-default-voice="handleUpdateDefaultVoice"
          ></VoiceItem>
        </div>  
      </template>
    </div>
  </div>
</template>