<script setup>
import { ref, watch, computed, onMounted, defineProps, defineEmits, onUnmounted } from 'vue';
import useMyComposable from '../../composables/Composable';
import { readLocalStorage, isNotEqualToNullorUndefined } from '../../../js/utils/helpers';
const { filterByDomainsList, API_NUXT_DOMAIN, getUserStatus, userProfile } = useMyComposable();
const animateModal = ref(false)
const emit = defineEmits(['close-event']);

const props = defineProps({
    username: String
});

const loading = ref(false);
const username = ref(props.username || "")
const notValidUsername = ref(false);
const usernameExist = ref(true);
onMounted(async () => {
    setTimeout(async () => { animateModal.value = true }, 50);
});

async function update(){
    loading.value = true;
    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN.value}/api/v1/user/change-username`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.value,
        })
    });
    await rawResponse.json();
    await getUserStatus();
    loading.value = false;
    close();  
}

async function autoCheckUsername(){

    const queryParams = new URLSearchParams({
            username: username.value,
    });

    const urlWithParams = `https://${API_NUXT_DOMAIN.value}/api/v1/user/username-check?${queryParams.toString()}`;
    let rawResponse = await fetch(urlWithParams, {
    method: 'GET',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
    });

    const responseData = (await rawResponse.json()); 
    usernameExist.value = responseData.username_exist.username_exist;

}

function close() {
    emit('close-event');
}

function validateUsername() {
    const value = username.value;
    const minLength = 3;
    const maxLength = 20;
    const regex = /^[a-zA-Z0-9._-]+$/;

    if (value === props.username) {
        notValidUsername.value = true;
        return;
    }

    if (value.length < minLength || value.length > maxLength) {
        notValidUsername.value = true;
        return;
    }

    if (!regex.test(value)) {
        notValidUsername.value = true;
        return;
    }

    if (/(\.|_|-)\1/.test(value)) {
        notValidUsername.value = true;
        return;
    }

    if (/^[.-]|[.-]$/.test(value)) {
        notValidUsername.value = true;
        return;
    }

    if (/\s/.test(value)) {
        notValidUsername.value = true;
        return;
    }

    // Ensure it contains letters or numbers
    if (!/[a-zA-Z0-9]/.test(value)) {
        notValidUsername.value = true;
        return;
    }

    // List of reserved words
    const reservedWords = ['admin', 'user', 'root'];
    if (reservedWords.includes(value.toLowerCase())) {
        notValidUsername.value = true;
        return;
    }

    notValidUsername.value = false;

    autoCheckUsername();
}


watch(username, validateUsername, { immediate: true });
</script>

