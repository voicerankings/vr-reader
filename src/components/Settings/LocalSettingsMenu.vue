<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import useMyComposable from '../../composables/Composable';
import { saveToLocalStorage, readLocalStorage } from '../../../js/utils/helpers';

import useLocalSettings from '../../composables/useLocalSettings';

const { 
  getFromStorageContextMenuControls,
  contextMenuShowRecentVoicesState
} = useLocalSettings();

let contextMenuShowRecentVoicesWatch;

onMounted(async () => {
    await getFromStorageContextMenuControls();
    contextMenuShowRecentVoicesWatch = watch(contextMenuShowRecentVoicesState, (newState)=>{ 
        chrome.runtime.sendMessage({ action: "update-contentscript-storage",
            key:'CONTEXT_MENU_SHOW_RECENT_VOICES',
            value:newState
        });
        saveToLocalStorage({'CONTEXT_MENU_SHOW_RECENT_VOICES':newState}, true);
    });

  document.addEventListener('click', handleClickOutside);
  await loadContextMenuVoices();
})


onUnmounted(() => {
  contextMenuShowRecentVoicesWatch();

  document.removeEventListener('click', handleClickOutside);
  clearTimeout(debounceTimer);
  stopAudio();
})



const MAX_CONTEXT_MENU_VOICES = 5;

// --- STATE & REFS ---
const searchQuery = ref('');
const isSearchFocused = ref(false);
const isLoading = ref(false);
const searchResults = ref([]);
const contextMenuVoices = ref([]);
const highlightedIndex = ref(-1);
let debounceTimer = null;

// --- Modal State ---
const isSpeedModalOpen = ref(false);
const editingVoice = ref(null);
const tempSpeed = ref(1.0);

const { 
  API_NUXT_DOMAIN, 
  sidepanelMakeToast 
} = useMyComposable();

// --- DOM REFS ---
const searchInputRef = ref(null);
const typeaheadRef = ref(null);

// --- AUDIO PLAYER STATE ---
const audio = ref(null);
const currentPlayingVoiceId = ref(null);
const isAudioLoading = ref(false);




// --- COMPUTED PROPERTIES ---
const showTypeahead = computed(() => {
  return isSearchFocused.value && searchQuery.value.trim() && (searchResults.value.length > 0 || isLoading.value);
});

const displayList = computed(() => {
  const menuVoices = Array.isArray(contextMenuVoices.value) ? contextMenuVoices.value : [];
  return searchResults.value.map(voice => {
    const langInfo = getLanguageInfo(voice.voice_language_codes);
    return {
      ...voice,
      displayCountryCode: langInfo.primaryCountryCode,
      languageCount: langInfo.count,
      isInMenu: menuVoices.some(v => v.voice_id === voice.voice_id)
    };
  });
});

// --- WATCHERS ---
watch(searchQuery, (newQuery) => {
  highlightedIndex.value = -1;
  clearTimeout(debounceTimer);
  if (!newQuery.trim()) { 
    searchResults.value = []; 
    isLoading.value = false; 
    return; 
  }
  debounceTimer = setTimeout(() => { fetchVoices(newQuery); }, 300);
});

// --- API & DATA METHODS ---
async function fetchVoices(query) {
  if (!query.trim()) { 
    searchResults.value = []; 
    return; 
  }
  isLoading.value = true;
  try {
    const url = `https://${API_NUXT_DOMAIN.value}/api/v1/voice/search?search=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) { 
      throw new Error(`HTTP error! status: ${response.status}`); 
    }
    const data = await response.json();
    if (query === searchQuery.value) {
      searchResults.value = data.voices || [];
    }
  } catch (error) {
    console.error('Failed to fetch voices:', error);
    if (query === searchQuery.value) {
      searchResults.value = [];
    }
  } finally {
    if (query === searchQuery.value) {
      isLoading.value = false;
    }
  }
}

function getLanguageInfo(languageCodes) {
  if (!languageCodes || !Array.isArray(languageCodes)) {
    return { primaryCountryCode: null, count: 0 };
  }
  const codes = languageCodes;
  const count = codes.length;
  if (count === 0) return { primaryCountryCode: null, count: 0 };
  
  let primaryCode = codes.find(c => c.toLowerCase() === 'en-us') || 
                    codes.find(c => c.toLowerCase().startsWith('en-')) || 
                    codes[0];
  const parts = primaryCode.split('-');
  const countryCode = parts.length > 1 ? parts[1].toUpperCase() : null;
  return { primaryCountryCode: countryCode, count: count };
}

async function loadContextMenuVoices() {
  try {
    const storage = await readLocalStorage(['CONTEXT_MENU_VOICES']);
    const voices = storage.CONTEXT_MENU_VOICES;
    contextMenuVoices.value = Array.isArray(voices) ? voices : [];
  } catch (error) {
    console.error('Error loading context menu voices:', error);
    contextMenuVoices.value = [];
  }
}

function gotoVoicePage(voice) {
  chrome.runtime.sendMessage({ 
    action: "sameTabNavigateTo", 
    url: `https://${API_NUXT_DOMAIN.value}/voice/${voice.voice_service}/${voice.voice_gender}/${voice.voice_speaker_id}`
  });
}

