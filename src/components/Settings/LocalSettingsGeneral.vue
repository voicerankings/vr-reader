<script setup>
import { ref, onMounted, computed, watchEffect, watch } from 'vue'


import useMyComposable from '../../composables/Composable'

import { CONSTANTS } from "../../../js/constants/constants";


const { API_NUXT_DOMAIN, userProfile, allowTelemetry, getFromStorageAllowTelemetry, localSettingsTab } = useMyComposable();

import useLocalSettings from '../../composables/useLocalSettings';
const { maxAutoReadLimitEnabled, maxAutoReadLimit, showVoiceRatingPromptState, showContinueReadingPromptState, getFromStorageOverlayPromptSettings } = useLocalSettings();

const domainFilterEnabled = ref(true);
const readerStrictMode = ref(true);

watch(domainFilterEnabled, (newVal) => {
  saveToLocalStorage({ 'DOMAIN_FILTER_ENABLED': newVal });
  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DOMAIN_FILTER_ENABLED',
    value: newVal
  });
});

watch(readerStrictMode, (newVal) => {
  saveToLocalStorage({ 'DEFAULT_READER_STRICT_MODE': newVal });
  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DEFAULT_READER_STRICT_MODE',
    value: newVal
  });
});

watch(showVoiceRatingPromptState, (newVal) => {
  saveToLocalStorage({ 'DEFAULT_SHOW_VOICE_RATING_PROMPT': newVal });
  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DEFAULT_SHOW_VOICE_RATING_PROMPT',
    value: newVal
  });
});

watch(showContinueReadingPromptState, (newVal) => {
  saveToLocalStorage({ 'DEFAULT_SHOW_CONTINUE_READING_PROMPT': newVal });
  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DEFAULT_SHOW_CONTINUE_READING_PROMPT',
    value: newVal
  });
});

const saveMaxAutoReadLimit = () => {
  saveToLocalStorage({
    'DEFAULT_MAX_AUTO_READ_LIMIT_ENABLED': maxAutoReadLimitEnabled.value,
    'DEFAULT_MAX_AUTO_READ_LIMIT': maxAutoReadLimit.value
  });
  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DEFAULT_MAX_AUTO_READ_LIMIT_ENABLED',
    value: maxAutoReadLimitEnabled.value
  });
  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'DEFAULT_MAX_AUTO_READ_LIMIT',
    value: maxAutoReadLimit.value
  });
};

const saveTelemetry = () => {
  saveToLocalStorage({'ALLOW_TELEMETRY': allowTelemetry.value});
  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'ALLOW_TELEMETRY',
    value: allowTelemetry.value
  });
};

function showRatingModal(){
  chrome.runtime.sendMessage({ action: "navigateTo", url: CONSTANTS.GUIDE_LINKS.CHROME_STORE_REVIEW });
}

function openDiscord(){
  chrome.runtime.sendMessage({ action: "navigateTo", url: CONSTANTS.GUIDE_LINKS.DISCORD });
}

import { saveToLocalStorage } from '../../../js/utils/helpers';

import QuickAccessControls from './QuickAccessControls.vue';
import HighlightControls from './HighlightControls.vue';

import LocalSettingsKeyboardShortcut from './LocalSettingsKeyboardShortcut.vue';
import LocalSettingsTimestamp from './LocalSettingsTimestamp.vue';


const supportEmail = ref('');
const supportMessage = ref('');
const supportSubject = ref('');

onMounted(async () => {
  await getFromStorageAllowTelemetry();
  await getFromStorageOverlayPromptSettings();
  const result = await chrome.storage.local.get('DEFAULT_READER_STRICT_MODE');
  if (result.DEFAULT_READER_STRICT_MODE !== undefined) {
    readerStrictMode.value = result.DEFAULT_READER_STRICT_MODE;
  }
  const domainResult = await chrome.storage.local.get('DOMAIN_FILTER_ENABLED');
  if (domainResult.DOMAIN_FILTER_ENABLED !== undefined) {
    domainFilterEnabled.value = domainResult.DOMAIN_FILTER_ENABLED;
  }
});

// Example subject options for Chrome extension
const subjectOptions = [
  'Bug Report',
  'Feature Request',
  'Voice Issues',
  'Account Problems',
  'Billing Questions',
  'Performance Issues',
  'Installation Problems',
  'Other'
];

