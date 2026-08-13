<script setup>

import useLocalSettings from '../../composables/useLocalSettings';
import { ref, watch, computed, onMounted,onUnmounted } from 'vue';
import { saveToLocalStorage, readLocalStorage } from '../../../js/utils/helpers';
import { CONSTANTS } from '../../../js/constants/constants.js';
const { 
    getFromStorageQuickAccessControls, 
    quickAccessState,
    quickAccessPanelPlacementState,
    enterKeyPlayState
} = useLocalSettings();

let quickAccessWatch;
let quickAccessPanelPlacementWatch;
let enterKeyPlayWatch;

const hiddenSites = ref([]);
const showHiddenSites = ref(false);

const QUICK_ACCESS_STATE_KEY = CONSTANTS.DOMAIN_QUICK_ACCESS_STATE_KEYNAME;

async function loadHiddenSites() {
  try {
    const storage = await readLocalStorage(['DOMAIN_SETTINGS']);
    const domainSettings = storage.DOMAIN_SETTINGS || {};
    const list = [];
    for (const domain of Object.keys(domainSettings)) {
      if (domainSettings[domain] && domainSettings[domain][QUICK_ACCESS_STATE_KEY] === false) {
        list.push(domain);
      }
    }
    hiddenSites.value = list.sort();
  } catch (error) {
    console.error('Error loading hidden quick access sites:', error);
    hiddenSites.value = [];
  }
}

async function removeHiddenSite(domain) {
  try {
    const storage = await readLocalStorage(['DOMAIN_SETTINGS']);
    const domainSettings = storage.DOMAIN_SETTINGS || {};

    if (domainSettings[domain]) {
      delete domainSettings[domain][QUICK_ACCESS_STATE_KEY];
      if (Object.keys(domainSettings[domain]).length === 0) {
        delete domainSettings[domain];
      }
    }

    await saveToLocalStorage({ 'DOMAIN_SETTINGS': domainSettings }, true);
    chrome.runtime.sendMessage({
      action: "update-contentscript-storage",
      key: 'DOMAIN_SETTINGS',
      value: domainSettings
    });

    hiddenSites.value = hiddenSites.value.filter(d => d !== domain);
  } catch (error) {
    console.error('Error removing hidden quick access site:', error);
  }
}

onMounted(async () => {
    await getFromStorageQuickAccessControls();
    await loadHiddenSites();
    quickAccessWatch = watch(quickAccessState, (newState)=>{ 
        chrome.runtime.sendMessage({ action: "update-contentscript-storage",
            key:'DEFAULT_QUICK_ACCESS_CONTROLS_STATE',
            value:newState
        });
        saveToLocalStorage({'DEFAULT_QUICK_ACCESS_CONTROLS_STATE':newState}, true);
    });

    quickAccessPanelPlacementWatch = watch(quickAccessPanelPlacementState, (newState)=>{ 
        chrome.runtime.sendMessage({ action: "update-contentscript-storage",
            key:'DEFAULT_QUICK_ACCESS_CONTROLS_PANEL_PLACEMENT_STATE',
            value:newState
        });
        saveToLocalStorage({'DEFAULT_QUICK_ACCESS_CONTROLS_PANEL_PLACEMENT_STATE':newState}, true);
    });

    enterKeyPlayWatch = watch(enterKeyPlayState, (newState)=>{ 
        chrome.runtime.sendMessage({ action: "update-contentscript-storage",
            key:'DEFAULT_ENTER_KEY_PLAY_STATE',
            value:newState
        });
        saveToLocalStorage({'DEFAULT_ENTER_KEY_PLAY_STATE':newState}, true);
    });

})

onUnmounted(() => {
    quickAccessWatch();
    quickAccessPanelPlacementWatch();
    enterKeyPlayWatch();
})

const svgPageText = ref(`<svg style="display:inline-block;vertical-align:middle;" class="text-gray-500" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path fill="currentColor" d="M9.5 8.5v7l6-3.5-6-3.5z"/></svg>`)
</script>

