<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import useMyComposable from '../../composables/Composable';
import VoiceCollectionManager from '../Shared/VoiceCollectionManager.vue';
import { saveToLocalStorage, readLocalStorage } from '../../../js/utils/helpers';
import { CONSTANTS } from "../../../js/constants/constants";

// --- NEW: Add constant for max voices ---
const MAX_CONTEXT_MENU_VOICES = 5;

// --- STATE & REFS ---
const searchQuery = ref('');
const isSearchFocused = ref(false);
const isLoading = ref(false);
const searchResults = ref([]);
const recentSearches = ref([]);
const contextMenuVoices = ref([]);
const highlightedIndex = ref(-1);
let debounceTimer = null;

const {
  API_NUXT_DOMAIN, isUserLogged, sidepanelMakeToast,
  saveVoiceDefaultOnServer,
  voiceDefaultPayload,
    saveVoiceDefaultToLocalStorage,
    pageRoute,
    localSettingsTab
} = useMyComposable();


// --- NEW STATE FOR HOVER MENU ---
const hoveredVoiceId = ref(null);
const defaultVoiceId = ref(null);
const isTogglingFavorite = ref(null);
const collectionTriggers = ref({}); // Track triggers for each voice
const openCollectionVoiceId = ref(null); // Track which voice has collection dropdown open

// Keep hover menu visible if collection dropdown is open
const shouldShowHoverMenu = (voiceId) => {
  return hoveredVoiceId.value === voiceId || openCollectionVoiceId.value === voiceId;
};

// --- DOM REFS ---
const searchInputRef = ref(null);
const typeaheadRef = ref(null);

// --- AUDIO PLAYER STATE ---
const audio = ref(null);
const currentPlayingVoiceId = ref(null);
const isAudioLoading = ref(false);


// --- TOOLTIP LOGIC WITH VOICE TAGS ---
const STAR_SVG_PATH = "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z";

const langDisplay = new Intl.DisplayNames(['en'], { type: 'language' });
const regionDisplay = new Intl.DisplayNames(['en'], { type: 'region' });

function getRatingHtml(voice) {
    const average = voice.voice_review_average;
    const count = voice.voice_review_count;
    if (!count || count === 0) return '';

    const widthPercentage = (average / 5) * 100;

    const stars = `
        <div class="relative inline-flex items-center" style="gap: 2px;">
            <!-- Background stars (empty/gray) -->
            <div class="flex" style="gap: 2px;">
                <svg class="w-4 h-4 text-gray-300 dark:text-gray-600" viewBox="0 0 20 20" fill="currentColor"><path d="${STAR_SVG_PATH}"/></svg>
                <svg class="w-4 h-4 text-gray-300 dark:text-gray-600" viewBox="0 0 20 20" fill="currentColor"><path d="${STAR_SVG_PATH}"/></svg>
                <svg class="w-4 h-4 text-gray-300 dark:text-gray-600" viewBox="0 0 20 20" fill="currentColor"><path d="${STAR_SVG_PATH}"/></svg>
                <svg class="w-4 h-4 text-gray-300 dark:text-gray-600" viewBox="0 0 20 20" fill="currentColor"><path d="${STAR_SVG_PATH}"/></svg>
                <svg class="w-4 h-4 text-gray-300 dark:text-gray-600" viewBox="0 0 20 20" fill="currentColor"><path d="${STAR_SVG_PATH}"/></svg>
            </div>
            <!-- Foreground stars (filled/yellow) - clipped by width -->
            <div class="absolute top-0 left-0 flex overflow-hidden" style="width: ${widthPercentage}%; gap: 2px;">
                <svg class="w-4 h-4 text-yellow-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="${STAR_SVG_PATH}"/></svg>
                <svg class="w-4 h-4 text-yellow-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="${STAR_SVG_PATH}"/></svg>
                <svg class="w-4 h-4 text-yellow-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="${STAR_SVG_PATH}"/></svg>
                <svg class="w-4 h-4 text-yellow-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="${STAR_SVG_PATH}"/></svg>
                <svg class="w-4 h-4 text-yellow-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="${STAR_SVG_PATH}"/></svg>
            </div>
        </div>
    `;

    return `
        <div class="flex items-center gap-2 text-sm">
            ${stars}
            <span class="text-gray-200 dark:text-gray-200 font-semibold">${Number(average).toFixed(1)}</span>
            <span class="text-gray-500 dark:text-gray-400">(${count})</span>
        </div>
    `;
}

