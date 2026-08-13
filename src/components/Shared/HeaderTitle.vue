<script setup>
import { ref ,computed, watchEffect, onMounted, defineProps  } from 'vue';

const animateModal = ref(false)

const props = defineProps({
    title:String
});

onMounted(() => {
    setTimeout(() => {
        animateModal.value = true;
    }, 50);
});

</script>

<template>
<span class=" ">
    <span :class="{'zoom-fadein':animateModal}" class="modal-content " v-html="title">
    </span>
</span>
</template>

<style scoped>


.modal-content {
    transition-property: all;
              transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
              transition-duration: 150ms;
    opacity:0;
 }

 .zoom-fadein {
    /* Animation */
    animation: zoomFadeIn 0.25s ease-out forwards;
}

@keyframes zoomFadeIn {
    from {
        opacity: 0;

    }
    to {
        opacity: 1;

    }
}
</style>