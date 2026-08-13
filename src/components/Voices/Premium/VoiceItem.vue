<script setup>
import { defineProps, computed, ref , defineEmits, onMounted } from 'vue';
import VoiceImage from './VoiceImage.vue';
import VoiceCollectionManager from '../../Shared/VoiceCollectionManager.vue';
import { useVoicePlayer } from '../../../composables/useVoicePlayer';
import useMyComposable from '../../../composables/Composable';
import useDateFormat from '../../../composables/useDateFormat';
import { saveToLocalStorage, readLocalStorage } from '../../../../js/utils/helpers';

const { 
    showLoginModalCount, 
    isUserLogged, 
    API_NUXT_DOMAIN,
    voiceFilterOptions,
    sidepanelMakeToast
} = useMyComposable();

const { currentPlayingVoiceId, isAudioLoading, isPlaying, togglePlay } = useVoicePlayer();
const { getDateLabel } = useDateFormat();

const MAX_CONTEXT_MENU_VOICES = 5;
const contextMenuVoices = ref([]);
const isAddingToContextMenu = ref(false);

const props = defineProps({
  voice: Object,
  index: Number,
  favoriteChange: Function,
  isFavoriteList: Boolean,
  likeChange: Function,
  selectedVoiceCallback: Function,
  currentDefaultVoiceId: String,
  collectionId: String,
  isCollectionOwner: Boolean
});

const emit = defineEmits([
    'update-default-voice',
    'remove-from-collection'
]);

const STAR_SVG_PATH = "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z";

const isSelected = ref(false);
const collectionManagerTrigger = ref(0);

onMounted(async () => {
    await loadContextMenuVoices();
});

async function loadContextMenuVoices() {
    try {
        const storage = await readLocalStorage(['CONTEXT_MENU_VOICES']);
        contextMenuVoices.value = Array.isArray(storage.CONTEXT_MENU_VOICES) ? storage.CONTEXT_MENU_VOICES : [];
    } catch (error) {
        console.error('Error loading context menu voices:', error);
        contextMenuVoices.value = [];
    }
}

const isInContextMenu = computed(() => {
    return contextMenuVoices.value.some(v => v.voice_id === props.voice.voice_id);
});

const showRemoveFromCollection = computed(() => {
    return props.collectionId && props.isCollectionOwner;
});

const isCurrentDefault = computed(() => {
    return props.voice.voice_id === props.currentDefaultVoiceId;
});

const langDisplay = new Intl.DisplayNames(['en'], { type: 'language' });
const regionDisplay = new Intl.DisplayNames(['en'], { type: 'region' });

const languageCount = computed(() => {
    return props.voice.voice_language_codes?.length || 0;
});

const displayCountryCode = computed(() => {
    if (!props.voice.voice_language_codes || props.voice.voice_language_codes.length === 0) return null;
    const parts = props.voice.voice_language_codes[0].split('-');
    return parts.length > 1 ? parts[1].toUpperCase() : null;
});

const isEnglishVoice = computed(() => {
    const selectedLang = voiceFilterOptions.value.languageCode;
    if (selectedLang && !selectedLang.toLowerCase().startsWith('en')) {
        return false;
    }

    if (!props.voice.voice_language_codes || props.voice.voice_language_codes.length === 0) return true;
    return props.voice.voice_language_codes.some(code => code.toLowerCase().startsWith('en'));
});

