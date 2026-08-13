<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';

function goToShortcut() {
  chrome.runtime.sendMessage({
    action: "navigateTo",
    url: "chrome://extensions/shortcuts"
  });
}

</script>
<template>
    <!-- keyboars shortcut -->
    <div class="w-full mt-4 mx-auto rounded-xl shadow-sm bg-white border border-gray-200 text-gray-800 mb-4">
      <div class="w-full p-3 border-b border-gray-200 text-left flex items-center justify-center">
        <button class="flex gap-3">
          <span></span>
          <label class="text-gray-600 font-semibold text-sm ml-1">Keyboard shortcuts</label>
        </button>
      </div>

      <div class="flex w-full p-3 border-b border-gray-200 text-left items-center"
      v-tooltip="{html:true, content:'Reading aloud player countrols'}">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M21 3.6v16.8a.6.6 0 0 1-.6.6H3.6a.6.6 0 0 1-.6-.6V3.6a.6.6 0 0 1 .6-.6h16.8a.6.6 0 0 1 .6.6"/><path d="M15.025 8.025h-4.95m4.95 0v4.95m0-4.95l-3.535 3.536c-2.475 2.475 0 4.95 0 4.95"/></g></svg>
        <span class="text-gray-600 font-semibold ml-2">Pause/Stop, Play Next line, Play Previous line</span>
      </div>
      <div v-tooltip="{html:true, content:'Start reading aloud the article/blog text<br> or highlight text and read aloud selected text.'}" 
      class="flex w-full p-3 border-b border-gray-200 text-left items-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M21 3.6v16.8a.6.6 0 0 1-.6.6H3.6a.6.6 0 0 1-.6-.6V3.6a.6.6 0 0 1 .6-.6h16.8a.6.6 0 0 1 .6.6"/><path d="M15.025 8.025h-4.95m4.95 0v4.95m0-4.95l-3.535 3.536c-2.475 2.475 0 4.95 0 4.95"/></g></svg>
        <span class="text-gray-600 font-semibold ml-2">Auto Start Reader</span>
      </div>
      <div class="w-full p-3 text-left">
        <button
          class="w-full text-sm px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          @click="goToShortcut()"
        >
          <svg width="16" class="inline" viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
            <!-- SVG path data -->
          </svg>
          &nbsp; Update shortcuts
        </button>
      </div>
    </div>
</template>