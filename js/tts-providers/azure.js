import { getApiKey, getErrorDetails, getExternalTimestamps } from './_shared.js';

export const providerInfo = {
    serviceNames: ['Azure'],
    url: 'https://*.tts.speech.microsoft.com/cognitiveservices/v1',
    handle
};

async function handle({ text, serviceOptions, userApiKey }) {
    const shortName = serviceOptions.speaker_id;
    const speed = serviceOptions.voiceSpeedSetting;
    const gender = serviceOptions.gender;
    const locale = serviceOptions.languageCode;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;

    const apiKey = await getApiKey('AZURE_API_KEY', userApiKey);
    if (!apiKey) throw new Error("Azure API Key is missing.");

    const speedRate = (speed - 1) * 100;
    const ssml = `<speak version='1.0' xml:lang='${locale}'><voice xml:lang='${locale}' xml:gender='${gender.toUpperCase()}' name='${shortName}'><prosody rate="${speedRate}%">${text}</prosody></voice></speak>`;

    const response = await fetch('https://eastus.tts.speech.microsoft.com/cognitiveservices/v1', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
            'Ocp-Apim-Subscription-Key': userApiKey,
            'User-Agent': 'vr-reader-chrome-extension'
        },
        body: ssml
    });

    if (!response.ok) {
        const errorBody = await getErrorDetails(response);
        const error = new Error(`Azure TTS API error: ${response.statusText}`);
        error.responseBody = errorBody;
        error.statusCode = response.status;
        error.requestPayload = ssml;
        throw error;
    }

    const audioBuffer = await response.arrayBuffer();
    const base64String = btoa(new Uint8Array(audioBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

    let speechMarks = null;
    if (includeAudioTimestamps && audioBuffer) {
        speechMarks = await getExternalTimestamps(audioBuffer);
    }

    return { audioData: base64String, speechMarks };
}

export async function azureSpeechWithSpeechMarks(text, shortName, speed, gender, locale, serviceKey) {
    console.warn("Azure direct REST API does not support speech marks. A WebSocket implementation is needed.");
    return handle({ text, serviceOptions: { speaker_id: shortName, voiceSpeedSetting: speed, gender, languageCode: locale }, userApiKey: serviceKey });
}
