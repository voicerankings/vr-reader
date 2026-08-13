import { ref, watch } from 'vue';
import {readLocalStorage, fnBrowserDetect,isNotEqualToNullorUndefined} from '../../js/utils/helpers'

const quickAccessState = ref(true);
const quickAccessPanelPlacementState = ref("bottom");
const enterKeyPlayState = ref(true);

const contextMenuShowRecentVoicesState = ref(false)

const highlightState = ref(true);
const autoscrollState = ref(true);
const autoReadTitleState = ref(true);
const highlightModeState = ref("smooth"); 
const highlightThemeState = ref("auto"); // ✅ NEW: Theme state (auto/light/dark)

const maxAutoReadLimitEnabled = ref(false);
const maxAutoReadLimit = ref(4000);

const externalTimestampServiceState = ref("None");
const openAiSttApiKeyState = ref("");
const deepgramSttApiKeyState = ref("");
const openRouterSttApiKeyState = ref("");
const openRouterSttModelState = ref("openai/whisper-large-v3");

const summReaderPageState = ref("AUTO_READ");


const pageChatAudioState = ref(true);
const pageChatModelState = ref("Claude");

async function getPageChatAudioState(){
    let result = await readLocalStorage(['DEFAULT_PAGE_CHAT_AUDIO_STATE']); 
    pageChatAudioState.value = isNotEqualToNullorUndefined(result.DEFAULT_PAGE_CHAT_AUDIO_STATE)? result.DEFAULT_PAGE_CHAT_AUDIO_STATE : pageChatAudioState.value;
}  

async function getPageChatModelState(){
    let result = await readLocalStorage(['DEFAULT_PAGE_CHAT_MODEL_STATE']); 
    pageChatModelState.value = isNotEqualToNullorUndefined(result.DEFAULT_PAGE_CHAT_MODEL_STATE)? result.DEFAULT_PAGE_CHAT_MODEL_STATE : pageChatModelState.value;
}  

// ✅ UPDATED: Add Theme state to fetch
async function getFromStorageHighlightOptions(){
    let result = await readLocalStorage([
        'DEFAULT_HIGHLIGHT_READING_STATE',
        'DEFAULT_AUTOSCROLL_READING_STATE',
        'DEFAULT_AUTO_READ_TITLE_STATE',
        'DEFAULT_HIGHLIGHT_MODE_STATE', 
        'DEFAULT_HIGHLIGHT_THEME_STATE',
        'DEFAULT_MAX_AUTO_READ_LIMIT_ENABLED',
        'DEFAULT_MAX_AUTO_READ_LIMIT'
    ]); 

    highlightState.value = isNotEqualToNullorUndefined(result.DEFAULT_HIGHLIGHT_READING_STATE)? result.DEFAULT_HIGHLIGHT_READING_STATE : highlightState.value;
    autoscrollState.value = isNotEqualToNullorUndefined(result.DEFAULT_AUTOSCROLL_READING_STATE)? result.DEFAULT_AUTOSCROLL_READING_STATE : autoscrollState.value;
    autoReadTitleState.value = isNotEqualToNullorUndefined(result.DEFAULT_AUTO_READ_TITLE_STATE)? result.DEFAULT_AUTO_READ_TITLE_STATE : autoReadTitleState.value;
    highlightModeState.value = isNotEqualToNullorUndefined(result.DEFAULT_HIGHLIGHT_MODE_STATE)? result.DEFAULT_HIGHLIGHT_MODE_STATE : highlightModeState.value;
    highlightThemeState.value = isNotEqualToNullorUndefined(result.DEFAULT_HIGHLIGHT_THEME_STATE)? result.DEFAULT_HIGHLIGHT_THEME_STATE : highlightThemeState.value;
    maxAutoReadLimitEnabled.value = isNotEqualToNullorUndefined(result.DEFAULT_MAX_AUTO_READ_LIMIT_ENABLED)? result.DEFAULT_MAX_AUTO_READ_LIMIT_ENABLED : maxAutoReadLimitEnabled.value;
    maxAutoReadLimit.value = isNotEqualToNullorUndefined(result.DEFAULT_MAX_AUTO_READ_LIMIT)? result.DEFAULT_MAX_AUTO_READ_LIMIT : maxAutoReadLimit.value;
}  

