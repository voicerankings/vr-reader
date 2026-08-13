<script setup>
import { computed } from 'vue';

const props = defineProps({
  variant: { type: String, default: 'light' }
});

const bgClass = computed(() => {
  if (props.variant === 'gray') return 'bg-slate-100';
  return 'bg-white';
});
</script>

<template>
  <div class="w-full h-screen grid grid-rows-[auto_1fr] rounded-xl border border-gray-200 shadow-md shadow-gray-100" :class="bgClass">
    <slot name="header" />
    <div class="overflow-y-auto">
      <slot />
    </div>
  </div>
</template>
