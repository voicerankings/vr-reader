import { getApiKey, getErrorDetails, arrayBufferToBase64, getExternalTimestamps } from './_shared.js';

export const providerInfo = {
    serviceNames: ['AsyncAI'],
    url: 'https://api.async.ai/v1/tts',
    handle
};

async function handle({ text, serviceOptions, userApiKey, customOptions = {} }) {
    const speakerId = serviceOptions.speaker_id;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;

    const apiKey = await getApiKey("ASYNCAI_API_KEY", userApiKey);
    if (!apiKey) throw new Error("AsyncAI API Key is missing.");

    const payload = {
        model_id: customOptions.model || 'async_flash_v1.5',
        transcript: text,
        voice: { mode: 'id', id: speakerId },
        output_format: { container: 'mp3', sample_rate: 44100 }
    };

    const baseUrl = 'https://api.async.com/';
    const headers = {
        'x-api-key': apiKey,
        'version': 'v1',
        'Content-Type': 'application/json'
    };

    const primaryEndpoint = includeAudioTimestamps ? 'text_to_speech/with_timestamps' : 'text_to_speech';
    const primaryUrl = baseUrl + primaryEndpoint;

    try {
        const response = await fetch(primaryUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await getErrorDetails(response);
            const error = new Error(`Primary status: ${response.status}`);
            error.responseBody = errorBody;
            error.statusCode = response.status;
            error.requestPayload = payload;
            throw error;
        }

        if (includeAudioTimestamps) {
            const responseData = await response.json();
            const audioData = responseData.audio_base64;
            let speechMarks = null;

            if (responseData.alignment && responseData.alignment.words) {
                const { words, word_start_times_milliseconds, word_end_times_milliseconds } = responseData.alignment;
                speechMarks = words.map((word, index) => ({
                    word: word,
                    startTime: word_start_times_milliseconds[index],
                    duration: word_end_times_milliseconds[index] - word_start_times_milliseconds[index]
                }));
            }
            return { audioData, speechMarks };
        } else {
            const audioBuffer = await response.arrayBuffer();
            const audioData = arrayBufferToBase64(audioBuffer);
            return { audioData, speechMarks: null };
        }
    } catch (primaryError) {
        console.warn(`Primary AsyncAI call failed: ${primaryError.message}. Attempting streaming fallback...`);

        const streamUrl = baseUrl + 'text_to_speech/streaming';
        const response = await fetch(streamUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await getErrorDetails(response);
            const error = new Error(`Failed to generate audio from AsyncAI (both primary and fallback failed)`);
            error.responseBody = errorBody;
            error.statusCode = response.status;
            error.requestPayload = payload;
            throw error;
        }

        const audioBuffer = await response.arrayBuffer();
        const audioData = arrayBufferToBase64(audioBuffer);
        let speechMarks = null;

        if (includeAudioTimestamps) {
            speechMarks = await getExternalTimestamps(audioBuffer);
        }

        return { audioData, speechMarks };
    }
}

export async function asyncAiSpeech(text, speakerId, includeAudioTimestamps, serviceKey, customOptions = {}) {
    return handle({ text, serviceOptions: { speaker_id: speakerId, includeAudioTimestamps }, userApiKey: serviceKey, customOptions });
}
