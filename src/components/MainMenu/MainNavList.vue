<script setup>
import { ref, onMounted , computed, watch, defineAsyncComponent } from 'vue'

import useMyComposable from '../../composables/Composable'
import SearchVoices from "./SearchVoices.vue";
import ProviderList from "./ProviderList.vue";
import UserStatus from './UserStatus.vue';


const { pageRoute,voiceShowFavoritesOn,voiceShowCollectionsOn, localSettingsTab,
voiceSwitchOnPremium, API_NUXT_DOMAIN, isUserLogged ,userProfile,
getUserStatus, globalSearch } = useMyComposable();

function changeRoute(routeName){
  pageRoute.value = routeName;
}

const isVoicesActive = computed(() => pageRoute.value === '/voices' && !voiceShowFavoritesOn.value && !voiceShowCollectionsOn.value)
const isFavoritesActive = computed(() => pageRoute.value === '/voices' && voiceShowFavoritesOn.value)
const isCollectionsActive = computed(() => pageRoute.value === '/voices' && voiceShowCollectionsOn.value)

function goToVoices(routeName,service){
       voiceShowFavoritesOn.value = false;
       voiceShowCollectionsOn.value = false;
  if(service === "free"){
    voiceSwitchOnPremium.value = false;
  }else if(service === "premium"){   
    voiceSwitchOnPremium.value = true
  }else if(service === 'favorites'){
    voiceShowFavoritesOn.value = true;
    voiceSwitchOnPremium.value = true
  }else if(service === 'collections'){
    voiceShowCollectionsOn.value = true;
        voiceSwitchOnPremium.value = true
  }

  setTimeout(()=>{
    pageRoute.value = routeName;
  }, 200)
}

function navigateToPage(url){
    chrome.runtime.sendMessage({ action: "sameTabNavigateTo", url});
}

onMounted(() => {
       voiceShowFavoritesOn.value = false;
       voiceShowCollectionsOn.value = false;


  getUserStatus()
})


const isShowLoginModal = ref(false);

watch(()=> isUserLogged.value, async(newState)=>{
  if(newState === true && userProfile.value.username === null){
    //openChangeUsernameModal()
  }
});

function close(){
  isShowLoginModal.value = false;
  isShowChangeUsernameComponent.value = false;
}

const buttonOne = ref({});
const modalTitle = ref("");
const modalMessage = ref("");
const isShow = ref(false);
const name = computed (() => isShow.value ? defineAsyncComponent(() => import("../Shared/ModalFull.vue")) : null)


function closeModal(){
  isShow.value = false;
  isShowChangeUsernameComponent.value = false;
}

function gotoPage(url){
    chrome.runtime.sendMessage({ action: "sameTabNavigateTo", url});
}



function gotoSavingsCalculator() {
  chrome.runtime.sendMessage({ action: "navigateTo", url:`https://${API_NUXT_DOMAIN.value}/savings-calculator` });
}
</script>


