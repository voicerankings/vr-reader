import { getApiKey, getErrorDetails, arrayBufferToBase64, getExternalTimestamps } from './_shared.js';

export const providerInfo = {
    serviceNames: ['Rime-Arcana', 'Rime-Coda'],
    url: 'https://api.rime.ai/v1/tts',
    handle
};

async function handle({ text, serviceOptions, userApiKey, customOptions = {}, serviceName }) {
    const speakerId = serviceOptions.speaker_id;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;
    const speed = serviceOptions.voiceSpeedSetting;

    const apiKey = await getApiKey('RIME_API_KEY', userApiKey);
    const url = 'https://users.rime.ai/v1/rime-tts';

    let modelId = serviceName === 'Rime-Coda' ? 'coda' : 'arcana';
    let splitId = speakerId;
    if (speakerId.includes('--')) {
        const parts = speakerId.split('--');
        splitId = parts[0];
        modelId = parts[1] || modelId;
    }

    const payload = {
        speaker: splitId,
        text,
        modelId: modelId,
        samplingRate: 24000,
        lang: "eng"
    };

    if (customOptions.samplingRate !== undefined) payload.samplingRate = parseInt(customOptions.samplingRate, 10);
    if (customOptions.lang !== undefined) payload.lang = customOptions.lang;
    if (customOptions.timeScaleFactor !== undefined) payload.timeScaleFactor = Number(customOptions.timeScaleFactor);
    else if (Number.isFinite(Number(speed))) payload.timeScaleFactor = 1 / Number(speed);

    const response = await fetch(url, {
        method: 'POST',
        credentials: 'omit',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const errorBody = await getErrorDetails(response);
        const error = new Error('Rime Arcana TTS API Error');
        error.responseBody = errorBody;
        error.statusCode = response.status;
        error.requestPayload = payload;
        throw error;
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = arrayBufferToBase64(audioBuffer);

    let speechMarks = null;
    if (includeAudioTimestamps && audioBuffer) {
        speechMarks = await getExternalTimestamps(audioBuffer);
    }
    return { audioData: audioBase64, speechMarks };
}

export async function rimeArcanaSpeech(text, speakerId, includeAudioTimestamps, serviceKey, options = {}) {
    const serviceName = options.serviceName || 'Rime-Arcana';
    return handle({ text, serviceOptions: { speaker_id: speakerId, includeAudioTimestamps }, userApiKey: serviceKey, customOptions: options, serviceName });
}
