<script setup>
import { ref, onMounted, computed, defineAsyncComponent } from 'vue';
import useMyComposable from '../../composables/Composable'
const { pageRoute, localSettingsTab } = useMyComposable();

onMounted(() => {

})

function backToMainMenu(){
    pageRoute.value = '/main-menu'
}


const isShowTitle = ref(true)
const headerTitle = computed (() => (isShowTitle.value)? defineAsyncComponent(() => import("../Shared/HeaderTitle.vue")) : '')
const headerTitleMessage = ref('Settings');

</script>

<template>
    <!-- Fixed height part -->
    <div class='relative flex flex-col justify-center  bg-gray-50 '>
        <div>
            <div class="flex items-center justify-between border-b bg-blue-500 p-3">
                <div @click="backToMainMenu()" class="flex items-center space-x-5 text-gray-100 hover:text-green-300 cursor-pointer" >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15m0 0l6.75 6.75M4.5 12l6.75-6.75" />
                            </svg>
                 
                        </div>
                <div class="flex-1 text-lg font-bold text-gray-100">
                    <component :is="headerTitle"  :title="headerTitleMessage"/>
                </div>
                <div class="flex items-center space-x-5 text-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" 
                    class="h-6 w-6 opacity-0">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15m0 0l6.75 6.75M4.5 12l6.75-6.75" />
                            </svg>
                </div>
            </div>

            <div  class=" bg-gray-50 p-0 border-b  border-gray-200 flex justify-center">
                <nav class="flex sm:flex-row">
                    <a @click="localSettingsTab = 'general'"   
                    :class="{' font-medium active': localSettingsTab === 'general'}"                  
                    class="text-gray-600 py-2 px-4 block hover:text-blue-500 focus:outline-none ease-linear transition-all duration-150 "
                    
                    >
                        General
                    </a>
                    <a @click="localSettingsTab = 'menu'" 
                    :class="{' font-medium active': localSettingsTab === 'menu'}"
                    class="text-gray-600 py-2 px-4 block hover:text-blue-500 focus:outline-none ease-linear transition-all duration-150">
                        Context Menu
                    </a>

                   <a @click="localSettingsTab = 'byok'" 
                    :class="{' font-medium active': localSettingsTab === 'byok'}"
                    class="text-gray-600 py-2 px-4 block hover:text-blue-500 focus:outline-none ease-linear transition-all duration-150">
                        Bring Your Own Key
                    </a>
                </nav>
            </div>
        </div>
    </div> 
</template>

<style scoped>
a {
    border-bottom: 2px solid transparent;
    cursor: pointer;
}
a.active {
    color: rgb(59 130 246);
    border-color: rgb(59 130 246);
    border-bottom-width: 2px;
}
</style>