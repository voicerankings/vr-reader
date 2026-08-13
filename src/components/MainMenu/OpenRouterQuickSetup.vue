<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import useMyComposable from '../../composables/Composable';
import { readLocalStorage, saveToLocalStorage } from '../../../js/utils/helpers';

const emit = defineEmits(['api-keys-refreshed']);

const { providersList, sidepanelMakeToast, showOpenRouterModalCount } = useMyComposable();

watch(showOpenRouterModalCount, () => {
  if (showOpenRouterModalCount.value > 0) openModal();
});

onMounted(() => {
  if (showOpenRouterModalCount.value > 0) openModal();
});

const isOpen = ref(false);
const apiKey = ref('');
const showKey = ref(false);
const isSaving = ref(false);
const providersStates = ref({});

const openRouterProviders = computed(() => {
    const list = Array.isArray(providersList.value) ? providersList.value : [];
    const out = [];
    for (const provider of list) {
        if (!provider || !Array.isArray(provider.custom_api_options)) continue;
        if (typeof provider.voice_service !== 'string' || typeof provider.storage_key !== 'string') continue;

        const apiKeyProviderField = provider.custom_api_options.find(f => f && f.name === 'apiKeyProvider');
        const options = Array.isArray(apiKeyProviderField?.options) ? apiKeyProviderField.options : [];
        const openRouterOption = options.find(o => typeof o === 'string' && o.startsWith('openrouter.com/'));
        if (!openRouterOption) continue;

        out.push({
            voice_service: provider.voice_service,
            voice_service_alias: provider.voice_service_alias || 'openrouter.com',
            storage_key: provider.storage_key,
            openRouterOption
        });
    }
    return out;
});

const selectedCount = computed(() => Object.values(providersStates.value).filter(Boolean).length);

function getOptionsStorageKey(provider) {
    return `${provider.storage_key}_options`;
}

async function evalProviderState() {
    const states = {};
    const optionKeys = openRouterProviders.value.map(getOptionsStorageKey);
    const stored = await readLocalStorage(optionKeys);
    for (const provider of openRouterProviders.value) {
        const options = stored?.[getOptionsStorageKey(provider)] || {};
        // Pre-check only providers already routed through OpenRouter.
        states[provider.voice_service] = typeof options.apiKeyProvider === 'string'
            && options.apiKeyProvider.indexOf('openrouter.com/') === 0;
    }
    providersStates.value = states;
}

async function openModal() {
    apiKey.value = '';
    showKey.value = false;
    await evalProviderState();
    isOpen.value = true;
    showOpenRouterModalCount.value = 0;
}

function checkAll() {
    const states = {};
    for (const provider of openRouterProviders.value) {
        states[provider.voice_service] = true;
    }
    providersStates.value = states;
}

function uncheckAll() {
    const states = {};
    for (const provider of openRouterProviders.value) {
        states[provider.voice_service] = false;
    }
    providersStates.value = states;
}

async function save() {
    const key = apiKey.value?.trim();
    if (!key) {
        sidepanelMakeToast('Enter an OpenRouter API key first', 'warning');
        return;
    }

    const selected = openRouterProviders.value.filter(p => providersStates.value[p.voice_service]);
    if (selected.length === 0) {
        sidepanelMakeToast('Select at least one provider to apply the key', 'warning');
        return;
    }

    isSaving.value = true;
    try {
        const optionKeys = selected.map(getOptionsStorageKey);
        const stored = await readLocalStorage(optionKeys);

        const writeObj = {};
        for (const provider of selected) {
            writeObj[provider.storage_key] = key;
            const existing = stored?.[getOptionsStorageKey(provider)] || {};
            writeObj[getOptionsStorageKey(provider)] = {
                ...existing,
                apiKeyProvider: provider.openRouterOption
            };
        }

        await saveToLocalStorage(writeObj, true);

        for (const provider of selected) {
            chrome.runtime.sendMessage({
                action: "update-contentscript-storage",
                key: provider.storage_key,
                value: key
            });
        }

        sidepanelMakeToast(`OpenRouter key applied to ${selected.length} provider${selected.length > 1 ? 's' : ''}`, 'success');
        emit('api-keys-refreshed');
        isOpen.value = false;
    } catch (error) {
        console.error('Error applying OpenRouter key:', error);
        sidepanelMakeToast('Failed to apply OpenRouter key', 'error');
    } finally {
        isSaving.value = false;
    }
}
</script>

