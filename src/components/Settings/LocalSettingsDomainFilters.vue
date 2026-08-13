<script setup>
import { ref, onMounted } from 'vue'
import useMyComposable from '../../composables/Composable'
import LocalSettingsPlaybackFilters from './LocalSettingsPlaybackFilters.vue';
import LocalSettingsCssFilters from './LocalSettingsCssFilters.vue';

const { localSettingsTab } = useMyComposable()
const activeSubTab = ref('playback')
</script>

<template>
  <div class="px-3 md:w-5/12">
    <div class="w-full max-w-lg mx-auto p-4">
      <div class="flex items-center justify-between gap-2 mb-4">
        <div class="flex items-center gap-2 min-w-0">
          <button @click="localSettingsTab = 'general'" class="p-1 rounded hover:bg-gray-100 flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5 text-gray-600">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h2 class="text-base font-semibold text-gray-900 truncate">Custom domain filters</h2>
        </div>
      </div>

      <!-- Sub-tabs: Playback text | CSS selectors -->
      <div class="mb-4 grid grid-cols-2 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl">
        <button
          @click="activeSubTab = 'playback'"
          class="px-3 py-2 text-xs font-semibold rounded-lg transition-colors"
          :class="activeSubTab === 'playback' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'"
        >Playback text</button>
        <button
          @click="activeSubTab = 'css'"
          class="px-3 py-2 text-xs font-semibold rounded-lg transition-colors"
          :class="activeSubTab === 'css' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'"
        >CSS selectors</button>
      </div>

      <p class="text-xs text-slate-500 mb-4 leading-relaxed">
        <strong>Playback text</strong> filters skip or strip spoken sentences/words. <strong>CSS selectors</strong> remove matching page elements (ads, nav, comments…) before the article is read.
      </p>

      <LocalSettingsPlaybackFilters v-if="activeSubTab === 'playback'" />
      <LocalSettingsCssFilters v-else />
    </div>
  </div>
</template>