<script setup>
import VoiceItem from './VoiceItem.vue';
import PreloaderAnimation from '../../Shared/PreloaderAnimation.vue';
import useMyComposable from '../../../composables/Composable';
import { ref, computed, onMounted } from 'vue';
import NoCountMessage from '../../Shared/NoCountMessage.vue';
import { saveToLocalStorage } from '../../../../js/utils/helpers';
import { CONSTANTS } from "../../../../js/constants/constants";

const {  
  API_NUXT_DOMAIN, 
  saveVoiceDefaultOnServer, 
  voiceDefaultPayload, 
  saveVoiceDefaultToLocalStorage 
} = useMyComposable();

const userCollections = ref([]);
const loading = ref(false);
const defaultVoiceId = ref(null);
const openCollections = ref(new Set());
const hoveredCollectionId = ref(null);

const props = defineProps({
  selectedVoiceCallback: Function
});

onMounted(async () => {
  await loadDefaultVoiceId();
  await fetchUserCollections();
});

async function loadDefaultVoiceId() {
  try {
    const result = await chrome.storage.local.get(['DEFAULT_PREMIUM_VOICE_ID']);
    defaultVoiceId.value = result.DEFAULT_PREMIUM_VOICE_ID || null;
  } catch (e) {
    console.error("Error loading default voice ID from storage", e);
  }
}

async function handleUpdateDefaultVoice(voice) {
  chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_ID': voice.voice_id });
  voiceDefaultPayload.value.voice_id = voice.voice_id;
  
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

async function fetchUserCollections() {
  loading.value = true;
  try {
    const urlWithParams = `https://${API_NUXT_DOMAIN.value}/api/v1/collections/list`;
    const rawResponse = await fetch(urlWithParams);
    const responseData = await rawResponse.json();
    userCollections.value = (responseData.collections || []).map(collection => ({
      ...collection,
      voices: [],
      voicesLoaded: false,
      loadingVoices: false
    }));
  } catch (error) {
    console.error("Failed to fetch user collections:", error);
    userCollections.value = [];
  } finally {
    loading.value = false;
  }
}

async function toggleCollection(collectionId, index) {
  const collection = userCollections.value[index];
  
  if (openCollections.value.has(collectionId)) {
    openCollections.value.delete(collectionId);
  } else {
    openCollections.value.add(collectionId);
    
    if (!collection.voicesLoaded && !collection.loadingVoices) {
      await fetchCollectionVoices(collectionId, index);
    }
  }
}

async function fetchCollectionVoices(collectionId, index) {
  const collection = userCollections.value[index];
  collection.loadingVoices = true;
  
  try {
    const params = {
      collection_id: collectionId,
      limit: 1000,
      offset: 0,
      extension_only: 'true'
    };
    
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    
    const queryParams = new URLSearchParams(filteredParams);
    const urlWithParams = `https://${API_NUXT_DOMAIN.value}/api/v1/voice/list?${queryParams.toString()}`;
    
    const rawResponse = await fetch(urlWithParams);
    const responseData = await rawResponse.json();
    
    collection.voices = (responseData.voices || []).map(voice => ({
      ...voice,
      audioModeOpened: false,
      audioBlobURL: null
    }));
    collection.voicesLoaded = true;
  } catch (error) {
    console.error(`Failed to fetch voices for collection ${collectionId}:`, error);
    collection.voices = [];
  } finally {
    collection.loadingVoices = false;
  }
}

async function handleDeleteCollection(collectionId, collectionName, isOwner) {
  if (!isOwner) {
    alert("You do not have permission to delete this collection.");
    return;
  }

  const isConfirmed = confirm(
    `Are you sure you want to permanently delete the collection "${collectionName}"?\n\nThis action cannot be undone.`
  );

  if (!isConfirmed) {
    return;
  }

  try {
    const urlWithParams = `https://${API_NUXT_DOMAIN.value}/api/v1/collections/collection`;
    const rawResponse = await fetch(urlWithParams, {
      method: 'DELETE',
      headers: { 
        'Accept': 'application/json', 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ collection_id: collectionId })
    });

    if (!rawResponse.ok) {
      const errorData = await rawResponse.json();
      throw new Error(errorData.message || 'Failed to delete collection');
    }

    // Remove from local state
    userCollections.value = userCollections.value.filter(c => c.collection_id !== collectionId);
    openCollections.value.delete(collectionId);
    
  } catch (error) {
    console.error("Failed to delete collection:", error);
    alert(error.message || "Could not delete the collection. Please try again.");
  }
}

async function handleRemoveFromCollection(collectionIndex, voiceId) {
  const collection = userCollections.value[collectionIndex];
  
  if (!collection.is_owner) {
    alert("You do not have permission to remove voices from this collection.");
    return;
  }

  const voiceIndex = collection.voices.findIndex(v => v.voice_id === voiceId);
  if (voiceIndex === -1) return;

  // Optimistically remove from UI
  const removedVoice = collection.voices.splice(voiceIndex, 1)[0];
  
  try {
    const urlWithParams = `https://${API_NUXT_DOMAIN.value}/api/v1/collections/remove`;
    const rawResponse = await fetch(urlWithParams, {
      method: 'POST',
      headers: { 
        'Accept': 'application/json', 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        collection_id: collection.collection_id,
        voice_id: voiceId
      })
    });

    if (!rawResponse.ok) {
      throw new Error('Failed to remove voice');
    }
  } catch (error) {
    console.error("Failed to remove voice from collection:", error);
    alert("Could not remove voice. Please try again.");
    // Revert optimistic update
    collection.voices.splice(voiceIndex, 0, removedVoice);
  }
}

function isCollectionOpen(collectionId) {
  return openCollections.value.has(collectionId);
}

