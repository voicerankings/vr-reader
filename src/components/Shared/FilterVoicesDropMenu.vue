<script setup>
import { ref ,computed, watchEffect, watch, onMounted  } from 'vue';
import {vOnClickOutside } from '@vueuse/components'
import useMyComposable from '../../composables/Composable';

const {  voiceFilterUpdatesCounter,
    voiceFilterOptions, voiceShowFavoritesOn, API_NUXT_DOMAIN,
    voiceFilterOpenTriggerCounter
    // voiceProviders is removed as it will now be fetched from the API
} = useMyComposable();
const isDropdownOpen = ref(false);

const countrySelectedRef = ref("");
const languageSelectedRef = ref("");
const languageSelected = ref("en");
const countrySelected = ref("");
const genderRadioCheck = ref("");
const voiceProviderSelected = ref("");

// --- State for API-driven provider list ---
const voiceProviderList = ref([]);
const isLoadingProviders = ref(false);

onMounted(async () => {
  const { getFromStorageFilterByDomainsList, voiceFilterOptions } = useMyComposable();
  const voiceOpts = await getFromStorageFilterByDomainsList();

    genderRadioCheck.value = voiceOpts.gender;
    voiceProviderSelected.value = voiceOpts.service;
    languageSelected.value = voiceOpts.languageCode;
    countrySelected.value = voiceOpts.countryCode;

  // Fetch the dynamic provider list on mount
  fetchVoiceProviders();
});

const languageList = ref([]);
const countryList = ref([]);

function toggleDropdown() {
    isDropdownOpen.value = !isDropdownOpen.value;
    if(isDropdownOpen.value === true) getFilterListLanguage();
}

// --- Fetches the dynamic list of voice providers from the API ---
async function fetchVoiceProviders() {
  isLoadingProviders.value = true;
  try {
    const url = `https://${API_NUXT_DOMAIN.value}/api/v1/voice/filtered-list?filter=providers&extension_only=true`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch providers list.');
    }

    const data = await response.json();

    if (data && Array.isArray(data.list)) {
      voiceProviderList.value = data.list;
    } else {
      throw new Error('Invalid data format received from API.');
    }

  } catch (err) {
    console.error('Error fetching voice providers:', err);
    // Optionally set an error ref to show in the UI
  } finally {
    isLoadingProviders.value = false;
  }
}

async function getFilterListLanguage(){
    const queryParams = new URLSearchParams({
        filter:'language-list',
        gender:genderRadioCheck.value,
        service:voiceProviderSelected.value || ""
    });

    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN.value}/api/v1/voice/filtered-list?${queryParams.toString()}&extension_only=true`, {
        method: 'GET',
        headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        }
    });

  const responseData = await rawResponse.json();
  languageList.value = responseData.list || [];

  setTimeout(() => {
       // findAndSelectOption(languageSelectedRef, languageSelected )
    }, 10);

  await getFilterListCountry()
}

async function getFilterListCountry(gender = "",language = "en"){
    const queryParams = new URLSearchParams({
        filter:'country-list',
        gender:genderRadioCheck.value,
        service:voiceProviderSelected.value || "",
        language:languageSelected.value
    });

    let rawResponse = await fetch(`https://${API_NUXT_DOMAIN.value}/api/v1/voice/filtered-list?${queryParams.toString()}&extension_only=true`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
  });

  const responseData = await rawResponse.json();
  countryList.value = responseData.list || [];

    setTimeout(() => {
       // findAndSelectOption(countrySelectedRef, countrySelected )
    }, 0);
}

watch(voiceFilterOpenTriggerCounter, (newState)=>{
    isDropdownOpen.value = true;
})

watch(genderRadioCheck,(newState)=>{
    getFilterListLanguage()
});

watch(languageSelected,async(newState)=>{
    await getFilterListCountry();
});

watch(voiceProviderSelected,async(newState)=>{
    await getFilterListLanguage()
});

const lang = new Intl.DisplayNames(['en'], { type: 'language' });
const languageListComputed = computed(() => {
    if (!languageList.value) return [];
    return languageList.value.map((item) => {
        try {
            // This will now handle invalid codes like "Indonesian" without crashing
            item.displayLanguage = lang.of(item.language_code);
        } catch (e) {
            // If the code is invalid, use the value from the API as a fallback
            item.displayLanguage = item.language_code;
        }
        return item;
    });
});

