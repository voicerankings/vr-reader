<!-- /components/voices/VoiceCollectionManager.vue -->
<template>
  <div class="relative" ref="managerRootRef">
    <!-- The button that will be visible in the mini panel (only if showButton is true) -->
    <button
      v-if="showButton"
      @click="toggleDropdown"
      class="mini-panel-button"
      v-tooltip="{ content: 'Add voice to collection' }"
    >
      <svg class="mini-panel-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"></path></svg>
    </button>

    <!-- The Dropdown Panel - Using Teleport to escape overflow hidden -->
    <Teleport to="body">
      <div 
        v-if="isOpen" 
        ref="dropdownRef"
        class="collections-dropdown"
        :style="dropdownStyle"
        @mouseenter="cancelClose"
        @mouseleave="scheduleClose"
      >
      <div class="p-2">
        <input
          type="text"
          v-model="searchTerm"
          placeholder="Find or create a collection..."
          class="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <!-- Loading/Error/Empty States -->
      <div v-if="isLoading" class="p-4 text-center text-sm text-gray-500">Loading...</div>
      <div v-else-if="error" class="p-4 text-center text-sm text-red-500">{{ error }}</div>
      
      <!-- Collections List -->
      <ul v-else class="max-h-60 overflow-y-auto">
        <!-- Create New Collection Item -->
        <li v-if="canCreate">
          <button @click="handleCreateCollection" class="collection-item create-item">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
            Create & Add to "{{ searchTerm }}"
          </button>
        </li>
        <!-- Filtered List of Existing Collections -->
        <li v-for="collection in filteredCollections" :key="collection.collection_id">
          <button @click="handleAddVoiceToCollection(collection.collection_id)" class="collection-item">
            <span class="truncate">{{ collection.collection_name }}</span>
            <span v-if="addingStatus.id === collection.collection_id && addingStatus.status === 'success'" class="text-green-500 ml-auto">
              ✓ Added
            </span>
          </button>
        </li>
         <li v-if="!canCreate && filteredCollections.length === 0" class="px-4 py-3 text-sm text-gray-500 text-center">
          No collections found.
        </li>
      </ul>
          </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import useMyComposable from '../../composables/Composable';

const props = defineProps({
  voiceId: { type: String, required: true },
  showButton: { type: Boolean, default: true },
  trigger: { type: [Boolean, Number], default: false }
});

const emit = defineEmits(['dropdown-closed']);

const { 
  isUserLogged, 
  showLoginModalCount,
  API_NUXT_DOMAIN 
} = useMyComposable();

// --- STATE ---
const isOpen = ref(false);
const collections = ref([]);
const searchTerm = ref('');
const isLoading = ref(false);
const error = ref(null);
const addingStatus = ref({ id: null, status: null }); // { id, status: 'loading'|'success'|'error' }
const managerRootRef = ref(null);
const dropdownRef = ref(null);
const dropdownStyle = ref({});

// --- COMPUTED ---
const filteredCollections = computed(() => {
  if (!searchTerm.value) {
    return collections.value;
  }
  return collections.value.filter(c =>
    c.collection_name.toLowerCase().includes(searchTerm.value.toLowerCase())
  );
});

const canCreate = computed(() => {
    if (!searchTerm.value.trim()) return false;
    // Check if a collection with the exact same name already exists
    const exactMatch = collections.value.some(c => c.collection_name.toLowerCase() === searchTerm.value.trim().toLowerCase());
    return !exactMatch;
});

// --- HELPER FUNCTION TO CALCULATE POSITION ---
function calculateDropdownPosition() {
  if (!managerRootRef.value || !dropdownRef.value) return;
  
  const rect = managerRootRef.value.getBoundingClientRect();
  const dropdownHeight = dropdownRef.value.offsetHeight;
  const dropdownWidth = 260;
  const spacing = 12;
  
  // Calculate available space
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  
  let top, left;
  
  // Position vertically (prefer below, but go above if not enough space)
  if (spaceBelow >= dropdownHeight || spaceBelow > spaceAbove) {
    top = rect.bottom + spacing;
  } else {
    top = rect.top - dropdownHeight - spacing;
  }
  
  // Position horizontally (align right edge)
  left = rect.right - dropdownWidth;
  
  // Ensure dropdown doesn't go off-screen
  if (left < spacing) {
    left = spacing;
  }
  if (left + dropdownWidth > window.innerWidth - spacing) {
    left = window.innerWidth - dropdownWidth - spacing;
  }
  if (top < spacing) {
    top = spacing;
  }
  
  dropdownStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${dropdownWidth}px`
  };
}

// --- API METHODS ---
async function fetchCollections() {
  if (!isUserLogged.value) return;
  isLoading.value = true;
  error.value = null;
  try {
    const urlWithParams = `https://${API_NUXT_DOMAIN.value}/api/v1/collections/list`;
    const rawResponse = await fetch(urlWithParams);
    const responseData = await rawResponse.json();
    collections.value = responseData.collections || [];
  } catch (e) {
    console.error("Failed to fetch collections:", e);
    error.value = "Could not load collections.";
  } finally {
    isLoading.value = false;
  }
}

