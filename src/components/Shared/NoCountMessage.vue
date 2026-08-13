<script setup>
import { ref ,computed, watchEffect, onMounted, defineProps  } from 'vue';

const animateModal = ref(false)

const props = defineProps({
    message:String
});


onMounted(() => {
    setTimeout(() => {
        animateModal.value = true;
    }, 50);
})

</script>
<template>
<div class=" text-base text-center text-gray-400 left-1/2 top-1/2 absolute -translate-x-1/2 -translate-y-1/2">
    <div :class="{'zoom-fadein':animateModal}" class="modal-content " v-html="message">
    </div>
</div>
</template>

<style scoped>
::marker {
    content: none;
}
ul ::marker {
    content: none;
}
ul > li::marker {
    content:normal;
}

.modal-content {
    transition-property: all;
              transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
              transition-duration: 150ms;
    opacity:0;
    transform: scale(0.8);
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