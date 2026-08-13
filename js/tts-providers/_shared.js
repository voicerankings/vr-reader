export const OPENROUTER_STT_MODELS = [
    'openai/gpt-transcribe',
    'openai/gpt-4o-transcribe',
    'openai/gpt-4o-mini-transcribe',
    'openai/whisper-1',
    'openai/whisper-large-v3',
    'openai/whisper-large-v3-turbo',
    'x-ai/grok-stt-1.0',
    'mistralai/voxtral-mini-transcribe',
    'qwen/qwen3-asr-flash-2026-02-10'
];

export const DEFAULT_OPENROUTER_STT_MODEL = 'openai/whisper-large-v3';

export async function getApiKey(storageKey, serviceKey = null) {
    if (serviceKey && serviceKey.trim()) return serviceKey;
    const storage = await chrome.storage.local.get(storageKey);
    const key = storage[storageKey];
    if (!key) throw new Error(`${storageKey.replace('_API_KEY', '')} API Key is missing.`);
    return key;
}

export async function getErrorDetails(response) {
    try {
        const text = await response.text();
        try { return JSON.parse(text); } catch { return text; }
    } catch { return null; }
}

export async function openrouterTTS({ model, text, voice, speed, apiKey, providerOptions, responseFormat }) {
    const payload = {
        model,
        input: text,
        voice,
        response_format: responseFormat || 'mp3'
    };
    if (speed && Number(speed) > 0) {
        payload.speed = Number(speed);
    }
    if (providerOptions) {
        payload.provider = providerOptions;
    }

    const response = await fetch('https://openrouter.ai/api/v1/audio/speech', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://voicerankings.com/reader',
            'X-OpenRouter-Title': 'VoiceRankings Reader',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await getErrorDetails(response);
        const error = new Error('OpenRouter TTS API Error');
        error.responseBody = errorBody;
        error.statusCode = response.status;
        error.requestPayload = payload;
        throw error;
    }

    return response.arrayBuffer();
}

export function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export function convertGrokTimestampsToSpeechMarks(audioTimestamps) {
    if (!audioTimestamps || !audioTimestamps.graph_chars || !audioTimestamps.graph_times) {
        return [];
    }

    const chars = audioTimestamps.graph_chars;
    const times = audioTimestamps.graph_times;
    const speechMarks = [];

    let currentWord = "";
    let wordStart = 0;
    let wordEnd = 0;
    let inWord = false;

    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const [start, end] = times[i];
        const isWhitespace = /^\s$/.test(char);

        if (isWhitespace) {
            if (inWord) {
                speechMarks.push({
                    word: currentWord,
                    startTime: Math.round(wordStart * 1000),
                    duration: Math.round((wordEnd - wordStart) * 1000)
                });
                inWord = false;
                currentWord = "";
            }
        } else {
            if (!inWord) {
                wordStart = start;
                inWord = true;
            }
            currentWord += char;
            wordEnd = end;
        }
    }

    if (inWord && currentWord) {
        speechMarks.push({
            word: currentWord,
            startTime: Math.round(wordStart * 1000),
            duration: Math.round((wordEnd - wordStart) * 1000)
        });
    }

    return speechMarks;
}

