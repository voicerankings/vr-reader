<script setup>
import { ref, defineEmits, watch, onMounted, computed, defineAsyncComponent } from 'vue';
import { useFocus } from '@vueuse/core'
import useMyComposable from '../../composables/Composable'


import useLangRegionDisplayName from '../../composables/useLangRegionDisplayName';
const { getRegionName, getLangName } = useLangRegionDisplayName();

import FilterVoicesDropMenu from '../Shared/FilterVoicesDropMenu.vue';
import VoiceDefault from './VoiceDefault.vue';
const { pageRoute, getFromStorageVoiceSwitchDefault, voiceSwitchOnPremium, voiceShowFavoritesOn, voiceShowCollectionsOn, 
    voiceFilterOptions,
    voiceFilterOpenTriggerCounter } = useMyComposable();

const showSearch = ref(true);
const searchInput = ref();
const search = ref("");

onMounted(async () => {
    await getFromStorageVoiceSwitchDefault();
    const { focused } = useFocus(searchInput, { initialValue: true });
})

const emit = defineEmits(['custom-event']);

function toggleSearch (){
    showSearch.value = !showSearch.value;

    if(showSearch.value === false){
        search.value = "";
    }
};

function backToMainMenu(){
    pageRoute.value = '/main-menu';
}

watch(search, (newState, oldState)=>{
    emit('custom-event', { search: search });
});

const isShowTitle = ref(true)
const headerTitle = computed (() => (isShowTitle.value)? defineAsyncComponent(() => import("../Shared/HeaderTitle.vue")) : '')

const headerTitleMessage = computed(() => {
    if(voiceShowCollectionsOn.value){
        return 'Voice Collections'
    }else if(voiceShowFavoritesOn.value){
        return 'Favorite Voices'
    }else if(voiceSwitchOnPremium.value){
        return 'Premium Voices'
    }else{
        return 'Free Voices'
    }
});

function openFilter(){
    voiceFilterOpenTriggerCounter.value++;
}

function showFavoriteList(){
    voiceShowFavoritesOn.value = !voiceShowFavoritesOn.value;
    voiceShowCollectionsOn.value = false;
    
    if(voiceShowFavoritesOn.value === true){
        voiceSwitchOnPremium.value = true;
    }
}

function showCollectionsList(){
    voiceShowCollectionsOn.value = !voiceShowCollectionsOn.value;
    voiceShowFavoritesOn.value = false;

    if(voiceShowCollectionsOn.value === true){
        voiceSwitchOnPremium.value = true;
    }
}

</script>

