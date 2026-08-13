import { getApiKey, getExternalTimestamps } from './_shared.js';

export const providerInfo = {
    serviceNames: ['Google-Chirp-3-HD'],
    url: 'https://texttospeech.googleapis.com/v1/text:synthesize',
    handle
};

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function handle({ text, serviceOptions, userApiKey }) {
    const ssmlGender = serviceOptions.gender;
    const name = serviceOptions.speaker_id;
    const languageCode = serviceOptions.languageCode;
    const speakingRate = serviceOptions.voiceSpeedSetting;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;

    const apiKey = await getApiKey('GOOGLE_CHIRP3_HD_API_KEY', userApiKey);
    if (!apiKey) throw new Error("Google API Key is missing.");

    const url = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`;
    const body = {
        input: { text },
        voice: { languageCode, ssmlGender: ssmlGender.toUpperCase(), name },
        audioConfig: { audioEncoding: 'MP3', speakingRate }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(`Google TTS API error: ${errorData.error.message}`);
        error.responseBody = errorData;
        error.statusCode = response.status;
        error.requestPayload = body;
        throw error;
    }

    const data = await response.json();
    const audioData = data.audioContent;

    let speechMarks = null;
    if (includeAudioTimestamps && audioData) {
        speechMarks = await getExternalTimestamps(base64ToArrayBuffer(audioData));
    }

    return { audioData, speechMarks };
}

export async function googleChirp3HdSpeech(text, ssmlGender, name, languageCode, speakingRate, serviceKey) {
    return handle({ text, serviceOptions: { gender: ssmlGender, speaker_id: name, languageCode, voiceSpeedSetting: speakingRate }, userApiKey: serviceKey });
}
