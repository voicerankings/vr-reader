import { getApiKey } from './_shared.js';

export const providerInfo = {
    serviceNames: ['Inworld'],
    url: 'https://api.inworld.ai/tts/v1/text:synthesize',
    handle
};

async function handle({ text, serviceOptions, userApiKey, customOptions = {} }) {
    const voiceId = serviceOptions.speaker_id;
    const speed = serviceOptions.voiceSpeedSetting;

    const apiKey = await getApiKey("INWORLD_API_KEY", userApiKey);
    if (!apiKey) throw new Error("Inworld AI API Key is missing.");

    let temperature = 1.1;
    if (customOptions && customOptions.temperature) {
        temperature = Number(customOptions.temperature);
    }

    const payload = {
        text,
        voiceId,
        modelId: customOptions.modelId || "inworld-tts-1.5-mini",
        temperature: temperature,
        timestampType: 'WORD',
        audioConfig: { speakingRate: speed }
    };

    const response = await fetch('https://api.inworld.ai/tts/v1/voice', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(`Inworld AI API error: ${JSON.stringify(errorData)}`);
        error.responseBody = errorData;
        error.statusCode = response.status;
        error.requestPayload = payload;
        throw error;
    }

    const data = await response.json();
    const { words, wordStartTimeSeconds, wordEndTimeSeconds } = data.timestampInfo.wordAlignment;
    const speechMarks = words.map((word, index) => {
        const startTime = Math.round(wordStartTimeSeconds[index] * 1000);
        const endTime = Math.round(wordEndTimeSeconds[index] * 1000);
        return { word, startTime, duration: endTime - startTime };
    });

    return { audioData: data.audioContent, speechMarks };
}

export async function inworldAiSpeech(text, voiceId, speed, serviceKey, customOptions) {
    return handle({ text, serviceOptions: { speaker_id: voiceId, voiceSpeedSetting: speed }, userApiKey: serviceKey, customOptions });
}
