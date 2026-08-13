<script setup>
import { ref ,computed, onMounted , watch } from 'vue';
import {vOnClickOutside } from '@vueuse/components'
import useMyComposable from '../../../composables/Composable';
import { saveToLocalStorage } from '../../../../js/utils/helpers';
const { getFromStorageVoiceDefaultPayload, voiceDefaultPayload, saveVoiceDefaultOnServer } = useMyComposable();
const isDropdownOpen = ref(false);
let changeSpeed;

onMounted(async () => {
    await getFromStorageVoiceDefaultPayload();

    watch(() => voiceDefaultPayload.value.voice_speed, (newSpeed) => {
        // --- MODIFIED: Add guard clause to prevent saving if not supported ---
        if (!isSpeedChangeSupported.value) return;

        clearTimeout(changeSpeed);
    
        changeSpeed = setTimeout(async() => {
            chrome.storage.local.set({'DEFAULT_PREMIUM_VOICE_SPEED':newSpeed});
            saveToLocalStorage({'DEFAULT_PREMIUM_VOICE_SPEED':newSpeed}, true);

            chrome.runtime.sendMessage({ action: "update-contentscript-storage",
                key:'DEFAULT_PREMIUM_VOICE_SPEED', value:newSpeed    
            });

            saveVoiceDefaultOnServer()
        }, 800);
    });
});

// --- NEW: Computed property to check if the current voice supports speed changes ---
const isSpeedChangeSupported = computed(() => {
  const val = voiceDefaultPayload.value?.voice_has_voice_speed_support;
  return val === true || val === 1;
});

// --- NEW: Computed property to determine the text displayed on the button ---
const speedDisplayText = computed(() => {
    if (!isSpeedChangeSupported.value) {
        return '1.0X';
    }
    const speed = voiceDefaultPayload.value?.voice_speed || 1.0;
    // Use toFixed(1) for cleaner display like 1.0X, 1.2X
    return `${parseFloat(speed).toFixed(1)}X`;
});

function toggleDropdown() {
    isDropdownOpen.value = !isDropdownOpen.value;
}

function closeMenu(){
    isDropdownOpen.value = false;
}
</script>

<template>
    <div class="relative flex">
        <div class="" v-on-click-outside="closeMenu">
            
            <button id="dropdown-button" 
                v-tooltip="{content:'Change Voice Speed'}"
                @click="toggleDropdown()" 
                :class="{'text-blue-500 font-bold':isDropdownOpen}" 
                class="justify-center block relative bg-slate-200 hover:text-blue-500 cursor-pointer border rounded-md p-2"
            >
                <!-- --- MODIFIED: Use the new computed property for the display text --- -->
                {{ speedDisplayText }}
            </button>

            <div v-if="isDropdownOpen" id="dropdown-menu" class="p-4 overflow-hidden z-40 origin-top-left absolute left-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                
                <!-- --- NEW: Message displayed when speed change is not supported --- -->
                <div v-if="!isSpeedChangeSupported" class="p-2 mb-3 text-center text-sm text-gray-700 bg-yellow-100 border border-yellow-200 rounded-md">
                    This voice does not support speed changes.
                </div>

                <div class="text-sm mb-2">Voice speed:</div>
                <input 
                    v-model="voiceDefaultPayload.voice_speed" 
                    class="rounded-lg overflow-hidden appearance-none bg-gray-400 h-3 w-full disabled:bg-gray-200 disabled:cursor-not-allowed" 
                    type="range" 
                    min="0.5" 
                    max="2.0" 
                    step="0.1"
                    :disabled="!isSpeedChangeSupported"
                />    
            </div>
        </div>
    </div>
</template>

<style scoped>
    @media screen and (-webkit-min-device-pixel-ratio: 0) {
        input[type="range"]::-webkit-slider-thumb {
            width: 15px;
            -webkit-appearance: none;
            appearance: none;
            height: 15px;
            cursor: ew-resize;
            background: #FFF;
            box-shadow: -405px 0 0 400px #605E5C;
            border-radius: 50%;
            border: 1px solid #ccc;
        }

        /* --- NEW: Style for the slider thumb when it is disabled --- */
        input[type="range"]:disabled::-webkit-slider-thumb {
            background: #e2e8f0; /* bg-slate-200 */
            cursor: not-allowed;
            box-shadow: -405px 0 0 400px #94a3b8; /* bg-slate-400 */
        }
    }
</style>