async function handleAddVoiceToCollection(collectionId) {
  addingStatus.value = { id: collectionId, status: 'loading' };
  try {
    const urlWithParams = `https://${API_NUXT_DOMAIN.value}/api/v1/collections/add`;
    const rawResponse = await fetch(urlWithParams, {
      method: 'POST',
      headers: { 
        'Accept': 'application/json', 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        collection_id: collectionId,
        voice_id: props.voiceId,
      })
    });
    
    if (!rawResponse.ok) {
      const errorData = await rawResponse.json();
      throw new Error(errorData.message || 'Failed to add voice');
    }
    
    addingStatus.value = { id: collectionId, status: 'success' };
    setTimeout(() => {
        isOpen.value = false;
        addingStatus.value = { id: null, status: null };
    }, 1200);
  } catch (e) {
    console.error("Failed to add voice to collection:", e);
    addingStatus.value = { id: null, status: null };
    alert(e.message || 'Failed to add voice.');
  }
}

async function handleCreateCollection() {
    if (!canCreate.value) return;
    const newCollectionName = searchTerm.value.trim();
    
    // Optimistic UI: Add to list immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticCollection = { collection_id: tempId, collection_name: newCollectionName };
    collections.value.unshift(optimisticCollection);
    
    try {
        const urlWithParams = `https://${API_NUXT_DOMAIN.value}/api/v1/collections/create`;
        const rawResponse = await fetch(urlWithParams, {
          method: 'POST',
          headers: { 
            'Accept': 'application/json', 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({ collection_name: newCollectionName })
        });
        
        if (!rawResponse.ok) {
          const errorData = await rawResponse.json();
          throw new Error(errorData.message || 'Failed to create collection');
        }
        
        const responseData = await rawResponse.json();
        const collection = responseData.collection;
        
        // Replace temp collection with real one
        const index = collections.value.findIndex(c => c.collection_id === tempId);
        if (index !== -1) {
            collections.value.splice(index, 1, collection);
        }
        
        // Automatically add the voice to the newly created collection
        await handleAddVoiceToCollection(collection.collection_id);
        
    } catch (e) {
        console.error("Failed to create collection:", e);
        // Revert optimistic UI on failure
        collections.value = collections.value.filter(c => c.collection_id !== tempId);
        alert(e.message || 'Failed to create collection.');
    }
}

// --- LIFECYCLE & EVENT HANDLING ---
function toggleDropdown() {
  if (!isUserLogged.value) {
    showLoginModalCount.value++;
    return;
  }
  isOpen.value = !isOpen.value;
}

const handleClickOutside = (event) => {
  // Don't close if clicking inside the dropdown
  const dropdown = event.target.closest('.collections-dropdown');
  if (dropdown) return;
  
  // Don't close if clicking the trigger button (it will toggle)
  if (managerRootRef.value && managerRootRef.value.contains(event.target)) return;
  
  // Close if clicking outside
  isOpen.value = false;
};

// Add a small delay before checking if mouse has left the component area
let closeTimer = null;

function scheduleClose() {
  closeTimer = setTimeout(() => {
    // Check if mouse is over dropdown or trigger
    const isOverDropdown = document.querySelector('.collections-dropdown:hover');
    const isOverTrigger = managerRootRef.value?.matches(':hover');
    
    if (!isOverDropdown && !isOverTrigger && isOpen.value) {
      isOpen.value = false;
    }
  }, 150); // Small delay to allow mouse to move to dropdown
}

function cancelClose() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

// Watch for external trigger changes
watch(() => props.trigger, (newValue, oldValue) => {
  // Only trigger if the value actually changed and is truthy
  if (newValue !== oldValue && newValue) {
    toggleDropdown();
  }
});

watch(isOpen, (newValue) => {
  if (newValue) {
    fetchCollections();
    searchTerm.value = '';
    // Calculate position after DOM update
    setTimeout(() => {
      calculateDropdownPosition();
    }, 10);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', calculateDropdownPosition, true);
    window.addEventListener('resize', calculateDropdownPosition);
  } else {
    document.removeEventListener('mousedown', handleClickOutside);
    window.removeEventListener('scroll', calculateDropdownPosition, true);
    window.removeEventListener('resize', calculateDropdownPosition);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside);
  window.removeEventListener('scroll', calculateDropdownPosition, true);
  window.removeEventListener('resize', calculateDropdownPosition);
  if (closeTimer) {
    clearTimeout(closeTimer);
  }
});
</script>

<style scoped>
.collections-dropdown {
  /* Position is now controlled by inline styles via dropdownStyle */
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  z-index: 9999;
  animation: fadeInUp 0.2s ease-out;
}
.dark .collections-dropdown {
  background: #1f2937; /* dark:bg-gray-800 */
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.collection-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 16px;
  text-align: left;
  border: none;
  background: transparent;
  color: #374151; /* dark:text-gray-300 */
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid #f3f4f6; /* dark:border-gray-700 */
}
.dark .collection-item {
  color: #d1d5db;
  border-bottom-color: #374151;
}
.collection-item:last-child {
  border-bottom: none;
}
.collection-item:hover {
  background-color: #f9fafb; /* dark:bg-gray-700 */
}
.dark .collection-item:hover {
    background-color: #374151;
}
.collection-item.create-item {
  color: #3b82f6; /* text-blue-500 */
  font-weight: 500;
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
.mini-panel-icon {
  width: 18px;
  height: 18px;
}
.mini-panel-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #6b7280;
}

.mini-panel-button:hover {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  transform: scale(1.1);
}
</style>