<template>
<div ref="ModalContentHTMLRef" @click="close()" style="z-index:100000" class="fixed flex top-0 left-0 right-0 bottom-0 overflow-y-auto bg-gray-800 bg-opacity-80">
    <div class="flex text-center sm:block items-end justify-end min-h-[100%] min-w-[100%]">
      
      <div class="left-1/2 top-6 -translate-x-1/2 cursor-pointer flex absolute text-gray-400">

        <svg width="30" class="mr-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><path d="M13.414 12l2.829-2.828a1 1 0 1 0-1.415-1.415L12 10.586L9.172 7.757a1 1 0 0 0-1.415 1.415L10.586 12l-2.829 2.828a1 1 0 0 0 1.415 1.415L12 13.414l2.828 2.829a1 1 0 0 0 1.415-1.415L13.414 12zM12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10s-4.477 10-10 10z" fill="currentColor"/></svg>
      </div>

      <div class="bg-gray-500 transition-opacity bg-opacity-75"></div>
      <span class="hidden ">​</span>
      <div 
      :class="{'zoom-fadein':animateModal}"
       class= " h-[90%] inline-block text-left  rounded-lg overflow-hidden align-bottom transition-all transform
          shadow-2xl w-full  modal-content">
          <div class="h-full grid grid-rows-[auto_1fr]">
            <div class="text-white text-center my-5 mx-4 ">
              <h1 v-if="userProfile.username === null" class="text-2xl line-clamp-4">Create your username</h1>
              <h1 v-else class="text-2xl line-clamp-4">Change Username</h1>
              <div v-if="userProfile.username === null" @click.stop="function(){}">Please a pick a username. You may change it later if you need it.</div>
           </div>
            <div   class=" relative overflow-auto scrollbar-thin rounded-xl rounded-b-none  bg-white mx-1">


              <div @click.stop="function(){}" class="chat-answer-html inter-font  text-gray-900 text-left text-base px-6 "
              style="height: -webkit-fill-available;">

                <div class="w-full mt-6">
                    <div class="relative w-full min-w-[200px] h-10">
                        <input
                        @input="validateUsername"
                        v-model="username"
                        class="peer w-full h-full bg-transparent text-blue-gray-700 font-sans font-normal outline outline-0 focus:outline-0 disabled:bg-blue-gray-50 disabled:border-0 transition-all placeholder-shown:border placeholder-shown:border-blue-gray-200 placeholder-shown:border-t-blue-gray-200 border focus:border-2 focus:border-t-transparent text-sm px-3 py-2.5 rounded-[7px] border-blue-gray-200 focus:border-gray-900"
                        placeholder=" " /><label
                        class="flex w-full h-full select-none pointer-events-none absolute left-0 font-normal !overflow-visible truncate peer-placeholder-shown:text-blue-gray-500 leading-tight peer-focus:leading-tight peer-disabled:text-transparent peer-disabled:peer-placeholder-shown:text-blue-gray-500 transition-all -top-1.5 peer-placeholder-shown:text-sm text-[11px] peer-focus:text-[11px] before:content[' '] before:block before:box-border before:w-2.5 before:h-1.5 before:mt-[6.5px] before:mr-1 peer-placeholder-shown:before:border-transparent before:rounded-tl-md before:border-t peer-focus:before:border-t-2 before:border-l peer-focus:before:border-l-2 before:pointer-events-none before:transition-all peer-disabled:before:border-transparent after:content[' '] after:block after:flex-grow after:box-border after:w-2.5 after:h-1.5 after:mt-[6.5px] after:ml-1 peer-placeholder-shown:after:border-transparent after:rounded-tr-md after:border-t peer-focus:after:border-t-2 after:border-r peer-focus:after:border-r-2 after:pointer-events-none after:transition-all peer-disabled:after:border-transparent peer-placeholder-shown:leading-[3.75] text-gray-500 peer-focus:text-gray-900 before:border-blue-gray-200 peer-focus:before:!border-gray-900 after:border-blue-gray-200 peer-focus:after:!border-gray-900">
                        Username
                        </label>
                    </div>
                </div>

                <button
                    @click="update()"
                    :disabled="notValidUsername || usernameExist"
                    class="my-2 w-full select-none rounded-lg bg-amber-500 py-3 px-6 text-center align-middle font-sans text-xs font-bold uppercase text-black shadow-md shadow-amber-500/20 transition-all hover:shadow-lg hover:shadow-amber-500/40 focus:opacity-[0.85] focus:shadow-none active:opacity-[0.85] active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                    type="button"
                >
                    <span v-if="loading">
                        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25"/><path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z"><animateTransform attributeName="transform" type="rotate" dur="0.75s" values="0 12 12;360 12 12" repeatCount="indefinite"/></path></svg>
                    </span>
                    <span v-else>
                        <span v-if="userProfile.username === null">Add</span>

                        <span v-else>
                            Change
                        </span>
                    </span>
                </button>

                <h6 
                v-if="usernameExist && notValidUsername === false"
                class="block mt-3  font-sans text-base antialiased font-semibold leading-relaxed tracking-normal text-red-500">
                    <svg width="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><path d="M13.314 11.9l3.535-3.536a1 1 0 1 0-1.414-1.414l-3.536 3.535L8.364 6.95A1 1 0 1 0 6.95 8.364l3.535 3.535l-3.535 3.536a1 1 0 1 0 1.414 1.414l3.535-3.535l3.536 3.535a1 1 0 1 0 1.414-1.414l-3.535-3.536z" fill="currentColor"/></svg>
                
                    <span>
                        username exists 
                    </span>
                </h6>
                <h6 
                v-if="!usernameExist && notValidUsername === false"
                class="block mt-3  font-sans text-base antialiased font-semibold leading-relaxed tracking-normal text-green-500">
                <svg width="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><path d="M9 19.414l-6.707-6.707l1.414-1.414L9 16.586L20.293 5.293l1.414 1.414z" fill="currentColor"/></svg>                
                    <span>
                        username available 
                    </span>
                </h6>

                    <h6
                        class="block mt-3  font-sans text-base antialiased font-semibold leading-relaxed tracking-normal text-blue-gray-900">
                    username requirements
                    </h6>
                    <ul class="list-item">
                        <li>
                            Username length is between 3 and 20 characters.
                        </li>
                        <li>
                            Allows letters, numbers, underscores (_), hyphens (-)
                        </li>
                        <li>
                            No spaces allowed
                        </li>
                    </ul>
              </div>            
            </div>

          </div>
      </div>


    </div>
  </div>
  </template>

  <style >
 .modal-content {
    transition-property: all;
              transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
              transition-duration: 150ms;
    opacity:0;
    transform:translate scale(0.8);
 }

 .zoom-fadein {
    /* Animation */
    animation: zoomFadeIn 0.25s ease-out forwards;
}

@keyframes zoomFadeIn {
    from {
        opacity: 0;
        transform:scale(0.9) translateY(-40px);
    }
    to {
        opacity: 1;
        bottom:0px;
        transform: scale(1) translateY(0px) ;
    }
}


/* width */
::-webkit-scrollbar {
  width: 10px;
}

/* Track */
::-webkit-scrollbar-track {
  background: #f1f1f1;
}

/* Handle */
::-webkit-scrollbar-thumb {
  background: #888;
}

/* Handle on hover */
::-webkit-scrollbar-thumb:hover {
  background: #555;
}
 </style>
