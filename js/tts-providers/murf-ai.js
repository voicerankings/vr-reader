import { getApiKey, getErrorDetails, blobToBase64 } from './_shared.js';

export const providerInfo = {
    serviceNames: ['MurfAI'],
    url: 'https://api.murf.ai/v1/speech/generate',
    handle
};

async function murfAiSpeechStream(text, voiceId, style, apiKey, region) {
    console.log(`Murf AI: Using FALCON streaming model via ${region} region.`);

    const baseUrl = region === 'global'
        ? 'https://global.api.murf.ai/v1/speech/stream'
        : `https://${region}.api.murf.ai/v1/speech/stream`;

    const payload = {
        text,
        voiceId,
        style: style ? style.replace(/-/g, ' ') : undefined,
        model: "FALCON",
        format: "MP3"
    };

    const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok || !response.body) {
        const errorData = await response.json();
        const error = new Error(`Murf.ai FALCON API error: ${JSON.stringify(errorData)}`);
        error.responseBody = errorData;
        error.statusCode = response.status;
        error.requestPayload = payload;
        throw error;
    }

    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        chunks.push(value);
    }

    const audioBlob = new Blob(chunks, { type: 'audio/mpeg' });
    const audioBase64 = await blobToBase64(audioBlob);

    return { audioData: audioBase64, speechMarks: null };
}

async function handle({ text, serviceOptions, userApiKey, customOptions = {} }) {
    const speakerId = serviceOptions.speaker_id;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;

    const apiKey = await getApiKey("MURFAI_API_KEY", userApiKey);
    if (!apiKey) throw new Error("Murf.ai API Key is missing.");

    const { model = 'GEN2', region = 'global', variation = 1 } = customOptions;
    const [voiceId, style] = speakerId.split('--');

    if (model === 'FALCON') {
        if (includeAudioTimestamps) {
            console.warn("Murf AI FALCON model does not support speech marks. Timestamps will not be returned.");
        }
        return murfAiSpeechStream(text, voiceId, style, apiKey, region);
    }

    console.log("Murf AI: Using GEN2 model.");
    const payload = {
        text,
        voiceId,
        style: style ? style.replace(/-/g, ' ') : undefined,
        format: 'MP3',
        variation,
        encodeAsBase64: true
    };

    const response = await fetch('https://api.murf.ai/v1/speech/generate', {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(`Murf.ai GEN2 API error: ${JSON.stringify(errorData)}`);
        error.responseBody = errorData;
        error.statusCode = response.status;
        error.requestPayload = payload;
        throw error;
    }

    const data = await response.json();

    let speechMarks = null;
    if (includeAudioTimestamps && data.wordDurations) {
        speechMarks = (data.wordDurations || []).map(mark => ({
            word: mark.word,
            startTime: mark.startMs,
            duration: mark.endMs - mark.startMs
        }));
    }

    return { audioData: data.encodedAudio, speechMarks };
}

export async function murfAiSpeech(text, speakerId, includeAudioTimestamps, serviceKey, options = {}) {
    return handle({ text, serviceOptions: { speaker_id: speakerId, includeAudioTimestamps }, userApiKey: serviceKey, customOptions: options });
}