// Update email when user is logged in
watchEffect(() => {
  if (userProfile.value?.user_email) {
    supportEmail.value = userProfile.value.user_email;
  }
});

const isValidForm = computed(() => {
  return supportMessage.value.trim().length > 0 && 
         supportEmail.value.trim().length > 0 &&
         supportSubject.value.trim().length > 0;
});



// Add these refs to your script setup
const isSubmitting = ref(false);
const submitStatus = ref('idle'); // 'idle' | 'submitting' | 'success' | 'error'
const errorMessage = ref('');

// Update the submitSupport function
const submitSupport = async () => {
  if (!isValidForm.value) return;
  
  submitStatus.value = 'submitting';
  isSubmitting.value = true;
  errorMessage.value = '';

  try {
    const response = await fetch(`https://${API_NUXT_DOMAIN.value}/api/v1/email-support`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: supportEmail.value,
        subject: supportSubject.value,
        message: supportMessage.value
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      submitStatus.value = 'success';
      // Reset form
      supportMessage.value = '';
      supportSubject.value = '';
      if (!userProfile.value?.user_email) {
        supportEmail.value = '';
      }
    } else {
      throw new Error(data.message || 'Failed to send message');
    }

  } catch (error) {
    console.error('Error sending email:', error);
    submitStatus.value = 'error';
    errorMessage.value = error.message || 'Failed to send message. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
};


</script>

<template>
  <div class="px-3 md:w-5/12">
  

<div class="w-full max-w-lg mx-auto p-4">
  <!-- Main Container: White background, rounded, shadow, grid for equal spacing -->
  <div class="grid grid-cols-3 gap-1 p-1.5 bg-white border border-gray-200 rounded-xl shadow-sm">
    
    <!-- BUTTON 1: RATING -->
    <div class="w-full">
      <VMenu :distance="5" :delay="{show:700}" class="w-full">
        <!-- Trigger Button -->
        <a @click.prevent="showRatingModal()" href="#" 
           class="flex items-center justify-center w-full gap-1.5 px-2 py-2.5 rounded-lg transition-all duration-200 group hover:bg-gray-50">
          
          <!-- Star Icon -->
          <svg class="w-5 h-5 flex-shrink-0 text-gray-400 transition-colors group-hover:text-orange-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292z"/>
          </svg>
          
          <!-- Text -->
          <span class="text-sm font-medium text-gray-600 group-hover:text-gray-900 whitespace-nowrap">Rate</span>
        </a>

        <!-- Popup Content (Original) -->
        <template #popper>
          <div role="alert" class="text-left relative flex flex-col w-full px-4 py-4 text-base text-gray-900 border border-gray-900 font-regular bg-white rounded-lg">
            <div class="">
              <p class="font-sans flex text-base antialiased font-medium leading-relaxed text-inherit mb-3">
                <svg class="inline-block mr-2" width="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21.92 6.62a1 1 0 0 0-.54-.54A1 1 0 0 0 21 6h-5a1 1 0 0 0 0 2h2.59L13 13.59l-3.29-3.3a1 1 0 0 0-1.42 0l-6 6a1 1 0 0 0 0 1.42a1 1 0 0 0 1.42 0L9 12.41l3.29 3.3a1 1 0 0 0 1.42 0L20 9.41V12a1 1 0 0 0 2 0V7a1 1 0 0 0-.08-.38z" fill="currentColor"/>
                </svg>
                <span>Help spread the word!!</span>
              </p>
              <p class="text-sm text-gray-600 mb-3">Love the freedom to choose your own voice provider with zero lock-in? <b>Drop a quick review to spread the word!</b></p>
              <button @click="showRatingModal()" class="w-full align-middle select-none rounded font-sans font-bold text-center uppercase transition-all text-sm py-3.5 px-4 bg-gradient-to-tr from-blue-600 to-blue-400 text-white shadow-md hover:shadow-lg flex items-center justify-between overflow-hidden" type="button">
                <div class="flex text-yellow-300 gap-1">
                  <!-- 5 Stars SVG Loop simplified for brevity, kept visually same -->
                  <svg v-for="i in 5" :key="i" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292z"/></svg> 
                </div>
                <span class="text-xs font-bold tracking-wider ml-2">CHROME STORE REVIEWS</span>
              </button>
            </div>
          </div>
        </template>
      </VMenu>
    </div>

    <!-- BUTTON 2: DISCORD -->
    <div class="w-full">
      <VMenu :distance="5" :delay="{show:200}" class="w-full">
        <!-- Trigger Button -->
        <a href="#" @click.prevent="openDiscord()" class="flex items-center justify-center w-full gap-1.5 px-2 py-2.5 rounded-lg transition-all duration-200 group hover:bg-gray-50">

          <!-- Discord Icon -->
          <svg class="w-5 h-5 flex-shrink-0 text-gray-400 transition-colors group-hover:text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
          </svg>

          <!-- Text -->
          <span class="text-sm font-medium text-gray-600 group-hover:text-gray-900 whitespace-nowrap">Discord</span>
        </a>

        <!-- Popup Content -->
        <template #popper>
          <div class="text-left relative flex flex-col w-80 p-4 text-base bg-white border border-gray-200 rounded-lg shadow-xl">
            <div class="flex items-center gap-2 mb-3">
              <svg class="w-6 h-6 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
              </svg>
              <h3 class="text-lg font-semibold text-gray-900">Join our Discord community</h3>
            </div>
            <p class="text-sm text-gray-600 mb-4">Get updates, help, and tips on free provider credits.</p>
            <button @click="openDiscord()" class="w-full px-4 py-2.5 text-sm font-bold text-white bg-[#5865F2] hover:bg-[#4752c4] rounded-md flex items-center justify-center gap-2 transition-colors duration-200">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
              </svg>
              Join the Discord
            </button>
          </div>
        </template>
      </VMenu>
    </div>

    <!-- BUTTON 3: SUPPORT -->
    <div class="w-full">
      <VMenu :distance="5" :delay="{show:200}" class="w-full">
        <!-- Trigger Button -->
        <a href="#" class="flex items-center justify-center w-full gap-1.5 px-2 py-2.5 rounded-lg transition-all duration-200 group hover:bg-gray-50">
          
          <!-- Added Support Icon for visual balance -->
          <svg class="w-5 h-5 flex-shrink-0 text-gray-400 transition-colors group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          
          <!-- Text -->
          <span class="text-sm font-medium text-gray-600 group-hover:text-gray-900 whitespace-nowrap">Support</span>
        </a>

        <!-- Popup Content (Original Logic) -->
        <template #popper>
          <div role="alert" class="text-left relative flex flex-col w-80 p-4 text-base bg-white border border-gray-200 rounded-lg shadow-xl" style="opacity: 1;">
            
            <!-- Success State -->
            <div v-if="submitStatus === 'success'" class="text-center py-8">
              <svg class="w-16 h-16 mx-auto text-green-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Message Sent!</h3>
              <p class="text-sm text-gray-600">We'll get back to you as soon as possible.</p>
              <button @click="submitStatus = 'idle'" class="mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700">
                Send another message
              </button>
            </div>

            <!-- Error State -->
            <div v-else-if="submitStatus === 'error'" class="text-center py-8">
              <svg class="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 class="text-lg font-semibold text-red-600 mb-2">Something went wrong</h3>
              <p class="text-sm text-gray-600 mb-4">{{ errorMessage }}</p>
              <button @click="submitStatus = 'idle'" class="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700">
                Try again
              </button>
            </div>

            <!-- Form State -->
            <div v-else>
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Contact Support</h3>
              
              <!-- Email Input -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Your Email</label>
                <input type="email" v-model="supportEmail" :disabled="!!userProfile?.user_email" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm" placeholder="Enter your email">
              </div>

              <!-- Subject Select -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select v-model="supportSubject" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm">
                  <option value="">Select a subject</option>
                  <option v-for="subject in subjectOptions" :key="subject" :value="subject">
                    {{ subject }}
                  </option>
                </select>
              </div>

              <!-- Message Textarea -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea v-model="supportMessage" rows="4" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm resize-none" placeholder="Describe your issue or question..."></textarea>
              </div>
              
              <!-- Submit Button -->
              <button @click="submitSupport" :disabled="!isValidForm || isSubmitting" class="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center">
                <svg v-if="isSubmitting" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ isSubmitting ? 'Sending...' : 'Send Message' }}
              </button>
            </div>
          </div>
        </template>
      </VMenu>
    </div>
  </div>