function getLanguagesTooltipHtml(voice) {
    if (!voice.voice_language_codes || voice.voice_language_codes.length === 0) return '';
    return voice.voice_language_codes.slice(0,1).map(code => {
        try {
            const parts = code.split('-');
            const langCode = parts[0];
            const regionCode = parts.length > 1 ? parts[1].toUpperCase() : null;
            let langName = langDisplay.of(langCode);
            let regionName = regionCode ? regionDisplay.of(regionCode) : '';
            const flagHtml = regionCode 
                ? `<img style="display: inline-block; height: 14px; border-radius: 2px; margin-left: 6px;" src="https://flagsapi.com/${regionCode}/flat/24.png" alt="${regionCode} flag">` 
                : '';
            return `<div style="display: flex; align-items: center; color: #d1d5db; font-size: 13px;">
                      ${langName}${regionName ? ' <span style="opacity: 0.5; margin: 0 4px;">/</span> ' + regionName : ''}${flagHtml}
                    </div>`;
        } catch (e) { return code; }
    }).join('');
}

/**
 * NEW: Generates engaging HTML for voice tags.
 * Displays tags as styled, pill-shaped badges.
 */
function getTagsHtml(voice) {
    if (!voice.voice_suggested_tags_filtered || !Array.isArray(voice.voice_suggested_tags_filtered) || voice.voice_suggested_tags_filtered.length === 0) {
        return '';
    }

    const tagBadges = voice.voice_suggested_tags_filtered.map(tag =>
        `<span style="display: inline-flex; align-items: center; background-color: #374151; color: #f3f4f6; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 500; letter-spacing: 0.01em;">${tag}</span>`
    ).join('');

    return `<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">${tagBadges}</div>`;
}

/**
 * UPDATED: Builds the complete tooltip content using voice tags instead of the summary.
 */
function getTooltipContent(voice) {
    const nameHtml = `<div style="font-weight: 600; font-size: 15px; color: #ffffff; letter-spacing: 0.01em;">${voice.voice_name}</div>`;
    const ratingSection = getRatingHtml(voice);
    const languagesSection = getLanguagesTooltipHtml(voice);
    const tagsSection = getTagsHtml(voice); 
    
    const parts = [];
    parts.push(`<div style="display: flex; flex-direction: column; gap: 4px;">${nameHtml}${languagesSection}</div>`);

    if (ratingSection) {
        parts.push(ratingSection);
    }
    
    if (ratingSection && tagsSection) {
        parts.push(`<hr style="border: 0; height: 1px; background: #4b5563; margin: 4px 0;">`);
    }

    if (tagsSection) parts.push(tagsSection); 

    return `<div style="display: flex; flex-direction: column; gap: 8px; padding: 6px 4px; font-family: ui-sans-serif, system-ui, sans-serif;">${parts.join('')}</div>`;
}
// --- END: TOOLTIP LOGIC ---


// --- LIFECYCLE HOOKS ---
onMounted(async () => {
  document.addEventListener('click', handleClickOutside);
  loadRecentSearches();
  loadDefaultVoiceId();
  await loadContextMenuVoices();
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  clearTimeout(debounceTimer);
  stopAudio();
});

