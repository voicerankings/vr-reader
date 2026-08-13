<script setup>
import { ref, defineEmits, watch,onMounted, defineProps,computed } from 'vue';
import useMyComposable from '../../composables/Composable';
const { getFromStorageVoiceDefaultPayload, voiceDefaultPayload } = useMyComposable();

import useLangRegionDisplayName from '../../composables/useLangRegionDisplayName';
import VoicePlayTestAudioPremium from './Premium/VoicePlayTestAudio.vue';

import VoiceSpeedSlider from './Header/VoiceSpeedSlider.vue';

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

onMounted(async () => {
    await getFromStorageVoiceDefaultPayload();

    updateDisplayLangRegion()
    
    watch(() => voiceDefaultPayload.value.voice_name, (newName, prevName) => {
        voiceDefaultPayload.value.audioBlobURL = null;
        updateDisplayLangRegion()
    });
})

watch(() => voiceDefaultPayload.value.voice_speed, (newSpeed) => {
    voiceDefaultPayload.value.audioBlobURL = null;
});
</script>

<template>
<div class="flex px-4 py-3 items-center min-w-0 w-full">
    <VoiceSpeedSlider></VoiceSpeedSlider>

    <div class="flex-1 flex flex-col min-w-0 ml-4">
        <div class="font-semibold text-gray-800 dark:text-gray-100 truncate">
            {{voiceDefaultPayload.voice_name}}<span v-if="voiceDefaultPayload.voice_gender == 'female' || voiceDefaultPayload.voice_gender == 'male'" class="text-gray-500 font-medium">({{ voiceDefaultPayload.voice_gender.substring(0,1).toUpperCase() }})</span> <span class="text-gray-400 mx-1">•</span> <span class="text-gray-600 dark:text-gray-300 font-medium">{{ langCode }} <span v-if="regionCode">/ {{ regionCode }}</span></span>
        </div>
        <div class="text-gray-500 dark:text-gray-400 text-sm mt-0.5 tracking-wide uppercase text-[10px] font-bold truncate">
            Default Voice <span class="text-blue-500 mx-1">•</span> {{voiceDefaultPayload.voice_service}}
        </div>
    </div>
    <!-- <div class="flex items-center justify-center">
        <VoicePlayTestAudioPremium v-if="voiceDefaultPayload.voice_service !== 'free'" :voice="voiceDefaultPayload"></VoicePlayTestAudioPremium>
        <VoicePlayTestAudioFree v-else :voice="voiceDefaultPayload"></VoicePlayTestAudioFree>        
    </div> -->
</div>    
</template>