async function updateAndSaveContextMenu(updatedVoices) {
  await saveToLocalStorage({ 'CONTEXT_MENU_VOICES': updatedVoices }, true);
  chrome.runtime.sendMessage({ 
    action: 'UPDATE_CONTEXT_MENU_VOICES',
    voices: updatedVoices
  });
}

async function addToContextMenu(voice) {
  if (!Array.isArray(contextMenuVoices.value)) {
    contextMenuVoices.value = [];
  }

  if (contextMenuVoices.value.some(v => v.voice_id === voice.voice_id)) {
    sidepanelMakeToast('This voice is already in the context menu', 'warning');
    return;
  }

  if (contextMenuVoices.value.length >= MAX_CONTEXT_MENU_VOICES) {
    alert(`The context menu is full (${MAX_CONTEXT_MENU_VOICES} voices maximum). Please remove a voice before adding another.`);
    return;
  }
  
  if (voice.voice_service_extension_active === false) {
    alert(`Sorry, ${voice.voice_service} voices are not available yet for the extension`);
    return;
  }

  const voiceData = {
    voice_id: voice.voice_id,
    voice_name: voice.voice_name,
    voice_gender: voice.voice_gender,
    voice_instructions: voice.voice_instructions ?? null,
    voice_language_code: voice.voice_language_code || (Array.isArray(voice.voice_language_codes) ? voice.voice_language_codes[0] : null),
    voice_speaker_id: voice.voice_speaker_id,
    voice_words_per_minute: voice.voice_words_per_minute,
    voice_service: voice.voice_service,
    voice_service_alias: voice.voice_service_alias,
    voice_has_voice_speed_support: voice.voice_has_voice_speed_support,
    voice_has_word_timestamp_support: voice.voice_has_word_timestamp_support,
    voice_speed: 1.0, 
  };

  const updatedVoices = [...contextMenuVoices.value, voiceData];
  contextMenuVoices.value = updatedVoices;
  
  await updateAndSaveContextMenu(updatedVoices);

  sidepanelMakeToast(`${voice.voice_name} added to context menu!`, 'success');
}

async function removeFromContextMenu(voiceId) {
  if (!Array.isArray(contextMenuVoices.value)) {
    contextMenuVoices.value = [];
    return;
  }

  const updatedVoices = contextMenuVoices.value.filter(v => v.voice_id !== voiceId);
  contextMenuVoices.value = updatedVoices;
  
  await updateAndSaveContextMenu(updatedVoices);

  sidepanelMakeToast('Voice removed from context menu', 'success');
}

function openSpeedModal(voice) {
  // Prevent opening modal for disabled voices, just in case
  if (!voice.voice_has_voice_speed_support) return;
  
  editingVoice.value = voice;
  tempSpeed.value = voice.voice_speed || 1.0;
  isSpeedModalOpen.value = true;
}

function closeSpeedModal() {
  isSpeedModalOpen.value = false;
  editingVoice.value = null;
}

