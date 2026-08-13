/**
 * ============================================================================
 * VoicePreferences (Global State Access Layer)
 * ============================================================================
 * Acts as a bridge between the TTS engine and the cached local storage state 
 * stored on the global `VR_Reader` object. Provides standardized getters.
 */
export default class VoicePreferences {
    constructor(vrReader) {
        this._vr = vrReader;
    }

    get activeVoiceId() {
        return this._vr.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_ID'];
    }
    get activeVoiceSpeed() {
        return this._vr.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_SPEED'];
    }
    get hasVoiceSpeedSupport() {
        return this._vr.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT'];
    }
    get activeVoiceService() {
        return this._vr.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_SERVICE'];
    }
    get activeVoiceGender() {
        return this._vr.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_GENDER'];
    }
    get activeVoiceName() {
        return this._vr.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_NAME'];
    }
    get activeVoiceSpeakerId() {
        return this._vr.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_SPEAKER_ID'];
    }
    get activeVoiceWordsPerMinute() {
        return this._vr.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_WORDS_PER_MINUTE'];
    }
    get activeVoiceInstructions() {
        return this._vr.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_INSTRUCTIONS'];
    }
    get activeVoiceLanguageCode() {
        return this._vr.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_LANGUAGE_CODE'];
    }
    get hasWordTimestampSupport() {
        return this._vr.savedLocalStorageGlobal['ACTIVE_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT'];
    }
    get defaultVoiceName() {
        return this._vr.savedLocalStorageGlobal['DEFAULT_PREMIUM_VOICE_NAME'];
    }
    get defaultVoiceLanguageCode() {
        return this._vr.savedLocalStorageGlobal['DEFAULT_PREMIUM_VOICE_LANGUAGE_CODE'];
    }
    get defaultVoiceSpeed() {
        return this._vr.savedLocalStorageGlobal['DEFAULT_PREMIUM_VOICE_SPEED'];
    }
    get defaultSpeakerId() {
        return this._vr.savedLocalStorageGlobal['DEFAULT_VOICE_SPEAKER_ID'];
    }
    set defaultSpeakerId(val) {
        this._vr.savedLocalStorageGlobal['DEFAULT_VOICE_SPEAKER_ID'] = val;
    }
    get defaultVoiceNameFallback() {
        return this._vr.savedLocalStorageGlobal['DEFAULT_VOICE_NAME'];
    }
    get highlightReadingEnabled() {
        return this._vr.savedLocalStorageGlobal['DEFAULT_HIGHLIGHT_READING_STATE'] === true;
    }
    get autoscrollReadingEnabled() {
        return this._vr.savedLocalStorageGlobal['DEFAULT_AUTOSCROLL_READING_STATE'] === true;
    }
    get highlightMode() {
        return this._vr.savedLocalStorageGlobal['DEFAULT_HIGHLIGHT_MODE_STATE'] || 'smooth';
    }

    get voiceSettings() {
        return {
            voice_id: this.activeVoiceId,
            voice_service: this.activeVoiceService,
            voice_gender: this.activeVoiceGender,
            voice_name: this.activeVoiceName,
            voice_speaker_id: this.activeVoiceSpeakerId,
            voice_words_per_minute: this.activeVoiceWordsPerMinute,
            voice_instructions: this.activeVoiceInstructions,
            voice_language_code: this.activeVoiceLanguageCode,
            voice_speed: this.activeVoiceSpeed,
            voice_has_voice_speed_support: this.hasVoiceSpeedSupport,
            voice_has_word_timestamp_support: this.hasWordTimestampSupport
        };
    }

    get defaultVoiceInfo() {
        return {
            voice_name: this.defaultVoiceName,
            voice_lang: this.defaultVoiceLanguageCode,
            voice_speed: this.defaultVoiceSpeed,
        };
    }
}
