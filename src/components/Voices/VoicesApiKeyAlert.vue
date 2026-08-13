<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import useMyComposable from '../../composables/Composable';
import { readLocalStorage } from '../../../js/utils/helpers';
import { SERVICE_AND_STORAGE_KEY } from '../../../js/constants/apiServices.js';
import LocalSettingsByokListProvider from '../Settings/LocalSettingsByokListProvider.vue';

const {
  API_NUXT_DOMAIN,
  providersList,
  voiceFilterOptions,
  voiceSwitchOnPremium,
  voiceShowFavoritesOn,
  voiceShowCollectionsOn,
  sidepanelMakeToast
} = useMyComposable();

const currentKey = ref('');
const hasApiKey = ref(false);
const isLoadingKey = ref(false);
const showAddKeyModal = ref(false);

const selectedProviderName = computed(() => {
  return (voiceFilterOptions.value?.service || '').trim();
});

const selectedProvider = computed(() => {
  const name = selectedProviderName.value;
  if (!name) return null;
  const fromList = providersList.value.find(p => p && p.voice_service === name);
  if (fromList) return fromList;
  const fallback = SERVICE_AND_STORAGE_KEY.find(s => s.service === name);
  if (fallback) {
    return {
      voice_service: fallback.service,
      voice_service_alias: fallback.alias,
      storage_key: fallback.storageKey
    };
  }
  return null;
});

const isByokProvider = computed(() => {
  return !!(selectedProvider.value && selectedProvider.value.storage_key);
});

const shouldShowAlert = computed(() => {
  if (!voiceSwitchOnPremium.value) return false;
  if (voiceShowFavoritesOn.value || voiceShowCollectionsOn.value) return false;
  if (!isByokProvider.value) return false;
  if (!hasApiKey.value) return true;
  return false;
});

async function loadApiKeyStatus() {
  const provider = selectedProvider.value;
  if (!provider || !provider.storage_key) {
    currentKey.value = '';
    hasApiKey.value = false;
    return;
  }

  isLoadingKey.value = true;
  try {
    const storage = await readLocalStorage([provider.storage_key]);
    const value = (storage && storage[provider.storage_key]) || '';
    currentKey.value = value;
    hasApiKey.value = value.trim().length > 0;
  } catch (error) {
    console.error('Error loading API key status:', error);
    currentKey.value = '';
    hasApiKey.value = false;
  } finally {
    isLoadingKey.value = false;
  }
}

async function fetchProviders() {
  if (providersList.value.length > 0) return;
  try {
    const url = `https://${API_NUXT_DOMAIN.value}/api/v1/voice/filtered-list?filter=providers&extension_only=true`;
    const response = await fetch(url);
    if (!response.ok) return;
    const data = await response.json();
    if (data && Array.isArray(data.list)) {
      providersList.value = data.list;
    }
  } catch (error) {
    console.error('Error fetching providers:', error);
  }
}

watch(selectedProviderName, async () => {
  await loadApiKeyStatus();
}, { immediate: true });

function openGuide() {
  const provider = selectedProvider.value;
  if (!provider) return;
  chrome.runtime.sendMessage({
    action: "open-byok-guide",
    serviceName: provider.voice_service
  });
}

function openAddKeyModal() {
  showAddKeyModal.value = true;
}

function closeAddKeyModal() {
  showAddKeyModal.value = false;
}

function handleApiKeySaved() {
  loadApiKeyStatus();
  sidepanelMakeToast(`${selectedProvider.value?.voice_service} API key added`, 'success');
}

onMounted(async () => {
  await fetchProviders();
  await loadApiKeyStatus();
});
</script>

<template>
  <div>
    <div
      v-if="shouldShowAlert"
      class="flex flex-col gap-3 sm:flex-row sm:items-center justify-between px-4 py-3 mb-2 rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-900/20"
    >
      <div class="flex items-start gap-2 min-w-0">
        <svg class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
        </svg>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-amber-800 dark:text-amber-200">
            API key not added for {{ selectedProvider?.voice_service }}
          </p>
          <p class="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            Add your API key to start listening to {{ selectedProvider?.voice_service }} voices.
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          @click="openGuide"
          class="px-4 py-2 text-xs font-bold rounded-lg border border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
        >
          Get Key
        </button>
        <button
          type="button"
          @click="openAddKeyModal"
          class="px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
        >
          Add Key
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showAddKeyModal && selectedProvider"
        class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm"
        @click.self="closeAddKeyModal"
      >
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto transform transition-all akm-scrollbar">
          <div class="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4 text-white flex items-center justify-between">
            <div>
              <h3 class="text-xl font-bold">API Key Management</h3>
              <p class="text-sm text-indigo-100 mt-1">{{ selectedProvider.voice_service }}</p>
            </div>
            <button
              type="button"
              @click="closeAddKeyModal"
              class="text-white/80 hover:text-white transition-colors"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div class="p-4">
            <LocalSettingsByokListProvider
              :service="selectedProvider"
              :initial-value="currentKey"
              :service-options="selectedProvider.api_test_voice || null"
              @api-key-saved="handleApiKeySaved"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Styled scrollbar for API Key Management modal */
.akm-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.akm-scrollbar::-webkit-scrollbar-track {
  background: rgba(148, 163, 184, 0.15);
  border-radius: 10px;
}

.akm-scrollbar::-webkit-scrollbar-thumb {
  background: #94a3b8;
  border-radius: 10px;
}

.akm-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}

.akm-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #94a3b8 rgba(148, 163, 184, 0.15);
}
</style>