export async function getDeepgramTimestamps(audioBuffer) {
    console.log("Requesting word-level timestamps from Deepgram (Nova-2)...");

    let apiKey;
    try {
        apiKey = await getApiKey('DEEPGRAM_STT_API_KEY');
    } catch (err) {
        console.warn("Deepgram STT API key missing, skipping timestamps.");
        return null;
    }

    try {
        const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${apiKey}`,
                'Content-Type': 'audio/mpeg'
            },
            body: audioBuffer
        });

        if (!response.ok) {
            const error = await response.json();
            console.warn(`Deepgram STT API Error: ${JSON.stringify(error)}`);
            return null;
        }

        const transcript = await response.json();
        const words = transcript.results?.channels?.[0]?.alternatives?.[0]?.words || [];

        return words.map(w => ({
            word: w.word,
            startTime: Math.round(w.start * 1000),
            duration: Math.round((w.end - w.start) * 1000)
        }));
    } catch (error) {
        console.warn("Failed to fetch Deepgram timestamps:", error);
        return null;
    }
}

export async function getWhisperTimestamps(audioBuffer) {
    console.log("Requesting word-level timestamps from OpenAI Whisper...");

    let apiKey;
    try {
        apiKey = await getApiKey('OPENAI_STT_API_KEY');
    } catch (err) {
        console.warn("OpenAI STT API key missing, skipping Whisper timestamps.");
        return null;
    }

    try {
        const formData = new FormData();
        formData.append('file', new Blob([audioBuffer]), 'audio.mp3');
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'verbose_json');
        formData.append('timestamp_granularities[]', 'word');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            console.warn(`OpenAI Whisper API Error: ${JSON.stringify(error.error)}`);
            return null;
        }

        const data = await response.json();
        return (data.words || []).map(w => ({
            word: w.word,
            startTime: Math.round(w.start * 1000),
            duration: Math.round((w.end - w.start) * 1000)
        }));
    } catch (error) {
        console.warn("Failed to fetch Whisper timestamps:", error);
        return null;
    }
}

export function detectAudioFormat(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer.slice(0, 16));
    const len = bytes.length;
    if (len >= 4) {
        if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return 'mp3';
        if (bytes[0] === 0xff && (bytes[1] === 0xfb || bytes[1] === 0xf3 || bytes[1] === 0xf2)) return 'mp3';
        if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'wav';
        if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return 'ogg';
        if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) return 'flac';
        if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'webm';
    }
    if (len >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return 'm4a';
    return 'mp3';
}

export async function getOpenRouterTimestamps(audioBuffer) {
    console.log("Requesting word-level timestamps from OpenRouter...");

    let apiKey;
    try {
        apiKey = await getApiKey('OPENROUTER_STT_API_KEY');
    } catch (err) {
        console.warn("OpenRouter STT API key missing, skipping timestamps.");
        return null;
    }

    const storage = await chrome.storage.local.get(['DEFAULT_OPENROUTER_STT_MODEL']);
    const model = storage.DEFAULT_OPENROUTER_STT_MODEL || DEFAULT_OPENROUTER_STT_MODEL;
    if (!OPENROUTER_STT_MODELS.includes(model)) {
        console.warn(`Unsupported OpenRouter STT model "${model}", skipping timestamps.`);
        return null;
    }

    try {
        const payload = {
            model,
            input_audio: {
                data: arrayBufferToBase64(audioBuffer),
                format: detectAudioFormat(audioBuffer)
            },
            response_format: 'verbose_json',
            timestamp_granularities: ['word']
        };

        const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://voicerankings.com/reader',
                'X-OpenRouter-Title': 'VoiceRankings Reader',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await getErrorDetails(response);
            console.warn(`OpenRouter STT API Error: ${JSON.stringify(errorBody)}`);
            return null;
        }

        const data = await response.json();
        return (data.words || []).map(w => ({
            word: w.word,
            startTime: Math.round(w.start * 1000),
            duration: Math.round((w.end - w.start) * 1000)
        }));
    } catch (error) {
        console.warn("Failed to fetch OpenRouter timestamps:", error);
        return null;
    }
}

export async function getExternalTimestamps(audioBuffer) {
    const storage = await chrome.storage.local.get('DEFAULT_EXTERNAL_TIMESTAMP_SERVICE');
    const service = storage.DEFAULT_EXTERNAL_TIMESTAMP_SERVICE || 'None';

    if (service === 'Whisper') {
        return await getWhisperTimestamps(audioBuffer);
    } else if (service === 'Deepgram') {
        return await getDeepgramTimestamps(audioBuffer);
    } else if (service === 'OpenRouter') {
        return await getOpenRouterTimestamps(audioBuffer);
    }

    return null;
}

export function parsePollySpeechMarks(marksText) {
    if (!marksText) return [];

    return marksText
        .trim()
        .split('\n')
        .map(line => JSON.parse(line))
        .map(mark => ({
            word: mark.value,
            startTime: mark.time,
            duration: 0
        }));
}

export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export function escapeSSML(text) {
    if (!text) return "";
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
