<script setup>
import { ref, watch, onUnmounted, nextTick, computed } from 'vue';

const toastContainer = ref(null);

const props = defineProps({
  trigger: Number,
  hideProgressBar: Boolean,
  icon: String,
  title: String,
  message: String,
  action: {
    type: String,
    default: 'none',
  },
  delay: {
    type: Number,
    default: 4000,
  },
  callback: Function,
});

const isVisible = ref(false);
let timeoutId = null;

const variantClasses = computed(() => {
  switch (props.action) {
    case 'success': return 'border-l-4 border-l-green-500';
    case 'error': return 'border-l-4 border-l-red-500';
    case 'warning': return 'border-l-4 border-l-amber-500';
    case 'info': return 'border-l-4 border-l-blue-500';
    default: return '';
  }
});

const progressColor = computed(() => {
  switch (props.action) {
    case 'success': return 'bg-green-500';
    case 'error': return 'bg-red-500';
    case 'warning': return 'bg-amber-500';
    default: return 'bg-blue-500';
  }
});

const showToast = () => {
  isVisible.value = true;
  if (props.delay) {
    timeoutId = setTimeout(() => {
      hideToast();
    }, props.delay);
  }
};

const hideToast = () => {
  isVisible.value = false;
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (props.callback) props.callback();
};

watch(() => props.trigger, (newVal, oldVal) => {
  if (newVal > oldVal) {
    showToast();
  }
});

watch(isVisible, (newValue) => {
  if (newValue) {
    nextTick(() => {
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 200);
    });
  } else {
    document.removeEventListener('click', handleClickOutside);
  }
});

const handleClickOutside = (event) => {
  if (toastContainer.value && !toastContainer.value.contains(event.target)) {
    hideToast();
  }
};

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <Transition name="toast">
    <div v-if="isVisible" class="toast-wrapper" ref="toastContainer">
      <div class="min-w-[300px]">
        <div :class="variantClasses" class="rounded-lg border border-gray-200 bg-white shadow-lg px-4 py-3 text-gray-700">
          <div v-if="!hideProgressBar" class="w-full bg-gray-200 h-1 rounded mb-2">
            <div :class="progressColor" class="h-1 rounded animate-toast-progress" :style="{ animationDuration: delay + 'ms' }"></div>
          </div>
          <div class="flex items-center">
            <div v-if="icon" class="pr-3 mr-3 border-r border-gray-200">
              <span v-html="icon"></span>
            </div>
            <div>
              <h3 v-if="title" class="font-semibold text-sm">{{ title }}</h3>
              <p class="text-sm text-gray-500">{{ message }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.toast-wrapper {
  z-index: 1000000;
  position: fixed;
  top: 20px;
  right: 20px;
}

.animate-toast-progress {
  animation: toastProgress linear 1 forwards;
  width: 0;
}

@keyframes toastProgress {
  from { width: 0%; }
  to { width: 100%; }
}

.toast-enter-active {
  transition: all 0.3s ease-out;
}
.toast-leave-active {
  transition: all 0.2s ease-in;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
