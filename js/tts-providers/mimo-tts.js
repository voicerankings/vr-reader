import { getApiKey, getErrorDetails, getExternalTimestamps } from './_shared.js';

export const providerInfo = {
    serviceNames: ['MiMo-V2-5-TTS', 'MiMo-V2-5-TTS-vd'],
    url: 'https://api.xiaomimimo.com/v1/chat/completions',
    handle
};

async function handle({ text, serviceOptions, userApiKey, customOptions = {} }) {
    const speakerId = serviceOptions.speaker_id;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;

    const isDeepInfra = customOptions.apiKeyProvider && customOptions.apiKeyProvider.includes('deepinfra.com');
    const apiKey = await getApiKey('MIMO_API_KEY', userApiKey);

    const voiceMapping = {
        "rock-sugar": "冰糖",
        "jasmine": "茉莉",
        "soda": "苏打",
        "birch": "白桦"
    };

    let splitId = speakerId;
    if (speakerId && speakerId.includes('--')) {
        splitId = speakerId.split('--')[0];
    }

    let finalVoice = splitId;
    if (splitId && voiceMapping[splitId.toLowerCase()]) {
        finalVoice = voiceMapping[splitId.toLowerCase()];
    }

    let url, payload, headers;

    let combinedInstructions = customOptions.voice_instructions || "";
    if (customOptions.instructions) {
        combinedInstructions = combinedInstructions
            ? `${combinedInstructions}. ${customOptions.instructions}`
            : customOptions.instructions;
    }

    if (isDeepInfra) {
        const deepinfraPath = customOptions.apiKeyProvider.split('.com/')[1];
        url = `https://api.deepinfra.com/v1/inference/${deepinfraPath}`;
        payload = {
            text: text,
            voice: finalVoice,
            output_format: "mp3"
        };

        if (combinedInstructions && combinedInstructions.trim()) {
            payload.instruct = combinedInstructions.trim();
        }

        headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        };
    } else {
        url = 'https://api.xiaomimimo.com/v1/chat/completions';

        const messages = [];
        if (combinedInstructions && combinedInstructions.trim()) {
            messages.push({
                role: "user",
                content: combinedInstructions.trim()
            });
        }
        messages.push({
            role: "assistant",
            content: text
        });

        payload = {
            model: "mimo-v2.5-tts",
            messages: messages,
            audio: {
                format: "mp3",
                voice: finalVoice
            }
        };
        headers = {
            'api-key': apiKey,
            'Content-Type': 'application/json'
        };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await getErrorDetails(response);
        const error = new Error('Mimo TTS API Error');
        error.responseBody = errorBody;
        error.statusCode = response.status;
        error.requestPayload = payload;
        throw error;
    }

    const data = await response.json();
    let audioDataBase64;

    if (isDeepInfra) {
        audioDataBase64 = data.audio;
        if (!audioDataBase64) {
            throw new Error('DeepInfra synthesis did not return audio data.');
        }
        const dataUriPrefix = "data:audio/mp3;base64,";
        if (audioDataBase64.startsWith(dataUriPrefix)) {
            audioDataBase64 = audioDataBase64.substring(dataUriPrefix.length);
        } else if (audioDataBase64.startsWith('data:')) {
            audioDataBase64 = audioDataBase64.split(',')[1];
        }
    } else {
        audioDataBase64 = data.choices?.[0]?.message?.audio?.data || (data.data ? data.data.audio : data.audio_data);
    }

    let speechMarks = null;
    if (includeAudioTimestamps && audioDataBase64) {
        const audioBuffer = Uint8Array.from(atob(audioDataBase64), c => c.charCodeAt(0)).buffer;
        speechMarks = await getExternalTimestamps(audioBuffer);
    }
    return { audioData: audioDataBase64, speechMarks };
}

export async function mimoTtsSpeech(text, speakerId, includeAudioTimestamps, serviceKey, options = {}) {
    return handle({ text, serviceOptions: { speaker_id: speakerId, includeAudioTimestamps }, userApiKey: serviceKey, customOptions: options });
}
