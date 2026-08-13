<script setup>
import { ref, onMounted, computed } from 'vue';
import useMyComposable from '../../composables/Composable';
import { readLocalStorage } from '../../../js/utils/helpers';
import { SERVICE_AND_STORAGE_KEY } from '../../../js/constants/apiServices.js';
import LocalSettingsByokListProvider from '../Settings/LocalSettingsByokListProvider.vue';
import OpenRouterQuickSetup from './OpenRouterQuickSetup.vue';

const { 
  localSettingsTab,
  providersList,
  voiceSwitchOnPremium, 
  voiceShowFavoritesOn,
  showProviderKeyModal,
  showProviderKeyModalProvider,
  pageRoute, API_NUXT_DOMAIN, APP_WEB_DOMAIN, isUserLogged, isFirstTimeLoggedIn, sidepanelMakeToast, totalVoices,
  userProfile 
} = useMyComposable();


const apiServices = computed(()=>{
  if(providersList.value.length === 0) return SERVICE_AND_STORAGE_KEY;
  return providersList.value
});

// --- STATE & REFS ---
const isLoading = ref(true);
const error = ref(null);
const showAllProviders = ref(false);
const selectedProvider = ref(null);
const showProviderModal = ref(false);
const showByokPanel = ref(false);
const apiKeysStatus = ref({});
const apiKeyValues = ref({});

// --- COMPUTED PROPERTIES ---
const sortedProviders = computed(() => {
  return [...providersList.value].sort((a, b) => {
    const aHasKey = hasApiKey(a.voice_service);
    const bHasKey = hasApiKey(b.voice_service);
    if (aHasKey && !bHasKey) {
      return -1;
    }
    if (!aHasKey && bHasKey) {
      return 1;
    }
    return 0;
  });
});

const initialProviders = computed(() => sortedProviders.value.slice(0, 5));
const remainingProviders = computed(() => sortedProviders.value.slice(5));

const selectedProviderData = computed(() => {
  if (!selectedProvider.value) return null;
  return providersList.value.find(p => p.voice_service === selectedProvider.value);
});

const selectedProviderSupportsApiKey = computed(() => {
  if (!selectedProvider.value) return false;
  return apiServices.value.some(s => s.voice_service === selectedProvider.value && s.storage_key);
});

const selectedProviderApiService = computed(() => {
  if (!selectedProvider.value) return null;
  return apiServices.value.find(s => s.voice_service === selectedProvider.value);
});

const selectedProviderHasApiKey = computed(() => {
  if (!selectedProvider.value) return false;
  return apiKeysStatus.value[selectedProvider.value] === true;
});

// --- LIFECYCLE HOOK ---
onMounted(async () => {
  // Only fetch if the list isn't already populated in the composable
  if (providersList.value.length === 0) {
    await fetchProviders();
  } else {
    isLoading.value = false; // If data is already there, we're not loading
  }
  await loadApiKeysStatus();
});

// --- METHODS ---
async function fetchProviders() {
  isLoading.value = true;
  error.value = null;
  try {
    const url = `https://${API_NUXT_DOMAIN.value}/api/v1/voice/filtered-list?filter=providers&extension_only=true`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch providers list.');
    }

    const data = await response.json();
    
    if (data && Array.isArray(data.list)) {
      providersList.value = data.list;
      totalVoices.value = data.list.reduce((sum, provider) => sum + (Number(provider.voice_count) || 0), 0);
    
      chrome.runtime.sendMessage({ 
        action: "update-background-storage",
        key: "SERVICE_TO_STORAGE_KEY_MAP",
        value: buildServiceToStorageKeyMap(data.list)
      });

      chrome.runtime.sendMessage({ 
        action: "update-background-storage",
        key: "PROVIDER_CONCURRENCY_MAP",
        value: buildProviderConcurrencyMap(data.list)
      });
    
      if(showProviderKeyModal.value && showProviderKeyModalProvider.value){
        openProviderModal(showProviderKeyModalProvider.value);
        showProviderKeyModal.value = false;
        showProviderKeyModalProvider.value = null;
      }


    } else {
      throw new Error('Invalid data format received from API.');
    }

  } catch (err) {
    console.error('Error fetching voice providers:', err);
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
}

function buildServiceToStorageKeyMap(list = []) {
  const out = {};
  if (!Array.isArray(list)) return out;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item) continue;
    const svc = item.voice_service;
    const key = item.storage_key;
    if (typeof svc === 'string' && svc && typeof key === 'string' && key) {
      out[svc] = key;
    }
  }
  return out;
}

function parseMaxConcurrent(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? Math.min(5, Math.max(1, Math.round(num))) : null;
}

