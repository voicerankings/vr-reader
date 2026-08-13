<script setup>
import { ref, onMounted, computed } from 'vue'
import { saveToLocalStorage } from '../../../js/utils/helpers'

const customFilters = ref([])
const showModal = ref(false)
const editingFilter = ref(null)
const isEditing = ref(false)

const form = ref({
  domain: '',
  filter_pattern: '',
  description: '',
  priority: 0
})

// Only display entries created in this tab (explicitly typed as 'css').
const isCssFilter = (f) => f && f.type === 'css'

const displayFilters = computed(() => arrayFilter(customFilters.value).filter(isCssFilter))

function arrayFilter(list) {
  if (!Array.isArray(list)) {
    if (list && typeof list === 'object') return Object.values(list)
    return []
  }
  return list
}

async function loadFilters() {
  const result = await chrome.storage.local.get('CUSTOM_DOMAIN_FILTERS')
  customFilters.value = arrayFilter(result.CUSTOM_DOMAIN_FILTERS)
}

// Persists the FULL array (playback + css) so the two tabs never clobber each other.
async function saveFilters() {
  const plainFilters = JSON.parse(JSON.stringify(customFilters.value))
  await saveToLocalStorage({ 'CUSTOM_DOMAIN_FILTERS': plainFilters })
  chrome.runtime.sendMessage({
    action: "update-contentscript-storage",
    key: 'CUSTOM_DOMAIN_FILTERS',
    value: plainFilters
  })
}

function openAddModal() {
  isEditing.value = false
  editingFilter.value = null
  form.value = { domain: '', filter_pattern: '', description: '', priority: 0 }
  showModal.value = true
}

function openEditModal(filter) {
  isEditing.value = true
  editingFilter.value = filter
  form.value = { ...filter }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingFilter.value = null
}

function saveForm() {
  if (!form.value.domain || !form.value.filter_pattern) return
  if (isEditing.value && editingFilter.value) {
    Object.assign(editingFilter.value, form.value)
  } else {
    customFilters.value.push({
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 9),
      type: 'css',
      ...form.value
    })
  }
  saveFilters()
  closeModal()
}

function deleteFilter(index) {
  const target = displayFilters.value[index]
  const realIndex = target ? customFilters.value.indexOf(target) : index
  if (realIndex !== -1) customFilters.value.splice(realIndex, 1)
  saveFilters()
}

