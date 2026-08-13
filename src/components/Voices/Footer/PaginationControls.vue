<!-- src/components/Voices/Footer/PaginationControls.vue -->
<script setup>
import { computed } from 'vue';
import { usePagination } from '../../../composables/usePagination';

const { currentPage, totalPages, goToPage } = usePagination();

const maxPageButtons = 5;

// --- PAGINATION ACTIONS ---
function goToNextPage() {
  if (currentPage.value < totalPages.value) {
    goToPage(currentPage.value + 1);
  }
}

function goToPrevPage() {
  if (currentPage.value > 1) {
    goToPage(currentPage.value - 1);
  }
}

function goToFirstPage() {
  if (currentPage.value !== 1) {
    goToPage(1);
  }
}

function goToLastPage() {
  if (currentPage.value !== totalPages.value) {
    goToPage(totalPages.value);
  }
}

// Generate page numbers array for display
const pageNumbers = computed(() => {
  const totalShown = Math.min(maxPageButtons, totalPages.value);
  let start = currentPage.value - Math.floor(totalShown / 2);
  
  start = Math.max(start, 1);
  
  if (start + totalShown - 1 > totalPages.value) {
    start = Math.max(1, totalPages.value - totalShown + 1);
  }
  
  return Array.from({ length: totalShown }, (_, i) => start + i);
});
</script>

<template>
  <div  class="flex items-center">
    <div class="flex items-center gap-1">
      <!-- First page button -->
      <button 
        @click="goToFirstPage" 
        :disabled="currentPage <= 1"
        class="flex w-8 h-8 rounded-md items-center justify-center border border-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:enabled:bg-gray-100"
        aria-label="Go to first page"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>
        </svg>
      </button>
      
      <!-- Previous page button -->
      <button 
        @click="goToPrevPage" 
        :disabled="currentPage <= 1"
        class="w-8 h-8 rounded-md flex items-center justify-center border border-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:enabled:bg-gray-100"
        aria-label="Go to previous page"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      </button>
      
      <!-- Page numbers -->
      <button
        v-for="page in pageNumbers" 
        :key="page"
        @click="goToPage(page)"
        class="flex w-8 h-8 rounded-md items-center justify-center border transition-colors"
        :class="page === currentPage 
          ? 'bg-blue-600 text-white border-blue-600 font-medium' 
          : 'border-gray-200 text-gray-700 hover:bg-gray-50'"
        :aria-current="page === currentPage ? 'page' : undefined"
      >
        {{ page }}
      </button>
      
      <!-- Next page button -->
      <button 
        @click="goToNextPage" 
        :disabled="currentPage >= totalPages"
        class="w-8 h-8 rounded-md flex items-center justify-center border border-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:enabled:bg-gray-100"
        aria-label="Go to next page"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
        </svg>
      </button>
      
      <!-- Last page button -->
      <button 
        @click="goToLastPage" 
        :disabled="currentPage >= totalPages"
        class="flex w-8 h-8 rounded-md items-center justify-center border border-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:enabled:bg-gray-100"
        aria-label="Go to last page"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>
        </svg>
      </button>
    </div>
  </div>
</template>