const region = new Intl.DisplayNames(['en'], { type: 'region' });
const countryListComputed = computed(() => {
    if (!countryList.value) return [];
    const list = countryList.value.map((item) => {
        try {
            // Also protect against invalid country codes like "SCOTT"
            item.displayCountry = region.of(item.country_code);
        } catch (e) {
            // Fallback for invalid codes
            item.displayCountry = "unknown";
            item.country_code = "unknown";
        }
        return item;
    });

    const total = list.reduce((total, current) => {
        const count = parseInt(current.country_code_count_total, 10);
        return total + (isNaN(count) ? 0 : count);
    }, 0);

    list.unshift({displayCountry:'All', country_code:'all', country_code_count_total:total});

    return list;
});

// --- Computed property to format provider names for display ---
const formattedProviders = computed(() => {
    if (!voiceProviderList.value) return [];
    return voiceProviderList.value.map(provider => {
        // Simple capitalization for display
        const displayName = provider.voice_service.charAt(0).toUpperCase() + provider.voice_service.slice(1);
        return {
            ...provider,
            displayName: displayName
        };
    });
});


function findAndSelectOption(selectedRef,selected){
    Array.from(selectedRef.value.options).forEach((option, index) => {
        if(option.value === selected.value)
            option.selected = true;
    })
}

const handleSelect = (event) => {
    const selectedOptions = event.target.selectedOptions;
    if (selectedOptions.length > 1) {
        // If more than one option is selected, deselect all but the last one selected
        Array.from(selectedOptions).forEach((option, index) => {
            option.selected = false;
        });
    }
    countrySelected.value = "all"
};
const handleSelect2 = (event) => {
    const selectedOptions = event.target.selectedOptions;
    if (selectedOptions.length > 1) {
        // If more than one option is selected, deselect all but the last one selected
        Array.from(selectedOptions).forEach((option, index) => {
            option.selected = false;
        });
    }
};

const handleSelect3 = (event) => {
    const selectedOptions = event.target.selectedOptions;
    if (selectedOptions.length > 1) {
        // If more than one option is selected, deselect all but the last one selected
        Array.from(selectedOptions).forEach((option, index) => {
            option.selected = false;
        });
    }
};

function closeMenu(){
    isDropdownOpen.value = false;
}

function applyFilter(){
    //save to local storage
    const languageCode = (typeof languageSelected.value === 'string')? languageSelected.value : languageSelected.value[0];
    const countryCode = (typeof countrySelected.value === 'string')? countrySelected.value : countrySelected.value[0];

    chrome.storage.local.set({
        'VOICE_FILTER_OPTIONS': {
            'gender':genderRadioCheck.value,
            'service':voiceProviderSelected.value,
            'languageCode':languageCode,
            'countryCode':countryCode
        }
    });
    voiceFilterOptions.value.gender = genderRadioCheck.value;
    voiceFilterOptions.value.languageCode = languageCode;
    voiceFilterOptions.value.countryCode = countryCode;
    voiceFilterOptions.value.service = voiceProviderSelected.value
    voiceShowFavoritesOn.value = false;
    voiceFilterUpdatesCounter.value++;


    closeMenu()
}
</script>

