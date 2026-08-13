// --- Provider info imports for handler registry ---
import { providerInfo as _deepgram } from './deepgram.js';
import { providerInfo as _openai } from './openai.js';
import { providerInfo as _gpt4o } from './gpt4o-mini-tts.js';
import { providerInfo as _resemble } from './resemble-ai.js';
import { providerInfo as _orpheus } from './orpheus-tts.js';
import { providerInfo as _amazonPolly } from './amazon-polly.js';
import { providerInfo as _amazonSpeech } from './amazon-speech.js';
import { providerInfo as _azure } from './azure.js';
import { providerInfo as _azureMai } from './azure-mai.js';
import { providerInfo as _google } from './google.js';
import { providerInfo as _googleChirp } from './google-chirp.js';
import { providerInfo as _speechify } from './speechify.js';
import { providerInfo as _murf } from './murf-ai.js';
import { providerInfo as _inworld } from './inworld-ai.js';
import { providerInfo as _async } from './async-ai.js';
import { providerInfo as _kokoro } from './kokoro.js';
import { providerInfo as _rime } from './rime-ai.js';
import { providerInfo as _rimeArcana } from './rime-arcana.js';
import { providerInfo as _mimo } from './mimo-tts.js';
import { providerInfo as _stepfun } from './stepfun.js';
import { providerInfo as _grok } from './grok.js';
import { providerInfo as _mistral } from './mistral-voxtral.js';
import { providerInfo as _gemini } from './gemini.js';
import { providerInfo as _qwen } from './qwen.js';

// --- Build handler map ---
const _providers = [
    _deepgram, _openai, _gpt4o, _resemble, _orpheus,
    _amazonPolly, _amazonSpeech, _azure, _azureMai,
    _google, _googleChirp, _speechify, _murf, _inworld,
    _async, _kokoro, _rime, _rimeArcana, _mimo,
    _stepfun, _grok, _mistral, _gemini, _qwen
];

const _handlerMap = {};
const _urlMap = {};
for (const info of _providers) {
    if (info && info.serviceNames) {
        for (const name of info.serviceNames) {
            _handlerMap[name] = info.handle;
            _urlMap[name] = info.url || null;
        }
    }
}

export function getHandler(serviceName) {
    return _handlerMap[serviceName] || null;
}

export function getProviderUrl(serviceName) {
    return _urlMap[serviceName] || null;
}

// --- Re-exports for backward compatibility ---
export * from './_shared.js';
export * from './deepgram.js';
export * from './openai.js';
export * from './gpt4o-mini-tts.js';
export * from './resemble-ai.js';
export * from './orpheus-tts.js';
export * from './amazon-polly.js';
export * from './amazon-speech.js';
export * from './azure.js';
export * from './azure-mai.js';
export * from './google.js';
export * from './google-chirp.js';
export * from './speechify.js';
export * from './murf-ai.js';
export * from './inworld-ai.js';
export * from './async-ai.js';
export * from './kokoro.js';
export * from './rime-ai.js';
export * from './rime-arcana.js';
export * from './mimo-tts.js';
export * from './stepfun.js';
export * from './grok.js';
export * from './mistral-voxtral.js';
export * from './gemini.js';
export * from './qwen.js';
