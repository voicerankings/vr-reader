import { getApiKey, getErrorDetails, arrayBufferToBase64, getExternalTimestamps, openrouterTTS } from './_shared.js';

export const providerInfo = {
    serviceNames: ['orpheus-tts'],
    url: 'https://api.orpheus.ai/v1/audio/speech',
    handle
};

async function handle({ text, serviceOptions, userApiKey, customOptions = {} }) {
    const speakerId = serviceOptions.speaker_id;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;

    const apiKey = await getApiKey('ORPHEUSTTS_API_KEY', userApiKey);

    const isOpenRouter = customOptions.apiKeyProvider && customOptions.apiKeyProvider.includes('openrouter.com');

    if (isOpenRouter) {
        const audioBuffer = await openrouterTTS({
            model: customOptions.apiKeyProvider.split('.com/')[1] || 'canopylabs/orpheus-3b-0.1-ft',
            text,
            voice: speakerId.toLowerCase(),
            apiKey
        });
        return {
            audioData: arrayBufferToBase64(audioBuffer),
            speechMarks: includeAudioTimestamps ? await getExternalTimestamps(audioBuffer) : null
        };
    }

    const requestPayload = { input: text, response_format: "mp3", voice: speakerId.toLowerCase() };

    const response = await fetch('https://api.deepinfra.com/v1/inference/canopylabs/orpheus-3b-0.1-ft', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
        const errorBody = await getErrorDetails(response);
        const error = new Error('Orpheus TTS API Error');
        error.responseBody = errorBody;
        error.statusCode = response.status;
        error.requestPayload = requestPayload;
        throw error;
    }

    const data = await response.json();
    let audioData = data.audio.replace("data:audio/mp3;base64,", "");

    let speechMarks = null;
    if (includeAudioTimestamps && audioData) {
        const audioBuffer = Uint8Array.from(atob(audioData), c => c.charCodeAt(0)).buffer;
        speechMarks = await getExternalTimestamps(audioBuffer);
    }

    return { audioData, speechMarks };
}

export async function orpheusTtsSpeech(text, speakerId, includeAudioTimestamps, serviceKey, options = {}) {
    return handle({ text, serviceOptions: { speaker_id: speakerId, includeAudioTimestamps }, userApiKey: serviceKey, customOptions: options });
}
