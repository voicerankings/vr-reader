import { getApiKey, getErrorDetails, arrayBufferToBase64, getExternalTimestamps } from './_shared.js';

export const providerInfo = {
    serviceNames: ['GPT-4o-mini-tts'],
    url: 'https://api.openai.com/v1/audio/speech',
    handle
};

async function handle({ text, serviceOptions, userApiKey }) {
    let voice = serviceOptions.speaker_id;
    const instructions = serviceOptions.voice_instructions;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;

    const apiKey = await getApiKey('GPT_4O_MINI_TTS_API_KEY', userApiKey);

    if (voice.indexOf("--") > -1) {
        voice = voice.split("--")[0];
    }

    const payload = {
        model: "gpt-4o-mini-tts",
        input: text,
        voice: voice.toLowerCase()
    };
    if (instructions) {
        payload.instructions = instructions;
    }

    const speechResponse = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!speechResponse.ok) {
        const errorBody = await getErrorDetails(speechResponse);
        const error = new Error('OpenAI Speech API Error');
        error.responseBody = errorBody;
        error.statusCode = speechResponse.status;
        error.requestPayload = payload;
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

export async function gpt4oMiniTtsSpeech(text, voice, instructions, includeAudioTimestamps, serviceKey) {
    return handle({ text, serviceOptions: { speaker_id: voice, voice_instructions: instructions, includeAudioTimestamps }, userApiKey: serviceKey });
}
