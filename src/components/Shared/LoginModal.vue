<script setup>
import { ref, computed, onMounted } from 'vue';
import useMyComposable from '../../composables/Composable';
import UserStatus from '../MainMenu/UserStatus.vue';
import { svgLogo } from '../../../js/utils/helpers.js';

const animateModal = ref(false);

onMounted(() => {
    setTimeout(() => {
        animateModal.value = true;
    }, 50);
});

const emit = defineEmits(['closeEvent']);

const props = defineProps({
    close: Function
});

const summLogo = computed(() => {
    return svgLogo(50);
});

const providers = [
    { name: 'Google', url: 'https://cloud.google.com' },
    { name: 'Resemble', url: 'https://resemble.ai' },
    { name: 'OpenAI', url: 'https://openai.com' },
    { name: 'Speechify', url: 'https://speechify.com' },
    { name: 'MurfAI', url: 'https://murf.ai' },
    { name: 'Deepgram', url: 'https://deepgram.com' },
    { name: 'InWorld', url: 'https://inworld.ai' },
    { name: 'AsyncAI', url: 'https://async.ai' }
];
</script>

<template>
<div @click="emit('closeEvent')" class="fixed inset-0 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm z-50 overflow-y-auto">
    <div 
        :class="{'zoom-fadein': animateModal}"
        @click.stop
        class="relative w-full max-w-md bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden"
    >
        <!-- Close button -->
        <button @click="emit('closeEvent')" class="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors z-10">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
        </button>


        <div class="p-8">
            <!-- Logo with gradient background -->
            <div class="flex justify-center mb-4">
                <div class="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl">
                   <img width="50" height="50" src="/images/logo.png">
                </div>
            </div>

            <div class="mb-4">
            <!-- Heading -->
            <h2 class="font-bold inline-block text-base text-center mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                VoiceRankings&nbsp;
            </h2>
            <p class="text-center inline-block text-gray-400 text-sm">
                Only the best AI voices
            </p>
            </div>

            <!-- Features list -->
            <div class="space-y-5 mb-8">
                <!-- Feature 1 -->
                <div class="flex items-start gap-3">
                    <div class="flex-shrink-0 w-6 h-6 mt-0.5 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <svg class="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <p class="text-white font-semibold mb-3">
                            Access 3000+ Premium Voices
                        </p>
                        <!-- Provider logos grid -->
                        <div class="grid grid-cols-4 gap-3">
                            <div 
                                v-for="provider in providers" 
                                :key="provider.name"
                                class="flex flex-col items-center gap-2 p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
                            >
                                <img 
                                    :src="`https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${provider.url}`"
                                    :alt="provider.name"
                                    class="w-6 h-6 rounded"
                                />
                                <span class="text-[10px] text-gray-400 text-center leading-tight">
                                    {{ provider.name }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Feature 2 -->
                <div class="flex items-center gap-3">
                    <div class="flex-shrink-0 w-6 h-6 mt-0.5 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <svg class="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                    </div>
                    <div>
                        <p class="text-white font-semibold">Create Custom Voices</p>
                    </div>
                </div>

                <!-- Feature 3 -->
                <div class="flex items-center gap-3">
                    <div class="flex-shrink-0 w-6 h-6 mt-0.5 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <svg class="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                    </div>
                    <div>
                        <p class="text-white font-semibold">Save Favorites and Create Collections</p>
                    </div>
                </div>
            </div>

            <!-- CTA Button -->
            <div>
            <UserStatus :hideBottomRow="true" class="w-full cta-button" />
            </div>
            
            
            <!-- Trust badge -->

        </div>
    </div>
</div>
</template>

<style scoped>
.cta-button {
    border-radius:10px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    color:white !important;
    transition: transform 0.2s, box-shadow 0.2s;
}

.cta-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}
.modal-content {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
    opacity: 0;
    transform: scale(0.8);
}

.zoom-fadein {
    animation: zoomFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes zoomFadeIn {
    from {
        opacity: 0;
        transform: scale(0.8);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}
</style>