async function saveSpeedChange() {
  if (!editingVoice.value) return;

  const voiceIndex = contextMenuVoices.value.findIndex(v => v.voice_id === editingVoice.value.voice_id);
  
  if (voiceIndex !== -1) {
    const updatedVoices = [...contextMenuVoices.value];
    updatedVoices[voiceIndex] = { ...updatedVoices[voiceIndex], voice_speed: parseFloat(tempSpeed.value) };
    contextMenuVoices.value = updatedVoices;

    await updateAndSaveContextMenu(updatedVoices);

    sidepanelMakeToast(`${editingVoice.value.voice_name} speed updated to ${parseFloat(tempSpeed.value).toFixed(2)}x`, 'success');
  }

  closeSpeedModal();
}

function handleKeydown(event) {
  if (!showTypeahead.value || displayList.value.length === 0) return;
  switch (event.key) {
    case 'ArrowDown': 
      event.preventDefault(); 
      highlightedIndex.value = (highlightedIndex.value + 1) % displayList.value.length; 
      break;
    case 'ArrowUp': 
      event.preventDefault(); 
      highlightedIndex.value = (highlightedIndex.value <= 0) ? displayList.value.length - 1 : highlightedIndex.value - 1; 
      break;
    case 'Enter': 
      event.preventDefault(); 
      if (highlightedIndex.value !== -1) { 
        gotoVoicePage(displayList.value[highlightedIndex.value]); 
      } 
      break;
    case 'Escape': 
      event.preventDefault(); 
      isSearchFocused.value = false; 
      searchInputRef.value?.blur(); 
      break;
  }
}

function handleClickOutside(event) {
  if (typeaheadRef.value && !typeaheadRef.value.contains(event.target)) {
    isSearchFocused.value = false;
  }
}

function getAudioUrl(voice) {
  if (voice?.voice_design_make_default_preview === true && voice?.voice_design_sample_text_hash) {
    return `https://cdn.soundranks.com/sampleVoiceDesignTTS/${voice.voice_service}-${voice.voice_speaker_id}-${voice.voice_design_sample_text_hash}.mp3`;
  }
  return `https://cdn.soundranks.com/sampleAudioTTS/${voice.voice_service}-${voice.voice_speaker_id}.mp3`;
}

function stopAudio() {
  if (audio.value) { 
    audio.value.pause(); 
    audio.value = null; 
  }
  currentPlayingVoiceId.value = null; 
  isAudioLoading.value = false;
}

function togglePlay(voice) {
  if (currentPlayingVoiceId.value !== voice.voice_id) {
    stopAudio(); 
    currentPlayingVoiceId.value = voice.voice_id; 
    isAudioLoading.value = true;
    const audioUrl = getAudioUrl(voice); 
    audio.value = new Audio(audioUrl);
    
    // If speed is not supported, playbackRate defaults to 1.0. Otherwise use the set speed.
    audio.value.playbackRate = voice.voice_has_voice_speed_support ? (voice.voice_speed || 1.0) : 1.0;
    
    audio.value.play().catch(e => { stopAudio(); });
    audio.value.oncanplaythrough = () => { 
      if (currentPlayingVoiceId.value === voice.voice_id) { 
        isAudioLoading.value = false; 
      } 
    };
    audio.value.onended = () => { stopAudio(); };
    audio.value.onerror = () => { stopAudio(); };
  } else { 
    if (audio.value) { 
      audio.value.paused ? audio.value.play() : audio.value.pause(); 
    } 
  }
}

const isPlaying = (voiceId) => { 
  return currentPlayingVoiceId.value === voiceId && audio.value && !audio.value.paused; 
}
</script>

