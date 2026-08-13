<script setup>
// This starter template is using Vue 3 <script setup> SFCs
// Check out https://vuejs.org/api/sfc-script-setup.html#script-setup
import { ref , watch, onMounted, computed, defineAsyncComponent} from 'vue';
import Toast from "./components/Shared/Toast.vue";


import MainNavList from "./components/MainMenu/MainNavList.vue";
import useMyComposable from './composables/Composable'
import VoicesList from './components/Voices/VoicesList.vue';

import LocalSettings from './components/Settings/LocalSettings.vue';
import ReadLaterList from './components/MainMenu/ReadLaterList.vue';
import UserAccount from './components/Account/UserAccount.vue';


const { 
  isUserLogged,
    pageRoute, 
    API_NUXT_DOMAIN, 
    sidePanelPort, 
    showLoginModalCount,
    showCommunityHelpCount,
    toastData,
    toastTrigger,
} = useMyComposable();

watch(pageRoute, (newState, oldState)=>{

   window.focus();
});

onMounted(() => {
    sidePanelPort();
})

const buttonOne = ref({});
const modalTitle = ref("");
const modalMessage = ref("");


const isShowLoginModalComponent = ref(false);
const loginModalComponent = computed (() => (isShowLoginModalComponent.value && isUserLogged.value === false)? defineAsyncComponent(() => import("./components/Shared/LoginModal.vue")) : null)

const isShowCommunityHelpComponent = ref(false);
const communityHelpComponent = computed (() => isShowCommunityHelpComponent.value ? defineAsyncComponent(() => import("./components/Shared/CommunityHelpModal.vue")) : null)

const isShow = ref(false);
const name = computed (() => isShow.value ? defineAsyncComponent(() => import("./components/Shared/ModalFull.vue")) : null)

watch(()=> showLoginModalCount.value, async(newState)=>{
  isShowLoginModalComponent.value =true
})

watch(()=> showCommunityHelpCount.value, async(newState)=>{
  isShowCommunityHelpComponent.value = true
})


function closeModal(){
  isShow.value = false;
    isShowLoginModalComponent.value = false;
    isShowCommunityHelpComponent.value = false;
}



</script>

<template>
    <Toast
      :trigger="toastTrigger"
      :title="toastData.title"
      :message="toastData.message"
      :icon="toastData.icon"
      :delay="toastData.delay"
      :hideProgressBar="toastData.hideProgressBar"
      :callback="toastData.callback"
    />

    <div v-if="API_NUXT_DOMAIN.length > 0 || pageRoute === '/main-menu'" class="relative main-parent h-screen w-full flex items-center justify-center">
        <component :is="name" 
        @closeEvent="closeModal" 
        :title="modalTitle"
        :message="modalMessage"
        :button-one="buttonOne"/>  

      <component :is="loginModalComponent" 
      @closeEvent="closeModal"/>

      <component :is="communityHelpComponent" 
      @closeEvent="closeModal"/>

            <MainNavList v-if="pageRoute === '/main-menu'" key="3"></MainNavList>
            <VoicesList v-if="pageRoute === '/voices'"></VoicesList>
            <LocalSettings v-if="pageRoute === '/settings'"></LocalSettings>
            <UserAccount v-if="pageRoute === '/account'"></UserAccount>
            <ReadLaterList v-if="pageRoute === '/read-later'"></ReadLaterList>

    </div>
</template>

<style>
body, html {
  margin: 0 !important;
  padding: 0 !important;
  height: 100vh !important;
  width: 100vw !important;
  overflow: hidden !important;
}
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  height: 100%;
  width: 100%;
}

    /* Custom Scrollbar styles */
    .scrollbar-thin::-webkit-scrollbar {
        width: 8px;
    }
    .scrollbar-thin::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
    }
    .scrollbar-thin::-webkit-scrollbar-thumb {
        background-color: rgba(148, 163, 184, 0.5);
        border-radius: 10px;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb:hover {
        background-color: rgba(148, 163, 184, 0.8);
    }
    .scrollbar-thin {
        scrollbar-width: thin;
        scrollbar-color: rgba(148, 163, 184, 0.5) rgba(255, 255, 255, 0.05);
    }

    .inter-font {
        font-family: "Inter","Montserrat", sans-serif;
    }

    .montserrat {
        font-family: "Montserrat", sans-serif;
    }

    .line-clamp-6 {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 6;
    overflow: hidden;
}

.line-clamp-5 {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 4;
        overflow: hidden;
    }
    .line-clamp-4 {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 4;
        overflow: hidden;
    }
    .line-clamp-3 {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
        overflow: hidden;
    }
    .line-clamp-2 {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
    }
</style>