<template>
            <!-- Fixed height part -->
            <div class='relative flex flex-col justify-center bg-gray-50 dark:bg-gray-900 sticky top-0 z-40 min-w-0 w-full'>
                <div class="backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800 shadow-sm transition-colors min-w-0 w-full">
                    <div class="flex items-center justify-between p-3 min-w-0 w-full">
                        <div @click="backToMainMenu()" class="flex items-center space-x-5 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer" >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15m0 0l6.75 6.75M4.5 12l6.75-6.75" />
                            </svg>
                 
                        </div>
                        <div class="text-lg font-semibold text-gray-800 dark:text-gray-100 text-left flex-grow ml-4 tracking-tight">
                            <component :is="headerTitle"  :title="headerTitleMessage"/>
                        </div>
                        <div class="flex items-center space-x-5 text-gray-700 dark:text-gray-300">
                            

                            <div class="flex items-center space-x-5 text-gray-100">
 
                                <div class="flex px-1 text-gray-500 dark:text-gray-400 gap-3 items-center">
                                    <div class="transition-colors">
                                        <FilterVoicesDropMenu v-if="voiceSwitchOnPremium && (!voiceShowFavoritesOn && !voiceShowCollectionsOn)"></FilterVoicesDropMenu>
                                    </div>
                                    <div v-tooltip="{content:'View Favorites'}" @click="showFavoriteList()" class="transition-colors">
                                        <svg :class="voiceShowFavoritesOn ? 'text-red-500' : 'hover:text-red-400'" class="cursor-pointer" height="22" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" />
                                        </svg>
                                    </div>
       
                                    <div v-tooltip="{content:'View Collections'}" @click="showCollectionsList()" class="transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" :class="voiceShowCollectionsOn ? 'text-orange-500' : 'hover:text-orange-400'" width="22" height="22" fill="currentColor" class="cursor-pointer" viewBox="0 0 24 24"><path fill="currentColor" d="M9.113 8.8c.34-.297.744-.526 1.19-.661l.247-.065l.16-.03l.176-.025l.18-.015l.184-.005h7.5a3.25 3.25 0 0 1 3.245 3.065l.005.185v7.5a3.25 3.25 0 0 1-3.066 3.245l-.184.005h-7.5a3.25 3.25 0 0 1-3.245-3.066L8 18.75v-7.5l.017-.339l.062-.377l.059-.223l.08-.236l.087-.202l.082-.162l.094-.163l.146-.217l.094-.123l.135-.156l.108-.112zm6.469-4.567l.052.177l.694 2.588H11.25A4.25 4.25 0 0 0 7 11.249v6.434a3.25 3.25 0 0 1-2.895-2.228l-.052-.176l-1.941-7.245a3.25 3.25 0 0 1 2.12-3.928l.178-.052l7.244-1.941a3.25 3.25 0 0 1 3.928 2.12"/></svg>
                                    </div>
                                </div>


                                
                            </div>

                        </div>
                    </div>

                    <div v-if="showSearch" class=" bg-gray-50 p-2 border-b border-gray-200 min-w-0 w-full">
                        <VoiceDefault></VoiceDefault>
                    </div>
                    <div v-if="voiceSwitchOnPremium && (!voiceShowFavoritesOn && !voiceShowCollectionsOn) " class="bg-gray-50 dark:bg-gray-800 p-2 px-3 border-b border-gray-200 dark:border-gray-700">
                        <div class="flex flex-wrap items-center gap-2">
                            <div class="flex items-center"> 
                                <span @click="openFilter()" v-tooltip="{content:'Change TTS Voice Provider'}" class="capitalize cursor-pointer rounded-full px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-slate-700 dark:text-blue-300 dark:hover:bg-slate-600 font-medium text-xs transition-colors shadow-sm">{{voiceFilterOptions.service || 'All TTS'}}</span>
                            </div>
                            <div class="flex items-center text-gray-400 dark:text-gray-500"> 
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" class="mr-1"><path fill="currentColor" fill-rule="evenodd" d="M9.97 7.47a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 1 1-1.06-1.06L13.44 12L9.97 8.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg> 
                                <span @click="openFilter()" v-tooltip="{content:'Change Gender'}" class="capitalize cursor-pointer rounded-full px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-slate-700 dark:text-blue-300 dark:hover:bg-slate-600 font-medium text-xs transition-colors shadow-sm">{{voiceFilterOptions.gender || 'Both'}}</span>
                            </div>
                            <div class="flex items-center text-gray-400 dark:text-gray-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" class="mr-1"><path fill="currentColor" fill-rule="evenodd" d="M9.97 7.47a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 1 1-1.06-1.06L13.44 12L9.97 8.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg> 
                                <span @click="openFilter()" v-tooltip="{content:'Change Language'}" class="cursor-pointer rounded-full px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-slate-700 dark:text-blue-300 dark:hover:bg-slate-600 font-medium text-xs transition-colors shadow-sm">{{getLangName(voiceFilterOptions.languageCode) || "All"}}</span>
                            </div>
                            <div class="flex items-center text-gray-400 dark:text-gray-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" class="mr-1"><path fill="currentColor" fill-rule="evenodd" d="M9.97 7.47a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 1 1-1.06-1.06L13.44 12L9.97 8.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg> 
                                <span @click="openFilter()" v-tooltip="{content:'Change Country'}" class="cursor-pointer rounded-full px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-slate-700 dark:text-blue-300 dark:hover:bg-slate-600 font-medium text-xs transition-colors shadow-sm">{{getRegionName(voiceFilterOptions.languageCode+"-"+voiceFilterOptions.countryCode) || "All"}}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div> 
</template>

<style scoped>

</style>