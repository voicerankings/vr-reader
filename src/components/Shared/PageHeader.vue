<script setup>
import { computed } from 'vue';
import HeaderTitle from './HeaderTitle.vue';
import useMyComposable from '../../composables/Composable';

const { pageRoute } = useMyComposable();

const props = defineProps({
  title: { type: String, required: true },
  variant: { type: String, default: 'blue' }
});

const headerClasses = computed(() => {
  if (props.variant === 'gray') {
    return 'bg-slate-100 text-gray-500';
  }
  return 'bg-blue-500 text-gray-100';
});

const hoverClasses = computed(() => {
  if (props.variant === 'gray') {
    return 'text-gray-500 hover:text-blue-500';
  }
  return 'text-gray-100 hover:text-green-300';
});

function backToMainMenu() {
  pageRoute.value = '/main-menu';
}
</script>

<template>
  <div class="relative flex flex-col justify-center bg-gray-50">
    <div>
      <div class="flex items-center justify-between border-b p-3" :class="headerClasses">
        <div @click="backToMainMenu()" class="flex items-center space-x-5 cursor-pointer" :class="hoverClasses">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15m0 0l6.75 6.75M4.5 12l6.75-6.75" />
          </svg>
        </div>
        <div class="flex-1 text-lg font-bold">
          <HeaderTitle :title="title" />
        </div>
        <div class="flex items-center space-x-5">
          <slot name="actions">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 opacity-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15m0 0l6.75 6.75M4.5 12l6.75-6.75" />
            </svg>
          </slot>
        </div>
      </div>
      <slot name="extra" />
    </div>
  </div>
</template>
