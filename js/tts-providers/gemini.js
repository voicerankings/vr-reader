import { getApiKey, getErrorDetails, arrayBufferToBase64, getExternalTimestamps, openrouterTTS } from './_shared.js';
import { Mp3Encoder } from '@breezystack/lamejs';

const GEMINI_MODEL = 'gemini-3.1-flash-tts-preview';
const GEMINI_2_5_MODEL = 'gemini-2.5-flash-preview-tts';
const GEMINI_3_8_MODEL = 'gemini-3.8-flash-tts';
const OPENROUTER_MODEL = 'google/gemini-3.1-flash-tts-preview';
const OPENROUTER_MODEL_3_8 = 'google/gemini-3.8-flash-tts';
const GEMINI_PCM_SAMPLE_RATE = 24000;
const GEMINI_MP3_BITRATE = 96;
const PCM_CHUNK_SAMPLES = 1152;

export const providerInfo = {
    serviceNames: [
        'gemini-3-1-flash-tts', 'gemini-3-1-flash-tts-vd',
        'gemini-2-5-flash-tts', 'gemini-2-5-flash-tts-vd',
        'gemini-3-8-flash-tts', 'gemini-3-8-flash-tts-extended', 'gemini-3-8-flash-tts-vd'
    ],
    url: 'https://texttospeech.googleapis.com/v1/text:synthesize',
    handle
};

async function handle({ text, serviceOptions, userApiKey, customOptions = {}, serviceName }) {
    const speakerId = serviceOptions.speaker_id;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;
    const isGemini25 = serviceName && serviceName.startsWith('gemini-2');
    const isGemini38 = serviceName && serviceName.startsWith('gemini-3-8');
    let storageKey = 'GEMINI_3_1_FLASH_TTS_API_KEY';
    let model = GEMINI_MODEL;
    if (isGemini25) {
        storageKey = 'GEMINI_2_5_FLASH_TTS_API_KEY';
        model = GEMINI_2_5_MODEL;
    } else if (isGemini38) {
        storageKey = 'GEMINI_3_8_FLASH_TTS_API_KEY';
        model = GEMINI_3_8_MODEL;
    }

    const apiKey = await getApiKey(storageKey, userApiKey);

    let finalVoice = speakerId;
    if (speakerId && speakerId.includes('--')) {
        finalVoice = speakerId.split('--')[0];
    }

    const languageCode = serviceOptions.languageCode || 'en-US';

    const isOpenRouter = customOptions.apiKeyProvider && customOptions.apiKeyProvider.includes('openrouter.com');
    const isGoogleGenAi = customOptions.apiKeyProvider && customOptions.apiKeyProvider.includes('generativelanguage.googleapis.com');

    if (isOpenRouter && !isGemini25) {
        if (isGemini38) {
            // 3.8 reads the input as a verbatim transcript and has no structured
            // prompt form. OpenRouter's OpenAI-shaped payload carries no
            // speech_metadata field, so delivery instructions ride along as a
            // leading inline vocal tag instead.
            const style = buildGeminiInstructions(serviceOptions, customOptions);
            const input = style ? `[${style}] ${text}` : text;
            const audioBuffer = await openrouterTTS({
                model: OPENROUTER_MODEL_3_8,
                text: input,
                voice: finalVoice,
                apiKey,
                responseFormat: 'mp3'
            });
            return {
                audioData: arrayBufferToBase64(audioBuffer),
                speechMarks: includeAudioTimestamps ? await getExternalTimestamps(audioBuffer) : null
            };
        }

        const promptText = buildStructuredPrompt(text, serviceOptions, customOptions);
        const audioBuffer = await openrouterTTS({
            model: OPENROUTER_MODEL,
            text: promptText,
            voice: finalVoice,
            apiKey,
            responseFormat: 'pcm'
        });
        const mp3Buffer = await encodePcmToMp3(audioBuffer);
        return {
            audioData: arrayBufferToBase64(mp3Buffer),
            speechMarks: includeAudioTimestamps ? await getExternalTimestamps(mp3Buffer) : null
        };
    }

    if (isGoogleGenAi) {
        const promptText = isGemini38
            ? text
            : (isGemini25
                ? buildLegacyPrompt(text, serviceOptions, customOptions)
                : buildStructuredPrompt(text, serviceOptions, customOptions));
        const audioBuffer = await googleGenAiSpeech({
            model,
            text: promptText,
            voiceName: finalVoice,
            style: isGemini38 ? buildGeminiInstructions(serviceOptions, customOptions) : '',
            isGemini38,
            apiKey
        });
        const mp3Buffer = await encodePcmToMp3(audioBuffer);
        return {
            audioData: arrayBufferToBase64(mp3Buffer),
            speechMarks: includeAudioTimestamps ? await getExternalTimestamps(mp3Buffer) : null
        };
    }

    if (isGemini38) {
        // Gemini 3.8 is served by the Gemini API only; there is no Cloud
        // Text-to-Speech (text:synthesize) model for it.
        const error = new Error('Gemini 3.8 Flash TTS is only available through the Gemini API or OpenRouter. Set the API Key Provider option for this service.');
        error.requestPayload = { model, voice: finalVoice };
        throw error;
    }

    const prompt = buildGeminiInstructions(serviceOptions, customOptions);
    const payload = {
        input: {},
        voice: {
            languageCode,
            name: finalVoice,
            modelName: model
        },
        audioConfig: {
            audioEncoding: 'MP3'
        }
    };
    if (prompt && prompt.trim()) {
        payload.input.prompt = prompt.trim();
    }
    payload.input.text = text;

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await getErrorDetails(response);
        const error = new Error('Gemini (Cloud TTS) API Error');
        error.responseBody = errorBody;
        error.statusCode = response.status;
        error.requestPayload = payload;
        throw error;
    }

    const data = await response.json();
    const audioDataBase64 = data.audioContent;
    if (!audioDataBase64) {
        const error = new Error('Google Cloud TTS did not return audio content.');
        error.requestPayload = payload;
        throw error;
    }

    let speechMarks = null;
    if (includeAudioTimestamps) {
        const audioBytes = Uint8Array.from(atob(audioDataBase64), c => c.charCodeAt(0)).buffer;
        speechMarks = await getExternalTimestamps(audioBytes);
    }

    return { audioData: audioDataBase64, speechMarks };
}