const ratingHtml = computed(() => {
    const average = props.voice.voice_review_average;
    const count = props.voice.voice_review_count;

    if (!count || count === 0) {
        return '';
    }
    
    const widthPercentage = (average / 5) * 100;

    const stars = `
        <div class="relative inline-flex items-center" style="gap: 2px;">
            <div class="flex" style="gap: 2px;">
                <svg class="w-4 h-4 text-gray-300 dark:text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="${STAR_SVG_PATH}"/>
                </svg>
                <svg class="w-4 h-4 text-gray-300 dark:text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="${STAR_SVG_PATH}"/>
                </svg>
                <svg class="w-4 h-4 text-gray-300 dark:text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="${STAR_SVG_PATH}"/>
                </svg>
                <svg class="w-4 h-4 text-gray-300 dark:text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="${STAR_SVG_PATH}"/>
                </svg>
                <svg class="w-4 h-4 text-gray-300 dark:text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="${STAR_SVG_PATH}"/>
                </svg>
            </div>
            <div class="absolute top-0 left-0 flex overflow-hidden" style="width: ${widthPercentage}%; gap: 2px;">
                <svg class="w-4 h-4 text-yellow-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path d="${STAR_SVG_PATH}"/>
                </svg>
                <svg class="w-4 h-4 text-yellow-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path d="${STAR_SVG_PATH}"/>
                </svg>
                <svg class="w-4 h-4 text-yellow-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path d="${STAR_SVG_PATH}"/>
                </svg>
                <svg class="w-4 h-4 text-yellow-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path d="${STAR_SVG_PATH}"/>
                </svg>
                <svg class="w-4 h-4 text-yellow-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path d="${STAR_SVG_PATH}"/>
                </svg>
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
});

const languagesTooltipHtml = computed(() => {
    if (!props.voice.voice_language_codes || props.voice.voice_language_codes.length === 0) {
        return '';
    }

    return props.voice.voice_language_codes.slice(0,1).map(code => {
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
        } catch (e) {
            console.error(`Could not parse language code: ${code}`, e);
            return code;
        }
    }).join('');
});

const tagsTooltipHtml = computed(()=> {
    if (!props.voice.voice_suggested_tags_filtered || !Array.isArray(props.voice.voice_suggested_tags_filtered) || props.voice.voice_suggested_tags_filtered.length === 0) {
        return '';
    }

    const tagBadges = props.voice.voice_suggested_tags_filtered.map(tag =>
        `<span style="display: inline-flex; align-items: center; background-color: #374151; color: #f3f4f6; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 500; letter-spacing: 0.01em;">${tag}</span>`
    ).join('');

    return `<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">${tagBadges}</div>`;
})

const tooltipContent = computed(() => {
    const nameHtml = `<div style="font-weight: 600; font-size: 15px; color: #ffffff; letter-spacing: 0.01em;">${props.voice.voice_name}</div>`;
    const ratingSection = ratingHtml.value;
    const languagesSection = languagesTooltipHtml.value;
    const tagsSection = tagsTooltipHtml.value; 
    
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
});

function hasLoggedIn(){
    if(!isUserLogged.value ){
        showLoginModalCount.value++;
        return false
    }else{
        return true;
    }
}

async function makeDefaultVoice(){
    if (isCurrentDefault.value) return;

    if(props.voice.voice_service_extension_active === false) {
        alert(`Sorry, ${props.voice.voice_service} voices are not available yet for the extension`);
        return;
    }

    emit('update-default-voice', props.voice);
}

async function favorite(){
    if( hasLoggedIn() === false) return;
    const urlWithParams = `https://${API_NUXT_DOMAIN.value}/api/v1/voice/favorite`;
    const rawResponse = await fetch(urlWithParams, {
      method: 'PUT',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voice_favorite_id: props.voice.voice_favorite_id || null,
        voice_id: props.voice.voice_id,
      })
    });
    const responseData = await rawResponse.json(); 
    if(props.voice.voice_favorite_id){
        props.favoriteChange(props.index, null )
    }else {
        props.favoriteChange(props.index, responseData.voice_favorite_id)
    }    
}

function openCollectionManager(){
    if( hasLoggedIn() === false) return;
    collectionManagerTrigger.value++;
}

function removeFromCollection(){
    if( hasLoggedIn() === false) return;
    
    const isConfirmed = confirm(
        `Remove "${props.voice.voice_name}" from this collection?`
    );
    
    if (isConfirmed) {
        emit('remove-from-collection');
    }
}

function gotoVoicePage(){
    chrome.runtime.sendMessage({ action: "sameTabNavigateTo", 
    url:`https://${API_NUXT_DOMAIN.value}/voice/${props.voice.voice_service}/${props.voice.voice_gender}/${props.voice.voice_speaker_id}`});
}

function selectVoiceAction(){
    if(props.selectedVoiceCallback){
        props.selectedVoiceCallback(props.voice)
    }else{
        isSelected.value = !isSelected.value
    }
}

