<script setup>
import { defineProps, computed, ref } from 'vue';

const showImg = ref(true);

const props = defineProps({
  voice:Object
});

const favIconURL = computed(() => {
    if(props.voice.voice_gender === "female"){
        return `https://cdn.soundranks.com/images/female.png`
    }else{
        return `https://cdn.soundranks.com/images/male.png`
    }
});

const noImageAbbr = computed(() => {
    return "M/W"
});

function noImage(){
    showImg.value = false;
}
</script>

<template>
    <div class="flex transition-all group-hover:scale-125">
        <img v-tooltip="{content:voice.voice_gender}" v-if="showImg" @error="noImage" :src="favIconURL">
        <span v-else class="tag w-full text-center capitalize text-[20px] font-medium text-slate-700 group-hover:text-slate-900">{{noImageAbbr}}</span>
    </div>    
</template>

<style scoped>
 img {
    width:20px;
    height:20px;
 }
</style>