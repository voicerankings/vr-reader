import { getApiKey, getErrorDetails, arrayBufferToBase64, getExternalTimestamps } from './_shared.js';

export const providerInfo = {
    serviceNames: ['OpenAI'],
    url: 'https://api.openai.com/v1/audio/speech',
    handle
};

async function handle({ text, serviceOptions, userApiKey, customOptions = {} }) {
    const voice = serviceOptions.speaker_id;
    const speed = serviceOptions.voiceSpeedSetting;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;
    const apiKey = await getApiKey('OPENAI_API_KEY', userApiKey);

    const model = customOptions.model || 'tts-1';
    console.log(`Using OpenAI Model: ${model}`);

    const requestPayload = {
        model: model,
        input: text,
        voice: voice.toLowerCase(),
        speed
    };

    const speechResponse = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
    });

    if (!speechResponse.ok) {
        const errorBody = await getErrorDetails(speechResponse);
        const error = new Error('OpenAI Speech API Error');
        error.responseBody = errorBody;
        error.statusCode = speechResponse.status;
        error.requestPayload = requestPayload;
        throw error;
    }

    const audioBuffer = await speechResponse.arrayBuffer();
    const audioBase64 = arrayBufferToBase64(audioBuffer);

    let speechMarks = null;
    if (includeAudioTimestamps) {
        speechMarks = await getExternalTimestamps(audioBuffer);
    }

    return { audioData: audioBase64, speechMarks };
}

export async function openAISpeech(text, voice, speed, includeAudioTimestamps, serviceKey, options = {}) {
    return handle({ text, serviceOptions: { speaker_id: voice, voiceSpeedSetting: speed, includeAudioTimestamps }, userApiKey: serviceKey, customOptions: options });
}
