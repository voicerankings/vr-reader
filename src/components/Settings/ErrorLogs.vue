<script setup>
import { ref, computed, onMounted } from 'vue';
import useMyComposable from '../../composables/Composable';

const { ttsErrorLogs, loadErrorLogs } = useMyComposable();

const expandedIndex = ref(null);
const debugMode = ref(false);

onMounted(async () => {
    await loadErrorLogs();
    try {
        const result = await chrome.storage.local.get('DEBUG_MODE');
        debugMode.value = result.DEBUG_MODE === true;
    } catch (e) {}
});

async function saveDebugMode() {
    try {
        await chrome.storage.local.set({ DEBUG_MODE: debugMode.value });
    } catch (e) {}
}

function toggleExpand(index) {
    expandedIndex.value = expandedIndex.value === index ? null : index;
}

async function clearLogs() {
    ttsErrorLogs.value = [];
    try {
        await chrome.storage.local.remove('TTS_ERROR_LOGS');
    } catch (e) {}
    expandedIndex.value = null;
}

function formatTime(ts) {
    return new Date(ts).toLocaleString();
}

function formatJson(obj) {
    if (!obj) return 'N/A';
    try {
        return JSON.stringify(obj, null, 2);
    } catch {
        return String(obj);
    }
}

function formatPayload(value) {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'string') return value;
    return formatJson(value);
}

const hasLogs = computed(() => ttsErrorLogs.value.length > 0);
</script>

<template>
    <div class="w-full mt-4">
        <div class="mb-3 p-4 bg-white border border-gray-200 rounded-lg">
            <div class="flex items-center justify-between">
                <div class="pr-4 text-left">
                    <h3 class="text-sm font-medium text-gray-900">Enable Debug Console Logs</h3>
                    <p class="text-xs text-gray-500 mt-1">Turn on console logs, warnings and errors in the browser's DevTools console to help debug issues.</p>
                </div>
                <div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" v-model="debugMode" @change="saveDebugMode" class="sr-only peer">
                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>
        </div>

        <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-700">
                Error Logs
                <span v-if="hasLogs" class="ml-1 text-xs text-gray-400">({{ ttsErrorLogs.length }})</span>
            </h3>
            <button
                v-if="hasLogs"
                @click="clearLogs"
                class="text-xs text-gray-500 hover:text-red-500 transition-colors cursor-pointer"
            >
                Clear all
            </button>
        </div>

        <div v-if="!hasLogs" class="text-center py-6 text-sm text-gray-400">
            <svg class="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            No errors logged yet
        </div>

        <div v-else class="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
            <div
                v-for="(log, index) in ttsErrorLogs"
                :key="index"
                class="border border-gray-200 rounded-lg overflow-hidden bg-white"
            >
                <button
                    @click="toggleExpand(index)"
                    class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors cursor-pointer"
                >
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="flex-shrink-0 w-2 h-2 rounded-full"
                            :class="log.statusCode === 403 ? 'bg-amber-400' : 'bg-red-400'"
                        />
                        <div class="min-w-0">
                            <div class="text-sm font-medium text-gray-800 truncate">{{ log.serviceName }}</div>
                            <div class="text-xs text-gray-500 truncate">{{ log.message }}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span class="text-xs text-gray-400">{{ formatTime(log.timestamp) }}</span>
                        <svg
                            :class="{ 'rotate-180': expandedIndex === index }"
                            class="w-4 h-4 text-gray-400 transition-transform"
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </button>

                <div v-if="expandedIndex === index" class="border-t border-gray-100 bg-gray-50 p-4 space-y-3 text-left">
                    <div v-if="log.request?.url">
                        <div class="text-xs font-semibold text-gray-500 uppercase mb-1.5">API URL</div>
                        <div class="text-xs font-mono text-gray-600 bg-white border border-gray-200 rounded p-2 break-all">{{ log.request.url }}</div>
                    </div>
                    <div>
                        <div class="text-xs font-semibold text-gray-500 uppercase mb-1.5">VRR Request Payload</div>
                        <pre class="text-xs text-gray-700 bg-white border border-gray-200 rounded p-3 overflow-x-auto max-h-[250px] overflow-y-auto whitespace-pre-wrap">{{ formatJson(log.request?.payload) }}</pre>
                    </div>
                    <div v-if="log.request?.requestPayload">
                        <div class="text-xs font-semibold text-gray-500 uppercase mb-1.5">Provider Request Payload</div>
                        <pre class="text-xs text-gray-700 bg-white border border-gray-200 rounded p-3 overflow-x-auto max-h-[250px] overflow-y-auto whitespace-pre-wrap">{{ formatPayload(log.request.requestPayload) }}</pre>
                    </div>
                    <div>
                        <div class="text-xs font-semibold text-gray-500 uppercase mb-1.5">Provider Response Received</div>
                        <pre class="text-xs text-gray-700 bg-white border border-gray-200 rounded p-3 overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap">{{ formatJson(log.response) }}</pre>
                    </div>
                    <div v-if="log.statusCode" class="text-xs text-gray-500">
                        HTTP Status: <span class="font-mono font-medium text-gray-700">{{ log.statusCode }}</span>
                    </div>
                    <div class="text-xs text-gray-400">
                        {{ formatTime(log.timestamp) }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
