import { getApiKey, getErrorDetails, blobToBase64 } from './_shared.js';

export const providerInfo = {
    serviceNames: ['MurfAI', 'MurfAI-Falcon-2'],
    url: 'https://api.murf.ai/v1/speech/generate',
    handle
};

// Falcon 2 encodes locale, voice and style into the voice id as
// "<locale>--<voiceId>" or "<locale>--<voiceId>--<style>", e.g.
// "en-US--Miles--Promo". Styles are published hyphenated in the voice id and
// sent to the API with spaces.
function parseFalcon2SpeakerId(speakerId) {
    const raw = String(speakerId || '').trim();
    const parts = raw.split('--');
    if (parts.length < 2 || parts.length > 3) {
        throw new Error(`Invalid speakerId for Murf Falcon 2: "${raw}". Expected "<locale>--<actor>" or "<locale>--<actor>--<style>".`);
    }
    return {
        locale: parts[0],
        voiceId: parts[1],
        style: parts[2] ? parts[2].replace(/-/g, ' ') : null
    };
}

// Falcon 2 takes rate and pitch as -50..50 offsets, not as multipliers.
function normalizeOffset(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.min(50, Math.max(-50, Math.round(num)));
}

async function falcon2SpeechStream({ text, locale, voiceId, style, rate, pitch, apiKey }) {
    const payload = {
        text,
        model: "falcon-2",
        voiceId,
        locale,
        format: "MP3",
        rate,
        pitch
    };
    if (style) payload.style = style;

    const response = await fetch('https://global.api.murf.ai/v1/speech/stream', {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await getErrorDetails(response);
        const error = new Error(`Murf.ai Falcon 2 API error: ${JSON.stringify(errorData)}`);
        error.responseBody = errorData;
        error.statusCode = response.status;
        error.requestPayload = payload;
        throw error;
    }

    if (!response.body) {
        const error = new Error('Murf.ai Falcon 2 API returned no audio stream.');
        error.requestPayload = payload;
        throw error;
    }

    // The endpoint streams with chunked transfer encoding; concatenate it all.
    const reader = response.body.getReader();
    const chunks = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
    }

    if (!chunks.length) {
        const error = new Error('Murf.ai Falcon 2 API returned no audio data.');
        error.requestPayload = payload;
        throw error;
    }

    const audioBlob = new Blob(chunks, { type: 'audio/mpeg' });
    return { audioData: await blobToBase64(audioBlob), speechMarks: null };
}

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

async function handle({ text, serviceOptions, userApiKey, serviceName, customOptions = {} }) {
    const speakerId = serviceOptions.speaker_id;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;
    const speed = serviceOptions.voiceSpeedSetting;

    const isFalcon2 = serviceName === 'MurfAI-Falcon-2';
    const apiKey = await getApiKey(isFalcon2 ? "MURFAI_FALCON_2_API_KEY" : "MURFAI_API_KEY", userApiKey);
    if (!apiKey) throw new Error("Murf.ai API Key is missing.");

    if (isFalcon2) {
        if (includeAudioTimestamps) {
            console.warn("Murf AI Falcon 2 does not return word timings. Timestamps will not be returned.");
        }
        const { locale, voiceId, style } = parseFalcon2SpeakerId(speakerId);
        const speedFactor = Number.isFinite(Number(speed)) ? Number(speed) : 1;
        const rate = customOptions.rate !== undefined
            ? normalizeOffset(customOptions.rate)
            : normalizeOffset((speedFactor - 1) * 50);
        return falcon2SpeechStream({
            text,
            locale,
            voiceId,
            style,
            rate,
            pitch: normalizeOffset(customOptions.pitch),
            apiKey
        });
    }

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
    return handle({
        text,
        serviceOptions: {
            speaker_id: speakerId,
            includeAudioTimestamps,
            voiceSpeedSetting: options.voiceSpeedSetting
        },
        userApiKey: serviceKey,
        serviceName: options.serviceName,
        customOptions: options
    });
}
