<script setup>

import useLocalSettings from '../../composables/useLocalSettings';
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { saveToLocalStorage, readLocalStorage, parsePlacementState } from '../../../js/utils/helpers';
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

const posX = ref(95);
const posY = ref(85);
const canvasRef = ref(null);
const isCanvasDragging = ref(false);

const QUICK_ACCESS_STATE_KEY = CONSTANTS.DOMAIN_QUICK_ACCESS_STATE_KEYNAME;

function syncPosFromState(val) {
    const parsed = parsePlacementState(val);
    posX.value = Math.round(parsed.x);
    posY.value = Math.round(parsed.y);
}

function savePosition(x, y) {
    posX.value = Math.min(Math.max(Math.round(x), 0), 98);
    posY.value = Math.min(Math.max(Math.round(y), 0), 98);
    const placementValue = JSON.stringify({ x: posX.value, y: posY.value });
    quickAccessPanelPlacementState.value = placementValue;
}

function applyPreset(presetX, presetY) {
    savePosition(presetX, presetY);
}

function handleCanvasClickOrDrag(event) {
    if (!canvasRef.value) return;
    const rect = canvasRef.value.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const xPct = (clickX / rect.width) * 100;
    const yPct = (clickY / rect.height) * 100;

    savePosition(xPct, yPct);
}

function onCanvasMouseDown(event) {
    isCanvasDragging.value = true;
    handleCanvasClickOrDrag(event);
    window.addEventListener('mousemove', onCanvasMouseMove);
    window.addEventListener('mouseup', onCanvasMouseUp);
}

function onCanvasMouseMove(event) {
    if (isCanvasDragging.value) {
        handleCanvasClickOrDrag(event);
    }
}

function onCanvasMouseUp() {
    isCanvasDragging.value = false;
    window.removeEventListener('mousemove', onCanvasMouseMove);
    window.removeEventListener('mouseup', onCanvasMouseUp);
}

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
    syncPosFromState(quickAccessPanelPlacementState.value);

    quickAccessWatch = watch(quickAccessState, (newState)=>{ 
        chrome.runtime.sendMessage({ action: "update-contentscript-storage",
            key:'DEFAULT_QUICK_ACCESS_CONTROLS_STATE',
            value:newState
        });
        saveToLocalStorage({'DEFAULT_QUICK_ACCESS_CONTROLS_STATE':newState}, true);
    });

    quickAccessPanelPlacementWatch = watch(quickAccessPanelPlacementState, (newState)=>{ 
        syncPosFromState(newState);
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
    window.removeEventListener('mousemove', onCanvasMouseMove);
    window.removeEventListener('mouseup', onCanvasMouseUp);
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
            <label class=" text-gray-600 font-semibold text-sm ml-1">Quick Access controls</label>            
        </button>
    </div>

    <div class="w-full p-3 border-b border-gray-200 text-left">
        <label class="flex items-center">                                                
            <input v-model="quickAccessState" type="checkbox" id="AutoscrollTextCheckbox">
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

    <!-- Play button widget placement control -->
    <div class="w-full p-3 border-b border-gray-200 text-left">
        <div class="flex items-center justify-between mb-2">
            <span class="text-gray-700 font-semibold text-sm">Play button widget placement</span>
            <span class="text-xs font-mono text-indigo-600 font-medium">X: {{ posX }}% | Y: {{ posY }}%</span>
        </div>

        <!-- Interactive Screen Canvas Preview -->
        <div class="mb-3">
            <p class="text-[11px] text-gray-400 mb-1.5">Click or drag the dot on the screen canvas to position widget:</p>
            <div
                ref="canvasRef"
                @mousedown="onCanvasMouseDown"
                class="relative w-full h-28 bg-gray-900 rounded-lg border border-gray-300 shadow-inner overflow-hidden cursor-crosshair select-none"
            >
                <!-- Mini screen layout grid mockup -->
                <div class="absolute top-2 left-3 right-3 h-2 bg-gray-800 rounded opacity-60"></div>
                <div class="absolute top-6 left-3 w-1/3 h-2.5 bg-gray-800 rounded opacity-40"></div>
                <div class="absolute top-10 left-3 right-3 h-12 bg-gray-800/40 rounded border border-gray-800"></div>

                <!-- Draggable Target Dot -->
                <div
                    class="absolute w-5 h-5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125 flex items-center justify-center pointer-events-none"
                    :style="{ left: posX + '%', top: posY + '%' }"
                >
                    <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
            </div>
        </div>

        <!-- Preset Quick Buttons -->
        <div class="flex flex-wrap gap-1.5 mb-3">
            <button type="button" @click="applyPreset(95, 85)" class="px-2 py-1 text-xs bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 rounded font-medium transition-colors">
                Bottom Right
            </button>
            <button type="button" @click="applyPreset(95, 50)" class="px-2 py-1 text-xs bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 rounded font-medium transition-colors">
                Middle Right
            </button>
            <button type="button" @click="applyPreset(95, 15)" class="px-2 py-1 text-xs bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 rounded font-medium transition-colors">
                Top Right
            </button>
            <button type="button" @click="applyPreset(5, 85)" class="px-2 py-1 text-xs bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 rounded font-medium transition-colors">
                Bottom Left
            </button>
            <button type="button" @click="applyPreset(5, 15)" class="px-2 py-1 text-xs bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 rounded font-medium transition-colors">
                Top Left
            </button>
        </div>

        <!-- Manual Sliders for X and Y % -->
        <div class="space-y-2 pt-1 border-t border-gray-100">
            <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-gray-500 w-24">X (Horizontal):</span>
                <input
                    type="range"
                    min="0"
                    max="98"
                    :value="posX"
                    @input="savePosition($event.target.value, posY)"
                    class="w-full accent-indigo-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg"
                />
                <span class="text-xs font-mono text-gray-600 w-8 text-right">{{ posX }}%</span>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-gray-500 w-24">Y (Vertical):</span>
                <input
                    type="range"
                    min="0"
                    max="98"
                    :value="posY"
                    @input="savePosition(posX, $event.target.value)"
                    class="w-full accent-indigo-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg"
                />
                <span class="text-xs font-mono text-gray-600 w-8 text-right">{{ posY }}%</span>
            </div>
        </div>
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