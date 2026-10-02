import { getApiKey, getErrorDetails, arrayBufferToBase64, getExternalTimestamps } from './_shared.js';

export const providerInfo = {
    serviceNames: ['Soniox-TTS-V2'],
    url: 'https://tts-rt.soniox.com/tts',
    handle
};

const SONIOX_MODEL = 'tts-rt-v2';
const SONIOX_SPEED_MIN = 0.7;
const SONIOX_SPEED_MAX = 1.3;

// Soniox delivers emotion as a leading inline audio tag rather than as a field,
// and the vocabulary is a closed set: an unrecognised tag can be read aloud as
// literal text, so anything outside the list is dropped instead of forwarded.
const EMOTION_TAGS = new Set([
    'happy', 'sad', 'angry', 'excited', 'nervous', 'fearful', 'surprised',
    'annoyed', 'relieved', 'disappointed', 'curious', 'delighted', 'calm',
    'warm', 'stern', 'serious', 'playful', 'sincerely', 'reassuringly',
    'dramatically'
]);

// Pseudo-tags in the transcript ("[angry]...[/angry]") become Soniox open tags,
// which carry no closing tag.
function applyInlineEmotionTags(text) {
    let output = text;
    for (const emotion of EMOTION_TAGS) {
        const regex = new RegExp(`\\[${emotion}\\]([\\s\\S]*?)\\[\\/${emotion}\\]`, 'gi');
        output = output.replace(regex, `[${emotion}]$1`);
    }
    return output;
}

function normalizeRate(rawRate) {
    const rate = Number(rawRate);
    if (!Number.isFinite(rate) || rate <= 0) return 1;
    // Anything outside 0.7-1.3 is rejected with invalid_request.
    return Math.min(SONIOX_SPEED_MAX, Math.max(SONIOX_SPEED_MIN, rate));
}

function resolveEmotion(rawEmotion) {
    const emotion = String(rawEmotion || '').trim().toLowerCase();
    if (!emotion || emotion === 'none') return null;
    return EMOTION_TAGS.has(emotion) ? emotion : null;
}

async function handle({ text, serviceOptions, userApiKey, customOptions = {} }) {
    // Soniox voice ids are display names and are case-sensitive, and a
    // UUID-shaped value is resolved as a cloned voice, so the id must reach the
    // API untouched.
    const voiceName = String(serviceOptions.speaker_id || '').trim();
    if (!voiceName) {
        throw new Error('Soniox TTS requires a voice name.');
    }
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;

    const apiKey = await getApiKey('SONIOX_TTS_V2_API_KEY', userApiKey);

    // Soniox requires a language on every request and takes a bare ISO 639-1
    // code rather than a BCP-47 tag.
    const language = String(serviceOptions.languageCode || customOptions.language || 'en')
        .trim()
        .split(/[-_]/)[0]
        .toLowerCase() || 'en';

    // Pinned to mp3 so the external timestamp engines, which assume
    // Content-Type audio/mpeg, can transcribe the result.
    const requestPayload = {
        model: SONIOX_MODEL,
        language,
        voice: voiceName,
        audio_format: 'mp3',
        text: applyInlineEmotionTags(text)
    };

    // The BYOK "Rate" option wins over the reader's live speed slider, matching
    // how StepFun treats its own speed option.
    const rate = normalizeRate(customOptions.rate ?? serviceOptions.voiceSpeedSetting);
    if (rate !== 1) requestPayload.speed = rate;

    if (customOptions.reduce_silence !== undefined && customOptions.reduce_silence !== '') {
        requestPayload.reduce_silence = customOptions.reduce_silence === true || customOptions.reduce_silence === 'true';
    }

    const emotion = resolveEmotion(customOptions.emotion);
    if (emotion) {
        requestPayload.text = `[${emotion}] ${requestPayload.text}`;
    }

    const response = await fetch('https://tts-rt.soniox.com/tts', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
        const errorBody = await getErrorDetails(response);
        const error = new Error(`Soniox TTS API error for voice "${voiceName}": ${JSON.stringify(errorBody)}`);
        error.responseBody = errorBody;
        error.statusCode = response.status;
        error.requestPayload = requestPayload;
        throw error;
    }

    const audioBuffer = await response.arrayBuffer();

    // A 200 can still carry a JSON error document, so check the bytes before
    // treating them as audio.
    if (!audioBuffer.byteLength || new Uint8Array(audioBuffer)[0] === 0x7b) {
        const error = new Error(`Soniox TTS returned no audio for voice "${voiceName}".`);
        error.requestPayload = requestPayload;
        throw error;
    }

    return {
        audioData: arrayBufferToBase64(audioBuffer),
        speechMarks: includeAudioTimestamps ? await getExternalTimestamps(audioBuffer) : null
    };
}

export async function sonioxSpeech(text, speakerId, includeAudioTimestamps, serviceKey, options = {}) {
    return handle({
        text,
        serviceOptions: {
            speaker_id: speakerId,
            includeAudioTimestamps,
            voiceSpeedSetting: options.voiceSpeedSetting,
            languageCode: options.languageCode,
            voice_instructions: options.voice_instructions || ''
        },
        userApiKey: serviceKey,
        customOptions: options
    });
}