// --- COMPUTED PROPERTIES ---
const showTypeahead = computed(() => {
  return isSearchFocused.value && (
    (searchQuery.value.trim() && (searchResults.value.length > 0 || isLoading.value)) ||
    (!searchQuery.value.trim() && recentSearches.value.length > 0)
  );
});

const displayList = computed(() => {
  const sourceList = searchQuery.value.trim()
    ? searchResults.value
    : recentSearches.value.slice(0, 6);
  const menuVoices = Array.isArray(contextMenuVoices.value) ? contextMenuVoices.value : [];
  return sourceList.map(voice => {
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
  if (!newQuery.trim()) { searchResults.value = []; isLoading.value = false; return; }
  debounceTimer = setTimeout(() => { fetchVoices(newQuery); }, 300);
});

watch(showTypeahead, (isShowing) => {
  if (!isShowing) { stopAudio(); }
});

// --- NEW FUNCTIONS: for Context Menu ---
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
    voice_service: voice.voice_service,
    voice_service_alias: voice.voice_service_alias,
    voice_has_voice_speed_support: voice.voice_has_voice_speed_support ?? true
  };

  contextMenuVoices.value.push(voiceData);

  await saveToLocalStorage({ 'CONTEXT_MENU_VOICES': [...contextMenuVoices.value] }, true);

  chrome.runtime.sendMessage({
    action: 'UPDATE_CONTEXT_MENU_VOICES',
    voices: contextMenuVoices.value
  });

  sidepanelMakeToast(`${voice.voice_name} added to context menu!`, 'success');
}


// --- API & DATA METHODS ---
async function fetchVoices(query) {
  if (!query.trim()) { searchResults.value = []; return; }
  isLoading.value = true;
  try {
    const url = `https://${API_NUXT_DOMAIN.value}/api/v1/voice/search?search=${encodeURIComponent(query)}&extension_only=true`;
    const response = await fetch(url);
    if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
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
  if (!languageCodes || !Array.isArray(languageCodes)) return { primaryCountryCode: null, count: 0 };
  const codes = languageCodes;
  const count = codes.length;
  if (count === 0) return { primaryCountryCode: null, count: 0 };
  let primaryCode = codes.find(c => c.toLowerCase() === 'en-us') || codes.find(c => c.toLowerCase().startsWith('en-')) || codes[0];
  const parts = primaryCode.split('-');
  const countryCode = parts.length > 1 ? parts[1].toUpperCase() : null;
  return { primaryCountryCode: countryCode, count: count };
}

function loadRecentSearches() {
  const saved = localStorage.getItem('voiceRecentSearches');
  if (saved) { try { recentSearches.value = JSON.parse(saved); } catch(e) { console.error("Could not parse recent searches", e); } }
}

function gotoVoicePage(voice){
    chrome.runtime.sendMessage({ action: "sameTabNavigateTo",
    url:`https://${API_NUXT_DOMAIN.value}/voice/${voice.voice_service}/${voice.voice_gender}/${voice.voice_speaker_id}`});
}

function selectVoice(voice) {
  searchQuery.value = voice.voice_name;
  isSearchFocused.value = false;
  const existingIndex = recentSearches.value.findIndex(item => item.voice_id === voice.voice_id);
  if (existingIndex > -1) { recentSearches.value.splice(existingIndex, 1); }
  recentSearches.value.unshift(voice);
  if (recentSearches.value.length > 6) { recentSearches.value = recentSearches.value.slice(0, 6); }
  localStorage.setItem('voiceRecentSearches', JSON.stringify(recentSearches.value));
  if (searchInputRef.value) { searchInputRef.value.blur(); }
  gotoVoicePage(voice);
}

// --- NEW METHODS FOR HOVER MENU ---

async function loadDefaultVoiceId() {
  try {
    const result = await chrome.storage.local.get(['DEFAULT_PREMIUM_VOICE_ID']);
    defaultVoiceId.value = result.DEFAULT_PREMIUM_VOICE_ID || null;
  } catch (e) {
    console.error("Error loading default voice ID from storage", e);
  }
}

async function makeDefaultVoice(voice) {

  if(voice.voice_service_extension_active === false) {
    alert(`Sorry, ${voice.voice_service} voices are not available yet for the extension`);
    return;
  }

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

  sidepanelMakeToast(`${voice.voice_name} is now your default voice!`, 'success');
}

async function toggleFavorite(voice) {
    if (!isUserLogged.value) {
        sidepanelMakeToast('Please sign in to favorite voices.', '');
        return;
    }

    isTogglingFavorite.value = voice.voice_id;

    try {
        const url = `https://${API_NUXT_DOMAIN.value}/api/v1/voice/favorite`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                voice_favorite_id: voice.voice_favorite_id || null,
                voice_id: voice.voice_id,
            })
        });

        const responseData = await response.json();
        if (!response.ok) throw new Error(responseData.message || 'Failed to update favorite status');

        const voiceInList = searchResults.value.find(v => v.voice_id === voice.voice_id);
        if (voiceInList) {
            const newFavoriteId = responseData.voice_favorite_id || null;
            voiceInList.voice_favorite_id = newFavoriteId;
            sidepanelMakeToast(newFavoriteId ? 'Voice favorited!' : 'Voice unfavorited.', 'success');
        }
    } catch (error) {
        console.error('Failed to toggle favorite:', error);
        sidepanelMakeToast(error.message, 'error');
    } finally {
        isTogglingFavorite.value = null;
    }
}

