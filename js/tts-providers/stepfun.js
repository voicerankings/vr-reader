import { getApiKey, getErrorDetails, arrayBufferToBase64, getExternalTimestamps } from './_shared.js';

export const providerInfo = {
    serviceNames: ['StepFun-TTS-2'],
    url: 'https://api.stepfun.ai/v1/audio/speech',
    handle
};

async function handle({ text, serviceOptions, userApiKey, customOptions = {} }) {
    const speakerId = serviceOptions.speaker_id;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;

    const apiKey = await getApiKey('STEPFUN_API_KEY', userApiKey);
    const url = 'https://api.stepfun.ai/v1/audio/speech';

    let finalSpeakerId = speakerId;
    if (finalSpeakerId && finalSpeakerId.includes('--')) {
        finalSpeakerId = finalSpeakerId.split('--')[0];
    }

    const payload = {
        model: customOptions.model || "step-tts-2",
        input: text,
        voice: finalSpeakerId,
        response_format: "mp3"
    };

    if (customOptions.speed !== undefined) {
        payload.speed = Number(customOptions.speed);
    }
    if (customOptions.volume !== undefined) {
        payload.volume = Number(customOptions.volume);
    }

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
        const error = new Error('Stepfun TTS API Error');
        error.responseBody = errorBody;
        error.statusCode = response.status;
        error.requestPayload = payload;
        throw error;
    }
    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = arrayBufferToBase64(audioBuffer);
    let speechMarks = null;
    if (includeAudioTimestamps) {
        speechMarks = await getExternalTimestamps(audioBuffer);
    }
    return { audioData: audioBase64, speechMarks };
}

export async function stepfunSpeech(text, speakerId, includeAudioTimestamps, serviceKey, options = {}) {
    return handle({ text, serviceOptions: { speaker_id: speakerId, includeAudioTimestamps }, userApiKey: serviceKey, customOptions: options });
}