function updateFavorite(collectionIndex, voiceIndex, voice_favorite_id = null) {
  const collection = userCollections.value[collectionIndex];
  if (collection && collection.voices[voiceIndex]) {
    collection.voices[voiceIndex].voice_favorite_id = voice_favorite_id;
  }
}

function updateLike(collectionIndex, voiceIndex, voice_like_id = null) {
  const collection = userCollections.value[collectionIndex];
  if (collection && collection.voices[voiceIndex]) {
    const voice = collection.voices[voiceIndex];
    voice.voice_likes += (voice_like_id === null ? -1 : 1);
    voice.voice_like_id = voice_like_id;
  }
}

const noCountMessage = ref(`
  <svg class="m-auto" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" width="100" height="100" viewBox="0 0 24 24">
    <path fill="#000000" d="m11.066 8.004l.184-.005h7.5a3.25 3.25 0 0 1 3.245 3.065l.005.185v7.5a3.25 3.25 0 0 1-3.066 3.245l-.184.005h-7.5a3.25 3.25 0 0 1-3.245-3.066L8 18.75v-7.5a3.25 3.25 0 0 1 3.066-3.245M18.75 9.5h-7.5a1.75 1.75 0 0 0-1.744 1.606l-.006.144v7.5a1.75 1.75 0 0 0 1.607 1.744l.143.006h7.5a1.75 1.75 0 0 0 1.744-1.607l.006-.143v-7.5a1.75 1.75 0 0 0-1.75-1.75m-3.168-5.266l.052.177l.693 2.588h-1.553l-.588-2.2a1.75 1.75 0 0 0-2.144-1.238L4.798 5.502a1.75 1.75 0 0 0-1.27 1.995l.032.148l1.942 7.244A1.75 1.75 0 0 0 7 16.176v1.506a3.25 3.25 0 0 1-2.895-2.228l-.052-.176l-1.941-7.245a3.25 3.25 0 0 1 2.12-3.928l.178-.052l7.244-1.941a3.25 3.25 0 0 1 3.928 2.12"/>
  </svg>
  <p>No collections created</p>
`);
</script>

<template>
  <div class="w-full">
    <div class="flex flex-col px-0 bg-white dark:bg-gray-800 dark:border-gray-600" :class="{'min-h-[300px] relative': loading || userCollections.length === 0}">      
      <PreloaderAnimation v-if="loading"></PreloaderAnimation>
      <template v-else>
        <NoCountMessage v-if="userCollections.length === 0" :message="noCountMessage"/>
        
        <div 
        v-for="(collection, collectionIndex) in userCollections" 
        :key="'collection-' + collection.collection_id"
        class="mb-2"
        @mouseenter="hoveredCollectionId = collection.collection_id"
        @mouseleave="hoveredCollectionId = null"
      >
        <!-- Collection Header -->
        <div 
          class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        >
          <div 
            @click="toggleCollection(collection.collection_id, collectionIndex)"
            class="flex items-center gap-3 flex-1"
          >
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ collection.collection_name }}
            </h3>
            <span class="text-sm text-gray-500 dark:text-gray-400">
              ({{ collection.voice_count || 0 }} voices)
            </span>
          </div>
          
          <div class="flex items-center gap-2">
            <!-- Delete Button (only shows on hover and if owner) -->
            <button
              v-if="hoveredCollectionId === collection.collection_id && collection.is_owner"
              @click.stop="handleDeleteCollection(collection.collection_id, collection.collection_name, collection.is_owner)"
              class="p-1 rounded-md text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors absolute bg-gray-300 right-12"
              v-tooltip="{ content: 'Delete collection' }"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>

            <!-- Arrow Icon -->
            <svg 
              @click="toggleCollection(collection.collection_id, collectionIndex)"
              xmlns="http://www.w3.org/2000/svg" 
              class="w-5 h-5 text-gray-600 dark:text-gray-300 transition-transform"
              :class="{ 'rotate-180': isCollectionOpen(collection.collection_id) }"
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <!-- Collection Voices (Accordion Content) -->
        <div 
          v-if="isCollectionOpen(collection.collection_id)"
          class="ml-4 border-l-2 border-gray-200 dark:border-gray-600 pl-4 mt-2"
        >
          <!-- Loading State -->
          <div 
            v-if="collection.loadingVoices" 
            class="py-8 text-center text-gray-500 dark:text-gray-400"
          >
            Loading voices...
          </div>

          <!-- Voices List -->
          <div 
            v-else-if="collection.voices.length > 0"
            class="space-y-2"
          >
            <div 
              v-for="(voice, voiceIndex) in collection.voices" 
              :key="'voice-' + voice.voice_id"
              :id="'collection-' + collection.collection_id + '-voice-' + voiceIndex"
            >
              <VoiceItem 
                :voice="voice" 
                :index="voiceIndex" 
                :is-favorite-list="false" 
                :like-change="(index, likeId) => updateLike(collectionIndex, index, likeId)"
                :selected-voice-callback="selectedVoiceCallback"
                :favorite-change="(index, favId) => updateFavorite(collectionIndex, index, favId)"
                :current-default-voice-id="defaultVoiceId"
                :collection-id="collection.collection_id"
                :is-collection-owner="collection.is_owner"
                @update-default-voice="handleUpdateDefaultVoice"
                @remove-from-collection="handleRemoveFromCollection(collectionIndex, voice.voice_id)"
              />
            </div>
          </div>

          <!-- No Voices Message -->
          <div 
            v-else
            class="py-8 text-center text-gray-500 dark:text-gray-400"
          >
            No voices in this collection
          </div>
        </div>
      </div>
      </template>
    </div>
  </div>
</template>