import { getApiKey, getErrorDetails, arrayBufferToBase64, getExternalTimestamps, openrouterTTS } from './_shared.js';

export const providerInfo = {
    serviceNames: ['voxtral-tts'],
    url: 'https://api.mistral.ai/v1/audio/speech',
    handle
};

async function handle({ text, serviceOptions, userApiKey, customOptions = {} }) {
    const speakerId = serviceOptions.speaker_id;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;

    console.log(text, speakerId, includeAudioTimestamps, userApiKey);
    const apiKey = await getApiKey('MISTRAL_API_KEY', userApiKey);
    const isOpenRouter = customOptions.apiKeyProvider && customOptions.apiKeyProvider.includes('openrouter.com');

    if (isOpenRouter) {
        const audioBuffer = await openrouterTTS({
            model: customOptions.apiKeyProvider.split('.com/')[1] || 'mistralai/voxtral-mini-tts-2603',
            text,
            voice: speakerId,
            apiKey
        });
        return {
            audioData: arrayBufferToBase64(audioBuffer),
            speechMarks: includeAudioTimestamps ? await getExternalTimestamps(audioBuffer) : null
        };
    }

    const payload = {
        model: customOptions.model || 'voxtral-mini-tts-2603',
        input: text,
        voice_id: speakerId,
        response_format: "mp3"
    };

    const response = await fetch('https://api.mistral.ai/v1/audio/speech', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const errorBody = await getErrorDetails(response);
        const error = new Error('Mistral TTS API Error');
        error.responseBody = errorBody;
        error.statusCode = response.status;
        error.requestPayload = payload;
        throw error;
    }

    const data = await response.json();
    const audioDataBase64 = data.audio_data || data.audio || data.data?.audio;
    let speechMarks = null;
    if (includeAudioTimestamps && audioDataBase64) {
        const audioBuffer = Uint8Array.from(atob(audioDataBase64), c => c.charCodeAt(0)).buffer;
        speechMarks = await getExternalTimestamps(audioBuffer);
    }
    return { audioData: audioDataBase64, speechMarks };
}

export async function mistralVoxtralSpeech(text, speakerId, includeAudioTimestamps, serviceKey, options = {}) {
    return handle({ text, serviceOptions: { speaker_id: speakerId, includeAudioTimestamps }, userApiKey: serviceKey, customOptions: options });
}
