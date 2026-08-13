import { getApiKey } from './_shared.js';

export const providerInfo = {
    serviceNames: ['Speechify'],
    url: 'https://api.speechify.ai/v1/audio/speech',
    handle
};

const KNOWN_MODELS = [
    'simba-3.2',
    'simba-3.0',
    'simba-english',
    'simba-multilingual',
    'simba-base',
    'simba-turbo'
];

const STREAMING_MODELS = ['simba-3.0', 'simba-3.2'];

const DEFAULT_MODEL = 'simba-3.0';

const OUTPUT_FORMAT = 'mp3_24000_64';

function normalizeModel(raw) {
    if (!raw) return raw;
    const value = String(raw).trim().toLowerCase();
    if (value === '3.0' || value === 'simba 3.0' || value === 'simba3.0') return 'simba-3.0';
    if (value === '3.2' || value === 'simba 3.2' || value === 'simba3.2') return 'simba-3.2';
    return value;
}

function resolveModelAndVoice(speaker, explicitModel) {
    let model = normalizeModel(explicitModel);
    let voice = speaker.toLowerCase();

    for (const m of KNOWN_MODELS) {
        if (voice.endsWith(`-${m}`)) {
            voice = voice.slice(0, -(`-${m}`).length);
            if (!model) model = m;
            break;
        }
    }

    model = model || DEFAULT_MODEL;

    if (model === 'simba-3.2' && !voice.endsWith('_32')) {
        voice += '_32';
    }

    return { voice_id: voice, model };
}

function parseSseEvent(rawEvent) {
    let event = 'message';
    const dataLines = [];

    for (const line of rawEvent.split('\n')) {
        if (line.startsWith('event:')) {
            event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
        }
    }

    if (!dataLines.length) return null;
    return { event, data: dataLines.join('\n') };
}

async function parseSseStream(response) {
    if (!response.body) throw new Error('Speechify: streaming response has no body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    const audioChunks = [];
    const speechMarks = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');

        let sepIndex;
        while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
            const rawEvent = buffer.slice(0, sepIndex);
            buffer = buffer.slice(sepIndex + 2);

            const parsed = parseSseEvent(rawEvent);
            if (!parsed) continue;

            if (parsed.event === 'speech.chunk') {
                const data = JSON.parse(parsed.data);
                if (data.audio) audioChunks.push(data.audio);
                if (Array.isArray(data.speech_marks)) speechMarks.push(...data.speech_marks);
            } else if (parsed.event === 'speech.done') {
                return { audioData: audioChunks.join(''), speechMarks };
            } else if (parsed.event === 'speech.error') {
                throw new Error(`Speechify stream error: ${parsed.data}`);
            }
        }
    }

    if (audioChunks.length) {
        return { audioData: audioChunks.join(''), speechMarks };
    }

    throw new Error('Speechify: stream ended without speech.done');
}

async function readErrorData(response) {
    try {
        return await response.json();
    } catch (e) {
        return await response.text();
    }
}

function mapSpeechMarks(marks) {
    if (!marks || !Array.isArray(marks)) return [];
    return marks.map(chunk => ({
        word: chunk.value,
        startTime: chunk.start_time,
        duration: chunk.end_time - chunk.start_time
    }));
}

async function handle({ text, serviceOptions, userApiKey, customOptions = {} }) {
    const speaker = serviceOptions.speaker_id;
    const speed = serviceOptions.voiceSpeedSetting;

    const apiKey = await getApiKey('SPEECHIFY_API_KEY', userApiKey);
    if (!apiKey) throw new Error("Speechify API Key is missing.");

    const speedRate = ((Number.isFinite(Number(speed)) ? Number(speed) : 1) - 1) * 100;

    const { voice_id, model } = resolveModelAndVoice(speaker, serviceOptions.model || customOptions?.model);

    const requestPayload = {
        input: `<speak><prosody rate="${speedRate}%">${text}</prosody></speak>`,
        voice_id: voice_id,
        model: model,
        output_format: OUTPUT_FORMAT,
    };

    if (serviceOptions.languageCode) {
        requestPayload.language = serviceOptions.languageCode;
    }

    if (STREAMING_MODELS.includes(model)) {
        requestPayload.options = {
            loudness_normalization: true,
            text_normalization: true
        };
    }

    const url = STREAMING_MODELS.includes(model)
        ? 'https://api.speechify.ai/v1/audio/stream/with-timestamps'
        : 'https://api.speechify.ai/v1/audio/speech';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
        const errorData = await readErrorData(response);
        const error = new Error(`Speechify API error: ${JSON.stringify(errorData)}`);
        error.responseBody = errorData;
        error.statusCode = response.status;
        error.requestPayload = requestPayload;
        throw error;
    }

    if (STREAMING_MODELS.includes(model)) {
        const streamResult = await parseSseStream(response);
        return {
            audioData: streamResult.audioData,
            speechMarks: mapSpeechMarks(streamResult.speechMarks)
        };
    }

    const data = await response.json();
    return {
        audioData: data.audio_data,
        speechMarks: mapSpeechMarks(data.speech_marks?.chunks)
    };
}

export async function speechifySpeech(text, speaker, speed, serviceKey) {
    return handle({ text, serviceOptions: { speaker_id: speaker, voiceSpeedSetting: speed }, userApiKey: serviceKey });
}