<template>
  <div class="px-3">
    <div class="relative flex flex-col w-full space-y-4 pb-4">
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 main-stick">
        <div class="flex-wrap items-center">
          <div class="relative px-0 max-w-full mb-1">
            <h3 class="font-semibold text-lg text-gray-800 mb-1">Context Menu Voices</h3>
            <p class="text-sm text-gray-500 mb-4">Add up to {{ MAX_CONTEXT_MENU_VOICES }} voices to your right-click context menu for quick access.</p>
            
            <!-- Search Input -->
            <div class="relative" ref="typeaheadRef">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
              <input
                ref="searchInputRef"
                v-model="searchQuery"
                @focus="isSearchFocused = true"
                @keydown="handleKeydown"
                type="text"
                placeholder="Search voices to add to context menu..."
                autocomplete="off"
                class="block w-full pl-11 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-shadow"
              >

              <!-- Search Results Dropdown -->
              <div 
                v-if="showTypeahead"
                class="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden"
              >
                <div class="max-h-80 overflow-y-auto local-settings-scrollbar">
                  <div class="py-1">
                    <div
                      v-for="(voice, index) in displayList"
                      :key="voice.voice_id"
                      :class="['group cursor-pointer relative', index === highlightedIndex ? 'bg-indigo-50' : '']"
                    >
                      <div class="px-4 pl-2 py-3 flex items-center justify-between w-full transition-colors duration-150 group-hover:bg-gray-50">
                        <div class="flex items-center space-x-2 flex-1 min-w-0">
                          <!-- Play Button -->
                          <button 
                            @click.stop.prevent="togglePlay(voice)" 
                            class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-indigo-600 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
                          >
                            <div v-if="isAudioLoading && currentPlayingVoiceId === voice.voice_id" class="animate-spin h-5 w-5">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            </div>
                            <div v-else-if="isPlaying(voice.voice_id)" class="w-5 h-5">
                              <svg fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                              </svg>
                            </div>
                            <svg v-else class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>
                            </svg>
                          </button>

                          <!-- Voice Info -->
                          <div @click="gotoVoicePage(voice)" class="flex-1 min-w-0">
                            <div class="font-medium text-gray-900 truncate flex items-center space-x-1.5">
                              <span>{{ voice.voice_name }}</span>
                              <template v-if="voice.displayCountryCode">
                                <img 
                                  class="inline-block h-4 w-auto rounded-sm shadow-sm" 
                                  :src="'https://flagsapi.com/' + voice.displayCountryCode + '/flat/24.png'" 
                                  :alt="voice.displayCountryCode + ' flag'" 
                                  @error="$event.target.style.display='none'"
                                >
                                <span v-if="voice.languageCount > 1" class="text-xs text-gray-500 font-normal">(x{{ voice.languageCount }})</span>
                              </template>
                            </div>
                          </div>
                        </div>
                        
                        <!-- Service Info & Add Button -->
                        <div class="flex items-center gap-3 flex-shrink-0 ml-2">
                          <div class="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                            <span>{{ voice.voice_service }}</span>
                            <img 
                              v-if="voice.voice_service_alias" 
                              class="h-4 w-4 rounded shadow-sm" 
                              :src="'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://' + voice.voice_service_alias + '&size=32'" 
                              :alt="voice.voice_service_alias + ' logo'"
                            />
                          </div>
                          
                          <!-- Add/Already Added Button -->
                          <button 
                            v-if="voice.isInMenu"
                            disabled
                            class="w-8 h-8 flex items-center justify-center rounded-full bg-green-50 text-green-600 cursor-not-allowed border border-green-200"
                            v-tooltip="{content: 'Already in context menu'}"
                          >
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                            </svg>
                          </button>
                          <button 
                            v-else
                            @click.stop.prevent="addToContextMenu(voice)"
                            class="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:scale-105 transition-all border border-indigo-200"
                            v-tooltip="{content: 'Add to context menu'}"
                          >
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"></path>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div v-if="isLoading" class="px-4 py-6 text-center text-gray-500 text-sm">
                      Searching...
                    </div>
                    <div v-if="searchQuery.trim() && !isLoading && searchResults.length === 0" class="px-4 py-6 text-center text-gray-500 text-sm">
                      No voices found for "{{ searchQuery }}"
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Settings Checkbox -->
      <div class="bg-white p-4 border border-gray-200 rounded-xl shadow-sm flex items-center justify-between">
        <label class="flex items-center cursor-pointer">                                                                
            <input v-model="contextMenuShowRecentVoicesState" type="checkbox" id="contextMenuRecentCheckbox" class="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500">
            <span class="text-sm text-gray-700 font-medium ml-3">Show recent voices in context menu</span>
        </label>
      </div>

      <!-- Context Menu Voices List -->
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
        <div v-if="contextMenuVoices.length === 0" class="px-6 py-8 text-center text-gray-500">
          <svg class="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
          </svg>
          <p class="text-sm font-medium">No voices in context menu yet.</p>
          <p class="text-xs mt-1 text-gray-400">Search and add voices above to quick-access them from right-click menu.</p>
        </div>

        <table v-else class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Voice Name
              </th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Provider
              </th>
              <th scope="col" class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-100">
            <tr v-for="voice in contextMenuVoices" :key="voice.voice_id" class="hover:bg-gray-50 transition-colors">
              <td class="px-4 py-3 whitespace-nowrap">
                <div class="flex items-center space-x-3">
                  <button 
                    @click.stop.prevent="togglePlay(voice)" 
                    class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-indigo-600 hover:bg-indigo-100 transition-colors"
                  >
                    <div v-if="isAudioLoading && currentPlayingVoiceId === voice.voice_id" class="animate-spin h-5 w-5">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <div v-else-if="isPlaying(voice.voice_id)" class="w-5 h-5">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                      </svg>
                    </div>
                    <svg v-else class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>
                    </svg>
                  </button>
                  <span class="font-medium text-gray-900 text-sm">{{ voice.voice_name }}</span>
                </div>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                <div class="flex items-center gap-1.5" v-tooltip="{content:voice.voice_service}">
                  <img 
                    v-if="voice.voice_service_alias" 
                    class="h-4 w-4 rounded shadow-sm" 
                    :src="'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://' + voice.voice_service_alias + '&size=32'" 
                    :alt="voice.voice_service_alias + ' logo'"
                  />
                  <span class="truncate max-w-[100px]">{{ voice.voice_service }}</span>
                </div>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-right text-sm">
                <div class="flex items-center justify-end space-x-2">
                  <button
                    @click="openSpeedModal(voice)"
                    :disabled="!voice.voice_has_voice_speed_support"
                    :class="[
                      'px-2 py-1 text-xs font-semibold rounded-md border',
                      voice.voice_has_voice_speed_support
                        ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200 transition-colors'
                        : 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                    ]"
                    v-tooltip="{
                      content: voice.voice_has_voice_speed_support
                        ? 'Adjust voice speed'
                        : `This voice doesn't support speed changes`
                    }"
                  >
                    {{ (voice.voice_has_voice_speed_support ? (voice.voice_speed || 1.0) : 1.0).toFixed(1) }}x
                  </button>

                  <button
                    @click="removeFromContextMenu(voice.voice_id)"
                    class="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                    v-tooltip="{content: 'Remove from context menu'}"
                  >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Voice Count Indicator -->
      <div class="mt-2 px-4 text-right text-xs text-gray-500">
        {{ contextMenuVoices.length }} / {{ MAX_CONTEXT_MENU_VOICES }} voices in context menu
      </div>
    </div>

    <!-- Speed Adjustment Modal -->
    <div v-if="isSpeedModalOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-2">
          Edit Speed for <span class="text-indigo-600">{{ editingVoice?.voice_name }}</span>
        </h3>
        <p class="text-sm text-gray-500 mb-6">Adjust the playback speed for this specific voice.</p>
        
        <div class="flex items-center space-x-4 mb-6">
          <input 
            v-model="tempSpeed" 
            type="range" 
            min="0.5" 
            max="2.0" 
            step="0.05" 
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          >
          <span class="font-mono text-lg text-gray-700 font-semibold w-20 text-center bg-gray-100 py-1 rounded-md">
            {{ parseFloat(tempSpeed).toFixed(2) }}x
          </span>
        </div>

        <div class="flex justify-end space-x-3">
          <button @click="closeSpeedModal" class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
            Cancel
          </button>
          <button @click="saveSpeedChange" class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.main-stick {
  position: sticky;
  top: 4px;
  background: white;
  z-index: 1;
}

.local-settings-scrollbar::-webkit-scrollbar { 
  width: 6px; 
}

.local-settings-scrollbar::-webkit-scrollbar-track { 
  background: #f1f5f9; 
  border-radius: 3px; 
}

.local-settings-scrollbar::-webkit-scrollbar-thumb { 
  background: #cbd5e1; 
  border-radius: 3px; 
}

.local-settings-scrollbar::-webkit-scrollbar-thumb:hover { 
  background: #94a3b8; 
}
</style>