async function addToContextMenu(){
    if (props.voice.voice_service_extension_active === false) {
        alert(`Sorry, ${props.voice.voice_service} voices are not available yet for the extension`);
        return;
    }

    if (isInContextMenu.value) {
        sidepanelMakeToast('This voice is already in the context menu', 'warning');
        return;
    }

    if (contextMenuVoices.value.length >= MAX_CONTEXT_MENU_VOICES) {
        alert(`The context menu is full (${MAX_CONTEXT_MENU_VOICES} voices maximum). Please remove a voice before adding another.`);
        return;
    }

    isAddingToContextMenu.value = true;

    const voiceData = {
        voice_id: props.voice.voice_id,
        voice_name: props.voice.voice_name,
        voice_gender: props.voice.voice_gender,
        voice_instructions: props.voice.voice_instructions ?? null,
        voice_language_code: props.voice.voice_language_code || (Array.isArray(props.voice.voice_language_codes) ? props.voice.voice_language_codes[0] : null),
        voice_speaker_id: props.voice.voice_speaker_id,
        voice_service: props.voice.voice_service,
        voice_service_alias: props.voice.voice_service_alias,
        voice_speed: props.voice.voice_speed || 1,
        voice_has_voice_speed_support: props.voice.voice_has_voice_speed_support ?? true
    };

    contextMenuVoices.value.push(voiceData);

    await saveToLocalStorage({ 'CONTEXT_MENU_VOICES': [...contextMenuVoices.value] }, true);

    chrome.runtime.sendMessage({
        action: 'UPDATE_CONTEXT_MENU_VOICES',
        voices: contextMenuVoices.value
    });

    sidepanelMakeToast(`${props.voice.voice_name} added to context menu!`, 'success');
    isAddingToContextMenu.value = false;
}
</script>

