import { getApiKey, getErrorDetails, getExternalTimestamps } from './_shared.js';

export const providerInfo = {
    serviceNames: ['Rime-Mist', 'Rime-MistV2'],
    url: 'https://api.rime.ai/v1/tts',
    handle
};

async function handle({ text, serviceOptions, userApiKey, customOptions = {} }) {
    const speakerId = serviceOptions.speaker_id;
    const speed = serviceOptions.voiceSpeedSetting;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;

    const apiKey = await getApiKey('RIME_API_KEY', userApiKey);
    const url = 'https://users.rime.ai/v1/rime-tts';
    const payload = {
        text,
        speaker: speakerId,
        modelId: "mist",
        audioFormat: "mp3"
    };
    if (Number.isFinite(Number(speed))) payload.speedAlpha = 1 / Number(speed);

    const response = await fetch(url, {
        method: 'POST',
        credentials: 'omit',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const errorBody = await getErrorDetails(response);
        const error = new Error('Rime AI TTS API Error');
        error.responseBody = errorBody;
        error.statusCode = response.status;
        error.requestPayload = payload;
        throw error;
    }
    const data = await response.json();
    const audioDataBase64 = data.audioContent;
    let speechMarks = null;
    if (includeAudioTimestamps && audioDataBase64) {
        const audioBuffer = Uint8Array.from(atob(audioDataBase64), c => c.charCodeAt(0)).buffer;
        speechMarks = await getExternalTimestamps(audioBuffer);
    }
    return { audioData: audioDataBase64, speechMarks };
}

export async function rimeAISpeech(text, speakerId, speed, includeAudioTimestamps, serviceKey, options = {}) {
    return handle({ text, serviceOptions: { speaker_id: speakerId, voiceSpeedSetting: speed, includeAudioTimestamps }, userApiKey: serviceKey, customOptions: options });
}
