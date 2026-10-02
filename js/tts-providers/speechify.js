import { getApiKey, escapeSSML } from './_shared.js';

export const providerInfo = {
    serviceNames: ['Speechify', 'Speechify-Simba-3-2'],
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

// Speechify-Simba-3-2 stores Speechify's own voice id verbatim (e.g. `geffen_32`
// or `alec`) and pins the model in the request body. Stripping a `-{model}`
// suffix or re-appending `_32` here would corrupt those ids.
function resolveVerbatimVoice(speaker, model) {
    return { voice_id: String(speaker || '').trim().toLowerCase(), model };
}

// Speechify-Simba-3-2 exposes rate, pitch, volume and the 13 emotion presets
// through SSML. When nothing deviates from the default the text is sent bare so
// Speechify is not asked to interpret a no-op prosody wrapper, and text that
// already carries markup is left alone rather than escaped or double-wrapped.
function buildSimba32Ssml(text, customOptions, fallbackRatePercent) {
    const hasMarkup = /<[a-zA-Z/]/.test(text);
    const rate = Number(customOptions.rate);
    const ratePercent = Number.isFinite(rate) && rate > 0
        ? Math.round((rate - 1) * 100)
        : fallbackRatePercent;
    const pitch = customOptions.pitch || 'medium';
    const volume = customOptions.volume || 'medium';
    const emotion = customOptions.emotion || 'none';

    if (ratePercent === 0 && pitch === 'medium' && volume === 'medium' && emotion === 'none') {
        return hasMarkup ? `<speak>${text}</speak>` : `<speak>${escapeSSML(text)}</speak>`;
    }

    let content = hasMarkup ? text : escapeSSML(text);
    if (ratePercent !== 0 || pitch !== 'medium' || volume !== 'medium') {
        content = `<prosody rate="${ratePercent}%" pitch="${pitch}" volume="${volume}">${content}</prosody>`;
    }
    if (emotion !== 'none' && !hasMarkup) {
        content = `<speechify:style emotion="${emotion}">${content}</speechify:style>`;
    }
    return `<speak>${content}</speak>`;
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

async function handle({ text, serviceOptions, userApiKey, serviceName, customOptions = {} }) {
    const speaker = serviceOptions.speaker_id;
    const speed = serviceOptions.voiceSpeedSetting;

    // Speechify-Simba-3-2 is pinned to simba-3.2 and reads its own key slot, so
    // a user can hold a Simba 3.2 key without replacing their legacy Simba key.
    const pinnedSimba32 = serviceName === 'Speechify-Simba-3-2';
    const apiKey = await getApiKey(pinnedSimba32 ? 'SPEECHIFY_SIMBA_3_2_API_KEY' : 'SPEECHIFY_API_KEY', userApiKey);
    if (!apiKey) throw new Error("Speechify API Key is missing.");

    const speedRate = ((Number.isFinite(Number(speed)) ? Number(speed) : 1) - 1) * 100;

    const { voice_id, model } = pinnedSimba32
        ? resolveVerbatimVoice(speaker, 'simba-3.2')
        : resolveModelAndVoice(speaker, serviceOptions.model || customOptions?.model);

    const requestPayload = {
        input: pinnedSimba32
            ? buildSimba32Ssml(text, customOptions, speedRate)
            : `<speak><prosody rate="${speedRate}%">${text}</prosody></speak>`,
        voice_id: voice_id,
        model: model,
        output_format: OUTPUT_FORMAT,
    };

    if (!pinnedSimba32 && serviceOptions.languageCode) {
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

export async function speechifySpeech(text, speaker, speed, serviceKey, options = {}) {
    return handle({
        text,
        serviceOptions: { speaker_id: speaker, voiceSpeedSetting: speed, model: options.model },
        userApiKey: serviceKey,
        serviceName: options.serviceName,
        customOptions: options
    });
}