</div>


    <div class="space-y-4">
      <QuickAccessControls></QuickAccessControls>
      <HighlightControls></HighlightControls>
      <LocalSettingsKeyboardShortcut></LocalSettingsKeyboardShortcut>
      <LocalSettingsTimestamp></LocalSettingsTimestamp>
    </div>

<div class="mt-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
  <div class="flex items-center justify-between">
    <div class="pr-4 text-left">
      <h3 class="text-sm font-medium text-gray-900">Auto-Read Character Limit</h3>
      <p class="text-xs text-gray-500 mt-1">Pause reading automatically after a certain number of characters to ensure you're still listening.</p>
    </div>
    <div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" v-model="maxAutoReadLimitEnabled" @change="saveMaxAutoReadLimit" class="sr-only peer">
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
  </div>
  
  <div v-if="maxAutoReadLimitEnabled" class="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between transition-all duration-300">
    <div class="pr-4 text-left">
      <h3 class="text-sm font-medium text-gray-900">Character Limit</h3>
      <p class="text-xs text-gray-500 mt-1">Number of characters before pausing.</p>
    </div>
    <div>
      <input type="number" min="100" step="100" v-model="maxAutoReadLimit" @change="saveMaxAutoReadLimit" class="w-24 px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
    </div>
  </div>
