import { getApiKey, getErrorDetails } from './_shared.js';

export const providerInfo = {
    serviceNames: ['Inworld', 'inworld-tts-2'],
    url: 'https://api.inworld.ai/tts/v1/text:synthesize',
    handle
};

function mapWordAlignment(alignment) {
    if (!alignment) return null;
    const { words, wordStartTimeSeconds, wordEndTimeSeconds } = alignment;
    if (!Array.isArray(words) || !Array.isArray(wordStartTimeSeconds) || !Array.isArray(wordEndTimeSeconds)) return null;
    if (words.length !== wordStartTimeSeconds.length || words.length !== wordEndTimeSeconds.length) return null;

    return words.map((word, index) => {
        const startTime = Math.round(wordStartTimeSeconds[index] * 1000);
        const endTime = Math.round(wordEndTimeSeconds[index] * 1000);
        return { word, startTime, duration: endTime - startTime };
    });
}

async function handle({ text, serviceOptions, userApiKey, serviceName, customOptions = {} }) {
    const voiceId = serviceOptions.speaker_id;
    const speed = serviceOptions.voiceSpeedSetting;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;

    // inworld-tts-2 is pinned to the TTS-2 model so a saved customOptions.modelId
    // cannot downshift it into the 1.5 family, and it reads its own key slot.
    const isTts2 = serviceName === 'inworld-tts-2';
    const apiKey = await getApiKey(isTts2 ? "INWORLD_TTS_2_API_KEY" : "INWORLD_API_KEY", userApiKey);
    if (!apiKey) throw new Error("Inworld AI API Key is missing.");

    let temperature = 1.1;
    if (customOptions && customOptions.temperature) {
        temperature = Number(customOptions.temperature);
    }

    const payload = {
        text,
        voiceId,
        modelId: isTts2 ? 'inworld-tts-2' : (customOptions.modelId || "inworld-tts-1.5-mini"),
        temperature: temperature,
        audioConfig: { speakingRate: isTts2 ? (customOptions.speakingRate ?? speed) : speed }
    };

    if (includeAudioTimestamps) {
        payload.timestampType = 'WORD';
    }

    const response = await fetch('https://api.inworld.ai/tts/v1/voice', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await getErrorDetails(response);
        const error = new Error(`Inworld AI API error: ${JSON.stringify(errorData)}`);
        error.responseBody = errorData;
        error.statusCode = response.status;
        error.requestPayload = payload;
        throw error;
    }

    const data = await response.json();
    if (!data.audioContent) {
        const error = new Error('Inworld AI did not return audio content.');
        error.responseBody = data;
        error.requestPayload = payload;
        throw error;
    }

    let speechMarks = null;
    if (includeAudioTimestamps) {
        speechMarks = mapWordAlignment(data.timestampInfo?.wordAlignment);
        if (!speechMarks) {
            console.warn('Inworld AI returned no word alignment; timestamps will not be returned.');
        }
    }

    return { audioData: data.audioContent, speechMarks };
}

export async function inworldAiSpeech(text, voiceId, speed, serviceKey, customOptions = {}) {
    return handle({
        text,
        serviceOptions: { speaker_id: voiceId, voiceSpeedSetting: speed, includeAudioTimestamps: customOptions.includeAudioTimestamps },
        userApiKey: serviceKey,
        serviceName: customOptions.serviceName,
        customOptions
    });
}
