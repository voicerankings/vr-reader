<script setup>
import { ref, onMounted, computed, watch, defineProps } from 'vue';
import useLangRegionDisplayName from '../../composables/useLangRegionDisplayName';
import useMyComposable from '../../composables/Composable'
const { triggerLoginPopup, pageRoute, localSettingsTab, isUserLogged, userProfile, API_NUXT_DOMAIN, APP_WS_DOMAIN, getUserStatus } = useMyComposable();
const { getFromStorageVoiceDefaultPayload, voiceDefaultPayload, resetLoginStep } = useMyComposable();

const props = defineProps({
  hideBottomRow: {
    type: Boolean,
    default: false
  }
});

function changeRoute(routeName){
  pageRoute.value = routeName;
}

const loginStep = ref(0);
const logoutStep = ref(0);

onMounted(async() => {
    await getFromStorageVoiceDefaultPayload();
    updateDisplayLangRegion()
})

let popupWindow;
let socket;

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

watch(() => isUserLogged.value, async (newName, prevName) => {
    if(newName){
        await getFromStorageVoiceDefaultPayload();
        updateDisplayLangRegion()
    }
});

watch(() => resetLoginStep.value, async (newName, prevName) => {
    if(newName){
        loginStep.value = 0;
        logoutStep.value = 0;
    }
});

const favIconURL = computed(() => {
    if(voiceDefaultPayload.value.voice_gender === "female"){
        return `https://cdn.soundranks.com/images/female.png`
    }else if(voiceDefaultPayload.value.voice_gender === "male"){
        return `https://cdn.soundranks.com/images/male.png`
    }else{
        return `https://cdn.soundranks.com/icons/user.png`;
    }
});

const noImageAbbr = computed(() => {
    if(userProfile.value){
        return userProfile.value.user_email.substring(0,2)
    }else{
        return '--'
    }
});

const { getRegionName, getLangName } = useLangRegionDisplayName();
const langCode = ref("");
const regionCode = ref("");

function updateDisplayLangRegion(){
    let languageCode = voiceDefaultPayload.value.voice_language_code 
    if(languageCode){
        langCode.value = getLangName(voiceDefaultPayload.value.voice_language_code);
        regionCode.value = getRegionName(voiceDefaultPayload.value.voice_language_code) 
    }else{
        langCode.value = "";
        regionCode.value = "";
    }  
}

watch(() => triggerLoginPopup.value, () => {
    openSignInWindow();
});

function openLoginPopupWindow(url){
    chrome.runtime.sendMessage({ action: "createWindow", url});
}

function closePopupWindow(url){
    chrome.runtime.sendMessage({ action: "closeWindow"});
}

function openSignInWindow(){
    socket = new WebSocket(`wss://${APP_WS_DOMAIN.value}/`);
    loginStep.value = 1;
    socket.addEventListener('open', (event) => {
        loginStep.value = 2;
    });

    socket.addEventListener('message', (event) => {
        const data = JSON.parse(event.data)
        if(data.action == "Your Connection ID"){
            loginStep.value = 3;
            openLoginPopupWindow(`https://${API_NUXT_DOMAIN.value}/api/v1/login?state=${data.connectionId}`)
        }else if(data.action === "login-complete"){
            setTimeout(async()=>{
                await getUserStatus();
                if(isUserLogged.value){
                    loginStep.value = 4;
                    chrome.runtime.sendMessage({ action: "update-contentscript-user-logged-in" });
                }
                closePopupWindow()
            }, 2500)            
        }
    });

    socket.addEventListener('close', () => {
    });
}

function openLogoutWindow(){    
    socket = new WebSocket(`wss://${APP_WS_DOMAIN.value}/`);
    logoutStep.value = 1;
    socket.addEventListener('open', (event) => {});

    socket.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);

        if(data.action == "Your Connection ID"){
            openLoginPopupWindow(`https://${API_NUXT_DOMAIN.value}/api/v1/logout?source=extension&connectionId=${data.connectionId}`)
        }else if(data.action === "logout-complete"){
            loginStep.value = 0;
            logoutStep.value = 0;
            setTimeout(async()=>{
                await getUserStatus();
                chrome.runtime.sendMessage({ action: "update-contentscript-user-logged-in" });
                closePopupWindow();
            }, 2500)            
        }
    });

    socket.addEventListener('close', () => {
    });
}

