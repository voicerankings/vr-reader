<script setup>
defineProps({
  label: { type: String, default: '' }
});
</script>
<template>
<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-3">
    <svg xmlns="http://www.w3.org/2000/svg" width="50" viewBox="0 0 200 200"><circle fill="#3B82F6" stroke="#3B82F6" stroke-width="16" r="15" cx="40" cy="100"><animate attributeName="opacity" calcMode="spline" dur="2" values="1;0;1;" keySplines=".5 0 .5 1;.5 0 .5 1" repeatCount="indefinite" begin="-.4"></animate></circle><circle fill="#3B82F6" stroke="#3B82F6" stroke-width="16" r="15" cx="100" cy="100"><animate attributeName="opacity" calcMode="spline" dur="2" values="1;0;1;" keySplines=".5 0 .5 1;.5 0 .5 1" repeatCount="indefinite" begin="-.2"></animate></circle><circle fill="#3B82F6" stroke="#3B82F6" stroke-width="16" r="15" cx="160" cy="100"><animate attributeName="opacity" calcMode="spline" dur="2" values="1;0;1;" keySplines=".5 0 .5 1;.5 0 .5 1" repeatCount="indefinite" begin="0"></animate></circle></svg>
    <p v-if="label" class="text-sm text-gray-400">{{ label }}</p>
</div>

</template>
