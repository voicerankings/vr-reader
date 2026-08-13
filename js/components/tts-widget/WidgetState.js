/**
 * ============================================================================
 * WidgetState Module
 * ============================================================================
 * A helper module that encapsulates the retrieval of various widget states
 * from local storage (e.g., read aloud state, active voice properties, and
 * text area selector state).
 */
export function getReaderState(VR_Reader) {
    let state;
    if (VR_Reader.savedLocalStorageDomain['DOMAIN_READER_STATE'] !== undefined && VR_Reader.savedLocalStorageDomain['DOMAIN_READER_STATE'] !== null) {
        state = VR_Reader.savedLocalStorageDomain['DOMAIN_READER_STATE']
    } else {
        state = VR_Reader.savedLocalStorageGlobal['DEFAULT_READER_STATE'] === undefined || VR_Reader.savedLocalStorageGlobal['DEFAULT_READER_STATE'] === null ? true : VR_Reader.savedLocalStorageGlobal['DEFAULT_READER_STATE'];
    }
    return state
}

export function getActiveVoiceState(VR_Reader) {
    return {
        voice_name: VR_Reader.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_NAME'],
        voice_lang: VR_Reader.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_LANGUAGE_CODE'],
        voice_speed: VR_Reader.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_SPEED'],
        voice_service: VR_Reader.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_SERVICE'],
        voice_has_voice_speed_support: VR_Reader.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT'],
        voice_has_word_timestamp_support: VR_Reader.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT'],
        voice_words_per_minute: VR_Reader.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_WORDS_PER_MINUTE']
    }
}

export function getReadTextAreaSelectorState(VR_Reader) {
    return VR_Reader.savedLocalStorageGlobal['DEFAULT_READ_TEXT_AREA_SELECTOR_STATE'] === undefined || VR_Reader.savedLocalStorageGlobal['DEFAULT_READ_TEXT_AREA_SELECTOR_STATE'] === null ? false : VR_Reader.savedLocalStorageGlobal['DEFAULT_READ_TEXT_AREA_SELECTOR_STATE'];
}
