<script setup>
import PageLayout from '../Shared/PageLayout.vue';
import PageHeader from '../Shared/PageHeader.vue';

import useMyComposable from '../../composables/Composable';
import { ref, watch, computed , defineAsyncComponent} from 'vue';
import { readLocalStorage, saveToLocalStorage } from '../../../js/utils/helpers';

const { sortByDomainsList, pageRoute, API_NUXT_DOMAIN, isUserLogged, userProfile,getUserStatus } = useMyComposable();

const loading = ref(false);

watch(isUserLogged, (newState, oldState)=>{
  if(newState){
    
  }
});

async function clearHistoryAction(){

    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN.value}/api/v1/user/chat-history`, {
        method: 'DELETE',
        headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        }
    });
    const responseData = (await rawResponse.json()); 

    if(!responseData.data) return false;

    if(responseData.data.success){
        deleteAccountSuccessful()
    }
}

function deleteAccountOrUnsubscribeModal(){
    buttonOne.value = {
        text:'Delete Account Permanently',
        classes:'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        click:()=>{
            clearHistoryAction()
            closeModal()
        }
    }

    buttonTwo.value = {
        text:'Cancel',
        classes:'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-400',
        click:()=>{
            closeModal()
        }
    }

    disableClose.value = false
    modalTitle.value = `<span class="font-extrabold text-transparent text-2xl bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 ">Delete My Account</span>`;
    modalMessage.value = `<p class="text-sm text-gray-500 mt-3">Are you sure? All of your saved preferences and account data will be permanently deleted.</p>`;
    isShow.value = true;
}

function resetAccountSettingsModal(){
    
    buttonOne.value = {
        text:'Reset all settings',
        classes:'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        click:async()=>{
            await saveToLocalStorage({RESET_ACCOUNT_SETTINGS:1})
            closeModal()
        }
    }
    buttonTwo.value = {
        text:'Close',
        classes:'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        click:()=>{
            closeModal()
        }
    }
    disableClose.value = false
    modalTitle.value = `Reset account settings?`;
    modalMessage.value = `All settings will be restored to the default settings.`;
    isShow.value = true;
}


function deleteAccountSuccessful(){
    
    buttonOne.value = {
        text:'Close',
        classes:'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        click:()=>{
            closeModal()
        }
    }
    buttonTwo.value = {}
    disableClose.value = true
    modalTitle.value = `Account deleted`;
    modalMessage.value = `All of your data has been removed and your account has been permanently deleted.<br><br>`;
    isShow.value = true;
}

const buttonOne = ref({});
const buttonTwo = ref({});
const modalTitle = ref("");
const modalMessage = ref("");
const disableClose = ref(false);
const isShow = ref(false);
const name = computed (() => isShow.value ? defineAsyncComponent(() => import("../Shared/ModalFull.vue")) : '')

function closeModal(){
  isShow.value = false;
  isShowChangeUsernameComponent.value = false;
}

function openChangeUsernameModal(){
    isShowChangeUsernameComponent.value = true;
}
const isShowChangeUsernameComponent = ref(false);
const changeUsernameComponent = computed (() => (isShowChangeUsernameComponent.value)? defineAsyncComponent(() => import("../Shared/ChangeUsernameModal.vue")) : '')

</script>
<template>
  <PageLayout variant="gray">
    <template #header>
      <PageHeader title="My Account" variant="gray" />
    </template>
    <div class="overflow-y-auto scrollbar-thin relative h-full">
        
        <component :is="name"
        @closeEvent="closeModal"
        :disable-close="disableClose"
        :title="modalTitle"
        :message="modalMessage"
        :button-one="buttonOne"
        :button-two="buttonTwo"/>

    <component :is="changeUsernameComponent"
    :username="userProfile.username"
      @closeEvent="closeModal"/>

      <div class="w-full">
        <div class="flex flex-col px-4 bg-slate-100  dark:bg-gray-800 dark:border-gray-600">






        <div class="w-full mx-auto rounded-lg bg-white border border-gray-200 text-gray-800 font-light mb-6">
            <div class="w-full p-3 border-b border-gray-200 text-left flex items-center justify-center">
                <div class="flex gap-3">
                    <span>
                        <svg width="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g fill="none"><path d="M12 11a4 4 0 1 1 0-8a4 4 0 0 1 0 8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="il-md-length-40 il-md-duration-3 il-md-delay-2"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="il-md-length-25 il-md-duration-2 il-md-delay-0"/></g></svg>
                        </span>
                    <label class="text-gray-600 font-semibold text-sm  ml-1">Username</label>
                </div>
            </div>
            
            <div class="w-full p-3 border-b border-gray-200 text-left">
                <button disabled
                        class="middle font-semibold text-sm w-full h-full space-x-2 center rounded  px-6 font-sans  disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                >{{userProfile.username || 'no username selected'}}</button>
            </div>

            <div class="w-full p-3 border-b border-gray-200 text-left">
                <button @click="openChangeUsernameModal()"
                        class="middle font-semibold text-sm w-full h-full space-x-2 center rounded  px-6 font-sans   text-pink-500 transition-all hover:bg-pink-500/10 active:bg-pink-500/30 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                >Change username</button>
            </div>


        </div>



        <div class="w-full mx-auto rounded-lg bg-white border border-gray-200 text-gray-800 font-light mb-6">
            <div class="w-full p-3 border-b border-gray-200 text-left">
                <button @click="resetAccountSettingsModal()"
                        v-tooltip="{html:true,'content':'This will reset all account settings to default. <br>(This does not delete any chat history)'}"
                        class="middle font-semibold text-sm w-full h-full space-x-2 center rounded  px-6 font-sans   text-pink-500 transition-all hover:bg-pink-500/10 active:bg-pink-500/30 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                >Reset account settings</button>
            </div>
            <div class="w-full p-3 border-b border-gray-200 text-left">
                <button @click="deleteAccountOrUnsubscribeModal()"
                        class="middle font-semibold text-sm w-full h-full space-x-2 center rounded  px-6 font-sans   text-pink-500 transition-all hover:bg-pink-500/10 active:bg-pink-500/30 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                >Delete account</button>
            </div>
        </div>


        </div>
      </div>
    </div>
  </PageLayout>
</template>
