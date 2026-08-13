import { getApiKey, getErrorDetails, arrayBufferToBase64, getExternalTimestamps } from './_shared.js';
import { Mp3Encoder } from '@breezystack/lamejs';

const QWEN_MODEL = 'qwen3-tts-flash-2025-11-27';
const QWEN_API_URL = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const QWEN_MP3_BITRATE = 96;
const PCM_CHUNK_SAMPLES = 1152;

export const providerInfo = {
    serviceNames: ['qwen3-tts-flash'],
    url: QWEN_API_URL,
    handle
};

async function handle({ text, serviceOptions, userApiKey }) {
    const apiKey = await getApiKey('QWEN_API_KEY', userApiKey);

    let speakerId = serviceOptions.speaker_id || 'Cherry';
    if (speakerId.includes('--')) {
        speakerId = speakerId.split('--')[0];
    }
    const finalVoice = speakerId.replace(/-/g, ' ');

    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;
    const languageType = mapLanguage(serviceOptions.languageCode);

    const payload = {
        model: QWEN_MODEL,
        input: {
            text,
            voice: finalVoice,
            language_type: languageType
        }
    };

    const response = await fetch(QWEN_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await getErrorDetails(response);
        const error = new Error('Qwen (DashScope) API Error');
        error.responseBody = errorBody;
        error.statusCode = response.status;
        error.requestPayload = payload;
        throw error;
    }

    const data = await response.json();
    const audioUrl = data.output?.audio?.url;
    if (!audioUrl) {
        const error = new Error('Qwen (DashScope) did not return an audio URL.');
        error.responseBody = data;
        error.requestPayload = payload;
        throw error;
    }

    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
        const error = new Error('Failed to download Qwen audio URL.');
        error.statusCode = audioResponse.status;
        throw error;
    }

    const wavArrayBuffer = await audioResponse.arrayBuffer();
    let samples, sampleRate;
    try {
        ({ samples, sampleRate } = parseWavToPcm(wavArrayBuffer));
    } catch (parseError) {
        const error = new Error(`Failed to parse Qwen audio: ${parseError.message}`);
        error.statusCode = audioResponse.status;
        throw error;
    }
    const mp3Buffer = await encodePcmToMp3(samples, sampleRate);

    return {
        audioData: arrayBufferToBase64(mp3Buffer),
        speechMarks: includeAudioTimestamps ? await getExternalTimestamps(mp3Buffer) : null
    };
}

function mapLanguage(inputLanguage) {
    if (!inputLanguage || inputLanguage.toLowerCase() === 'auto') {
        return 'Auto';
    }

    const code = inputLanguage.split('-')[0].toLowerCase();
    const languageMap = {
        'zh': 'Chinese',
        'en': 'English',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'es': 'Spanish',
        'ja': 'Japanese',
        'ko': 'Korean',
        'fr': 'French',
        'ru': 'Russian'
    };

    return languageMap[code] || 'English';
}

function parseWavToPcm(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    if (bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46) {
        throw new Error('audio is not a RIFF/WAVE file.');
    }

    let offset = 12;
    let withSampleRate = 24000;
    let numChannels = 1;
    let dataStart = -1;
    let declaredLength = 0;

    while (offset + 8 <= bytes.length) {
        const chunkId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
        const chunkLength = view.getUint32(offset + 4, true);
        const chunkDataStart = offset + 8;

        if (chunkId === 'fmt ') {
            if (chunkDataStart + 16 <= bytes.length) {
                numChannels = view.getUint16(chunkDataStart + 2, true);
                withSampleRate = view.getUint32(chunkDataStart + 4, true);
            }
        } else if (chunkId === 'data') {
            dataStart = chunkDataStart;
            declaredLength = chunkLength;
            break;
        }

        offset = chunkDataStart + chunkLength + (chunkLength % 2);
    }

if (dataStart === -1 || dataStart >= bytes.length) {
        throw new Error('data chunk missing.');
    }

    // DashScope WAV headers can declare a data length larger than the actual
    // file content. Clamp to the real bytes available so we never allocate an
    // oversized typed array (RangeError: Invalid typed array length).
    const availableSamples = Math.floor((bytes.length - dataStart) / 2);
    const declaredSamples = Math.floor(declaredLength / 2);
    const numSamples = Math.max(0, Math.min(declaredSamples, availableSamples));

    if (numSamples === 0) {
        throw new Error('data chunk is empty.');
    }

    const src = new Int16Array(bytes.buffer, bytes.byteOffset + dataStart, numSamples);

    let samples;
    if (numChannels === 1) {
        samples = new Int16Array(src);
    } else {
        samples = new Int16Array(src.length / numChannels);
        for (let i = 0; i < samples.length; i++) {
            let sum = 0;
            for (let c = 0; c < numChannels; c++) {
                sum += src[i * numChannels + c];
            }
            samples[i] = sum / numChannels;
        }
    }

    return { samples, sampleRate: withSampleRate };
}

async function encodePcmToMp3(samples, sampleRate) {
    const encoder = new Mp3Encoder(1, sampleRate, QWEN_MP3_BITRATE);

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

export async function qwenSpeech(text, speakerId, includeAudioTimestamps, serviceKey, options = {}) {
    return handle({
        text,
        serviceOptions: {
            speaker_id: speakerId,
            includeAudioTimestamps,
            languageCode: options.languageCode || 'en-US',
            voice_instructions: options.voice_instructions || ''
        },
        userApiKey: serviceKey,
        customOptions: options
    });
}