function buildProviderConcurrencyMap(list = []) {
  const out = {};
  if (!Array.isArray(list)) return out;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item) continue;
    const svc = item.voice_service;
    if (typeof svc !== 'string' || !svc) continue;

    let maxConcurrent = parseMaxConcurrent(item.max_concurrent);
    if (maxConcurrent === null && Array.isArray(item.custom_api_options)) {
      const entry = item.custom_api_options.find(f => f && f.name === 'max_concurrent');
      if (entry) maxConcurrent = parseMaxConcurrent(entry.default);
    }
    if (maxConcurrent !== null) out[svc] = maxConcurrent;
  }
  return out;
}

const storageKeys = computed(() => {
  const services = Array.isArray(apiServices.value) ? apiServices.value : [];
  const keys = [];
  for (let i = 0; i < services.length; i++) {
    const sk = services[i] && services[i].storage_key;
    if (sk && typeof sk === 'string' && sk.trim().length) keys.push(sk);
  }
  return keys;
});

async function loadApiKeysStatus() {
  try {
    const storage = await readLocalStorage(storageKeys.value);
    const newApiKeysStatus = {};
    const newApiKeyValues = {};

    apiServices.value.forEach(service => {
        if (service.storage_key) {
            const keyValue = storage[service.storage_key] || '';
            const hasKey = keyValue.trim().length > 0;
            newApiKeysStatus[service.voice_service] = hasKey;
            newApiKeyValues[service.storage_key] = keyValue;
        }
    });
    apiKeysStatus.value = newApiKeysStatus;
    apiKeyValues.value = newApiKeyValues;

  } catch (error) {
    console.error('Error loading API keys status:', error);
  }
}

function getApiKeyValue(storageKey) {
  return apiKeyValues.value[storageKey] || '';
}

function hasApiKey(serviceName) {
  return apiKeysStatus.value[serviceName] === true;
}

function generateTooltipContent(provider) {
  const badges = [];
  if (hasApiKey(provider.voice_service)) {
    badges.push(`<span class="bg-green-400 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">🔑 API Key Saved</span>`);
  }
  if (provider.voice_count > 0) {
    badges.push(`<span class="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">${provider.voice_count} voices</span>`);
  }
  if (provider.language_count > 0) {
    badges.push(`<span class="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">${provider.language_count} languages</span>`);
  }
  if (provider.voice_has_word_timestamp_support) {
    badges.push(`<span class="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">✅word highlights</span>`);
  }
  if (provider.voice_has_voice_speed_support) {
    badges.push(`<span class="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">✅voice speed change</span>`);
  }
  return `<div class="flex flex-wrap items-center gap-1.5 p-1">${badges.join(' ')}</div>`;
}

function goToVoices(routeName, service) {
  if (service === "free") {
    voiceSwitchOnPremium.value = false;
    voiceShowFavoritesOn.value = false;
  } else if (service === "premium") {
    voiceShowFavoritesOn.value = false;
    voiceSwitchOnPremium.value = true;
  } else if (service === 'favorites') {
    voiceShowFavoritesOn.value = true;
    voiceSwitchOnPremium.value = true;
  }
  setTimeout(() => {
    pageRoute.value = routeName;
  }, 200);
}

async function viewProviderVoiceList(provider) {
  await chrome.storage.local.set({ 
    'VOICE_FILTER_OPTIONS': {
      'gender': "",
      'service': provider,
      'languageCode': "en",
      'countryCode': "all"
    } 
  }); 
  goToVoices('/voices', 'premium');
  closeProviderModal();
}

function openProviderModal(providerName) {
  selectedProvider.value = providerName;
  showProviderModal.value = true;
  showByokPanel.value = false;
}

// --- MODIFIED FUNCTION ---
// Close provider modal and refresh API key statuses
async function closeProviderModal() {
  showProviderModal.value = false;
  showByokPanel.value = false;
  
  // Re-run the API key status check when the modal is closed.
  // This ensures the provider buttons are correctly highlighted if a key was added or removed.
  await loadApiKeysStatus();

  setTimeout(() => {
    selectedProvider.value = null;
  }, 300);
}

function showApiKeyPanel() {
  showByokPanel.value = true;
}

function hideApiKeyPanel() {
  showByokPanel.value = false;
}

function openAdvancedFilters(providerName) {
  const url = `https://${APP_WEB_DOMAIN.value}/filters?service=${encodeURIComponent(providerName)}`;
  chrome.tabs.create({ url });
}

function getServiceOptions(serviceName) {
  const provider = providersList.value.find((item)=>item.voice_service === serviceName);
  return provider?.api_test_voice || null;
}

