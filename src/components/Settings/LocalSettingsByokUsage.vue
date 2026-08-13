<template>
  <div class="px-3 pb-6">
    <div class="relative flex flex-col bg-white w-full rounded-lg border border-gray-200 mt-3">
      <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 class="font-semibold text-lg text-blueGray-700">Usage by Storage Key</h3>
          <p class="text-sm text-gray-600">Track how many characters you've generated with your local API keys.</p>
        </div>
        <button 
          @click="$emit('close')" 
          class="text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
      </div>

      <div class="p-4">
        <div v-if="isLoading" class="text-center py-4 text-gray-500">
          Loading usage data...
        </div>
        
        <div v-else-if="usageData.length === 0" class="text-center py-4 text-gray-500">
          No active BYOK services found.
        </div>

        <div v-else>
          <div class="flex justify-end mb-4">
            <button 
              @click="resetAllUsage" 
              class="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
            >
              Reset All Usage
            </button>
          </div>

          <div class="space-y-3">
            <div 
              v-for="item in usageData" 
              :key="item.storage_key" 
              class="flex flex-col p-3 border border-gray-200 rounded-lg bg-gray-50/50 hover:bg-white transition-colors"
            >
              <div class="flex justify-between items-start mb-2">
                <div class="flex flex-col flex-1 mr-2 overflow-hidden">
                  <span class="text-sm font-semibold text-gray-800 font-mono">{{ item.storage_key }}</span>
                  <span class="text-xs text-gray-500 mt-1 break-words leading-relaxed">{{ item.voice_service }}</span>
                </div>
                <button 
                  @click="resetUsage(item.storage_key)"
                  class="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-100 transition-colors focus:outline-none whitespace-nowrap shrink-0"
                >
                  Reset
                </button>
              </div>
              <div class="flex items-center justify-between pt-2 border-t border-gray-200/60 mt-1">
                <span class="text-xs text-gray-600 font-medium">Characters Generated</span>
                <span class="text-sm font-bold text-blue-600">{{ formatNumber(item.usage) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { readLocalStorage } from '../../../js/utils/helpers';

const props = defineProps({
  providers: {
    type: Array,
    required: true,
  }
});

defineEmits(['close']);

const isLoading = ref(true);
const usageData = ref([]);

onMounted(async () => {
  await loadUsageData();
});

async function loadUsageData() {
  isLoading.value = true;
  usageData.value = [];

  const groupedProviders = {};
  
  // Get unique storage keys and group voice services
  for (const p of props.providers) {
    if (p.storage_key) {
      if (!groupedProviders[p.storage_key]) {
        groupedProviders[p.storage_key] = [];
      }
      groupedProviders[p.storage_key].push(p.voice_service);
    }
  }

  const storageKeys = Object.keys(groupedProviders);
  const usageKeys = storageKeys.map(key => `BYOK_USAGE_${key}`);
  
  try {
    const storage = await readLocalStorage(usageKeys);
    
    storageKeys.forEach(key => {
      const uKey = `BYOK_USAGE_${key}`;
      const count = storage[uKey] || 0;
      
      usageData.value.push({
        voice_service: groupedProviders[key].join(', '),
        storage_key: key,
        usage: count
      });
    });
    
    // Sort by usage descending
    usageData.value.sort((a, b) => b.usage - a.usage);
  } catch (err) {
    console.error("Error loading BYOK usage data:", err);
  } finally {
    isLoading.value = false;
  }
}

async function resetUsage(storageKey) {
  const uKey = `BYOK_USAGE_${storageKey}`;
  await chrome.storage.local.remove(uKey);
  
  // Update local state without full reload
  const item = usageData.value.find(i => i.storage_key === storageKey);
  if (item) {
    item.usage = 0;
  }
}

async function resetAllUsage() {
  const keysToRemove = usageData.value.map(item => `BYOK_USAGE_${item.storage_key}`);
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
    usageData.value.forEach(item => {
      item.usage = 0;
    });
  }
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
</script>

<style scoped>
/* Scoped styles */
</style>
