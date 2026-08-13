import { getApiKey, getErrorDetails, getExternalTimestamps } from './_shared.js';

export const providerInfo = {
    serviceNames: ['ResembleAI'],
    url: 'https://app.resemble.ai/api/v2/projects',
    handle
};

async function handle({ text, serviceOptions, userApiKey }) {
    const instructions = serviceOptions.voice_instructions;
    let speaker_id = serviceOptions.speaker_id;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;

    const apiKey = await getApiKey('RESEMBLEAI_API_KEY', userApiKey);

    if (speaker_id.indexOf("--") > -1) {
        speaker_id = speaker_id.split("--")[0];
    }

    const inputText = instructions
        ? `<speak prompt="${instructions}">${text}</speak>`
        : `<speak>${text}</speak>`;

    const requestPayload = {
        voice_uuid: speaker_id,
        data: inputText,
        output_format: "mp3"
    };

    const response = await fetch("https://f.cluster.resemble.ai/synthesize", {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
        const errorBody = await getErrorDetails(response);
        const error = new Error('Resemble AI API Error');
        error.responseBody = errorBody;
        error.statusCode = response.status;
        error.requestPayload = requestPayload;
        throw error;
    }
    const data = await response.json();

    let speechMarks = null;
    if (includeAudioTimestamps && data.audio_content) {
        const audioBuffer = Uint8Array.from(atob(data.audio_content), c => c.charCodeAt(0)).buffer;
        speechMarks = await getExternalTimestamps(audioBuffer);
    }

    return { audioData: data.audio_content, speechMarks };
}

export async function resembleAiSpeech(text, instructions, voiceUuid, includeAudioTimestamps, serviceKey) {
    return handle({ text, serviceOptions: { voice_instructions: instructions, speaker_id: voiceUuid, includeAudioTimestamps }, userApiKey: serviceKey });
}
