<script setup>
import { ref, watch, computed, onMounted, defineProps, defineEmits } from 'vue';

const emit = defineEmits(['close-event'])
const props = defineProps({
    disableClose:Boolean,
    title:String,
    message:String,
    buttonOne:Object,
    buttonTwo:Object,
    buttonThree:Object,
});

const loading = ref(false);

const animateModal = ref(false)

onMounted(() => {
    setTimeout(() => {
        animateModal.value = true;
    }, 50);
})
async function buttonOneAction(){
  loading.value = true;
  await props.buttonOne.click()
}
function close(){
  if(props.disableClose) return false
    emit('close-event');
}
</script>

<template>
  <div @click="close()" class="fixed cursor-pointer" style="z-index:1000000;top:30px;right:40px;">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
<path opacity="0.5" d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" fill="#FFFFFF"/>
<path d="M8.96967 8.96967C9.26256 8.67678 9.73744 8.67678 10.0303 8.96967L12 10.9394L13.9697 8.96969C14.2626 8.6768 14.7374 8.6768 15.0303 8.96969C15.3232 9.26258 15.3232 9.73746 15.0303 10.0304L13.0607 12L15.0303 13.9696C15.3232 14.2625 15.3232 14.7374 15.0303 15.0303C14.7374 15.3232 14.2625 15.3232 13.9696 15.0303L12 13.0607L10.0304 15.0303C9.73746 15.3232 9.26258 15.3232 8.96969 15.0303C8.6768 14.7374 8.6768 14.2626 8.96969 13.9697L10.9394 12L8.96967 10.0303C8.67678 9.73744 8.67678 9.26256 8.96967 8.96967Z" fill="#FFFFFF"/>
</svg>
  </div>
<div @click="close()" class="fixed top-0 left-0 right-0 bottom-0 overflow-y-auto sm:p-0 pt-4 pr-4 pb-20 pl-4 bg-gray-800 bg-opacity-80" style="z-index:100000;">
    <div class="flex text-center sm:block items-center justify-center min-h-[100%] min-w-[100%]">
      <div class="bg-gray-500 transition-opacity bg-opacity-75"></div>
      <span class="hidden sm:inline-block sm:align-middle sm:h-screen">​</span>
      <div 
      :class="{'zoom-fadein':animateModal}"
      @click.prevent.stop="function(){}" class= "inline-block text-left bg-gray-900 rounded-lg overflow-hidden align-bottom transition-all transform
          shadow-2xl sm:my-8 sm:align-middle sm:max-w-xl sm:w-full modal-content">
        <div class="items-center w-full mr-auto ml-auto relative max-w-7xl md:px-12 lg:px-24">
          <div class="grid grid-cols-1">
            <div class="mt-4 mr-auto mb-4 ml-auto bg-gray-900 max-w-lg">
              <div class="flex flex-col items-center pt-6 pr-6 pb-6 pl-6">
                
                <p class="mt-8 text-2xl font-semibold leading-none text-white tracking-tighter lg:text-3xl text-center" v-html="title"></p>
                <p class="mt-3 text-base leading-relaxed text-center text-gray-200" v-html="message"></p>
                <div class="w-full mt-6">

                    <a v-if="loading"  class="flex cursor-pointer text-center items-center justify-center w-full pt-4 pr-10 pb-4 pl-10 text-base
                      font-medium text-white bg-indigo-600 rounded-xl transition duration-500 ease-in-out transform
                      hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" 
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25"/><path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z"><animateTransform attributeName="transform" type="rotate" dur="0.75s" values="0 12 12;360 12 12" repeatCount="indefinite"/></path></svg>        
 
                    </a>
                    <a v-else-if="buttonOne && buttonOne.text" @click="buttonOneAction" class="flex cursor-pointer text-center items-center justify-center w-full pt-4 pr-10 pb-4 pl-10 text-base
                      font-medium text-white bg-indigo-600 rounded-xl transition duration-500 ease-in-out transform
                      hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" 
                      v-html="buttonOne.text"></a>

                    <a v-if="buttonTwo && buttonTwo.text" 
                      @click="buttonTwo.click()"                     
                      class="flex cursor-pointer text-center items-center justify-center w-full pt-4 mt-2 pr-10 pb-4 pl-10 text-base
                      font-medium text-white  rounded-xl transition duration-500 ease-in-out transform
                       focus:outline-none focus:ring-2 focus:ring-offset-2"
                      :class="[buttonTwo.classes]" 
                      v-html="buttonTwo.text"
                      >
                    </a>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  </template>

  <style scoped>
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
        transform:scale(0.8);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}
 </style>