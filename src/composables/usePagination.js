// src/composables/usePagination.js
import { ref, computed } from 'vue';

// --- STATE (Exported as a singleton) ---
// This state will be shared across any component that imports it.
const totalItems = ref(0);
const limit = ref(50); // Items per page, matches your list component
const currentOffset = ref(0);

// --- COMPUTED PROPERTIES ---
const currentPage = computed(() => Math.floor(currentOffset.value / limit.value) + 1);
const totalPages = computed(() => Math.ceil(totalItems.value / limit.value));

// --- ACTIONS ---
/**
 * Sets the current page, which updates the offset.
 * @param {number} page - The page number to navigate to.
 */
function goToPage(page) {
  if (page < 1 || page > totalPages.value) return;
  currentOffset.value = (page - 1) * limit.value;
}

/**
 * Resets the pagination state, typically when filters change or the view is switched.
 */
function resetPagination() {
    totalItems.value = 0;
    currentOffset.value = 0;
}

/**
 * Updates the total number of items available for pagination.
 * This should be called by the list component after fetching data.
 * @param {number} count - The total count of items from the API.
 */
function setTotalItems(count) {
    totalItems.value = count;
}


// --- EXPORT ---
// We export a function that returns all the reactive state and methods.
// This is a common pattern for composables.
export function usePagination() {
  return {
    // State
    totalItems,
    limit,
    currentOffset,
    
    // Computed
    currentPage,
    totalPages,

    // Methods
    goToPage,
    resetPagination,
    setTotalItems,
  };
}