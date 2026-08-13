<template>
  <div class="w-full mx-auto rounded-lg bg-white border border-gray-200 p-4 text-gray-800 font-light mb-6">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-sm font-medium text-gray-900">Timestamp Word Highlighting Service</h3>
        <p class="text-xs text-gray-500 mt-1">Select the fallback service to generate word-level timestamps for text highlighting when a TTS provider does not support it natively.</p>
      </div>
    </div>

    <div class="mb-4">
      <select 
        v-model="externalTimestampServiceState" 
        @change="saveTimestampService"
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
      >
        <option value="None">None</option>
        <option value="Whisper">Whisper (OpenAI)</option>
        <option value="Deepgram">Deepgram</option>
        <option value="OpenRouter">OpenRouter (STT)</option>
      </select>
    </div>

    <!-- OpenAI STT API Key Field -->
    <div v-if="externalTimestampServiceState === 'Whisper'" class="mb-4 pt-2 border-t border-gray-100">
      <label class="block text-xs font-medium text-gray-600 mb-1">OpenAI Transcription API Key</label>
      <p class="text-[10px] text-gray-400 mb-2">Used exclusively for generating timestamps via Whisper.</p>
      <div class="relative">
        <input 
          v-model="openAiSttApiKeyState"
          @change="saveApiKeys"
          :type="showOpenAiKey ? 'text' : 'password'"
          placeholder="sk-..."
          class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
        >
        <button
          v-if="openAiSttApiKeyState"
          @click="showOpenAiKey = !showOpenAiKey"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          type="button"
        >
          <svg v-if="showOpenAiKey" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
        </button>
      </div>
    </div>

    <!-- Deepgram STT API Key Field -->
    <div v-if="externalTimestampServiceState === 'Deepgram'" class="mb-4 pt-2 border-t border-gray-100">
      <label class="block text-xs font-medium text-gray-600 mb-1">Deepgram Transcription API Key</label>
      <p class="text-[10px] text-gray-400 mb-2">Used exclusively for generating timestamps via Deepgram.</p>
      <div class="relative">
        <input 
          v-model="deepgramSttApiKeyState"
          @change="saveApiKeys"
          :type="showDeepgramKey ? 'text' : 'password'"
          placeholder="Enter API key"
          class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
        >
        <button
          v-if="deepgramSttApiKeyState"
          @click="showDeepgramKey = !showDeepgramKey"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          type="button"
        >
          <svg v-if="showDeepgramKey" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
        </button>
      </div>
    </div>

    <!-- OpenRouter STT API Key & Model Fields -->
    <div v-if="externalTimestampServiceState === 'OpenRouter'" class="mb-4 pt-2 border-t border-gray-100">
      <label class="block text-xs font-medium text-gray-600 mb-1">OpenRouter API Key</label>
      <p class="text-[10px] text-gray-400 mb-2">One key is shared across all OpenRouter STT models below.</p>
      <div class="relative">
        <input 
          v-model="openRouterSttApiKeyState"
          @change="saveApiKeys"
          :type="showOpenRouterKey ? 'text' : 'password'"
          placeholder="sk-or-..."
          class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
        >
        <button
          v-if="openRouterSttApiKeyState"
          @click="showOpenRouterKey = !showOpenRouterKey"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          type="button"
        >
          <svg v-if="showOpenRouterKey" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
        </button>
      </div>

      <label class="block text-xs font-medium text-gray-600 mb-1 mt-4">OpenRouter STT Model</label>
      <p class="text-[10px] text-gray-400 mb-2">Used for generating word-level timestamps. Only models that support verbose_json word timestamps are listed.</p>
      <select
        v-model="openRouterSttModelState"
        @change="saveTimestampService"
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
      >
        <option v-for="model in openRouterSttModels" :key="model" :value="model">{{ model }}</option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { saveToLocalStorage } from '../../../js/utils/helpers';
import { OPENROUTER_STT_MODELS } from '../../../js/tts-providers/_shared';
import useLocalSettings from '../../composables/useLocalSettings';
import useMyComposable from '../../composables/Composable';

const { 
  externalTimestampServiceState, 
  openAiSttApiKeyState, 
  deepgramSttApiKeyState, 
  openRouterSttApiKeyState, 
  openRouterSttModelState, 
  getFromStorageExternalTimestampSettings 
} = useLocalSettings();

const { sidepanelMakeToast } = useMyComposable();

const showOpenAiKey = ref(false);
const showDeepgramKey = ref(false);
const showOpenRouterKey = ref(false);

const openRouterSttModels = OPENROUTER_STT_MODELS;

onMounted(async () => {
  await getFromStorageExternalTimestampSettings();
});

const saveTimestampService = () => {
  saveToLocalStorage({
    'DEFAULT_EXTERNAL_TIMESTAMP_SERVICE': externalTimestampServiceState.value,
    'DEFAULT_OPENROUTER_STT_MODEL': openRouterSttModelState.value
  });
};

const saveApiKeys = () => {
  saveToLocalStorage({
    'OPENAI_STT_API_KEY': openAiSttApiKeyState.value,
    'DEEPGRAM_STT_API_KEY': deepgramSttApiKeyState.value,
    'OPENROUTER_STT_API_KEY': openRouterSttApiKeyState.value
  });
  sidepanelMakeToast('Transcription API keys saved', 'success');
};
</script>
