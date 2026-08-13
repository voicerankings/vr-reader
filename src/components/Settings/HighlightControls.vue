<script setup>
import useLocalSettings from '../../composables/useLocalSettings';
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { saveToLocalStorage } from '../../../js/utils/helpers';

const { 
    getFromStorageHighlightOptions, 
    highlightState, 
    autoscrollState, 
    autoReadTitleState,
    highlightModeState,
    highlightThemeState // ✅ NEW: Import theme state
} = useLocalSettings();

let highlightWatch, autoscrollWatch, autoReadTitleWatch, highlightModeWatch, highlightThemeWatch;

onMounted(async () => {
    await getFromStorageHighlightOptions();
    
    highlightWatch = watch(highlightState, (newState) => { 
        chrome.runtime.sendMessage({ 
            action: "update-contentscript-storage",
            key: 'DEFAULT_HIGHLIGHT_READING_STATE',
            value: newState
        });
        saveToLocalStorage({'DEFAULT_HIGHLIGHT_READING_STATE': newState}, true);
    });

    autoscrollWatch = watch(autoscrollState, (newState) => { 
        chrome.runtime.sendMessage({ 
            action: "update-contentscript-storage",
            key: 'DEFAULT_AUTOSCROLL_READING_STATE',
            value: newState
        });
        saveToLocalStorage({'DEFAULT_AUTOSCROLL_READING_STATE': newState}, true);
    });

    autoReadTitleWatch = watch(autoReadTitleState, (newState) => { 
        chrome.runtime.sendMessage({ 
            action: "update-contentscript-storage",
            key: 'DEFAULT_AUTO_READ_TITLE_STATE',
            value: newState
        });
        saveToLocalStorage({'DEFAULT_AUTO_READ_TITLE_STATE': newState}, true);
    });

    highlightModeWatch = watch(highlightModeState, (newState) => { 
        chrome.runtime.sendMessage({ 
            action: "update-contentscript-storage",
            key: 'DEFAULT_HIGHLIGHT_MODE_STATE',
            value: newState
        });
        saveToLocalStorage({'DEFAULT_HIGHLIGHT_MODE_STATE': newState}, true);
    });

    // ✅ NEW: Watch highlight theme
    highlightThemeWatch = watch(highlightThemeState, (newState) => { 
        chrome.runtime.sendMessage({ 
            action: "update-contentscript-storage",
            key: 'DEFAULT_HIGHLIGHT_THEME_STATE',
            value: newState
        });
        saveToLocalStorage({'DEFAULT_HIGHLIGHT_THEME_STATE': newState}, true);
    });
});

onUnmounted(() => {
    highlightWatch();
    autoscrollWatch();
    autoReadTitleWatch();
    highlightModeWatch();
    highlightThemeWatch();
});
</script>

<template>
<div class="w-full mx-auto rounded-xl shadow-sm bg-white border border-gray-200 text-gray-800 mb-4">
    <div class="w-full p-3 border-b border-gray-200 text-left flex items-center justify-center">
        <button class="flex gap-3">
            <label class="text-gray-600 font-semibold text-sm ml-1">Reader controls</label>            
        </button>
    </div>
    
    <div class="w-full p-3 border-b border-gray-200 text-left">
        <label class="flex items-center">                                                
            <input v-model="autoscrollState" type="checkbox" id="AutoscrollTextCheckbox">
            <span class="text-gray-600 font-semibold ml-2">Autoscroll to line being read aloud</span>
        </label>
    </div>
    
    <div class="w-full p-3 text-left border-b">
        <label class="flex items-center">                                                            
            <input v-model="highlightState" type="checkbox" id="HighlightTextCheckbox">
            <span class="text-gray-600 font-semibold ml-2">Highlight text being read aloud</span>
        </label>
    </div>

    <!-- Highlight Options Container -->
    <div v-if="highlightState" class="w-full p-3 pl-8 text-left border-b bg-gray-50">
        
        <!-- 1. Mode Options -->
        <div class="space-y-3 mb-4">
            <p class="text-gray-600 font-semibold mb-3">Highlight style:</p>
            
            <label class="flex items-start cursor-pointer">
                <input 
                    type="radio" 
                    value="smooth" 
                    v-model="highlightModeState" 
                    name="highlightMode"
                    class="mt-1"
                >
                <div class="ml-3">
                    <span class="text-gray-700 font-medium">Smooth (word-by-word)</span>
                    <p class="text-xs text-gray-500 mt-1">
                        Animated highlight bar flows across each word <span class="italic">*if provider supports it</span>
                    </p>
                </div>
            </label>
            
            <label class="flex items-start cursor-pointer">
                <input 
                    type="radio" 
                    value="instant" 
                    v-model="highlightModeState" 
                    name="highlightMode"
                    class="mt-1"
                >
                <div class="ml-3">
                    <span class="text-gray-700 font-medium">Instant (word-by-word)</span>
                    <p class="text-xs text-gray-500 mt-1">
                        Each word highlights instantly as spoken <span class="italic">*if provider supports it</span>
                    </p>
                </div>
            </label>
            
            <label class="flex items-start cursor-pointer">
                <input 
                    type="radio" 
                    value="sentence" 
                    v-model="highlightModeState" 
                    name="highlightMode"
                    class="mt-1"
                >
                <div class="ml-3">
                    <span class="text-gray-700 font-medium">Full sentence</span>
                    <p class="text-xs text-gray-500 mt-1">
                        Entire sentence highlights at once (best performance)
                    </p>
                </div>
            </label>
        </div>

        <!-- Divider -->
        <div class="w-full border-t border-gray-200 my-3"></div>

        <!-- 2. ✅ NEW: Theme Options -->
        <div class="space-y-3">
            <p class="text-gray-600 font-semibold mb-3">Highlight Theme:</p>
            
            <label class="flex items-center cursor-pointer">
                <input 
                    type="radio" 
                    value="auto" 
                    v-model="highlightThemeState" 
                    name="highlightTheme"
                >
                <span class="ml-3 text-gray-700 font-medium">Auto (Browser default)</span>
            </label>
            
            <label class="flex items-center cursor-pointer">
                <input 
                    type="radio" 
                    value="light" 
                    v-model="highlightThemeState" 
                    name="highlightTheme"
                >
                <span class="ml-3 text-gray-700 font-medium">Light Mode</span>
            </label>
            
            <label class="flex items-center cursor-pointer">
                <input 
                    type="radio" 
                    value="dark" 
                    v-model="highlightThemeState" 
                    name="highlightTheme"
                >
                <span class="ml-3 text-gray-700 font-medium">Dark Mode</span>
            </label>
        </div>

    </div>

    <div class="w-full p-3 border-gray-200 text-left">
        <label class="flex items-center">                                                
            <input v-model="autoReadTitleState" type="checkbox" id="AutoReadTitleCheckbox">
            <span class="text-gray-600 font-semibold ml-2">Read article/blog title</span>
        </label>
    </div>
</div>
</template>