// Refresh API keys status after save for instant feedback inside the modal
async function handleApiKeySaved() {
  await loadApiKeysStatus();
}
</script>


<template>
  <div class="px-3 py-2 z-100 relative">
    <!-- Loading State -->
    <div v-if="isLoading" class="text-center text-gray-400 text-sm py-4">
      Loading providers...
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center text-red-400 text-sm py-4">
      Could not load providers.
    </div>

    <!-- Provider "Shelf" Layout -->
    <div v-else-if="providersList.length > 0" class="flex flex-wrap gap-2 pr-2 custom-scrollbar">
      <!-- Always show the first 6 providers -->
      <button
        v-for="provider in initialProviders"
        :key="provider.voice_service"
        v-tooltip="{ content: generateTooltipContent(provider), html: true }"
        @click="openProviderModal(provider.voice_service)"
        :class="[
          hasApiKey(provider.voice_service) 
            ? 'bg-green-900/30 hover:bg-green-900/50 border border-green-500/40 text-green-100 shadow-sm shadow-green-900/20' 
            : 'bg-gray-800/80 hover:bg-gray-700 border border-gray-700/50 hover:border-gray-600 text-gray-300 hover:text-white shadow-sm'
        ]"
        class="flex items-center cursor-pointer px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ease-in-out no-underline hover:scale-105"
      >
        <img
          v-if="provider.voice_service_alias"
          :src="`https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${provider.voice_service_alias}&size=32`"
          :alt="`${provider.voice_service} logo`"
          class="w-4 h-4 mr-2 flex-shrink-0"
        />
        <span>{{ provider.voice_service }}</span>
      </button>

      <!-- Show the rest of the providers when toggled -->
      <template v-if="showAllProviders">
        <button
          v-for="provider in remainingProviders"
          :key="provider.voice_service"
          v-tooltip="{ content: generateTooltipContent(provider), html: true }"
          @click="openProviderModal(provider.voice_service)"
          :class="[
            hasApiKey(provider.voice_service) 
              ? 'bg-green-900/30 hover:bg-green-900/50 border border-green-500/40 text-green-100 shadow-sm shadow-green-900/20' 
              : 'bg-gray-800/80 hover:bg-gray-700 border border-gray-700/50 hover:border-gray-600 text-gray-300 hover:text-white shadow-sm'
          ]"
          class="flex cursor-pointer items-center px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ease-in-out no-underline hover:scale-105"
        >
          <img
            v-if="provider.voice_service_alias"
            :src="`https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${provider.voice_service_alias}&size=32`"
            :alt="`${provider.voice_service} logo`"
            class="w-4 h-4 mr-2 flex-shrink-0"
          />
          <span>{{ provider.voice_service }}</span>
        </button>
      </template>

      <!-- "More Providers" Divider Button -->
      <button
        v-if="providersList.length > 6 && !showAllProviders"
        @click="showAllProviders = true"
        class="w-full text-center text-xs text-gray-400 hover:text-white font-semibold py-1 mt-1 bg-white/5 hover:bg-white/10 rounded-md transition-colors duration-200"
      >
        ... More Providers ({{ providersList.length }}) ...
      </button>

      <!-- OpenRouter quick setup -->
      <OpenRouterQuickSetup @api-keys-refreshed="loadApiKeysStatus" />
    </div>
    
    <!-- Empty State -->
    <div v-else class="text-center text-gray-500 text-sm py-4">
      No voice providers found.
    </div>

    <!-- Provider Options Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div 
          v-if="showProviderModal && selectedProviderData"
          class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm"
          @click.self="closeProviderModal"
        >
          <div class="h-full block relative bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full  max-h-[90vh] overflow-hidden transform transition-all border border-gray-700">
            <div class="relative h-full">
              
              <Transition name="slide-left">
                <div v-if="!showByokPanel" class="flex flex-col h-full">
                  <!-- Header (Fixed Height) -->
                  <div class="flex-shrink-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-6 text-white relative">
                    <button
                      @click="closeProviderModal"
                      class="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                    >
                      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    <div class="flex items-center gap-4">
                      <div class="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg">
                        <img v-if="selectedProviderData.voice_service_alias" :src="`https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${selectedProviderData.voice_service_alias}&size=64`" :alt="`${selectedProviderData.voice_service} logo`" class="w-10 h-10"/>
                      </div>
                      <div class="flex-1">
                        <h3 class="text-2xl font-bold mb-1">{{ selectedProviderData.voice_service }}</h3>
                        <p class="text-indigo-100 text-sm">{{ selectedProviderData.voice_service_alias }}</p>
                      </div>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                      <span v-if="selectedProviderHasApiKey" class="bg-green-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
                        API Key Saved
                      </span>
                      <span class="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">{{ selectedProviderData.voice_count }} voices</span>
                      <span class="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">{{ selectedProviderData.language_count }} languages</span>
                    </div>
                  </div>

                  <!-- Content (Scrollable Area) -->
                  <!-- MODIFIED: Added flex-1 and the critical min-h-0 -->
                  <div class="px-4 py-8 bg-gray-900 overflow-y-auto flex-1 min-h-0 provider-actions-scrollbar">
                    <div class="space-y-3">
                      <button @click="viewProviderVoiceList(selectedProviderData.voice_service)" class="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl transition-all transform hover:scale-[1.02] shadow-lg group">
                        <div class="flex items-center gap-4">
                          <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg></div>
                          <div class="text-left"><p class="font-bold text-lg">View Voices</p><p class="text-sm text-indigo-100">Browse all available voices</p></div>
                        </div>
                        <svg class="w-6 h-6 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                      </button>
                      <button @click="openAdvancedFilters(selectedProviderData.voice_service)" class="w-full flex items-center justify-between px-6 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-all transform hover:scale-[1.02] border border-gray-700 group">
                        <div class="flex items-center gap-4">
                          <div class="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center"><svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg></div>
                          <div class="text-left"><p class="font-bold text-lg">Advanced Filters</p><p class="text-sm text-gray-400">Open in {{ APP_WEB_DOMAIN.value }}</p></div>
                        </div>
                        <svg class="w-6 h-6 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                      </button>
                      <button v-if="selectedProviderSupportsApiKey" @click="showApiKeyPanel" class="w-full flex items-center justify-between px-6 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-all transform hover:scale-[1.02] border border-gray-700 group">
                        <div class="flex items-center gap-4">
                          <div class="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center"><svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg></div>
                          <div class="text-left"><p class="font-bold text-lg">{{ selectedProviderHasApiKey ? 'Change' : 'Add' }} API Key</p><p class="text-sm text-gray-400">Use your own API credentials</p></div>
                        </div>
                        <svg class="w-6 h-6 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </Transition>

              <Transition name="slide-right">
                <div v-if="showByokPanel" class="bg-gray-900 flex flex-col h-full">
                  <!-- Header (Fixed Height) -->
                  <div class="flex-shrink-0 bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-6 text-white relative">
                    <button @click="hideApiKeyPanel" class="absolute top-4 left-4 text-white/80 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                      Back
                    </button>
                    <button @click="closeProviderModal" class="absolute top-4 right-4 text-white/80 hover:text-white transition-colors">
                      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    <div class="text-center pt-8">
                      <div class="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-4">
                        <svg class="w-9 h-9 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                      </div>
                      <h3 class="text-2xl font-bold mb-2">API Key Management</h3>
                      <p class="text-green-100 text-sm">{{ selectedProviderData.voice_service }}</p>
                    </div>
                  </div>

                  <!-- Content (Scrollable Area) -->
                  <!-- MODIFIED: Added flex-1 and the critical min-h-0 -->
                  <div class="px-6 py-8 overflow-y-auto flex-1 min-h-0 byok-scrollbar">
                    <LocalSettingsByokListProvider
                      v-if="selectedProviderApiService"
                      :service="selectedProviderApiService"
                      :initial-value="getApiKeyValue(selectedProviderApiService.storage_key)"
                      :service-options="getServiceOptions(selectedProvider)"
                      @api-key-saved="handleApiKeySaved"
                    />
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
a, button {
  text-decoration: none;
}

/* Modal fade animation */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* Slide left animation (main panel out) */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  width: 100%;
}

.slide-left-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* Slide right animation (BYOK panel in) */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  width: 100%;
}

.slide-right-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Custom scrollbar for provider list */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

/* Styled scrollbar for API Key Management panel */
.byok-scrollbar::-webkit-scrollbar,
.provider-actions-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.byok-scrollbar::-webkit-scrollbar-track,
.provider-actions-scrollbar::-webkit-scrollbar-track {
  background: rgba(148, 163, 184, 0.15);
  border-radius: 10px;
}

.byok-scrollbar::-webkit-scrollbar-thumb,
.provider-actions-scrollbar::-webkit-scrollbar-thumb {
  background: #94a3b8;
  border-radius: 10px;
}

.byok-scrollbar::-webkit-scrollbar-thumb:hover,
.provider-actions-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}

.byok-scrollbar,
.provider-actions-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #94a3b8 rgba(148, 163, 184, 0.15);
}
</style>