function goToPage(url){
    chrome.runtime.sendMessage({ action: "navigateTo", url});       
}




const newPackLoading = ref(false);

function goToAddKey() {
    localSettingsTab.value = 'byok';
    changeRoute("/settings");
}


</script>

<template>
    <!-- Account Menu -->
    <div class="flex flex-col space-y-3 justify-center">
        
        <!-- Not Logged In View -->
        <div v-if="!isUserLogged" class="space-y-3">
            <!-- Sign In Button -->
            <div class="w-full overflow-hidden relative border-gray-500 rounded-md mx-0 my-0 p-0 flex justify-center items-center">
                <button @click="openSignInWindow()" class="w-full relative flex items-center space-x-2 rounded py-1 px-3 shadow-md hover:bg-[#2A2D3A] hover:text-white cursor-pointer">
                    <svg v-if="loginStep === 0" width="36" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                        <path d="M16 4C10.422 4 5.742 7.832 4.406 13H6.47C7.746 8.945 11.53 6 16 6c5.516 0 10 4.484 10 10s-4.484 10-10 10c-4.469 0-8.254-2.945-9.531-7H4.406c1.336 5.168 6.016 9 11.594 9c6.617 0 12-5.383 12-12S22.617 4 16 4zm-.656 7.281l-1.438 1.438L16.187 15H4v2h12.188l-2.282 2.281l1.438 1.438l4-4L20.03 16l-.687-.719z" fill="currentColor"/>
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" version="1.0" width="28px" height="28px" viewBox="0 0 128 128">
                        <path fill="#000000" d="M64.4 16a49 49 0 0 0-50 48 51 51 0 0 0 50 52.2 53 53 0 0 0 54-52c-.7-48-45-55.7-45-55.7s45.3 3.8 49 55.6c.8 32-24.8 59.5-58 60.2-33 .8-61.4-25.7-62-60C1.3 29.8 28.8.6 64.3 0c0 0 8.5 0 8.7 8.4 0 8-8.6 7.6-8.6 7.6z">
                            <animateTransform attributeName="transform" type="rotate" from="0 64 64" to="360 64 64" dur="1400ms" repeatCount="indefinite"/>
                        </path>
                    </svg>
                    <span class="font-bold">
                        <span v-if="loginStep === 0">Sign in</span>
                        <span v-else>pending complete sign in...</span>
                    </span>
                </button>
            </div>

            <!-- Guest Mode & Settings Row -->
            <div v-if="!hideBottomRow" class="flex items-center justify-center space-x-2 border-t border-gray-700 pt-3">
                <!-- Guest Mode Button with Tooltip -->
                <VMenu :distance="5">
                    <div class="cursor-pointer flex items-center px-3 py-1.5 text-sm text-gray-400 hover:bg-[#2A2D3A] hover:text-white rounded transition-colors">
                        <svg class="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
                        </svg>
                        Guest
                    </div>
                    <template #popper>
                        <div class="p-4 m-2 w-72 space-y-2">
                            <h4 class="font-semibold text-sm text-gray-700">Guest Mode</h4>
                            <p class="text-sm text-gray-600">You are using the extension as a guest. BYOK is completely free with no usage limits for all users.</p>
                            <p class="text-sm text-purple-600 font-medium mt-3">Sign in to unlock:</p>
                            <ul class="text-sm text-gray-600 space-y-1 list-disc list-inside">
                                <li>Access to premium voice options</li>
                                <li>Save favorites & voice collections</li>
                                <li>Save reading progress & share audios</li>
                            </ul>
                        </div>
                    </template>
                </VMenu>

                <span class="text-gray-600">|</span>

                <!-- Settings Button -->
                <div @click="changeRoute('/settings')" class="cursor-pointer flex items-center px-3 py-1.5 text-sm text-gray-400 hover:bg-[#2A2D3A] hover:text-white rounded transition-colors">
                    <svg class="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15Z" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Settings
                </div>
            </div>
        </div>

        <!-- Logged In View -->
        <div v-if="isUserLogged" class="space-y-3">


            <!-- User Profile & Settings Row -->
            <div v-if="!hideBottomRow" class="flex items-center justify-center space-x-2 border-t border-gray-700 pt-3">
                <!-- User Profile Menu -->
                <VMenu :distance="5">
                    <div class="cursor-pointer flex items-center px-3 py-1.5 text-sm text-gray-400 hover:bg-[#2A2D3A] hover:text-white rounded transition-colors">
                        <span class="w-5 h-5 border rounded-full overflow-hidden bg-slate-500 text-white flex items-center justify-center mr-1.5 text-xs">
                            {{ noImageAbbr }}
                        </span>
                        {{ userProfile.user_email }}
                    </div>
                    <template #popper>
                        <div class="p-4 m-2 w-64">
                            <!-- User Profile Header -->
                            <div class="flex items-center mb-4">
                                <span class="w-8 h-8 border rounded-full overflow-hidden bg-slate-500 text-white flex items-center justify-center">
                                    <span class="text-lg font-medium capitalize">{{ noImageAbbr }}</span>
                                </span>
                                <div class="ml-3">
                                    <h4 class="text-sm font-bold">{{ userProfile.username || "(no username selected)" }}</h4>
                                    <p class="text-xs text-gray-500">{{ userProfile.user_email }}</p>
                                </div>
                            </div>

                            <!-- Account Navigation -->
                            <div class="space-y-1">
                                <div 
                                    @click="changeRoute('/account')"
                                    class="cursor-pointer flex items-center px-4 py-2 text-gray-600 transition-colors duration-200 transform rounded-md dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 dark:hover:text-gray-200 hover:text-gray-700"
                                >
                                    <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 11a4 4 0 1 1 0-8a4 4 0 0 1 0 8z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                        <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                    </svg>
                                    <span>Account</span>
                                </div>

                                <div 
                                    @click="openLogoutWindow()"
                                    class="cursor-pointer flex items-center px-4 py-2 text-gray-600 transition-colors duration-200 transform rounded-md dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 dark:hover:text-gray-200 hover:text-gray-700"
                                >
                                    <svg v-if="logoutStep === 0" class="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none">
                                        <path d="M20.5 15.1a1 1 0 0 0-1.34.45A8 8 0 1 1 12 4a7.93 7.93 0 0 1 7.16 4.45a1 1 0 0 0 1.8-.9a10 10 0 1 0 0 8.9a1 1 0 0 0-.46-1.35zM21 11h-9.59l2.3-2.29a1 1 0 1 0-1.42-1.42l-4 4a1 1 0 0 0-.21.33a1 1 0 0 0 0 .76a1 1 0 0 0 .21.33l4 4a1 1 0 0 0 1.42 0a1 1 0 0 0 0-1.42L11.41 13H21a1 1 0 0 0 0-2z" fill="currentColor"/>
                                    </svg>
                                    <svg v-else class="w-5 h-5 mr-2" viewBox="0 0 128 128">
                                        <path fill="currentColor" d="M64.4 16a49 49 0 0 0-50 48 51 51 0 0 0 50 52.2 53 53 0 0 0 54-52c-.7-48-45-55.7-45-55.7s45.3 3.8 49 55.6c.8 32-24.8 59.5-58 60.2-33 .8-61.4-25.7-62-60C1.3 29.8 28.8.6 64.3 0c0 0 8.5 0 8.7 8.4 0 8-8.6 7.6-8.6 7.6z">
                                            <animateTransform attributeName="transform" type="rotate" from="0 64 64" to="360 64 64" dur="1400ms" repeatCount="indefinite"/>
                                        </path>
                                    </svg>
                                    <span>{{ logoutStep === 1 ? 'Logging out...' : 'Logout' }}</span>
                                </div>
                            </div>
                        </div>
                    </template>
                </VMenu>

                <span class="text-gray-600">|</span>

                <!-- Settings Button -->
                <div @click="changeRoute('/settings')" class="cursor-pointer flex items-center px-3 py-1.5 text-sm text-gray-400 hover:bg-[#2A2D3A] hover:text-white rounded transition-colors">
                    <svg class="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none">
                        <path d="M12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15Z" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Settings
            </div>
        </div>
    </div>
</div>
</template>
<style scoped>
.bg-animation{
    position: absolute;
    width: 100%;
    height: 100%;
    z-index: 0;
}
    
.bg-animation > div{
    will-change: opacity;
    position: absolute;
    width: 200%;
    height: 200%;
    z-index: 0;
}

.bg-2{
    background: linear-gradient(300deg, #f9c3f5 60%, #9bdaff 100%);
}

.bg-3{
    background: linear-gradient(10deg, #bab2fc 60%, #9bdaff 100%);
}
</style>