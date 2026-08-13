import { getApiKey, getErrorDetails, arrayBufferToBase64, getExternalTimestamps, openrouterTTS } from './_shared.js';

export const providerInfo = {
    serviceNames: ['Deepgram', 'Deepgram-A2'],
    url: 'https://api.deepgram.com/v1/speak',
    handle
};

async function handle({ text, serviceOptions, userApiKey, serviceName, customOptions = {} }) {
    const model = serviceOptions.speaker_id;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;

    let apiKey;
    if (model.indexOf("aura-2") > -1) {
        apiKey = await getApiKey('DEEPGRAM_A2_API_KEY', userApiKey);
    } else {
        apiKey = await getApiKey('DEEPGRAM_API_KEY', userApiKey);
    }

    const isOpenRouter = customOptions.apiKeyProvider && customOptions.apiKeyProvider.includes('openrouter.com');

    if (isOpenRouter) {
        const audioBuffer = await openrouterTTS({
            model: customOptions.apiKeyProvider.split('.com/')[1] || 'deepgram/aura-2',
            text,
            voice: model,
            apiKey
        });
        return {
            audioData: arrayBufferToBase64(audioBuffer),
            speechMarks: includeAudioTimestamps ? await getExternalTimestamps(audioBuffer) : null
        };
    }

    const requestPayload = { text };

    const ttsResponse = await fetch(`https://api.deepgram.com/v1/speak?model=${model}`, {
        method: 'POST',
        headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
    });

    if (!ttsResponse.ok) {
        const errorBody = await getErrorDetails(ttsResponse);
        const error = new Error('Deepgram TTS API Error');
        error.responseBody = errorBody;
        error.statusCode = ttsResponse.status;
        error.requestPayload = requestPayload;
        throw error;
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioBase64 = arrayBufferToBase64(audioBuffer);

    let speechMarks = null;
    if (includeAudioTimestamps) {
        speechMarks = await getExternalTimestamps(audioBuffer);
    }

    return { audioData: audioBase64, speechMarks };
}

export async function deepgramSpeech(text, model, includeAudioTimestamps, serviceKey, options = {}) {
    return handle({ text, serviceOptions: { speaker_id: model, includeAudioTimestamps }, userApiKey: serviceKey, customOptions: options });
}
