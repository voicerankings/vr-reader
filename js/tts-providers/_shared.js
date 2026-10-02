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

// ---------------------------------------------------------------------------
// User-facing error messages
//
// Provider handlers throw rich Errors that carry the whole API response, which
// is what we want for the diagnostics log and telemetry but far too noisy for a
// toast. Everything funnels through buildFriendlyErrorMessage() so no provider
// has to think about presentation.
// ---------------------------------------------------------------------------

const FRIENDLY_ERROR_MAX_LENGTH = 180;
const FRIENDLY_ERROR_DETAIL_MAX_LENGTH = 120;

// Where vendors hide the human-readable sentence inside an error body. Ordered
// most-specific first: a body can carry both `message` and `error_message`, and
// the nested `error.message` is usually the better one.
const PROVIDER_MESSAGE_PATHS = [
  ['error', 'message'],
  ['error_message'],
  ['err_msg'],
  ['detail'],
  ['message'],
  ['errorMessage'],
  ['error', 'error_description'],
  ['error_description'],
  ['Message']
];

// Keys that must never be echoed back to the user or into telemetry.
const SENSITIVE_KEY_HINTS = ['key', 'token', 'secret', 'password', 'authorization'];

function flattenToRecord(value) {
  if (value === null || typeof value !== 'object') return null;
  const out = {};
  for (const key of Object.keys(value)) {
    const entry = value[key];
    if (entry === null || entry === undefined) continue;
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      out[key] = entry;
    } else if (typeof entry === 'object' && !Array.isArray(entry)) {
      Object.assign(out, flattenToRecord(entry));
    }
  }
  return out;
}

// Pulls the provider's own sentence out of an arbitrarily shaped error body.
export function extractProviderMessage(body) {
  if (body === null || body === undefined) return '';

  if (typeof body === 'string') {
    const trimmed = body.trim();
    // A bare JSON document as a string: parse it and try again.
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try { return extractProviderMessage(JSON.parse(trimmed)); } catch { /* fall through */ }
    }
    return trimmed;
  }

  if (typeof body !== 'object') return String(body);

  for (const path of PROVIDER_MESSAGE_PATHS) {
    let cursor = body;
    for (const segment of path) {
      if (cursor === null || typeof cursor !== 'object') { cursor = undefined; break; }
      cursor = cursor[segment];
    }
    if (typeof cursor === 'string' && cursor.trim()) return cursor.trim();
  }

  // Some APIs return only a numeric error code. Say so rather than going silent.
  const code = body.error_code ?? body.code ?? body.status;
  if (code !== undefined && code !== null) return `Error code ${code}`;

  return '';
}

// Masks anything that looks like a credential before the string reaches a toast,
// the diagnostics log, or an innerHTML sink.
function maskSecrets(text) {
  return String(text)
    .replace(/\b(sk|pk|rk|api|key|token)[-_][A-Za-z0-9_-]{8,}/gi, '$1-***')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '***');
}

// One line, no markup: these strings are also injected into innerHTML by the
// content-script toast, so angle brackets and quotes must not survive.
function toPlainSingleLine(text) {
    return String(text ?? '')
        .replace(/[\u0000-\u001f]+/g, ' ')
        .replace(/[<>]/g, '')
        .replace(/["'`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    const cut = text.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

// Strips the "SomeProvider TTS API error: {json}" scaffolding that handlers wrap
// around the useful part, so a fallback to error.message still reads well.
function stripJsonTail(message) {
  return String(message ?? '').replace(/\s*[:\-]?\s*\{[\s\S]*$/, '').trim();
}

function statusPhrase(statusCode) {
  switch (statusCode) {
    case 400: return 'rejected the request';
    case 402: return 'reported a payment problem';
    case 404: return 'does not recognise this request';
    case 408: return 'timed out';
    case 413: return 'rejected the request as too large';
    case 422: return 'could not process the request';
    case 429: return 'hit a rate limit';
    case 500: return 'had an internal error';
    case 502: return 'is having trouble upstream';
    case 503: return 'is temporarily unavailable';
    case 504: return 'timed out';
    default:
      return statusCode >= 500 ? 'is unavailable right now' : 'rejected the request';
  }
}

/**
 * Turns a provider Error into a short, plain, human sentence for the UI.
 *
 * @param {string} serviceName  the voice_service id, used as the subject
 * @param {Error}  error        the thrown Error, with optional .statusCode
 *                              and .responseBody set by the handler
 * @returns {string} one line, safe for a toast, a modal and innerHTML
 */
export function buildFriendlyErrorMessage(serviceName, error) {
  const subject = toPlainSingleLine(serviceName) || 'The provider';
  const statusCode = Number(error && error.statusCode) || null;
  const isKeyError = statusCode === 401 || statusCode === 403;

  let lead;
  if (isKeyError) {
    lead = `${subject} rejected the API key`;
  } else if (statusCode === 429) {
    lead = `${subject} hit a rate limit`;
  } else if (statusCode) {
    lead = `${subject} ${statusPhrase(statusCode)}`;
  } else {
    lead = `${subject} could not be reached`;
  }

  // A key rejection never needs the provider's own wording: it is always some
  // variation of "bad key", and repeating it just makes the toast longer. The
  // full body stays available in Settings -> Error Logs.
  const rawDetail = isKeyError ? '' : toPlainSingleLine(
    extractProviderMessage(error && error.responseBody) || stripJsonTail(error && error.message)
  );

  // Sentences are joined with '. ', so drop any trailing terminator first to
  // avoid "credentials.." and friends.
  const detail = rawDetail.replace(/[.!?;:,\s]+$/, '');

  const hint = (() => {
    if (isKeyError) return 'Check the key saved for this provider.';
    if (statusCode === 429) return 'Wait a moment, then try again.';
    if (statusCode === 400 || statusCode === 404 || statusCode === 422) return 'Check this provider\u2019s options in BYOK settings.';
    if (!statusCode) return 'Check your connection, then try again.';
    return 'Try again in a moment.';
  })();

  const parts = [lead];
  if (detail && !detail.toLowerCase().startsWith(lead.toLowerCase())) {
    parts.push(truncate(detail, FRIENDLY_ERROR_DETAIL_MAX_LENGTH));
  }
  parts.push(hint);

  return truncate(maskSecrets(parts.join('. ')), FRIENDLY_ERROR_MAX_LENGTH);
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