async function googleGenAiSpeech({ model, text, voiceName, style, isGemini38, apiKey }) {
    const part = { text };
    const voiceConfig = isGemini38
        ? { voice: voiceName }
        : { prebuiltVoiceConfig: { voiceName } };

    if (isGemini38 && style) {
        // Gemini 3.8 treats the input as a verbatim transcript: delivery
        // directions go in speech_metadata.style on the part, not in the text.
        part.speech_metadata = { style };
    }

    const payload = {
        model,
        contents: [
            {
                parts: [part]
            }
        ],
        generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig
            }
        }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await getErrorDetails(response);
        const error = new Error('Google GenAI API Error');
        error.responseBody = errorBody;
        error.statusCode = response.status;
        error.requestPayload = payload;
        throw error;
    }

    const data = await response.json();
    // The audio part is not guaranteed to be first, and the REST response
    // spells the field either inlineData or inline_data depending on revision.
    const parts = data.candidates?.[0]?.content?.parts || [];
    let inlineData = null;
    for (const candidatePart of parts) {
        const found = candidatePart?.inlineData || candidatePart?.inline_data;
        if (found && found.data) {
            inlineData = found;
            break;
        }
    }
    if (!inlineData) {
        const error = new Error('Google GenAI did not return audio inlineData.');
        error.responseBody = data;
        error.requestPayload = payload;
        throw error;
    }

    return Uint8Array.from(atob(inlineData.data), c => c.charCodeAt(0)).buffer;
}

async function encodePcmToMp3(pcmArrayBuffer) {
    const samples = new Int16Array(pcmArrayBuffer);
    const encoder = new Mp3Encoder(1, GEMINI_PCM_SAMPLE_RATE, GEMINI_MP3_BITRATE);

    const chunks = [];
    for (let offset = 0; offset < samples.length; offset += PCM_CHUNK_SAMPLES) {
        const block = samples.subarray(offset, offset + PCM_CHUNK_SAMPLES);
        const encoded = encoder.encodeBuffer(block);
        if (encoded && encoded.length) {
            chunks.push(encoded);
        }
    }

    const flushed = encoder.flush();
    if (flushed && flushed.length) {
        chunks.push(flushed);
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const mp3Buffer = new Uint8Array(totalLength);
    let writeOffset = 0;
    for (const chunk of chunks) {
        mp3Buffer.set(chunk, writeOffset);
        writeOffset += chunk.byteLength;
    }

    return mp3Buffer.buffer;
}

function buildGeminiInstructions(serviceOptions, customOptions) {
    const parts = [];
    if (serviceOptions && serviceOptions.voice_instructions && serviceOptions.voice_instructions.trim()) {
        parts.push(serviceOptions.voice_instructions.trim());
    }
    if (customOptions && customOptions.instructions && customOptions.instructions.trim()) {
        parts.push(customOptions.instructions.trim());
    }
    return parts.filter(Boolean).join('. ');
}

function buildStructuredPrompt(text, serviceOptions, customOptions = {}) {
    const promptParts = [];
    const instructions = buildGeminiInstructions(serviceOptions, customOptions);
    if (instructions) {
        promptParts.push(`## Scene:\n${instructions}`);
    }
    if (customOptions && customOptions.context && customOptions.context.trim()) {
        promptParts.push(`## Sample Context:\n${customOptions.context.trim()}`);
    }
    promptParts.push(`## Transcript:\n${text}`);
    return promptParts.join('\n\n');
}

function buildLegacyPrompt(text, serviceOptions, customOptions = {}) {
    const instructions = buildGeminiInstructions(serviceOptions, customOptions);
    return instructions ? `${instructions}: ${text}` : text;
}

export async function geminiSpeech(text, speakerId, includeAudioTimestamps, serviceKey, options = {}) {
    return handle({
        text,
        serviceOptions: {
            speaker_id: speakerId,
            includeAudioTimestamps,
            voiceSpeedSetting: options.voiceSpeedSetting,
            languageCode: options.languageCode || 'en-US',
            voice_instructions: options.voice_instructions || ''
        },
        userApiKey: serviceKey,
        customOptions: options,
        serviceName: options.serviceName
    });
}