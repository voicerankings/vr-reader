import { getApiKey, getErrorDetails, arrayBufferToBase64, convertGrokTimestampsToSpeechMarks, getExternalTimestamps, openrouterTTS } from './_shared.js';

export const providerInfo = {
    serviceNames: ['grok-tts'],
    url: 'https://api.x.ai/v1/tts',
    handle
};

async function handle({ text, serviceOptions, userApiKey, customOptions = {} }) {
    const speakerId = serviceOptions.speaker_id;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;
    const speed = serviceOptions.voiceSpeedSetting;

    const apiKey = await getApiKey('GROK_API_KEY', userApiKey);
    const isOpenRouter = customOptions.apiKeyProvider && customOptions.apiKeyProvider.includes('openrouter.com');

    if (isOpenRouter) {
        const grokSpeed = Number.isFinite(Number(speed)) ? Math.min(1.5, Math.max(0.7, Number(speed))) : 1;
        const audioBuffer = await openrouterTTS({
            model: customOptions.apiKeyProvider.split('.com/')[1] || 'x-ai/grok-voice-tts-1.0',
            text,
            voice: speakerId.toLowerCase(),
            speed: grokSpeed,
            apiKey
        });
        return {
            audioData: arrayBufferToBase64(audioBuffer),
            speechMarks: includeAudioTimestamps ? await getExternalTimestamps(audioBuffer) : null
        };
    }

    const url = 'https://api.x.ai/v1/tts';
    const payload = {
        text: text,
        voice_id: speakerId.toLowerCase(),
        language: 'auto',
        with_timestamps: !!includeAudioTimestamps,
        speed: Number.isFinite(Number(speed)) ? Math.min(1.5, Math.max(0.7, Number(speed))) : 1
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const errorBody = await getErrorDetails(response);
        const error = new Error('Grok TTS API Error');
        error.responseBody = errorBody;
        error.statusCode = response.status;
        error.requestPayload = payload;
        throw error;
    }

    let audioBase64;
    let speechMarks = null;

    if (payload.with_timestamps) {
        const data = await response.json();
        audioBase64 = data.audio;
        if (data.audio_timestamps) {
            speechMarks = convertGrokTimestampsToSpeechMarks(data.audio_timestamps);
        }
    } else {
        const audioBuffer = await response.arrayBuffer();
        audioBase64 = arrayBufferToBase64(audioBuffer);
    }

    return { audioData: audioBase64, speechMarks };
}

export async function grokSpeech(text, speakerId, includeAudioTimestamps, serviceKey, options = {}) {
    return handle({ text, serviceOptions: { speaker_id: speakerId, includeAudioTimestamps, voiceSpeedSetting: options.speed || 1 }, userApiKey: serviceKey, customOptions: options });
}
