import { getApiKey, getErrorDetails, arrayBufferToBase64, getExternalTimestamps, openrouterTTS } from './_shared.js';

const FLUX_SPEED_MIN = 0.85;
const FLUX_SPEED_MAX = 1.15;
const FLUX_SPEED_STEP = 0.05;

export const providerInfo = {
    serviceNames: ['Deepgram', 'Deepgram-A2', 'Deepgram-Flux'],
    url: 'https://api.deepgram.com/v1/speak',
    handle
};

// Flux speaks from /v2/speak while Aura uses /v1/speak, and the two families
// share nothing else: Flux keys off a dedicated storage slot, its voice ids
// are the full flux-{voice}-{language} model string, and it takes its own
// `speed` range.
function isFlux(serviceName) {
    return serviceName === 'Deepgram-Flux';
}

// Flux documents speed as 0.85-1.15 in 0.05 steps. Out-of-range or fractional
// values are rejected, so clamp and snap rather than letting a 400 through.
function normalizeFluxSpeed(rawSpeed) {
    const speed = Number(rawSpeed);
    if (!Number.isFinite(speed) || speed <= 0) return null;
    if (Math.abs(speed - 1) < 0.001) return null;

    const clamped = Math.min(FLUX_SPEED_MAX, Math.max(FLUX_SPEED_MIN, speed));
    const snapped = Math.round(clamped / FLUX_SPEED_STEP) * FLUX_SPEED_STEP;
    return Number(snapped.toFixed(2));
}

async function handle({ text, serviceOptions, userApiKey, serviceName, customOptions = {} }) {
    const model = serviceOptions.speaker_id;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;
    const flux = isFlux(serviceName);

    let apiKey;
    if (flux) {
        apiKey = await getApiKey('DEEPGRAM_FLUX_API_KEY', userApiKey);
    } else if (model.indexOf("aura-2") > -1) {
        apiKey = await getApiKey('DEEPGRAM_A2_API_KEY', userApiKey);
    } else {
        apiKey = await getApiKey('DEEPGRAM_API_KEY', userApiKey);
    }

    const isOpenRouter = customOptions.apiKeyProvider && customOptions.apiKeyProvider.includes('openrouter.com');

    if (isOpenRouter) {
        const audioBuffer = await openrouterTTS({
            model: customOptions.apiKeyProvider.split('.com/')[1] || (flux ? 'deepgram/flux-tts' : 'deepgram/aura-2'),
            text,
            voice: model,
            speed: flux ? normalizeFluxSpeed(serviceOptions.voiceSpeedSetting) : null,
            apiKey
        });
        return {
            audioData: arrayBufferToBase64(audioBuffer),
            speechMarks: includeAudioTimestamps ? await getExternalTimestamps(audioBuffer) : null
        };
    }

    const requestPayload = { text };

    let speakUrl;
    if (flux) {
        if (!model || !model.startsWith('flux-')) {
            throw new Error(`Deepgram Flux received an invalid model string: "${model}". Expected "flux-{voice}-{language}".`);
        }
        const params = new URLSearchParams({ model, encoding: 'mp3' });
        const fluxSpeed = normalizeFluxSpeed(serviceOptions.voiceSpeedSetting);
        if (fluxSpeed) params.set('speed', String(fluxSpeed));
        speakUrl = `https://api.deepgram.com/v2/speak?${params.toString()}`;
    } else {
        speakUrl = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}`;
    }

    const ttsResponse = await fetch(speakUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
    });

    if (!ttsResponse.ok) {
        const errorBody = await getErrorDetails(ttsResponse);
        const error = new Error(flux ? 'Deepgram Flux TTS API Error' : 'Deepgram TTS API Error');
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