<template>
  <div>
    <!-- Always-visible quick-setup pill -->
    <button
      type="button"
      @click="openModal()"
      class="flex items-center cursor-pointer px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ease-in-out no-underline hover:scale-105 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 border border-purple-400/40 text-white shadow-sm"
    >
      <img
        class="w-4 h-4 mr-2 flex-shrink-0"
        :src="'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://openrouter.ai&size=32'"
        alt="OpenRouter logo"
      />
      <span>OpenRouter</span>
    </button>

    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="isOpen"
          class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm"
          @click.self="isOpen = false"
        >
          <div class="w-full max-w-lg bg-gray-900 rounded-2xl shadow-2xl overflow-hidden transform transition-all border border-gray-700 flex flex-col max-h-[90vh]">
            <!-- Header -->
            <div class="flex-shrink-0 bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 px-6 py-5 text-white relative">
              <button @click="isOpen = false" class="absolute top-4 right-4 text-white/80 hover:text-white transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <img class="w-8 h-8" src="https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://openrouter.ai&size=64" alt="OpenRouter logo"/>
                </div>
                <div>
                  <h3 class="text-xl font-bold">Connect OpenRouter</h3>
                  <p class="text-purple-100 text-sm">One key, many TTS providers</p>
                </div>
              </div>
            </div>

            <!-- Content (scrollable) -->
            <div class="px-5 py-5 overflow-y-auto flex-1 min-h-0 orqs-scrollbar">
              <!-- API key input -->
              <div class="flex justify-between items-end mb-1.5">
                <label class="block text-xs font-medium text-gray-300">OpenRouter API Key</label>
                <a href="https://openrouter.ai/keys" target="_blank" class="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors">
                  <span>Get API Key</span>
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                </a>
              </div>
              <div class="relative mb-3">
                <input
                  v-model="apiKey"
                  :type="showKey ? 'text' : 'password'"
                  placeholder="sk-or-..."
                  class="w-full px-3 py-2.5 pr-10 border border-gray-600 rounded-lg bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-mono text-white"
                  @keydown.enter="save()"
                >
                <button v-if="apiKey" @click="showKey = !showKey" type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 focus:outline-none">
                  <svg v-if="showKey" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
                  <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                </button>
              </div>

              <!-- Provider checkboxes -->
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-semibold text-gray-300">{{ selectedCount }}/{{ openRouterProviders.length }} selected</span>
                <div class="flex gap-2">
                  <button @click="checkAll" type="button" class="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors">Check All</button>
                  <span class="text-gray-600">|</span>
                  <button @click="uncheckAll" type="button" class="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors">Uncheck All</button>
                </div>
              </div>

              <div class="space-y-1.5 mb-1">
                <label
                  v-for="provider in openRouterProviders"
                  :key="provider.voice_service"
                  class="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 cursor-pointer transition-colors border border-gray-700/60"
                >
                  <input
                    type="checkbox"
                    v-model="providersStates[provider.voice_service]"
                    class="flex-shrink-0 w-4 h-4 self-center text-indigo-600 focus:ring-indigo-500 border-gray-600 bg-gray-900 rounded cursor-pointer"
                  />
                  <div class="flex-1 min-w-0 flex flex-col">
                    <div class="flex items-center gap-2">
                      <img
                        :src="`https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${provider.voice_service_alias}&size=32`"
                        :alt="`${provider.voice_service} logo`"
                        class="w-4 h-4 flex-shrink-0"
                        @error="$event.target.style.display='none'"
                      />
                      <span class="text-sm font-medium text-gray-200 truncate">{{ provider.voice_service }}</span>
                    </div>
                    <span class="text-[10px] font-mono text-gray-500 mt-0.5 truncate">{{ provider.openRouterOption }}</span>
                  </div>
                </label>

                <div v-if="!openRouterProviders.length" class="text-center text-gray-500 text-sm py-4">
                  No providers support OpenRouter yet.
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex-shrink-0 border-t border-gray-700 px-5 py-3 flex justify-end gap-3 bg-gray-900">
              <button @click="isOpen = false" type="button" class="px-4 py-2 bg-gray-800 text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button @click="save" :disabled="isSaving || !apiKey?.trim()" type="button" class="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {{ isSaving ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* Styled scrollbar matching the dark modal design */
.orqs-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.orqs-scrollbar::-webkit-scrollbar-track {
  background: rgba(148, 163, 184, 0.15);
  border-radius: 10px;
}

.orqs-scrollbar::-webkit-scrollbar-thumb {
  background: #94a3b8;
  border-radius: 10px;
}

.orqs-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}

.orqs-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #94a3b8 rgba(148, 163, 184, 0.15);
}
</style>