function openCollectionManager(voiceId) {
  if (!collectionTriggers.value[voiceId]) {
    collectionTriggers.value[voiceId] = 0;
  }
  collectionTriggers.value[voiceId]++;
}

// --- KEYBOARD & MOUSE HANDLERS ---
function handleKeydown(event) {
  if (!showTypeahead.value || displayList.value.length === 0) return;
  switch (event.key) {
    case 'ArrowDown': event.preventDefault(); highlightedIndex.value = (highlightedIndex.value + 1) % displayList.value.length; break;
    case 'ArrowUp': event.preventDefault(); highlightedIndex.value = (highlightedIndex.value <= 0) ? displayList.value.length - 1 : highlightedIndex.value - 1; break;
    case 'Enter': event.preventDefault(); if (highlightedIndex.value !== -1) { selectVoice(displayList.value[highlightedIndex.value]); } break;
    case 'Escape': event.preventDefault(); isSearchFocused.value = false; searchInputRef.value?.blur(); break;
  }
}
function handleClickOutside(event) {
  const isClickInsideCollectionManager = event.target.closest('.collections-dropdown');
  if (typeaheadRef.value && !typeaheadRef.value.contains(event.target) && !isClickInsideCollectionManager) {
    isSearchFocused.value = false;
  }
}

// --- AUDIO PLAYER METHODS ---
function getAudioUrl(voice) {
  if (voice?.voice_design_make_default_preview === true && voice?.voice_design_sample_text_hash) { return `https://cdn.soundranks.com/sampleVoiceDesignTTS/${voice.voice_service}-${voice.voice_speaker_id}-${voice.voice_design_sample_text_hash}.mp3`; }
  return `https://cdn.soundranks.com/sampleAudioTTS/${voice.voice_service}-${voice.voice_speaker_id}.mp3`;
}
function stopAudio() {
  if (audio.value) { audio.value.pause(); audio.value = null; }
  currentPlayingVoiceId.value = null; isAudioLoading.value = false;
}
function togglePlay(voice) {
  if (currentPlayingVoiceId.value !== voice.voice_id) {
    stopAudio(); currentPlayingVoiceId.value = voice.voice_id; isAudioLoading.value = true;
    const audioUrl = getAudioUrl(voice); audio.value = new Audio(audioUrl);
    audio.value.play().catch(e => { stopAudio(); });
    audio.value.oncanplaythrough = () => { if (currentPlayingVoiceId.value === voice.voice_id) { isAudioLoading.value = false; } };
    audio.value.onended = () => { stopAudio(); };
    audio.value.onerror = () => { stopAudio(); };
  } else { if (audio.value) { audio.value.paused ? audio.value.play() : audio.value.pause(); } }
}
const isPlaying = (voiceId) => { return currentPlayingVoiceId.value === voiceId && audio.value && !audio.value.paused; }