onMounted(loadFilters)
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-2 mb-4">
      <h3 class="text-sm font-semibold text-gray-900">
        CSS selector filters
        <span class="ml-1 text-[10px] font-mono font-normal text-gray-400">type: css</span>
      </h3>
      <button @click="openAddModal" class="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-sm cursor-pointer whitespace-nowrap flex-shrink-0">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        <span>Add</span>
      </button>
    </div>

    <!-- How CSS selector filters work guide -->
    <details class="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 group transition-all">
      <summary class="font-semibold text-slate-800 cursor-pointer flex items-center justify-between select-none">
        <span class="flex items-center gap-1.5 text-purple-600 font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
          How CSS selector filters work & examples
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3.5 h-3.5 text-slate-400 group-open:rotate-180 transition-transform">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </summary>

      <div class="mt-3 space-y-3 pt-2 border-t border-slate-200/80">
        <p class="text-slate-600 leading-relaxed">
          CSS selector filters are <strong>more precise</strong> than text filters: instead of matching spoken words, they target the actual HTML elements (ads, nav, comment boxes, recommended widgets, footers…). Their content is <strong>excluded from what is read aloud</strong> — the page itself is left untouched.
        </p>

        <div>
          <p class="font-semibold text-slate-800 mb-1">Finding a selector (DevTools)</p>
          <ol class="list-decimal ml-4 space-y-1 text-slate-600">
            <li>Right-click the element you want removed (e.g. a "Related articles" block) and choose <strong>Inspect</strong>.</li>
            <li>In the DevTools panel, find its <code class="bg-slate-100 px-1 rounded">class</code> or <code class="bg-slate-100 px-1 rounded">id</code> (e.g. <code class="font-mono text-purple-600">.related-articles</code>, <code class="font-mono text-purple-600">#comments</code>).</li>
            <li>Right-click the element row and choose <strong>Copy → Copy selector</strong>, or write one manually.</li>
          </ol>
        </div>

        <div>
          <p class="font-semibold text-slate-800 mb-1">Common selector examples</p>
          <div class="overflow-x-auto rounded-lg border border-slate-200">
            <table class="w-full text-left text-[11px]">
              <thead class="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th class="p-1.5">Selector</th>
                  <th class="p-1.5">What It Removes</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                <tr>
                  <td class="p-1.5 font-mono text-purple-600">#comments</td>
                  <td class="p-1.5 text-slate-600">Element with id <code class="bg-slate-100 px-1 rounded">comments</code></td>
                </tr>
                <tr>
                  <td class="p-1.5 font-mono text-purple-600">.newsletter</td>
                  <td class="p-1.5 text-slate-600">Elements with class <code class="bg-slate-100 px-1 rounded">newsletter</code></td>
                </tr>
                <tr>
                  <td class="p-1.5 font-mono text-purple-600">[class*="ad-banner"]</td>
                  <td class="p-1.5 text-slate-600">Elements whose class name contains <code class="bg-slate-100 px-1 rounded">ad-banner</code></td>
                </tr>
                <tr>
                  <td class="p-1.5 font-mono text-purple-600">.related, .recommended</td>
                  <td class="p-1.5 text-slate-600">A comma-separated list matches multiple selectors</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p class="font-semibold text-slate-800 mb-1">Domain Scope & Priority -1</p>
          <div class="p-2.5 bg-purple-50 border border-purple-200/80 rounded-lg text-slate-700 leading-relaxed space-y-1">
            <p><strong>Domain</strong>: same rules as playback filters — a specific domain, subdomain, or <code class="bg-purple-100 px-1 rounded">*</code> for every site.</p>
            <p><strong>Priority -1</strong>: hides the local rule and acts as an <strong>Override</strong> — a matching remote CSS rule (same Domain + Selector) is suppressed.</p>
            <p><strong>Tip</strong>: prefer specific selectors (<code class="bg-purple-100 px-1 rounded">aside.newsletter</code> over <code class="bg-purple-100 px-1 rounded">aside</code>) to avoid removing the main article.</p>
          </div>
        </div>
      </div>
    </details>

    <div v-if="displayFilters.length === 0" class="text-center py-10 text-gray-400 text-sm">
      No CSS selector filters yet.
    </div>

    <div class="space-y-2">
      <div v-for="(filter, index) in displayFilters" :key="filter.id || index" 
           class="p-3 border rounded-xl shadow-sm text-left transition-all"
           :class="filter.priority === -1 ? 'bg-rose-50/40 border-rose-200 opacity-75' : 'bg-white border-gray-200'">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1 text-left">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{{ filter.domain }}</span>
              <span class="text-xs font-mono bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">css</span>
              <span v-if="filter.priority === -1" class="text-xs font-semibold font-mono bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded">p(-1) disabled</span>
              <span v-else-if="filter.priority !== 0" class="text-xs text-gray-400">p{{ filter.priority }}</span>
            </div>
            <p class="text-sm text-gray-800 mt-1 font-mono truncate text-left" :class="{ 'line-through text-gray-400': filter.priority === -1 }">{{ filter.filter_pattern }}</p>
            <p v-if="filter.description" class="text-xs text-gray-400 mt-0.5 truncate text-left">{{ filter.description }}</p>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button @click="openEditModal(filter)" class="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-purple-600">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </button>
            <button @click="deleteFilter(index)" class="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <button @click="openAddModal" class="mt-4 w-full px-4 py-2.5 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors duration-200">
      Add new CSS selector
    </button>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="closeModal">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-5 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold text-gray-900">{{ isEditing ? 'Edit CSS selector' : 'Add CSS selector' }}</h3>
          <button @click="closeModal" class="p-1 rounded hover:bg-gray-100 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Domain <span class="text-red-400">*</span></label>
            <input v-model="form.domain" type="text" placeholder="e.g. wikipedia.org or * for all" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm">
            <p class="text-[11px] text-gray-400 mt-1">Use <code class="font-mono bg-gray-100 px-1 py-0.5 rounded">*</code> to match all websites globally.</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">CSS selector <span class="text-red-400">*</span></label>
            <input v-model="form.filter_pattern" type="text" placeholder="e.g. .newsletter, #comments, [class*='ad-']" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm font-mono">
            <p class="text-[11px] text-gray-400 mt-1">Every element matching this selector is excluded from the text that is read aloud. The page is not modified — the rule applies exactly, no content guard.</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea v-model="form.description" rows="2" placeholder="Optional notes for this filter" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm resize-none"></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <input v-model.number="form.priority" type="number" min="-1" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm">
            <p class="text-xs text-gray-400 mt-0.5">Use <code class="font-mono bg-gray-100 px-1 rounded">-1</code> to disable/hide this rule and override matching remote rules. Positive numbers set the application order.</p>
          </div>
        </div>

        <div class="mt-5 flex gap-2">
          <button @click="closeModal" class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
          <button @click="saveForm" :disabled="!form.domain || !form.filter_pattern" class="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50">
            {{ isEditing ? 'Save' : 'Add' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>