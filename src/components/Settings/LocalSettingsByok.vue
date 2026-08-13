<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue';
import useMyComposable from '../../composables/Composable';
import { readLocalStorage } from '../../../js/utils/helpers';
import LocalSettingsByokListProvider from './LocalSettingsByokListProvider.vue';
import LocalSettingsByokUsage from './LocalSettingsByokUsage.vue';
import ErrorLogs from './ErrorLogs.vue';

const selectedProviderToScroll = ref('');
const selectedProviderId = ref('');
const showUsageView = ref(false);
const showErrorLogs = ref(false);
const providersLoaded = ref(false);

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

function scrollToProvider() {
  if (!selectedProviderToScroll.value) return;
  
  const safeId = selectedProviderToScroll.value.replace(/\s+/g, '-');
  const el = document.getElementById(`provider-${safeId}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  
  // Set the selected provider to keep it highlighted with full opacity
  selectedProviderId.value = selectedProviderToScroll.value;
  
  // Reset scroll target after jumping
  setTimeout(() => {
    selectedProviderToScroll.value = '';
  }, 100);
}

function handleProviderSelect() {
  if (selectedProviderToScroll.value) {
    selectedProviderId.value = selectedProviderToScroll.value;
    scrollToProvider();
  } else {
    // If placeholder is selected, clear the selection
    selectedProviderId.value = '';
  }
}

function toggleUsageView() {
  showUsageView.value = !showUsageView.value;
  if (showUsageView.value) showErrorLogs.value = false;
}

function toggleErrorLogs() {
  showErrorLogs.value = !showErrorLogs.value;
  if (showErrorLogs.value) showUsageView.value = false;
}

const {
  pageRoute,
  userProfile,
  providersList,
  API_NUXT_DOMAIN,
  openErrorLogsOnMount,
  openByokProvider
} = useMyComposable();

watch(() => openErrorLogsOnMount.value, (newVal) => {
  if (newVal) {
    showErrorLogs.value = true;
    showUsageView.value = false;
    openErrorLogsOnMount.value = false;
  }
}, { immediate: true });

// Watch for provider request and scroll when providers are loaded
watch([() => openByokProvider.value, () => providersLoaded.value], async ([providerName, loaded]) => {
  if (providerName && loaded) {
    // Check if provider exists in the list
    const provider = providersList.value.find(p => p.voice_service === providerName);
    if (provider) {
      selectedProviderToScroll.value = providerName;
      // Wait for DOM to update (v-for rendering + select update)
      await nextTick();
      // Additional delay to ensure scroll container is ready
      setTimeout(() => {
        scrollToProvider();
      }, 150);
    }
    openByokProvider.value = '';
  }
}, { immediate: true });


const isLoading = ref(false);
const error = ref(null);

const byokProviders = computed(() => {
  return providersList.value.filter(provider => provider.storage_key);
});

function getServiceOptions(serviceName) {
  const provider = providersList.value.find(p => p.voice_service === serviceName);
  return provider?.api_test_voice || null;
}

const apiKeys = ref({});

onMounted(async () => {
  if (providersList.value.length === 0) {
    await fetchProviders();
  } else {
    providersLoaded.value = true;
  }
  await loadApiKeys();
});

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
      providersLoaded.value = true;

      chrome.runtime.sendMessage({ 
        action: "update-background-storage",
        key: "PROVIDER_CONCURRENCY_MAP",
        value: buildProviderConcurrencyMap(data.list)
      });
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

async function loadApiKeys() {
  try {
    if (byokProviders.value.length > 0) {
      const storageKeys = byokProviders.value.map(p => p.storage_key);
      const storage = await readLocalStorage(storageKeys);
      
      byokProviders.value.forEach(provider => {
        apiKeys.value[provider.storage_key] = storage[provider.storage_key] || '';
      });
    }
  } catch (error) {
    console.error('Error loading API keys:', error);
  }
}
</script>

<template>
  <div class="px-3">
    <div class="relative flex flex-col bg-white w-full">
      <div class="rounded-t mt-3 mb-0 px-4 py-3 rounded-lg border border-gray-200 bg-white">
        <div class="flex flex-col">
          <div class="mb-3">
            <h3 class="font-semibold text-lg text-blueGray-700 mb-2">
              API Key Management
            </h3>
            <p class="text-sm text-gray-600">
              Store your API keys securely for different TTS services. Keys are saved locally in your browser.
            </p>
          </div>
          <div>
            <button 
              v-if="!showUsageView" 
              @click="toggleUsageView" 
              class="w-full px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
            >
              View Usage by Storage Key
            </button>
            <button 
              v-if="!showErrorLogs" 
              @click="toggleErrorLogs" 
              class="w-full mt-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors"
            >
              View Error Logs
            </button>
          </div>
        </div>
      </div>

      <LocalSettingsByokUsage 
        v-if="showUsageView" 
        :providers="byokProviders" 
        @close="showUsageView = false" 
      />

      <div v-if="showErrorLogs" class="mt-4">
        <button 
          @click="showErrorLogs = false" 
          class="mb-2 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 transition-colors cursor-pointer"
        >
          ← Hide Error Logs
        </button>
        <ErrorLogs />
      </div>

      <div v-else>
        <div v-if="byokProviders.length > 0" class="mt-4 px-4 bg-white py-3 rounded-lg border border-gray-200">
        <label for="provider-select" class="block text-sm font-semibold text-gray-700 mb-2">Jump to Voice Service</label>
        <select 
          id="provider-select" 
          v-model="selectedProviderToScroll" 
          @change="handleProviderSelect"
          class="block w-full lg:max-w-md pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm rounded-lg shadow-sm border bg-gray-50 cursor-pointer"
        >
          <option value="" disabled>Select a voice service to jump to...</option>
          <option v-for="provider in byokProviders" :key="'select-' + provider.storage_key" :value="provider.voice_service">
            {{ provider.voice_service }} {{ apiKeys[provider.storage_key] ? '🔑' : '' }}
          </option>
        </select>
      </div>

      <div v-if="isLoading" class="text-center py-8">
        <p class="text-gray-500">Loading API providers...</p>
      </div>
      <div v-else-if="error" class="text-center py-8 text-red-600">
        <p>Could not load providers: {{ error }}</p>
      </div>

      <div v-else class="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3" >
        <div v-for="provider in byokProviders" :key="provider.storage_key"
        :id="'provider-' + provider.voice_service.replace(/\s+/g, '-')"
        :class="selectedProviderId === provider.voice_service 
          ? 'ring-2 ring-indigo-500 ring-offset-2 rounded-lg transition-all' 
          : 'opacity-60 hover:opacity-100 transition-all'"
        >
            <LocalSettingsByokListProvider
            :service="provider" 
            :initial-value="apiKeys[provider.storage_key]"
            :has-unlock="true"
            :service-options="getServiceOptions(provider.voice_service)"
            @api-key-saved="loadApiKeys"
          />
        </div>


      </div>
      </div>

      <div class="mt-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div class="flex gap-3">
          <svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
          </svg>
          <div>
            <h4 class="text-sm font-semibold text-blue-900 mb-1">Security Note</h4>
            <p class="text-xs text-blue-800">
              API keys are stored locally in your browser's storage and are never sent to our servers. 
              Keep your keys secure and don't share them with others.
            </p>
          </div>
        </div>
      </div>
    </div>


  </div>
</template>

<style scoped>
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(148, 163, 184, 0.15);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background: #94a3b8;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}
</style>