function changeRoute(routeName){
  pageRoute.value = routeName;
}

</script>

<template>
  <div class="p-4 w-full max-w-md mx-auto relative" >
<div class="flex w-full items-start">
    <h1 class="text-xl font-bold text-center flex-grow text-gray-200 mb-4 flex justify-start items-center gap-2">
        <img width="26" src="/images/logo.png">
        VR Reader
    </h1>

    <button @click="localSettingsTab = 'byok'; changeRoute('/settings')"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50">
        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <path d="M336 352c97.2 0 176-78.8 176-176S433.2 0 336 0S160 78.8 160 176c0 18.7 2.9 36.8 8.3 53.7L7 391c-4.5 4.5-7 10.6-7 17v80c0 13.3 10.7 24 24 24h80c13.3 0 24-10.7 24-24v-40h40c13.3 0 24-10.7 24-24v-40h40c6.4 0 12.5-2.5 17-7l33.3-33.3c16.9 5.4 35 8.3 53.7 8.3zM376 96a40 40 0 1 1 0 80 40 40 0 1 1 0-80z"/>
        </svg>
        <span class="text-xs font-semibold">Add Key</span>
    </button>
</div>

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
        placeholder="Search voices by name..."
        autocomplete="off"
        class="block w-full pl-10 pr-3 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm border-gray-600 bg-gray-900 text-white placeholder-gray-400"
      >
    </div>

    <!-- Typeahead Dropdown -->
    <div
      v-if="showTypeahead"
      class="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden"
    >
      <div v-if="!searchQuery.trim() && recentSearches.length > 0" class="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
        Recent Searches
      </div>
      
      <div class="max-h-80 overflow-y-auto search-scrollbar">
        <div class="py-1">
             <div
              v-for="(voice, index) in displayList"
              :key="voice.voice_id"
              @mouseenter="hoveredVoiceId = voice.voice_id"
              @mouseleave="(shouldShowHoverMenu(voice.voice_id))? hoveredVoiceId = voice.voice_id : hoveredVoiceId = null "
              :class="['group cursor-pointer relative', index === highlightedIndex ? 'bg-indigo-50' : '']"
              v-tooltip="{ content: getTooltipContent(voice), html: true }"
            >
              <div class="px-4 pl-2 py-3 flex items-center justify-between w-full transition-colors duration-150 group-hover:bg-gray-100 ">
                <div class="flex items-center space-x-2 flex-1 min-w-0">
                  <!-- Play Button -->
                  <button @click.stop.prevent="togglePlay(voice)" class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-indigo-600 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <div v-if="isAudioLoading && currentPlayingVoiceId === voice.voice_id" class="animate-spin h-5 w-5"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
                    <div v-else-if="isPlaying(voice.voice_id)" class="w-5 h-5"><svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></div>
                    <svg v-else class="w-6 h-6 " fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg>
                  </button>

                  <!-- Voice Info -->
                  <div @click="selectVoice(voice)" class="flex-1 min-w-0">
                    <div class="font-medium text-gray-900 truncate flex items-center space-x-1.5">
                      <span>{{ voice.voice_name }}</span>
                      <!-- FLAG IMAGE -->
                      <template v-if="voice.displayCountryCode">
                        <img class="inline-block h-4 w-auto rounded-sm" :src="'https://flagsapi.com/' + voice.displayCountryCode + '/flat/24.png'" :alt="voice.displayCountryCode + ' flag'" @error="$event.target.style.display='none'">
                        <span v-if="voice.languageCount > 1" class="text-xs text-gray-500 font-normal">(x{{ voice.languageCount }})</span>
                      </template>
                    </div>
                  </div>
                </div>

                <!-- SERVICE INFO -->
                <div class="text-xs text-gray-500 font-medium flex items-center gap-2 flex-shrink-0 ml-2">
                  <span>{{ voice.voice_service }}</span>
                  <!-- SERVICE ICON -->
                  <img v-if="voice.voice_service_alias" class="h-4 w-4 rounded" :src="'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://' + voice.voice_service_alias + '&size=32'" :alt="voice.voice_service_alias + ' logo'"/>
                </div>
              </div>

              <!-- Hover Menu -->
              <div
                v-if="hoveredVoiceId === voice.voice_id"
                class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center bg-gray-200 rounded-full shadow p-1 space-x-1 z-10"
                @mouseenter="hoveredVoiceId = voice.voice_id"
              >
                <!-- Make Default Button -->
                <button
                  @click.stop.prevent="makeDefaultVoice(voice)"
                  class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-300 transition-colors"
                  v-tooltip="{content: defaultVoiceId === voice.voice_id ? 'This is your default voice' : 'Make default voice'}"
                >
                  <svg v-if="defaultVoiceId === voice.voice_id" class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
                  <svg v-else class="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>
                </button>

                <!-- Favorite Button -->
                <button
                  @click.stop.prevent="toggleFavorite(voice)"
                  class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-300 transition-colors"
                  v-tooltip="{content: voice.voice_favorite_id ? 'Unfavorite this voice' : 'Favorite this voice'}"
                >
                  <div v-if="isTogglingFavorite === voice.voice_id" class="animate-spin h-4 w-4 text-indigo-600"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg></div>
                  <svg v-else-if="voice.voice_favorite_id" class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" /></svg>
                  <svg v-else class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                </button>

                <!-- Add to Collection Button -->
                <div class="relative">
                  <button
                    @click.stop.prevent="openCollectionManager(voice.voice_id)"
                    class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-300 transition-colors"
                    v-tooltip="{content:'Add to collection'}"
                  >
                    <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"></path>
                    </svg>
                  </button>
                  <VoiceCollectionManager
                    :voice-id="voice.voice_id"
                    :show-button="false"
                    :trigger="collectionTriggers[voice.voice_id] || 0"
                  />
                </div>

                <!-- START: NEW Add to Context Menu Button -->
                <button
                  v-if="voice.isInMenu"
                  disabled
                  class="w-7 h-7 flex items-center justify-center rounded-full bg-green-200 text-green-700 cursor-not-allowed"
                  v-tooltip="{content: 'Already in context menu'}"
                >
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                  </svg>
                </button>
                <button
                  v-else
                  @click.stop.prevent="addToContextMenu(voice)"
                  class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-300 transition-colors text-gray-600"
                  v-tooltip="{content: 'Add to context menu'}"
                >
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 14.95a1 1 0 101.414 1.414l.707-.707a1 1 0 00-1.414-1.414l-.707.707zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zM11 16a1 1 0 10-2 0v1a1 1 0 102 0v-1zM4.343 5.757a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"></path>
                  </svg>
                </button>
                <!-- END: NEW Add to Context Menu Button -->

              </div>

            </div>

          <div v-if="isLoading" class="px-4 py-4 text-center text-gray-500 text-sm">Searching...</div>
          <div v-if="searchQuery.trim() && !isLoading && searchResults.length === 0" class="px-4 py-6 text-center text-gray-500 text-sm">
            No voices found for "{{ searchQuery }}"
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
#blur {
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  backdrop-filter: blur(4vmax);
}
.search-scrollbar::-webkit-scrollbar { width: 6px; }
.search-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
.search-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
.search-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>