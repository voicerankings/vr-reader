<script setup>
import { ref, onMounted } from 'vue';
import { CONSTANTS } from '../../../js/constants/constants.js';

const animateModal = ref(false);

onMounted(() => {
    setTimeout(() => {
        animateModal.value = true;
    }, 50);
});

const emit = defineEmits(['closeEvent']);

const discordUrl = CONSTANTS.GUIDE_LINKS.DISCORD;

function joinDiscord() {
    window.open(discordUrl, '_blank');
}
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
                <div class="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl">
                    <img width="50" height="50" src="/images/logo.png">
                </div>
            </div>

            <!-- Heading -->
            <div class="mb-2 text-center">
                <h2 class="font-bold text-base inline-block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Need help getting started?
                </h2>
            </div>
            <p class="text-center text-gray-400 text-sm mb-6">
                Our community is here to help you add API keys, set up voices, and troubleshoot any issues.
            </p>

            <!-- Discord CTA -->
            <div class="rounded-xl bg-gray-800/50 border border-gray-700/60 p-5 mb-6">
                <div class="flex items-center justify-center mb-3">
                    <svg class="w-9 h-9 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
                    </svg>
                </div>
                <p class="text-white font-semibold text-center mb-1">
                    Join the VoiceRankings Discord
                </p>
                <p class="text-gray-400 text-sm text-center mb-4">
                    Get updates, help, and tips on free provider credits.
                </p>
                <button @click="joinDiscord"
                    class="w-full py-3 rounded-lg font-semibold transition-all cta-button">
                    Join the Discord
                </button>
            </div>
        </div>
    </div>
</div>
</template>

<style scoped>
.cta-button {
    border-radius: 10px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    color: white !important;
    transition: transform 0.2s, box-shadow 0.2s;
}

.cta-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
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
