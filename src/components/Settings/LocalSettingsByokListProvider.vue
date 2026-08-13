<script setup>
import { ref, watch, onMounted, reactive, computed } from 'vue';
import useMyComposable from '../../composables/Composable';
import { saveToLocalStorage, readLocalStorage } from '../../../js/utils/helpers';
import { CONSTANTS } from '../../../js/constants/constants.js';

const props = defineProps({
  service: {
    type: Object,
    required: true
  },
  initialValue: {
    type: String,
    default: ''
  },

  serviceOptions: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['api-key-saved']);

const { sidepanelMakeToast, saveRequest, pageRoute,   API_NUXT_DOMAIN } = useMyComposable();

const apiKey = ref(props.initialValue);
const savedKey = ref(props.initialValue);
const isSaving = ref(false);
const showKey = ref(false);
const isKeySaved = ref(false);

const isTesting = ref(false);
const showTestModal = ref(false);
const testStatus = ref('loading');
const testMessage = ref('');
const testAudioBlobURL = ref(null);
const showSaveKeyButton = ref(false);

const customOptionsValues = reactive({});
const customOptionsStorageKey = `${props.service.storage_key}_options`;
const guideUrl = computed(() => {
  // Converts "Google Cloud" to "google-cloud", "OpenAI" to "openai"
  const slug = props.service.voice_service; 
  return `https://${API_NUXT_DOMAIN.value}/reader/${slug}#get-api-key`;
});

const maxConcurrent = ref(CONSTANTS.DEFAULT_MAX_CONCURRENT);
const showAdvanced = ref(false);

const maxConcurrentField = computed(() => {
  if (Array.isArray(props.service.custom_api_options)) {
    return props.service.custom_api_options.find(f => f && f.name === 'max_concurrent') || null;
  }
  return null;
});

const renderableCustomOptions = computed(() => {
  if (!Array.isArray(props.service.custom_api_options)) return [];
  return props.service.custom_api_options.filter(f => !f || f.name !== 'max_concurrent');
});

const maxConcurrentTooltip = computed(() => {
  if (maxConcurrentField.value && maxConcurrentField.value.tooltip) {
    return maxConcurrentField.value.tooltip;
  }
  return `Maximum simultaneous requests sent to ${props.service.voice_service}. Lower this if you hit provider rate limits.`;
});

const hasUnsavedChanges = computed(() => {
  return apiKey.value?.trim() !== (savedKey.value || '').trim();
});

function clampMaxConcurrent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return CONSTANTS.DEFAULT_MAX_CONCURRENT;
  return Math.min(5, Math.max(1, Math.round(num)));
}

function getMaxConcurrentDefault() {
  const fieldDefault = maxConcurrentField.value && maxConcurrentField.value.default;
  const hasFieldDefault = fieldDefault !== undefined && fieldDefault !== null && fieldDefault !== '';
  const base = hasFieldDefault ? fieldDefault : (props.service.max_concurrent || CONSTANTS.DEFAULT_MAX_CONCURRENT);
  return clampMaxConcurrent(base);
}

function buildOptionsPayload() {
  return { ...customOptionsValues, max_concurrent: maxConcurrent.value };
}

let maxConcurrentSaveTimer = null;
function saveMaxConcurrent(value) {
  clearTimeout(maxConcurrentSaveTimer);
  maxConcurrentSaveTimer = setTimeout(async () => {
    try {
      await saveToLocalStorage({ [customOptionsStorageKey]: { ...customOptionsValues, max_concurrent: value } });
    } catch (error) {
      console.error('Error saving max concurrent setting:', error);
    }
  }, 300);
}

function onMaxConcurrentInput(event) {
  const value = clampMaxConcurrent(event.target.value);
  maxConcurrent.value = value;
  saveMaxConcurrent(value);
}

function resetMaxConcurrent() {
  const value = getMaxConcurrentDefault();
  maxConcurrent.value = value;
  saveMaxConcurrent(value);
}



