import { getApiKey, arrayBufferToBase64, getExternalTimestamps, openrouterTTS } from './_shared.js';

export const providerInfo = {
    serviceNames: ['kokoro-82M'],
    url: 'https://api.deepinfra.com/v1/inference/hexgrad/Kokoro-82M',
    handle
};

async function handle({ text, serviceOptions, userApiKey, customOptions = {} }) {
    const speakerId = serviceOptions.speaker_id;
    const speed = serviceOptions.voiceSpeedSetting;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;

    const apiKey = await getApiKey("KOKORO82M_API_KEY", userApiKey);
    if (!apiKey) throw new Error("Kokoro/DeepInfra API Key is missing.");

    const isOpenRouter = customOptions.apiKeyProvider && customOptions.apiKeyProvider.includes('openrouter.com');

    if (isOpenRouter) {
        const audioBuffer = await openrouterTTS({
            model: customOptions.apiKeyProvider.split('.com/')[1] || 'hexgrad/kokoro-82m',
            text,
            voice: speakerId.toLowerCase(),
            speed,
            apiKey
        });
        return {
            audioData: arrayBufferToBase64(audioBuffer),
            speechMarks: includeAudioTimestamps ? await getExternalTimestamps(audioBuffer) : null
        };
    }

    const payload = {
        text,
        output_format: "mp3",
        return_timestamps: true,
        speed,
        preset_voice: [speakerId.toLowerCase()]
    };

    const response = await fetch('https://api.deepinfra.com/v1/inference/hexgrad/Kokoro-82M', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(`Kokoro TTS API error: ${JSON.stringify(errorData)}`);
        error.responseBody = errorData;
        error.statusCode = response.status;
        error.requestPayload = payload;
        throw error;
    }

    const data = await response.json();
    let audioData = data.audio;

    const dataUriPrefix = "data:audio/mp3;base64,";
    if (audioData.startsWith(dataUriPrefix)) {
        audioData = audioData.substring(dataUriPrefix.length);
    }

    const speechMarks = (data.words || []).map(mark => ({
        word: mark.text,
        startTime: Math.round(mark.start * 1000),
        duration: Math.round((mark.end - mark.start) * 1000)
    }));

    return { audioData, speechMarks };
}

export async function kokoroTtsSpeech(text, speakerId, speed, serviceKey, includeAudioTimestamps = false, options = {}) {
    return handle({ text, serviceOptions: { speaker_id: speakerId, voiceSpeedSetting: speed, includeAudioTimestamps }, userApiKey: serviceKey, customOptions: options });
}