</div>

<div class="mt-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
  <div class="flex items-center justify-between">
    <div class="pr-4 text-left">
      <h3 class="text-sm font-medium text-gray-900">Enable Anonymous Telemetry/Error Tracking</h3>
      <p class="text-xs text-gray-500 mt-1">Help us improve the extension by sending anonymous usage and error data.</p>
    </div>
    <div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" v-model="allowTelemetry" @change="saveTelemetry" class="sr-only peer">
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
  </div>
</div>

<div class="mt-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
  <div class="flex items-center justify-between mb-4">
    <div class="pr-4 text-left">
      <h3 class="text-sm font-medium text-gray-900">Enable remote domain filters</h3>
      <p class="text-xs text-gray-500 mt-1">Fetch domain-specific text filters from the remote API endpoint on page load.</p>
    </div>
    <div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" v-model="domainFilterEnabled" class="sr-only peer">
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
  </div>
  <div class="pt-4 border-t border-gray-100">
    <button @click="localSettingsTab = 'domain-filters'" class="w-full px-4 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors duration-200">
      Custom domain filters
    </button>
  </div>
</div>

<div class="mt-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
  <div class="flex items-center justify-between">
    <div class="pr-4 text-left">
      <h3 class="text-sm font-medium text-gray-900">Strict article extraction</h3>
      <p class="text-xs text-gray-500 mt-1">Turn off to include more page metadata (e.g. review author, outlet, score). May include extra page noise.</p>
    </div>
    <div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" v-model="readerStrictMode" class="sr-only peer">
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
  </div>
</div>

<div class="mt-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
  <div class="flex items-center justify-between mb-2">
    <div class="pr-4 text-left">
      <h3 class="text-sm font-medium text-gray-900">Reader Overlays</h3>
    </div>
  </div>
  <div class="pt-2 border-t border-gray-100">
    <div class="flex items-center justify-between">
      <div class="pr-4 text-left">
        <h3 class="text-sm font-medium text-gray-900">Show voice rating prompt after reading</h3>
        <p class="text-xs text-gray-500 mt-1">Hide the "Rate [voice]'s reading" overlay that appears after playback ends or pauses.</p>
      </div>
      <div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="showVoiceRatingPromptState" class="sr-only peer">
          <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
    </div>
    <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
      <div class="pr-4 text-left">
        <h3 class="text-sm font-medium text-gray-900">Show "Continue reading the rest of the page" prompt</h3>
        <p class="text-xs text-gray-500 mt-1">Hide the overlay that offers to resume reading from where you stopped on the page.</p>
      </div>
      <div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="showContinueReadingPromptState" class="sr-only peer">
          <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
    </div>
  </div>
</div>

   <br>

  </div>
</template>
