<script setup>
import { defineProps, computed, ref, onMounted, nextTick } from 'vue';
import useMyComposable from '../../../composables/Composable';
const {  
	getFreeBrowserVoicesList, 
	browserVoicesList, 
	getVoiceTestTextOrPlaceholder ,
	saveRequest, 
	completeRequest,
	isUserLogged, 
    userProfile   ,
	showLoginModalCount
} = useMyComposable();

const line1 = ref();
const line2 = ref();
const line3 = ref();
const line4 = ref();
const line5 = ref();

let stopNumber = null;
let iterationCount = 0;
const playing = ref(false);
const loading = ref(false);
const props = defineProps({
  voice:Object,
  index:Number,
  textList:String,
  makeDownloadLink:Function
});

//let audioBlobURL = null;

onMounted(() => {
	props.voice.audioBlobURL = null;
});

function hasPremiumAccess(){
    if(!isUserLogged.value ){
		showLoginModalCount.value++;
        return false
    }else{
        return true;
    }
}


async function play(){
	if(props.voice.audioBlobURL !== null){
		playAudioBlobOffscreen();
		return false;
	}
	loading.value = true;

	let callbackID = "sidepanel_premium_tts_"+Math.floor(Math.random() * 1000) + 100; 
	
	const textList = (props.textList)? props.textList : await getVoiceTestTextOrPlaceholder(props.voice.voice_name);


	chrome.runtime.sendMessage({
		action: "getAudioDataFromExternalTTS",
		callbackID,
		payload:{
			serviceName:props.voice.voice_service,
			serviceOptions:{				
				gender:props.voice.voice_gender, 
				speaker_id:props.voice.voice_speaker_id,
				languageCode: props.voice.voice_language_code,
				voiceSpeedSetting: props.voice.voice_speed  
			},
			text:textList,
			index:props.index,
			ignoreFirstQueue:false
		}
	});
	
	saveRequest(callbackID,({audioData, index, ignoreFirstQueue,status })=>{
		if(status === "error"){
			playing.value = false;
			loading.value = false;
			return false;
		}
		props.voice.audioBlobURL = base64ToBlob(audioData, 'audio/mpeg');

		if(props.makeDownloadLink){
			props.makeDownloadLink(props.voice.audioBlobURL);
		}
		playAudioBlobOffscreen()		
	})
}

function playAudioBlobOffscreen(){
	let onPlayCallbackID = "sidepanel_premium_tts_onPlay_callback_"+Math.floor(Math.random() * 2000) + 1001;  
	saveRequest(onPlayCallbackID,({audioData, index, ignoreFirstQueue })=>{
		loading.value = false;
	});

	let onEndedCallbackID = "sidepanel_premium_tts_onEnded_callback_"+Math.floor(Math.random() * 1000) + 100;  
	saveRequest(onEndedCallbackID,({audioData, index, ignoreFirstQueue,status })=>{
		if(status === "error"){
			playing.value = false
		}
		clickToPlayAndStop(true);
	});

	playAudioInOffscreen({
		audioBlobURL:props.voice.audioBlobURL, 
		index:props.index, 
		ignoreFirstQueue:false,
		onPlayCallbackID,
		onEndedCallbackID
	})
}

function playAudioInOffscreen({audioBlobURL,ignoreFirstQueue,index,onPlayCallbackID,
        onEndedCallbackID}){ 
 
        chrome.runtime.sendMessage({
            action: "play-audio",
            target: 'offscreen',
            data: {
                audioBlobURL,
                ignoreFirstQueue,
                index,
                onPlayCallbackID,
                onEndedCallbackID
            }
        });
}
function base64ToBlob(base64, mimeType,audioObj) {
	const sliceSize = 1024;
	const byteCharacters = atob(base64);
	const byteArrays = [];
	
	for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
		const slice = byteCharacters.slice(offset, offset + sliceSize);
		const byteNumbers = new
	
	Array(slice.length);
		for (let i = 0; i < slice.length; i++) {
		byteNumbers[i] = slice.charCodeAt(i);
		}
		const byteArray = new
	
	Uint8Array(byteNumbers);
		byteArrays.push(byteArray);
	}
	
	const blob = new Blob(byteArrays, { type: mimeType });

	const blobURL = URL.createObjectURL(blob);
	// Create a URL for the blob
	return blobURL;

}

// // Add an event listener for the end of each animation iteration
async function clickToPlayAndStop(forceStop = false){
	if(hasPremiumAccess() === false){
		return false;
	}

    if(playing.value === true || forceStop === true){
        stopNumber = iterationCount + 1;
        line1.value.style.animationIterationCount = stopNumber;
        line2.value.style.animationIterationCount = stopNumber;
        line3.value.style.animationIterationCount = stopNumber;
        line4.value.style.animationIterationCount = stopNumber;
        line5.value.style.animationIterationCount = stopNumber;

		chrome.runtime.sendMessage({
            action: "stop-audio",
            target: "offscreen"
        });
    }else{
		play();
		props.voice.audioModeOpened = true;
		await nextTick()
	}
    playing.value = !playing.value;
	line1.value.addEventListener('animationiteration',()=>{
		iterationCount++;
	});
}
function close(){
	loading.value = false;
	playing.value = false;
	props.voice.audioModeOpened = false;
}
</script>

<template>