<template>
<div class="w-full h-screen relative flex flex-col rounded-xl border border-gray-200 bg-[#111827] shadow-md shadow-gray-100 overflow-hidden">
    <div class="overflow-y-auto flex-1 scrollbar-thin bg-[#111827] min-h-0"> 
      <div class="flex flex-col min-h-full px-0 bg-[#111827]  dark:bg-gray-800 dark:border-gray-600">      
        <div class="flex flex-col justify-between flex-1 ">
            <nav class="flex-1 pb-24">    
              <div class="bg-[#142853] min-h-[200px]">

              <SearchVoices></SearchVoices>

                <ProviderList v-if="API_NUXT_DOMAIN"></ProviderList>
                



  </div>


              <div class="mt-4 flex flex-col space-y-1">
                  <div @click="goToVoices('/voices','premium')"
                    :class="isVoicesActive ? 'bg-blue-600/90 text-white shadow-md shadow-blue-500/20' : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'"
                    class="cursor-pointer flex items-center px-4 py-3 mx-3 transition-all duration-300 rounded-xl group">
                    <div class="w-[30px] flex justify-center items-center transition-transform duration-300 group-hover:scale-110" :class="isVoicesActive ? 'text-white' : 'text-blue-400 group-hover:text-blue-300'">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" height="24" viewBox="0 -960 960 960" width="24"><path d="M80-80v-80q46 0 91-6t88-22q-46-23-72.5-66.5T160-349v-91h160v-120h135L324-822l72-36 131 262q20 40-3 78t-68 38h-56v40q0 33-23.5 56.5T320-360h-80v11q0 35 21.5 61.5T316-252l12 3q40 10 45 50t-31 60q-60 33-126.5 46T80-80Zm572-114-57-56q21-21 33-48.5t12-59.5q0-32-12-59.5T595-466l57-57q32 32 50 74.5t18 90.5q0 48-18 90t-50 74ZM765-80l-57-57q43-43 67.5-99.5T800-358q0-66-24.5-122T708-579l57-57q54 54 84.5 125T880-358q0 81-30.5 152.5T765-80Z"/></svg>
                    </div>
                    <span class="mx-3 flex-1 text-left text-[1.05rem] font-medium tracking-wide">Voices</span>
                  </div>

                  <div @click="goToVoices('/voices','favorites')"
                    :class="isFavoritesActive ? 'bg-red-500/90 text-white shadow-md shadow-red-500/20' : (voiceShowFavoritesOn ? 'text-red-400' : 'text-gray-400 hover:bg-white/10 hover:text-gray-200')"
                    class="cursor-pointer flex items-center px-4 py-3 mx-3 transition-all duration-300 rounded-xl group">
                    <div class="w-[30px] flex justify-center items-center transition-transform duration-300 group-hover:scale-110" :class="isFavoritesActive ? 'text-white' : 'text-red-400 group-hover:text-red-300'">
                      <svg height="24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <span class="mx-3 flex-1 text-left text-[1.05rem] font-medium tracking-wide">Favorites</span>
                  </div>

                  <div @click="goToVoices('/voices','collections')"
                    :class="isCollectionsActive ? 'bg-orange-500/90 text-white shadow-md shadow-orange-500/20' : (voiceShowCollectionsOn ? 'text-orange-400' : 'text-gray-400 hover:bg-white/10 hover:text-gray-200')"
                    class="cursor-pointer flex items-center px-4 py-3 mx-3 transition-all duration-300 rounded-xl group">
                    <div class="w-[30px] flex justify-center items-center transition-transform duration-300 group-hover:scale-110" :class="isCollectionsActive ? 'text-white' : 'text-orange-400 group-hover:text-orange-300'">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M9.113 8.8c.34-.297.744-.526 1.19-.661l.247-.065l.16-.03l.176-.025l.18-.015l.184-.005h7.5a3.25 3.25 0 0 1 3.245 3.065l.005.185v7.5a3.25 3.25 0 0 1-3.066 3.245l-.184.005h-7.5a3.25 3.25 0 0 1-3.245-3.066L8 18.75v-7.5l.017-.339l.062-.377l.059-.223l.08-.236l.087-.202l.082-.162l.094-.163l.146-.217l.094-.123l.135-.156l.108-.112zm6.469-4.567l.052.177l.694 2.588H11.25A4.25 4.25 0 0 0 7 11.249v6.434a3.25 3.25 0 0 1-2.895-2.228l-.052-.176l-1.941-7.245a3.25 3.25 0 0 1 2.12-3.928l.178-.052l7.244-1.941a3.25 3.25 0 0 1 3.928 2.12"/>
                      </svg>
                    </div>
                    <span class="mx-3 flex-1 text-left text-[1.05rem] font-medium tracking-wide">Collections</span>
                  </div>

                  <div @click="changeRoute('/read-later')"
                    :class="pageRoute === '/read-later' ? 'bg-teal-500/90 text-white shadow-md shadow-teal-500/20' : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'"
                    class="cursor-pointer flex items-center px-4 py-3 mx-3 transition-all duration-300 rounded-xl group">
                    <div class="w-[30px] flex justify-center items-center transition-transform duration-300 group-hover:scale-110" :class="pageRoute === '/read-later' ? 'text-white' : 'text-teal-400 group-hover:text-teal-300'">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </div>
                    <span class="mx-3 flex-1 text-left text-[1.05rem] font-medium tracking-wide">Read Later</span>
                  </div>
              </div>


            </nav>
        </div>
      </div>
    </div>

    <!-- Footer: restored to absolute bottom position -->
    <div class="w-full justify-evenly items-center mb-0 pb-2 z-100 absolute bottom-0 bg-[#111827]">
       <div class="flex-grow">
        <UserStatus class="text-gray-400"></UserStatus>
       </div>
    </div>
</div>
</template>

<style>

a > div[role="separator"] > span {
  text-decoration: underline;
  text-underline-offset: 4px;
}

  .popup-button {
    display: block;
    text-align: center;
    text-decoration: none;
    font-weight: 800;
    font-size: 1em;

    color: white;
    
    border-radius: 10px;
    margin: 10px;
    padding: 0.5em 1.5em;
    background-size: 200% auto;
    color: white;
    box-shadow: 0 4px 6px rgba(50,50,93,.11), 0 1px 3px rgba(0,0,0,.08);
    background-image: linear-gradient(to right, #895cf2 0%, #3963f0 50%, #895cf2 100%);
    transition: 0.5s;
    cursor:pointer;
  }

  .popup-button:hover {
    background-position: right center;
  } 



</style>