async function getFromStorageQuickAccessControls(){
    let result = await readLocalStorage([
        'DEFAULT_QUICK_ACCESS_CONTROLS_STATE',
        'DEFAULT_QUICK_ACCESS_CONTROLS_PANEL_PLACEMENT_STATE',
        'DEFAULT_ENTER_KEY_PLAY_STATE'
    ]); 

    quickAccessState.value = isNotEqualToNullorUndefined(result.DEFAULT_QUICK_ACCESS_CONTROLS_STATE)? result.DEFAULT_QUICK_ACCESS_CONTROLS_STATE : quickAccessState.value;
    quickAccessPanelPlacementState.value = isNotEqualToNullorUndefined(result.DEFAULT_QUICK_ACCESS_CONTROLS_PANEL_PLACEMENT_STATE) ? result.DEFAULT_QUICK_ACCESS_CONTROLS_PANEL_PLACEMENT_STATE : quickAccessPanelPlacementState.value;
    enterKeyPlayState.value = isNotEqualToNullorUndefined(result.DEFAULT_ENTER_KEY_PLAY_STATE) ? result.DEFAULT_ENTER_KEY_PLAY_STATE : enterKeyPlayState.value;
}  

async function getFromStorageContextMenuControls(){
    let result = await readLocalStorage(['CONTEXT_MENU_SHOW_RECENT_VOICES']); 
    contextMenuShowRecentVoicesState.value = isNotEqualToNullorUndefined(result.CONTEXT_MENU_SHOW_RECENT_VOICES)? result.CONTEXT_MENU_SHOW_RECENT_VOICES : contextMenuShowRecentVoicesState.value;
}  

async function getFromStorageSummReaderSettings(){
    let result = await readLocalStorage(['DEFAULT_SUMM_READER_PAGE_STATE']);
    summReaderPageState.value = isNotEqualToNullorUndefined(result.DEFAULT_SUMM_READER_PAGE_STATE) ? result.DEFAULT_SUMM_READER_PAGE_STATE : summReaderPageState.value;
    summReaderHighlightState.value = isNotEqualToNullorUndefined(result.DEFAULT_SUMM_READER_HIGHLIGHT_STATE) ? result.DEFAULT_SUMM_READER_HIGHLIGHT_STATE : summReaderHighlightState.value;
}

async function getFromStorageExternalTimestampSettings(){
    let result = await readLocalStorage([
        'DEFAULT_EXTERNAL_TIMESTAMP_SERVICE',
        'OPENAI_STT_API_KEY',
        'DEEPGRAM_STT_API_KEY',
        'OPENROUTER_STT_API_KEY',
        'DEFAULT_OPENROUTER_STT_MODEL'
    ]);
    externalTimestampServiceState.value = isNotEqualToNullorUndefined(result.DEFAULT_EXTERNAL_TIMESTAMP_SERVICE) ? result.DEFAULT_EXTERNAL_TIMESTAMP_SERVICE : "None";
    openAiSttApiKeyState.value = isNotEqualToNullorUndefined(result.OPENAI_STT_API_KEY) ? result.OPENAI_STT_API_KEY : "";
    deepgramSttApiKeyState.value = isNotEqualToNullorUndefined(result.DEEPGRAM_STT_API_KEY) ? result.DEEPGRAM_STT_API_KEY : "";
    openRouterSttApiKeyState.value = isNotEqualToNullorUndefined(result.OPENROUTER_STT_API_KEY) ? result.OPENROUTER_STT_API_KEY : "";
    openRouterSttModelState.value = isNotEqualToNullorUndefined(result.DEFAULT_OPENROUTER_STT_MODEL) ? result.DEFAULT_OPENROUTER_STT_MODEL : "openai/whisper-large-v3";
}

export default function useLocalSettings() {
    return {
        quickAccessState, 
        quickAccessPanelPlacementState,
        enterKeyPlayState,
        getFromStorageQuickAccessControls,
        getFromStorageContextMenuControls,
        contextMenuShowRecentVoicesState,
        summReaderPageState,

        getFromStorageSummReaderSettings,
        getFromStorageHighlightOptions,
        highlightState,
        autoscrollState,
        autoReadTitleState,
        highlightModeState,
        highlightThemeState, // ✅ NEW: Export theme state
        maxAutoReadLimitEnabled,
        maxAutoReadLimit,
        getPageChatAudioState,
        pageChatAudioState,
        getPageChatModelState,
        pageChatModelState,
        externalTimestampServiceState,
        openAiSttApiKeyState,
        deepgramSttApiKeyState,
        openRouterSttApiKeyState,
        openRouterSttModelState,
        getFromStorageExternalTimestampSettings,
    }
}