<div class="relative">
	<div 
	@click="close()"
	:class="{'bg-slate-300 active-close flex': voice.audioModeOpened}"	
	class=" items-center justify-center  text-slate-500 border-r-0 rounded-md hidden">		
		<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><path d="M13.414 12l2.829-2.828a1 1 0 1 0-1.415-1.415L12 10.586L9.172 7.757a1 1 0 0 0-1.415 1.415L10.586 12l-2.829 2.828a1 1 0 0 0 1.415 1.415L12 13.414l2.828 2.829a1 1 0 0 0 1.415-1.415L13.414 12zM12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10s-4.477 10-10 10z" fill="currentColor"/></svg>
	</div>
	<div 
	:class="{'bg-slate-300 active-play': voice.audioModeOpened}"
	@click.prevent.stop="clickToPlayAndStop()" class=" relative loader hover:text-slate-500  hover:bg-slate-300 flex px-0.5 rounded-md items-center justify-center cursor-pointer">
		
		<span v-if="loading" class="absolute z-10">
			<svg xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.0" width="28px" height="28px" viewBox="0 0 128 128" xml:space="preserve"><path fill="#000000" d="M64.4 16a49 49 0 0 0-50 48 51 51 0 0 0 50 52.2 53 53 0 0 0 54-52c-.7-48-45-55.7-45-55.7s45.3 3.8 49 55.6c.8 32-24.8 59.5-58 60.2-33 .8-61.4-25.7-62-60C1.3 29.8 28.8.6 64.3 0c0 0 8.5 0 8.7 8.4 0 8-8.6 7.6-8.6 7.6z"><animateTransform attributeName="transform" type="rotate" from="0 64 64" to="360 64 64" dur="1400ms" repeatCount="indefinite"/></path></svg>
		</span>

		<svg v-if="playing === false" class="mr-0.5" xmlns="http://www.w3.org/2000/svg" height="24" fill="currentColor" viewBox="0 -960 960 960" width="24"><path d="M280-240v-480h80v480h-80ZM440-80v-800h80v800h-80ZM120-400v-160h80v160h-80Zm480 160v-480h80v480h-80Zm160-160v-160h80v160h-80Z"/></svg>

		<svg v-if="playing === true" class="wave" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 33 36">
			<path ref="line1" class="Line_1" data-name="Line 1" d="M0.91,15L0.78,15A1,1,0,0,0,0,16v6a1,1,0,1,0,2,0s0,0,0,0V16a1,1,0,0,0-1-1H0.91Z"/>
			<path ref="line2" class="Line_2" data-name="Line 2" d="M6.91,9L6.78,9A1,1,0,0,0,6,10V28a1,1,0,1,0,2,0s0,0,0,0V10A1,1,0,0,0,7,9H6.91Z"/>
			<path ref="line3" class="Line_3" data-name="Line 3" d="M12.91,0L12.78,0A1,1,0,0,0,12,1V37a1,1,0,1,0,2,0s0,0,0,0V1a1,1,0,0,0-1-1H12.91Z"/>
			<path ref="line4" class="Line_4" data-name="Line 4" d="M18.91,10l-0.12,0A1,1,0,0,0,18,11V27a1,1,0,1,0,2,0s0,0,0,0V11a1,1,0,0,0-1-1H18.91Z"/>
			<path ref="line5" class="Line_5" data-name="Line 5" d="M24.91,15l-0.12,0A1,1,0,0,0,24,16v6a1,1,0,0,0,2,0s0,0,0,0V16a1,1,0,0,0-1-1H24.91Z"/>
		</svg>

	</div>   

</div>
</template>

<style scoped>
.active-play {
	border-top-left-radius: 0px; 
	border-bottom-left-radius: 0px;
}
.active-close {

	position:absolute;
	display:flex;
	top:0px;
	bottom:0px;
	right:30px;
	border-top-right-radius: 0px; 
	border-bottom-right-radius: 0px;
}
 .wave {
    width: 24px;
    fill: #000;
    scale: 0.80;
    margin: auto;
    align-content: center;
    text-align: center;
    margin-left: 3px;

}
.wave path {
    
}
 .Line_1 {
	 animation: pulse 1s infinite;
	 animation-delay: 0.15s;
}
 .Line_2 {
	 animation: pulse 1s infinite;
	 animation-delay: 0.3s;
}
.Line_3 {
	 animation: pulse 1s infinite;
	 animation-delay: 0.45s;
}
 .Line_4 {
	 animation: pulse 1s infinite;
	 animation-delay: 0.6s;
}
 .Line_5 {
	 animation: pulse 1s infinite;
	 animation-delay: 0.75s;
}
 .Line_6 {
	 animation: pulse 1s infinite;
	 animation-delay: 0.9s;
}
 .Line_7 {
	 animation: pulse 1s infinite;
	 animation-delay: 1.05s;
}
 .Line_8 {
	 animation: pulse 1s infinite;
	 animation-delay: 1.2s;
}
 .Line_9 {
	 animation: pulse 1s infinite;
	 animation-delay: 1.35s;
}
 @keyframes pulse {
	 0% {
		 transform: scaleY(1);
		 transform-origin: 50% 50%;
	}
	 50% {
		 transform: scaleY(0.7);
		 transform-origin: 50% 50%;
	}
	 100% {
		 transform: scaleY(1);
		 transform-origin: 50% 50%;
	}
}
</style>