<template>
    <div class="mb-2 mx-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-[1px]" :class="{'is-selected':isSelected && !voice.audioModeOpened}">
        <div
        :class="{'bg-gray-100 dark:bg-gray-700':voice.audioModeOpened, 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 border-b border-indigo-100 dark:border-indigo-800 rounded-b-none': isSelected && !voice.audioModeOpened}"
        @click="selectVoiceAction()"

        v-tooltip="{ content: tooltipContent, html: true }" 

        class="cursor-pointer heading flex items-center px-4 py-3 text-gray-700 transition-colors duration-200 transform rounded-xl dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <VoiceImage :voice="voice"></VoiceImage>
            <div class="flex-1 mx-4 text-lg text-left truncate font-medium">

                <!-- MODIFIED: Replaced the old text span with the new structure -->
                <span>
                    {{ voice.voice_name }}
                    <span class="text-sm ml-2 inline-flex items-center space-x-1">
                        <!-- Show the flag for the primary language -->
                        <img 
                          v-if="displayCountryCode"
                          class="inline-block h-4 w-auto rounded-sm" 
                          :src="'https://flagsapi.com/' + displayCountryCode + '/flat/24.png'" 
                          :alt="displayCountryCode + ' flag'" 
                          @error="$event.target.style.display='none'">
                        <!-- Show a count if there is more than one language -->
                        <span v-if="languageCount > 1" class="text-xs text-gray-500 font-normal">(+{{ languageCount - 1 }})</span>
                    </span>
                </span>
                
            </div>
            <button v-if="isEnglishVoice" @click.stop.prevent="togglePlay(voice)" class="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1">
                <!-- Loading Spinner -->
                <div v-if="isAudioLoading && currentPlayingVoiceId === voice.voice_id" class="animate-spin h-8 w-8">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
                <!-- Pause Icon -->
                <svg v-else-if="isPlaying(voice.voice_id)" class="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
                <!-- Play Icon -->
                <svg v-else class="w-10 h-10" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>
                </svg>
            </button>
        </div>
        <div v-show="isSelected" class="bg-slate-50 dark:bg-gray-800/50 rounded-b-xl overflow-hidden border-t border-gray-100 dark:border-gray-700">
            <!-- Speed Control (only for favorite list) -->
            <div  v-if="isFavoriteList"  class="flex items-center space-x-3 bg-white dark:bg-gray-800 py-3 px-4 text-slate-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 transition-colors duration-200" >
                <button class=" justify-center block relative w-[42px] font-medium text-xs bg-slate-100 dark:bg-slate-700 hover:text-blue-500 cursor-pointer border border-gray-200 dark:border-gray-600 rounded-md py-1.5 px-1 transition-colors">
                {{voice.voice_speed || 1.0}}X
                </button>
                <div class="flex-1 flex items-center ml-2">
                    <input v-model="voice.voice_speed" :disabled="!voice.voice_has_voice_speed_support" class="rounded-lg overflow-hidden appearance-none bg-gray-300 dark:bg-gray-600 h-2 w-full cursor-pointer accent-blue-500" type="range" min="0" max="2" step="0.1"  />
                </div>
            </div>
            <div  v-if="isFavoriteList && !voice.voice_has_voice_speed_support"  class="flex items-center space-x-3 bg-white dark:bg-gray-800 py-2 px-4 text-slate-500 text-sm border-b border-gray-100 dark:border-gray-700 transition-colors duration-200" >
                This voice doesn't support speed change
            </div>
            
            <!-- Make Default Voice -->
            <div @click="makeDefaultVoice()" class="flex items-center space-x-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 bg-white dark:bg-gray-800 py-3 px-4 text-slate-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 transition-colors duration-200 cursor-pointer" >
                <template v-if="isCurrentDefault">
                    <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
                    <span class="flex-1 font-medium text-green-700 dark:text-green-400">Current default voice</span>
                </template>
                <template v-else>
                    <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>
                    <span class="flex-1">Make default reader voice</span>
                </template>
            </div>

            <!-- Add to Favorites -->
            <div @click="favorite()" class="flex items-center space-x-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 bg-white dark:bg-gray-800 py-3 px-4 text-slate-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 transition-colors duration-200 cursor-pointer" >
                <svg v-if="voice.voice_favorite_id !== null" class="w-5 h-5 text-red-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" stroke="currentColor" viewBox="0 0 20 20">
                    <path  stroke-linecap="round" stroke-linejoin="round" stroke-width="2" fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" />
                </svg>
                <svg v-else class="w-5 h-5 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                </svg>

                <span v-if="voice.voice_favorite_id !== null" class="flex-1">Remove from favorites</span>
                <span v-else class="flex-1">Add to favorites</span>
            </div>

            <!-- Add to Collection -->
            <div class="flex items-center space-x-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 bg-white dark:bg-gray-800 py-3 px-4 text-slate-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 transition-colors duration-200 relative cursor-pointer" @click="openCollectionManager()">
                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"></path>
                </svg>
                <span class="flex-1">Add to collection</span>
                
                <!-- Collection Manager Component -->
                <VoiceCollectionManager 
                  :voice-id="voice.voice_id"
                  :show-button="false"
                  :trigger="collectionManagerTrigger"
                />
            </div>

            <!-- Add to Context Menu -->
            <div 
              v-if="!isInContextMenu"
              @click="addToContextMenu()" 
              class="flex items-center space-x-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 bg-white dark:bg-gray-800 py-3 px-4 text-slate-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 transition-colors duration-200 cursor-pointer"
            >
                <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 14.95a1 1 0 101.414 1.414l.707-.707a1 1 0 00-1.414-1.414l-.707.707zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zM11 16a1 1 0 10-2 0v1a1 1 0 102 0v-1zM4.343 5.757a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"></path>
                </svg>
                <span class="flex-1">Add to context menu</span>
            </div>
            <div 
              v-else
              class="flex items-center space-x-3 bg-white dark:bg-gray-800 py-3 px-4 text-green-600 dark:text-green-400 border-b border-gray-100 dark:border-gray-700 cursor-default"
            >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                </svg>
                <span class="flex-1">Already in context menu</span>
            </div>

            <!-- Remove from Collection (NEW - only shows when in a collection) -->
            <div 
              v-if="showRemoveFromCollection"
              @click="removeFromCollection()" 
              class="flex items-center space-x-3 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 py-3 px-4 text-slate-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 border-b border-gray-100 dark:border-gray-700 transition-colors duration-200 cursor-pointer"
            >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                <span class="flex-1">Remove from collection</span>
            </div>

            <!-- Visit Voice Page -->
            <div @click="gotoVoicePage(voice)" class="cursor-pointer flex items-center space-x-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 bg-gray-50 dark:bg-gray-800/80 py-3 px-4 text-slate-600 dark:text-gray-300 transition-colors duration-200" >
                <img class="w-5 h-5 rounded-sm" :src="'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://'+voice.voice_service_alias+'&size=24'">
                <span class="flex-1 font-medium">Visit {{ voice.voice_name }} voice page </span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.active-chat .active-domain{
    color:white !important;
}
</style>