onMounted(async () => {
  if (props.initialValue && props.initialValue.trim().length > 0) {
    isKeySaved.value = true;
  }

  savedKey.value = props.initialValue || '';

  let savedOptions = {};
  try {
    const storedData = await readLocalStorage([customOptionsStorageKey]);
    if (storedData && storedData[customOptionsStorageKey]) {
      savedOptions = storedData[customOptionsStorageKey];
    }
  } catch (error) {
    console.error('Error loading custom options from local storage:', error);
  }

  if (props.service.custom_api_options) {
    const newOptionsState = {};
    renderableCustomOptions.value.forEach(field => {
      if (savedOptions.hasOwnProperty(field.name)) {
        newOptionsState[field.name] = savedOptions[field.name];
      } else {
        newOptionsState[field.name] = field.default;
      }
    });
    Object.assign(customOptionsValues, newOptionsState);
  }

  if (savedOptions.hasOwnProperty('max_concurrent')) {
    maxConcurrent.value = clampMaxConcurrent(savedOptions.max_concurrent);
  } else {
    maxConcurrent.value = getMaxConcurrentDefault();
  }
});

watch(() => props.initialValue, (newValue) => {
  apiKey.value = newValue;
  savedKey.value = newValue || '';
  isKeySaved.value = newValue && newValue.trim().length > 0;
});


async function persistApiKey(value) {
  clearTimeout(maxConcurrentSaveTimer);
  await saveToLocalStorage({
    [props.service.storage_key]: value,
    [customOptionsStorageKey]: buildOptionsPayload()
  }, true);

  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: props.service.storage_key,
    value: value
  });

  isKeySaved.value = true;
  savedKey.value = value;
}

async function saveApiKey() {

  const value = apiKey.value?.trim();
  if (!value) {
    sidepanelMakeToast(`Please enter a ${props.service.voice_service} API key`, 'warning');
    return;
  }

  isSaving.value = true;
  try {
    await persistApiKey(value);
    sidepanelMakeToast(`${props.service.voice_service} API key saved successfully!`, 'success');
    emit('api-key-saved');
  } catch (error) {
    console.error(`Error saving ${props.service.voice_service} API key:`, error);
    sidepanelMakeToast(`Failed to save ${props.service.voice_service} API key`, 'error');
  } finally {
    isSaving.value = false;
  }
}

async function clearApiKey() {
  
  apiKey.value = '';
  
  try {
    clearTimeout(maxConcurrentSaveTimer);
    maxConcurrent.value = getMaxConcurrentDefault();

    if (props.service.custom_api_options) {
      props.service.custom_api_options.forEach(field => {
        customOptionsValues[field.name] = field.default;
      });
    }

    await saveToLocalStorage({
      [props.service.storage_key]: '',
      [customOptionsStorageKey]: buildOptionsPayload()
    }, true);
    
    chrome.runtime.sendMessage({ 
      action: "update-contentscript-storage",
      key: props.service.storage_key,
      value: ''
    });

    isKeySaved.value = false;
    savedKey.value = '';
    sidepanelMakeToast(`${props.service.voice_service} API key cleared`, 'success');
    emit('api-key-saved');
  } catch (error) {
    console.error(`Error clearing ${props.service.voice_service} API key:`, error);
    sidepanelMakeToast(`Failed to clear ${props.service.voice_service} API key`, 'error');
  }
}

function toggleKeyVisibility() {
  showKey.value = !showKey.value;
}

function handleInputFocus() {
  // Logic if needed
}

