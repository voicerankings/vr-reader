export const CONSTANTS = {
    ABBREVIATIONS: [
        "Mr", "Mrs", "Ms", "Dr", "Prof", "Sr", "Jr", "St", "Co", "Inc", "Ltd", "etc",
        "Mx", "Capt", "Col", "Gen", "Lt", "Maj", "Sgt", "Adm", "Cdr", "Rev", "Hon",
        "Pres", "Gov", "Sen", "Rep", "Amb", "Supt", "Pr", "Art", "Mme", "Mlle",
        "Messrs", "Mmes", "PhD", "MD", "DDS", "DVM", "Esq", "Mt", "Ave", "Blvd",
        "Rd", "Ln", "Pvt", "Corp", "LLC", "PLC", "Bros", "Assn", "Dept",
        "M.D", "J.D", "Ph.D", "B.A", "B.S", "M.A", "M.S",
        "A.M", "P.M", "e.g", "i.e", "vs", "c",
        "in", "ft", "lb", "gal", "Dir", "Sec", "Exec", "Treas"
    ],
    ELEMENTS_PATH_TYPE: {
        CLASS_XPATH: 'CLASS_XPATH',
        SIMPLE_XPATH: 'SIMPLE_XPATH',
        CSS_SELECTOR: 'CSS_SELECTOR',
    },
    ELEMENT_MATCH_TEXT_CONDITION: {
        CONTAINS_TEXT_ANYWHERE: 'CONTAINS_TEXT_ANYWHERE',
        CONTAINS_ONLY_THIS_TEXT: 'CONTAINS_ONLY_THIS_TEXT',
        STARTS_WITH_THIS: 'STARTS_WITH_THIS',
    },
    PROMPT_RULE_ACTION: {
        REPLACE_TEXT_SHORTCUT: 'REPLACE_TEXT_SHORTCUT',
        REPLACE_TEXT_PAGE_SEARCH: 'REPLACE_TEXT_PAGE_SEARCH',
        REPLACE_TEXT_SAVE_CHAT: 'REPLACE_TEXT_SAVE_CHAT'
    },

    CHATBOX_ELEMENT_XPATHS_KEYNAME: 'CHATBOX_ELEMENT_XPATH_LIST',
    PROMPT_RULE_KEYNAME: 'promptRule',
    DEFAULT_AUTO_PLAY_WITH_ENTER_KEY_STATE_KEYNAME: 'DEFAULT_AUTO_PLAY_WITH_ENTER_KEY_STATE',


    DOMAIN_AUTO_PLAY_WITH_KEYBOARD_ENTER_KEY_STATE_KEYNAME: 'DOMAIN_AUTO_PLAY_WITH_KEYBOARD_ENTER_KEY_STATE',
    DOMAIN_AUTO_SETTINGS_STATE_KEYNAME: 'DOMAIN_AUTO_SETTINGS_STATE',
    DOMAIN_POWER_STATE_KEYNAME: 'DOMAIN_POWER_STATE',
    DOMAIN_QUICK_ACCESS_STATE_KEYNAME: 'DOMAIN_QUICK_ACCESS_STATE',
    DOMAIN_READER_STATE_KEYNAME: 'DOMAIN_READER_STATE',
    DOMAIN_SAVE_CHATS_STATE_KEYNAME: 'DOMAIN_SAVE_CHATS_STATE',
    DOMAIN_CHAT_DETECT_STATE_KEYNAME: 'DOMAIN_CHAT_DETECT_STATE',
    DOMAIN_REMEMBER_MESSAGE_SHOWN_KEYNAME: 'DOMAIN_REMEMBER_MESSAGE_STATE',
    SAVED_SETTINGS_KEYNAME: 'SAVED_SETTINGS',

    UPDATE_CONTENT_SCRIPT_ACTION: 'update-auto-save-and-play',
    UPDATE_CONTENT_SCRIPT_TYPE_AUTO_PLAY: 'auto-play',
    UPDATE_CONTENT_SCRIPT_TYPE_AUTO_SETTINGS: 'auto-settings',
    UPDATE_CONTENT_SCRIPT_TYPE_POWER: 'power',
    UPDATE_CONTENT_SCRIPT_TYPE_AUTO_SAVE: 'auto-save',
    UPDATE_CONTENT_SCRIPT_TYPE_AUTO_CHAT_DETECT: 'auto-chat-detect',
    UPDATE_CONTENT_SCRIPT_TYPE_SUGGEST_SIDEBAR: 'suggest-sidebar',
    UPDATE_CONTENT_SCRIPT_TYPE_PLAY_CLEAN_UP: 'play-clean-up',
    UPDATE_CONTENT_SCRIPT_TYPE_SAVE_CLEAN_UP: 'save-clean-up',
    UPDATE_CONTENT_SCRIPT_TYPE_STRICT_MODE: 'strict-mode',
    UPDATE_CONTENT_SCRIPT_TYPE_AUTO_PLAY_WITH_ENTER_KEY: 'auto-play-enter-key',
    UPDATE_CONTENT_SCRIPT_TYPE_REVERSE_CHAT_LAYOUT: 'reverse-chat-layout',
    SEND_BUTTON_KEYNAME: 'sendElement',

    AUDIO_STATUS_TYPE: {
        OFF: 'OFF',
        PLAYING: 'PLAYING',
        PAUSED: 'PAUSED',  // ✅ Add this if missing
        TRANSITION: 'TRANSITION'
    },

    TTS_VOICE_SERVICE: {
        EXTERNAL_VOICE: 'EXTERNAL_VOICE',
        PREMIUM_VOICE: 'PREMIUM_VOICE',
        BROWSER_VOICE: 'BROWSER_VOICE'
    },
    PREMIUM_TTS_TYPE: {
        GOOGLE_VOICES: 'GOOGLE_VOICES',
        RIME_VOICES: 'RIME_VOICES',
        OPENAI_VOICES: 'OPENAI_VOICES'
    },
    PREMIUM_TTS_SETTINGS: {
        serviceSettings: { speakingRate: 1.0, languageCode: 'en-US', name: 'en-US-Journey-F', ssmlGender: 'MALE' },
        voiceSpeedSetting: 1.0
    },
    NOTIFICATION_NAME: {
        CLICK_BUTTON_CLOSE: 'click-button-close',
        CLICK_BUTTON_CLOSE_OR_PROMPT_FOUND_CLOSE: 'click-button-close-or-prompt-found'
    },
    NOTIFICATION_ICON: {
        TIMESTAMP_CLOCK_24: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960"><path fill="currentColor" d="m480-640-62 138-138 62 138 62 62 138 62-138 138-62-138-62zM360-840v-80h240v80zM480-80q-74 0-139.5-28.5T226-186t-77.5-114.5T120-440t28.5-139.5T226-694t114.5-77.5T480-800q62 0 119 20t107 58l56-56 56 56-56 56q38 50 58 107t20 119q0 74-28.5 139.5T734-186t-114.5 77.5T480-80m0-80q116 0 198-82t82-198-82-198-198-82-198 82-82 198 82 198 198 82m0-280"/></svg>`,
        ERROR_32: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" height="32" width="32" version="1.1" id="Layer_1" viewBox="0 0 512 512" xml:space="preserve">
        <path style="fill:#FF9F19;" d="M445.215,478.835H66.848c-23.67,0-45.079-12.118-57.25-32.418  c-12.182-20.3-12.802-44.883-1.663-65.781L198.889,65.387c12.182-20.17,33.548-32.222,57.142-32.222s44.959,12.052,57.152,32.245  l190.499,314.433c11.585,21.692,10.966,46.274-1.217,66.575C490.294,466.717,468.885,478.835,445.215,478.835z"/>
        <path style="fill:#F28618;" d="M445.215,478.835c23.67,0,45.079-12.118,57.25-32.418c12.182-20.3,12.802-44.883,1.217-66.575  L313.184,65.409c-12.193-20.193-33.559-32.245-57.152-32.245v445.67H445.215z"/>
        <path style="fill:#486475;" d="M256.031,345.294c-9.215,0-16.693-7.477-16.693-16.693V161.675c0-9.215,7.477-16.693,16.693-16.693  s16.693,7.477,16.693,16.693v166.926C272.724,337.817,265.247,345.294,256.031,345.294z"/>
        <path style="fill:#3C4D5C;" d="M256.031,412.061c-9.21,0-16.693-7.498-16.693-16.693s7.483-16.693,16.693-16.693  c9.21,0,16.693,7.498,16.693,16.693S265.241,412.061,256.031,412.061z"/>
        </svg>`,
        LICENSE_KEY_ICON_24: '<svg width="24" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g fill="#FFA000"><path d="M30 41l-4 4h-4l-4-4V21h12v8l-2 2l2 2v2l-2 2l2 2z"/><path d="M38 7.8c-.5-1.8-2-3.1-3.7-3.6C31.9 3.7 28.2 3 24 3s-7.9.7-10.3 1.2C12 4.7 10.5 6 10 7.8c-.5 1.7-1 4.1-1 6.7c0 2.6.5 5 1 6.7c.5 1.8 1.9 3.1 3.7 3.5c2.4.6 6.1 1.3 10.3 1.3s7.9-.7 10.3-1.2c1.8-.4 3.2-1.8 3.7-3.5s1-4.1 1-6.7c0-2.7-.5-5.1-1-6.8zM29 13H19c-1.1 0-2-.9-2-2V9c0-.6 3.1-1 7-1s7 .4 7 1v2c0 1.1-.9 2-2 2z"/></g><path fill="#D68600" d="M23 26h2v19h-2z"/></svg>',
        SAVE_CHAT: '<svg xmlns="http://www.w3.org/2000/svg" height="30" fill="currentColor" viewBox="0 -960 960 960" width="50"><path d="m720-122.667-46.666-46.666L743-240H566.667v-66.666H743l-69.666-70.667L720-424l150.666 150.667L720-122.667ZM120-120v-613.334q0-27.5 19.583-47.083T186.666-800h506.668q27.5 0 47.083 19.583T760-733.334V-517q-10-2-20-2.5t-20-.5q-6.667 0-13.333.278-6.667.278-13.333 1.389v-215.001H186.666v426.668h295.001q-1.111 6.666-1.389 13.333Q480-286.667 480-280q0 10 .5 20t2.5 20H240L120-120Zm160-453.334h320V-640H280v66.666Zm0 166.667h200v-66.666H280v66.666Zm-93.334 100.001v-426.668 426.668Z"/></svg>',
        SAVE_CHAT_CHECK_24: '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" fill="currentColor"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>',
        SAVE_CHAT_CHECK_18: '<svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" fill="currentColor"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>',
        TALK_TO_ME_20: '<svg width="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g fill="none" stroke-width="4" stroke-linejoin="round"><path d="M24 44c11.046 0 20-8.954 20-20S35.046 4 24 4S4 12.954 4 24s8.954 20 20 20z" fill="#2F88FF" stroke="#000"/><path d="M24 35c5 0 7-4 7-4H17s2 4 7 4zM31 20v1M17 20v1" stroke="#fff" stroke-linecap="round"/></g></svg>',
        SEND_BUTTON_24: '<svg width="24" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><path d="M0 0l20 10L0 20V0zm0 8v4l10-2L0 8z" fill="currentColor"/></svg>',
        PLAY_STOPPED_36: `<svg height="36" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g stroke-width="1.5" fill="none"><path d="M12 3v16" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 8v6" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 9v4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9v4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 6v8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.121 21.364l2.122-2.121m0 0l2.121-2.122m-2.121 2.122L16.12 17.12m2.122 2.122l2.121 2.121" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`,
        PLAY_24: `<svg width="24" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><path d="M5 4l10 6l-10 6V4z" fill="currentColor"/></svg>`,
        PLAY_AUDIO: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 10v3m4-7v11m4-14v18m4-13v7m4-10v13m4-8v3"/></svg>`,
        LINE_32: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="currentColor"><path d="M11.48 5.616c.383.153.635.524.635.937v7.503a1.01 1.01 0 0 1-2.02 0V9.21a.053.053 0 0 0-.09-.037a1.01 1.01 0 1 1-1.463-1.392l1.832-1.924a1.01 1.01 0 0 1 1.106-.241Zm9.35 1.948c-.179.009-.461.097-.779.475a1.01 1.01 0 1 1-1.546-1.3c.622-.74 1.402-1.151 2.224-1.192a2.742 2.742 0 0 1 2.073.81c1.1 1.097 1.236 2.969-.174 4.483c-.41.44-.907.96-1.41 1.485v.001l-.487.508a.125.125 0 0 0 .09.212h2.075a1.01 1.01 0 0 1 0 2.02h-4.05c-1.086 0-1.736-1.296-.959-2.152c.492-.542 1.221-1.305 1.917-2.033c.5-.523.982-1.027 1.346-1.418c.385-.413.485-.775.486-1.029a.902.902 0 0 0-.26-.647a.723.723 0 0 0-.546-.223ZM10.019 19.48a.898.898 0 1 1 1.18 1.206a.125.125 0 0 1-.037.01a1.01 1.01 0 0 0-.076 1.998a.899.899 0 1 1-1.113 1.134a1.01 1.01 0 1 0-1.925.612a2.918 2.918 0 1 0 5.105-2.649a.132.132 0 0 1 0-.16A2.918 2.918 0 1 0 8.2 18.602a1.01 1.01 0 1 0 1.82.877Zm10.469-1.221a1.01 1.01 0 0 0-1.96-.49l-1.058 4.245a1.01 1.01 0 0 0 .98 1.255h2.264c.069 0 .125.056.125.125v2.053a1.01 1.01 0 0 0 2.02 0V23.35c0-.06.042-.11.099-.127a1.01 1.01 0 0 0 0-1.928a.136.136 0 0 1-.1-.128v-.556a1.01 1.01 0 0 0-2.019 0v.513a.125.125 0 0 1-.125.125h-.811a.125.125 0 0 1-.121-.155l.706-2.835Z"/><path d="M6 1a5 5 0 0 0-5 5v20a5 5 0 0 0 5 5h20a5 5 0 0 0 5-5V6a5 5 0 0 0-5-5H6ZM3 6a3 3 0 0 1 3-3h20a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Z"/></g></svg>`
    },
    ICON: {
        PLAY_16: '<svg height="16" viewBox="0 0 1664 1664" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><path d="M1664 832q0 203-66.5 386.5T1391 1517q-24 19-47 19q-26 0-45-19t-19-45q0-32 31-55q80-58 133-163.5t72.5-209.5t19.5-212t-19.5-212t-72.5-209.5T1311 247q-31-23-31-55q0-26 19-45t45-19q23 0 47 19q140 115 206.5 298.5T1664 832zm-256 0q0-161-51.5-309.5T1198 275q-21-19-46-19q-26 0-45 19t-19 45q0 31 29 54q82 67 122.5 198.5T1280 832t-40.5 259.5T1117 1290q-29 23-29 54q0 26 19 45t45 19q25 0 46-19q107-99 158.5-247.5T1408 832zm-448 448q-26 0-45-19t-19-45q0-24 17-43q111-130 111-341q0-210-111-341q-17-19-17-43q0-26 19-45t45-19q27 0 48 21q72 75 108 192t36 235t-36 235t-108 192q-21 21-48 21zM64 128q-26 0-45-19T0 64t19-45T64 0q121 0 226 41t182 126.5T575 371q18 66 49 100q23 26 96 62t97 65q7 9 11 21.5t4.5 19t0 25t-.5 21.5q0 26-13 48.5t-37.5 40t-47 29.5t-55.5 26l-96 37q5 20 22.5 57.5t28 71t5.5 59.5q-5 24-43 31q-49 16-154 17.5t-154-6.5q33 39 55 57q34 27 66 39t103 24q69 11 64 70q-9 95-82.5 140.5T320 1472q-19 0-32.5 8.5T268 1503t-9.5 31t-3 34t.5 32q0 26-19 45t-45 19t-45-19t-19-45v-64q0-82 56-137t136-55q34-1 74.5-11t41.5-31q-128-12-218-84t-90-194q0-33 26-50.5t59-10.5q92 21 215 19q44 0 66-7q-1-2-23.5-61T448 832q0-44 48-62q5-2 35-11t58-18t58-21.5t47.5-26.5t14.5-27q-4-10-45-29t-88.5-46t-65.5-53q-49-70-61-143q-15-72-51.5-123t-92-79.5T194 150T64 128z" fill="currentColor"/></svg>',
        SAVE_16: '<svg height="16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"></path></svg>',
        LOCK_20: `<svg width="20" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><path d="M600 0C268.629 0 0 268.629 0 600s268.629 600 600 600s600-268.629 600-600S931.371 0 600 0zm-4.321 274.658c81.026.386 155.088 52.056 186.548 124.146c10.762 25.109 16.479 50.903 16.479 78.882v71.339h98.291v376.317H303.003V549.023h90.381c-.819-50.406-1.856-108.07 15.82-150.221c34.37-75.909 105.448-124.53 186.475-124.144zm-4.395 119.824c-44.881.944-74.48 35.073-78.81 83.202v71.339h167.14v-72.07c-2.061-45.641-36.604-81.214-83.937-82.471a93.24 93.24 0 0 0-4.393 0z" fill="currentColor"/></svg>`
    },
    GUIDE_LINKS: {
        DISCORD: 'https://discord.gg/zrpFPyYtpe',
        CHROME_STORE_REVIEW: 'https://chromewebstore.google.com/detail/voice-rankings-text-to-sp/ehefcdakfbkmpeimjcnhdlhjhinhkhpn/reviews'
    },

    /**
     * Default maximum number of simultaneous in-flight TTS requests allowed per
     * provider when neither a server default (max_concurrent) nor a user override
     * is set. Keep in sync with MAX_CONCURRENT_GENERATIONS in ExternalVoicePlayer.js.
     */
    DEFAULT_MAX_CONCURRENT: 2,

    /**
     * How many upcoming sentences to pre-create highlight marks and word spans for.
     * Higher values reduce lag further but use more CPU/DOM memory. Default is 1.
     */
    HIGHLIGHT_PRELOAD_AHEAD_SENTENCES: 1,

    USER_SETTINGS: [
        'WIDGET_PIN_EXPANDED',
        'DEFAULT_QUICK_ACCESS_CONTROLS_PANEL_PLACEMENT_STATE',
        'DEFAULT_QUICK_ACCESS_CONTROLS_STATE',
        'DEFAULT_ENTER_KEY_PLAY_STATE',

        'DEFAULT_SUMM_READER_PAGE_STATE',

        'SAVED_SETTINGS',
        'DEFAULT_READER_STATE',
        'DEFAULT_AUTO_PLAY_WITH_ENTER_KEY_STATE',
        'DEFAULT_AUTO_SETTINGS_STATE',

        'DEFAULT_HIGHLIGHT_READING_STATE',
        'DEFAULT_AUTOSCROLL_READING_STATE',
        'DEFAULT_AUTO_READ_TITLE_STATE',

        'DEFAULT_READER_STRICT_MODE',

        'DEFAULT_READ_TEXT_AREA_SELECTOR_STATE',
        'DEFAULT_HIGHLIGHT_MODE_STATE',
        'DEFAULT_HIGHLIGHT_THEME_STATE',
        'DEFAULT_MAX_AUTO_READ_LIMIT_ENABLED',
        'DEFAULT_MAX_AUTO_READ_LIMIT',

        'DEFAULT_EXTERNAL_TIMESTAMP_SERVICE',
        'DEFAULT_OPENROUTER_STT_MODEL',

        'DEFAULT_SHOW_VOICE_RATING_PROMPT',
        'DEFAULT_SHOW_CONTINUE_READING_PROMPT',


        'DEFAULT_TTS_VOICE_SERVICE',

        'DEFAULT_VOICE_NAME',
        'DEFAULT_VOICE_LANGUAGE_CODE',
        'DEFAULT_VOICE_SPEAKER_ID',
        'DEFAULT_VOICE_SPEED',

        'DEFAULT_PREMIUM_VOICE_SERVICE',
        'DEFAULT_PREMIUM_VOICE_ID',
        'DEFAULT_PREMIUM_VOICE_NAME',
        'DEFAULT_PREMIUM_VOICE_GENDER',
        'DEFAULT_PREMIUM_VOICE_INSTRUCTIONS',
        'DEFAULT_PREMIUM_VOICE_LANGUAGE_CODE',
        'DEFAULT_PREMIUM_VOICE_SPEAKER_ID',
        'DEFAULT_PREMIUM_VOICE_WORDS_PER_MINUTE',
        'DEFAULT_PREMIUM_VOICE_SPEED',
        'DEFAULT_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT',
        'DEFAULT_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT',

        'DOMAIN_SETTINGS',
        'DOMAIN_FILTER_ENABLED',
        'ALLOW_TELEMETRY',
        'CUSTOM_DOMAIN_FILTERS'
    ]
};