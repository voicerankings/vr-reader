<script setup>
import { ref, onMounted, computed } from 'vue';
import useMyComposable from '../../composables/Composable';

const { pageRoute, API_NUXT_DOMAIN } = useMyComposable();
const bookmarks = ref([]);
const loading = ref(true);
const filter = ref('active'); // 'active' or 'completed'

onMounted(() => {
    fetchBookmarks();
});

async function fetchBookmarks() {
    loading.value = true;
    try {
        let rawResponse = await fetch(`https://${API_NUXT_DOMAIN.value}/api/v1/user/bookmarks/list`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        });
        const responseData = await rawResponse.json();
        if (responseData && responseData.bookmarks) {
            bookmarks.value = responseData.bookmarks;
        }
    } catch (e) {
        console.error("Error fetching bookmarks", e);
    }
    loading.value = false;
}

const filteredBookmarks = computed(() => {
    if (filter.value === 'active') {
        return bookmarks.value.filter(b => b.status === 'reading' && b.percentage_remaining > 0);
    } else {
        return bookmarks.value.filter(b => b.status === 'completed' || b.percentage_remaining === 0);
    }
});

function getDomain(url) {
    if (!url) return '';
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

async function markAsRead(id, event) {
    event.stopPropagation();
    try {
        let rawResponse = await fetch(`https://${API_NUXT_DOMAIN.value}/api/v1/user/bookmarks/mark-read`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id })
        });
        const responseData = await rawResponse.json();
        if (responseData && responseData.status === 'success') {
            const index = bookmarks.value.findIndex(b => b.id === id);
            if (index !== -1) {
                bookmarks.value[index].status = 'completed';
                bookmarks.value[index].percentage_remaining = 0;
                bookmarks.value[index].current_char_position = bookmarks.value[index].total_chars;
            }
        }
    } catch (e) {
        console.error("Error marking as read", e);
    }
}

async function deleteBookmark(id, event) {
    event.stopPropagation();
    try {
        let rawResponse = await fetch(`https://${API_NUXT_DOMAIN.value}/api/v1/user/bookmarks/delete`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id })
        });
        const responseData = await rawResponse.json();
        if (responseData && responseData.status === 'success') {
            bookmarks.value = bookmarks.value.filter(b => b.id !== id);
        }
    } catch (e) {
        console.error("Error deleting bookmark", e);
    }
}

function openArticle(bookmark) {
    chrome.runtime.sendMessage({ 
        action: "openReadLaterArticle", 
        payload: JSON.parse(JSON.stringify(bookmark))
    });
}
</script>

<template>
    <div class="h-full w-full bg-[#111827] flex flex-col text-white">
        <!-- Header with Back Button -->
        <div class='relative flex flex-col justify-center'>
            <div>
                <div class="flex items-center justify-between border-b border-gray-800 bg-gradient-to-b from-[#1E253A] to-[#111827] p-3">
                    <div @click="pageRoute = '/main-menu'" class="flex items-center space-x-5 text-gray-400 hover:text-white cursor-pointer transition-colors" >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="h-5 w-5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </div>
                    <div class="flex-1 text-lg font-bold text-white text-center tracking-wide">
                        Read Later
                    </div>
                    <div class="flex items-center space-x-5">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="h-5 w-5 opacity-0">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>

        <div class="flex border-b border-gray-700 mx-4">
            <button @click="filter = 'active'" :class="{'text-teal-400 border-teal-400': filter === 'active', 'text-gray-400 border-transparent': filter !== 'active'}" class="flex-1 py-2 text-sm font-medium border-b-2 hover:text-teal-300 transition">Active</button>
            <button @click="filter = 'completed'" :class="{'text-teal-400 border-teal-400': filter === 'completed', 'text-gray-400 border-transparent': filter !== 'completed'}" class="flex-1 py-2 text-sm font-medium border-b-2 hover:text-teal-300 transition">Finished</button>
        </div>

        <div class="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4 pb-20">
            <div v-if="loading" class="text-center text-gray-400 mt-10">
                Loading...
            </div>
            <div v-else-if="filteredBookmarks.length === 0" class="text-center text-gray-500 mt-10 text-sm">
                No items found.
            </div>

            <div v-for="bookmark in filteredBookmarks" :key="bookmark.id" @click="openArticle(bookmark)" class="bg-gray-800 rounded-xl p-3 cursor-pointer hover:bg-gray-700 transition relative flex flex-col shadow-md">
                <div class="flex gap-3">
                    <!-- Thumbnail -->
                    <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-900 border border-gray-700 flex items-center justify-center">
                        <img v-if="bookmark.page_image_url" :src="bookmark.page_image_url" class="w-full h-full object-cover" />
                        <span v-else class="text-gray-500 text-xs">No img</span>
                    </div>

                    <!-- Content -->
                    <div class="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                            <h3 v-tooltip="{ content: bookmark.title || bookmark.url, placement: 'top' }" class="text-sm font-semibold truncate pr-16">{{ bookmark.title || bookmark.url }}</h3>
                            <p v-tooltip="{ content: bookmark.last_read_text, placement: 'top' }" class="text-xs text-gray-400 italic line-clamp-2 mt-1 pr-16">"...{{ bookmark.last_read_text }}..."</p>
                        </div>
                    </div>
                </div>

                <div class="absolute top-3 right-3 flex space-x-1">
                    <!-- Checkmark -->
                    <button v-if="filter === 'active'" @click="markAsRead(bookmark.id, $event)" class="text-gray-400 hover:text-green-400 bg-gray-900/50 rounded-full p-1 transition" title="Mark as Finished">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20 6L9 17l-5-5"></path>
                        </svg>
                    </button>
                    <!-- Delete -->
                    <button @click="deleteBookmark(bookmark.id, $event)" class="text-gray-400 hover:text-red-400 bg-gray-900/50 rounded-full p-1 transition" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                    </button>
                </div>

                <!-- Progress Bar -->
                <div class="mt-3 w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
                    <div class="bg-teal-500 h-1.5" :style="{ width: Math.max(0, 100 - bookmark.percentage_remaining) + '%' }"></div>
                </div>
                <div class="flex justify-between items-center mt-1">
                    <div class="text-[10px] text-gray-500">
                        {{ getDomain(bookmark.url) }}
                    </div>
                    <div class="text-[10px] text-gray-400">
                        {{ Math.max(0, 100 - bookmark.percentage_remaining) }}% Read
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