async function testApiKey() {
  const keyToUse = apiKey.value?.trim();

  if (!keyToUse) {
    sidepanelMakeToast('Please enter an API key to test', 'warning');
    return;
  }


  if (!props.serviceOptions) {
    sidepanelMakeToast('Service options not configured for testing', 'error');
    return;
  }

  isTesting.value = true;
  showTestModal.value = true;
  testStatus.value = 'loading';
  testMessage.value = 'Testing API key...';
  testAudioBlobURL.value = null;
  showSaveKeyButton.value = false;

  const callbackID = `sidepanel_premium_tts_${props.service.storage_key}_${Date.now()}`;
  const testText = `This API Key for ${props.service.voice_service} is working!`;

  const payload = {
    serviceName: props.service.voice_service,
    serviceOptions: {
      gender: props.serviceOptions.voice_gender,
      speaker_id: props.serviceOptions.voice_speaker_id,
      languageCode: props.serviceOptions.voice_language_code,
      voice_instructions: props.serviceOptions.voice_instructions || '',
      voiceSpeedSetting: props.serviceOptions.voiceSpeedSetting || 1,
      includeAudioTimestamps: props.serviceOptions.includeAudioTimestamps || false
    },
    testKeyOptions: {
      apiKey: keyToUse,
      customOptionsValues: buildOptionsPayload()
    },
    text: testText,
    index: 0,
    ignoreFirstQueue: false
  };


  try {
    chrome.runtime.sendMessage({
      action: "getAudioDataFromExternalTTS",
      callbackID,
      payload: payload
    });

    saveRequest(callbackID, async ({ audioData, status, errorMessage }) => {
      isTesting.value = false;

      if (status === "error") {
        testStatus.value = 'error';
        testMessage.value = errorMessage || 'API key test failed. Please check your key and try again.';
        return;
      }

      testStatus.value = 'success';
      testMessage.value = `Success! Your ${props.service.voice_service} API key is working correctly.`;
      testAudioBlobURL.value = base64ToBlob(audioData, 'audio/mpeg');
      
      playTestAudio();

      const hasExistingKey = isKeySaved.value;
      if (hasUnsavedChanges.value && !hasExistingKey) {
        try {
          await persistApiKey(keyToUse);
          sidepanelMakeToast(`${props.service.voice_service} API key saved successfully!`, 'success');
          emit('api-key-saved');
        } catch (error) {
          console.error(`Error auto-saving ${props.service.voice_service} API key after test:`, error);
        }
      } else if (hasUnsavedChanges.value && hasExistingKey) {
        showSaveKeyButton.value = true;
      }
    });

  } catch (error) {
    console.error('Error testing API key:', error);
    isTesting.value = false;
    testStatus.value = 'error';
    testMessage.value = 'An unexpected error occurred. Please try again.';
  }
}