<template>

    <div class="relative flex">
        <div class="" v-on-click-outside="closeMenu">
            <button id="dropdown-button" @click="toggleDropdown()" :class="{'text-green-300':isDropdownOpen}" class=" justify-center block relative hover:text-green-300 cursor-pointer">
                <svg v-tooltip="'Filter by voices'" xmlns="http://www.w3.org/2000/svg" class="border-none outline-none" fill="currentColor" height="24" viewBox="0 -960 960 960" width="24"><path d="M400-240v-80h160v80H400ZM240-440v-80h480v80H240ZM120-640v-80h720v80H120Z"/></svg>
            </button>
            <div  v-if="isDropdownOpen" id="dropdown-menu" class="overflow-hidden z-[100] origin-top-right absolute -right-12 mt-2 w-[320px] rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                <div class="w-full  h-[310px] grid grid-rows-[auto_1fr] overflow-hidden " style=" grid-template-rows:40px auto 40px;">
                    <div class='relative flex  justify-center  bg-gray-50 p-2 h-10'>
                        <div class="flex w-1/2 items-center space-x-2 roundedpy-1 px-2 text-slate-500 font-bold">
                            <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16"><path d="M440-160q-17 0-28.5-11.5T400-200v-240L168-736q-15-20-4.5-42t36.5-22h560q26 0 36.5 22t-4.5 42L560-440v240q0 17-11.5 28.5T520-160h-80Zm40-308 198-252H282l198 252Zm0 0Z"/></svg>
                            <span>Filter voices by</span>
                        </div>
                        <div class="flex justify-end w-1/2">
                            <button @click="applyFilter()"
                            class="flex items-center   mr-3 rounded bg-blue-500 hover:bg-blue-700  px-6 font-sans    text-white  shadow-blue-500/20 transition-all hover:shadow-md hover:shadow-blue-500/40 focus:opacity-[0.85] focus:shadow-none active:opacity-[0.85] active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                        >Apply Filter</button>
                        </div>

                    </div>

                    <div class="font-semibold grid text-slate-600 bg-gray-50" style="grid-template-rows:50px auto">

                        <main class="grid w-full place-items-center">
                            <div class="grid w-full grid-cols-3 gap-2  bg-gray-200 p-2">

                                    <div>
                                        <input v-model="genderRadioCheck" type="radio" name="option" id="voiceBoth" value="" class="peer hidden" checked />
                                        <label for="voiceBoth" class="block text-slate-600 cursor-pointer select-none rounded-xl p-2 text-center peer-checked:bg-blue-500 peer-checked:font-bold peer-checked:text-white">both</label>
                                    </div>

                                    <div>
                                        <input v-model="genderRadioCheck" type="radio" name="option" id="voiceMale" value="male" class="peer hidden" />
                                        <label for="voiceMale" class="block text-slate-600 cursor-pointer select-none rounded-xl p-2 text-center peer-checked:bg-blue-400 peer-checked:font-bold peer-checked:text-white">male</label>
                                    </div>

                                    <div>
                                        <input v-model="genderRadioCheck" type="radio" name="option" id="voiceFemale" value="female" class="peer hidden" />
                                        <label for="voiceFemale" class="block text-slate-600 cursor-pointer select-none rounded-xl p-2 text-center peer-checked:bg-pink-400 peer-checked:font-bold peer-checked:text-white">female</label>
                                    </div>

                            </div>
                        </main>
                        <div class="flex">
                            <div class="py-2 grid grid-rows-[auto_1fr] w-[50%]">
                            <span class="mb-2">language</span>
                            <select @change="handleSelect" ref="languageSelectedRef" v-model="languageSelected" multiple class="w-full  border border-slate-200 border-l-0 border-r-0">
                                <option class="p-1 text-sm" v-for="(language) in languageListComputed" :key="'lang_'+language.language_code" :value="language.language_code">{{ language.displayLanguage }} ({{ language.language_code_count_total  }})</option>
                            </select>
                            </div>
                            <div class="py-2 grid grid-rows-[auto_1fr] w-[50%]">
                                <span class="mb-2">country</span>
                                <select @change="handleSelect2" ref="countrySelectedRef" v-model="countrySelected" multiple  class="w-full border border-slate-200 border-l-0 border-r-0">
                                    <option class="p-1 text-sm"
                                    v-for="(country) in countryListComputed"
                                    :selected="country.selected"
                                    :key="'lang_'+country.country_code"  :value="country.country_code">{{ country.displayCountry }} ({{ country.country_code_count_total  }})</option>
                                </select>
                            </div>
                        </div>

                    </div>

                    <div class='relative flex gap-2  justify-end  bg-gray-50 p-2 h-10 border-t'>

                        <div class=" flex-grow flex-1">
                            <select @change="handleSelect2" v-model="voiceProviderSelected" class="w-full h-6 px-2 text-sm text-slate-600 bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-500">
                                <option value="">All Voice Providers</option>
                                <option v-if="isLoadingProviders" disabled>Loading...</option>
                                <option
                                    v-for="provider in formattedProviders"
                                    :key="provider.voice_service"
                                    :value="provider.voice_service"
                                >
                                    {{ provider.displayName }} ({{ provider.voice_count }})
                                </option>
                            </select>
                        </div>
                        <button @click="applyFilter()"
                            class="flex items-center   mr-3 rounded bg-blue-500 hover:bg-blue-700  px-6 font-sans    text-white  shadow-blue-500/20 transition-all hover:shadow-md hover:shadow-blue-500/40 focus:opacity-[0.85] focus:shadow-none active:opacity-[0.85] active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                        >Apply Filter</button>

                    </div>
                </div>


            </div>
        </div>
    </div>

</template>