<template>
<div class="w-full mx-auto rounded-xl shadow-sm bg-white border border-gray-200 text-gray-800 mb-4">
    
    
    <div class="w-full p-3 border-b border-gray-200 text-left flex items-center justify-center">
        <button class="flex gap-3 justify-center items-center">
            <span class="text-blue-500 block" style="width: 20px; height: 20px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960"><path fill="currentColor" d="m456-200 174-340H510v-220L330-420h126zm24 120q-83 0-156-31.5T197-197t-85.5-127T80-480t31.5-156T197-763t127-85.5T480-880t156 31.5T763-763t85.5 127T880-480t-31.5 156T763-197t-127 85.5T480-80m0-80q134 0 227-93t93-227-93-227-227-93-227 93-93 227 93 227 227 93m0-320"/></svg>
            </span>
            <label class=" text-gray-600 font-semibold text-sm  ml-1">Quick Access controls</label>            
        </button>
    </div>
    <div class="w-full p-3 border-b  border-gray-200 text-left">
        <label class="flex items-center">                                                
            
            <input v-model="quickAccessState" style type="checkbox" id="AutoscrollTextCheckbox">
            <span class=" text-gray-600 font-semibold ml-2 inline-flex items-center gap-1.5"><span v-html="svgPageText"></span>
            <span class="flex h-[19px] items-center"> Show VR-Reader play button</span></span>
        </label>
    </div>

    <div class="w-full p-3 border-b border-gray-200 text-left">
        <label class="flex items-center">                                                
            
            <input v-model="enterKeyPlayState" type="checkbox" id="EnterKeyPlayCheckbox">
            <span class=" text-gray-600 font-semibold ml-2 inline-flex items-center gap-1.5">
<svg xmlns="http://www.w3.org/2000/svg" class="text-gray-500" width="16" height="16" viewBox="0 0 48 48" fill="currentColor"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"><path d="M44 44V4H24v16H4v24h40Z"/><path d="m21 28l-4 4l4 4"/><path d="M34 23v9H17"/></g></svg>
                <span class="flex h-[19px] items-center"> Enable [Enter] to play highlight shortcut</span>
            </span>
        </label>
    </div>

    <div class="w-full p-3  border-gray-200 text-left">
        <label class="">                                                
            <select v-model="quickAccessPanelPlacementState" class="form-select px-1.5 py-2 ml-1.5 border border-gray-200 rounded-md focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer">
                <option value="middle">Middle</option>
                <option value="bottom">Bottom</option>
            </select>
            <span class="text-gray-600 font-semibold ml-2">Play button widget placement</span>
        </label>
    </div>

    <div class="w-full p-3 border-t border-gray-200 text-left">
        <button
            type="button"
            @click="showHiddenSites = !showHiddenSites"
            class="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
        >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            <span>{{ showHiddenSites ? 'Hide hidden sites' : 'Manage hidden sites (' + hiddenSites.length + ')' }}</span>
        </button>

        <div v-if="showHiddenSites" class="mt-3">
            <p class="text-[11px] text-gray-400 mb-2">
                Sites where the VR-Reader play button has been hidden. Remove a site to show the button there again.
            </p>
            <div v-if="hiddenSites.length === 0" class="text-center text-xs text-gray-400 py-4 border border-dashed border-gray-200 rounded-lg">
                No hidden sites.
            </div>
            <div v-else class="space-y-2">
                <div
                    v-for="domain in hiddenSites"
                    :key="domain"
                    class="flex items-center justify-between gap-2 p-2.5 border border-gray-200 rounded-lg bg-gray-50"
                >
                    <span class="text-xs font-mono text-gray-700 truncate">{{ domain }}</span>
                    <button
                        type="button"
                        @click="removeHiddenSite(domain)"
                        class="flex-shrink-0 p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                        :aria-label="'Remove ' + domain"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>


</template>