function base64ToBlob(base64, mimeType) {
  try {
    const sliceSize = 1024;
    const byteCharacters = atob(base64);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    
    const blob = new Blob(byteArrays, { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error("Error creating blob from base64:", e);
    return null;
  }
}

function playTestAudio() {
  if (!testAudioBlobURL.value) return;
  const audio = new Audio(testAudioBlobURL.value);
  audio.play();
}

function closeTestModal() {
  showTestModal.value = false;
}

function retryTest() {
  closeTestModal();
  setTimeout(() => testApiKey(), 200);
}

async function saveFromTestModal() {
  const value = apiKey.value?.trim();
  if (!value) return;

  try {
    await persistApiKey(value);
    showSaveKeyButton.value = false;
    sidepanelMakeToast(`${props.service.voice_service} API key saved successfully!`, 'success');
    emit('api-key-saved');
  } catch (error) {
    console.error(`Error saving ${props.service.voice_service} API key:`, error);
    sidepanelMakeToast(`Failed to save ${props.service.voice_service} API key`, 'error');
  }
}
</script>

<template>
  <div class="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow relative">
    

    <div class="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm">
          <img 
            class="h-5 w-5 rounded" 
            :src="'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://' + service.voice_service_alias + '&size=32'" 
            :alt="service.voice_service + ' logo'"
            @error="$event.target.style.display='none'"
          />
        </div>
        <div class="text-left">
          <label class="text-gray-800 font-semibold text-sm">{{ service.voice_service }}</label>
          <p class="text-xs text-gray-500">{{ service.voice_service_alias }}</p>
        </div>
      </div>
      

    </div>

    <div class="p-4">
      <!-- MODIFIED: Label Row with "Get Key" Link -->
      <div class="flex justify-between items-end mb-1.5">
        <div class="flex items-center gap-2">
          <label class="block text-xs font-medium text-gray-600">API Key</label>
          <span
            v-if="hasUnsavedChanges"
            class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"
          >
            Not saved
          </span>
        </div>
        <!-- NEW: Get Key Link -->
        <a 
          :href="guideUrl" 
          target="_blank" 
          class="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span>Get API Key</span>
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
        </a>
      </div>

      <div class="relative">
        <input 
          v-model="apiKey"
          :type="showKey ? 'text' : 'password'"
          :placeholder="isKeySaved ? '••••••••••••••••' : 'Enter API key'"
          class="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-mono disabled:bg-gray-50 disabled:cursor-not-allowed"
          @keydown.enter="saveApiKey()"
          @focus="handleInputFocus"
        >
        
        <button
          v-if="apiKey"
          @click="toggleKeyVisibility"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
          type="button"
        >
          <svg v-if="showKey" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
        </button>
      </div>

      <div v-if="renderableCustomOptions.length > 0" class="mt-4 space-y-4">
        <div v-for="field in renderableCustomOptions" :key="field.name" v-tooltip="{html:true, content: field.tooltip || undefined}">
          <div class="flex items-center justify-between mb-1.5">
            <label :for="field.name" class="block text-xs font-medium text-gray-600">
              {{ field.label }}
            </label>
            <span v-if="field.type === 'slider'" class="text-xs font-mono text-gray-500">
              {{ customOptionsValues[field.name] }}
            </span>
          </div>

          <select
            v-if="field.type === 'select'"
            v-model="customOptionsValues[field.name]"
            :id="field.name"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm disabled:bg-gray-50"
          >
            <option v-for="option in field.options" :key="option" :value="option">
              {{ option }}
            </option>
          </select>

          <input
            v-if="field.type === 'text' || field.type === 'password'"
            v-model="customOptionsValues[field.name]"
            :id="field.name"
            :type="field.type"
            :placeholder="field.placeholder || ''"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm disabled:bg-gray-50"
          >
          
          <input
            v-if="field.type === 'slider'"
            v-model.number="customOptionsValues[field.name]"
            :id="field.name"
            type="range"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          >
        </div>
      </div>

      <div class="mt-4 border-t border-gray-100 pt-3">
        <button
          type="button"
          @click="showAdvanced = !showAdvanced"
          class="flex items-center justify-between w-full text-xs font-semibold text-gray-600 hover:text-gray-800 cursor-pointer transition-colors"
        >
          <span>Advanced</span>
          <svg
            class="w-4 h-4 transition-transform duration-200"
            :class="showAdvanced ? 'rotate-180' : ''"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>

        <div v-if="showAdvanced" class="mt-3">
          <div class="flex items-center justify-between mb-1.5">
            <label
              class="flex items-center gap-1 text-xs font-medium text-gray-600 cursor-help"
              v-tooltip="{html:true, content: maxConcurrentTooltip}"
            >
              Max Concurrent Requests
            </label>
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono text-gray-500">{{ maxConcurrent }}</span>
              <button
                @click="resetMaxConcurrent"
                class="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer transition-colors"
                type="button"
              >
                Reset
              </button>
            </div>
          </div>

          <input
            :value="maxConcurrent"
            type="range"
            min="1"
            max="5"
            step="1"
            data-testid="max-concurrent-slider"
            @input="onMaxConcurrentInput"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          >
        </div>
      </div>

      <div class="flex flex-col gap-3 mt-4">
        

          <button @click="saveApiKey" :disabled="isSaving || !apiKey?.trim()" class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            <svg v-if="isSaving" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <svg v-else class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z"></path></svg>
            <span>{{ isSaving ? 'Saving...' : 'Save' }}</span>
          </button>
          <button v-if="apiKey && serviceOptions" @click="testApiKey" :disabled="isTesting" class="px-4 py-2 bg-green-50 text-green-600 text-sm font-medium rounded-lg hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" v-tooltip="{content: 'Test API key'}">
            <svg v-if="isTesting" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <svg v-else class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path></svg>
            <span>Test Key</span>
          </button>
          <button v-if="isKeySaved" @click="clearApiKey" class="px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" v-tooltip="{content: 'Delete API key'}">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
            <span>Delete Key</span>
          </button>


      </div>
    </div>

    <!-- MODAL (Same as before) -->
    <Teleport to="body">
    <div 
        v-if="showTestModal"
        class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm"
        @click.self="closeTestModal"
    >
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all">
        <div class="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4 text-white">
            <h3 class="text-xl text-center font-bold">Testing API Key</h3>
            <p class="text-sm text-indigo-100 mt-1">{{ service.voice_service }}</p>
        </div>
        <div class="px-6 py-8">
            <div v-if="testStatus === 'loading'" class="text-center">
              <svg class="animate-spin h-16 w-16 mx-auto text-indigo-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <p class="text-gray-600 font-medium">{{ testMessage }}</p>
            </div>
            <div v-if="testStatus === 'success'" class="text-center">
            <div class="w-32 h-32 mx-auto mb-4">
                <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 161.2 161.2" enable-background="new 0 0 161.2 161.2" xml:space="preserve"><path class="path" fill="none" stroke="#7DB0D5" stroke-miterlimit="10" d="M425.9,52.1L425.9,52.1c-2.2-2.6-6-2.6-8.3-0.1l-42.7,46.2l-14.3-16.4 c-2.3-2.7-6.2-2.7-8.6-0.1c-1.9,2.1-2,5.6-0.1,7.7l17.6,20.3c0.2,0.3,0.4,0.6,0.6,0.9c1.8,2,4.4,2.5,6.6,1.4c0.7-0.3,1.4-0.8,2-1.5 c0.3-0.3,0.5-0.6,0.7-0.9l46.3-50.1C427.7,57.5,427.7,54.2,425.9,52.1z"/><circle class="path" fill="none" stroke="#7DB0D5" stroke-width="4" stroke-miterlimit="10" cx="80.6" cy="80.6" r="62.1"/><polyline class="path" fill="none" stroke="#7DB0D5" stroke-width="6" stroke-linecap="round" stroke-miterlimit="10" points="113,52.8 74.1,108.4 48.2,86.4 "/><circle class="spin" fill="none" stroke="#7DB0D5" stroke-width="4" stroke-miterlimit="10" stroke-dasharray="12.2175,12.2175" cx="80.6" cy="80.6" r="73.9"/></svg>
            </div>
            <p class="text-gray-800 font-semibold text-lg mb-2">API Key Works!</p>
            <p class="text-gray-600 text-sm">{{ testMessage }}</p>
            <button
              v-if="showSaveKeyButton"
              @click="saveFromTestModal"
              class="mt-5 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
            >
              Save Key
            </button>
            </div>
            <div v-if="testStatus === 'error'" class="text-center">
              <svg class="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <p class="text-gray-800 font-semibold text-lg mb-2">Test Failed</p>
              <p class="text-gray-600 text-sm mb-4">{{ testMessage }}</p>
              <button @click="retryTest" class="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all">Try Again</button>
            </div>
        </div>
        <div class="bg-gray-50 px-6 py-4 flex justify-end">
            <button @click="closeTestModal" class="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-all">Close</button>
        </div>
        </div>
    </div>
    </Teleport>
  </div>
</template>

<style scoped>
.path {
  stroke-dasharray: 1000;
  stroke-dashoffset: 0;
}
.path.circle {
  -webkit-animation: dash .9s ease-in-out;
  animation: dash .9s ease-in-out;
}
.path.line {
  -webkit-animation: dash .9s .35s ease-in-out forwards;
  animation: dash .9s .35s ease-in-out forwards;
}
.path.check {
  -webkit-animation: dash-check .9s .35s ease-in-out forwards;
  animation: dash-check .9s .35s ease-in-out forwards;
}
p {
  text-align: center;
  font-size: 1.25em;
}
p.success {
  color: #73AF55;
}
p.error {
  color: #D06079;
}
@-webkit-keyframes dash {
  0% {
    stroke-dashoffset: 1000;
  }
  100% {
    stroke-dashoffset: 0;
  }
}
@keyframes dash {
  0% {
    stroke-dashoffset: 1000;
  }
  100% {
    stroke-dashoffset: 0;
  }
}
@-webkit-keyframes dash-check {
  0% {
    stroke-dashoffset: -100;
  }
  100% {
    stroke-dashoffset: 900;
  }
}
@keyframes dash-check {
  0% {
    stroke-dashoffset: -100;
  }
  100% {
    stroke-dashoffset: 900;
  }
}
</style>