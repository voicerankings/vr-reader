import { getApiKey, getErrorDetails, arrayBufferToBase64, getExternalTimestamps, escapeSSML, openrouterTTS } from './_shared.js';

export const providerInfo = {
    serviceNames: ['MAI-Voice-1', 'MAI-Voice-2'],
    url: 'https://*.tts.speech.microsoft.com/cognitiveservices/v1',
    handle
};

async function handle({ text, serviceOptions, userApiKey, customOptions = {}, serviceName = 'MAI-Voice-1' }) {
    let speakerId = serviceOptions.speaker_id;
    let speed = serviceOptions.voiceSpeedSetting;
    const includeAudioTimestamps = serviceOptions.includeAudioTimestamps;

    if (typeof speed === "string") {
        speed = Number(speed);
    }

    let modelName = customOptions.model || serviceName;

    if (!speakerId) {
        speakerId = `en-US-Jasper:${modelName}`;
    }

    let [baseName, extractedEmotion] = speakerId.split('--');

    let baseVoice = baseName.split(':')[0];
    let name = `${baseVoice}:${modelName}`;

    let emotion = extractedEmotion || customOptions.emotion || null;

    const apiKey = await getApiKey(serviceName === 'MAI-Voice-1' ? 'MAI_VOICE_1_AZURE_API_KEY' : 'MAI_VOICE_2_AZURE_API_KEY', userApiKey);
    if (!apiKey) throw new Error("Azure API Key is missing.");

    const url = 'https://eastus.tts.speech.microsoft.com/cognitiveservices/v1';
    const headers = {
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-160kbitrate-mono-mp3',
        'Ocp-Apim-Subscription-Key': apiKey,
        'User-Agent': 'vr-reader'
    };

    let ssmlContent = escapeSSML(text);
    let expressAsOpen = '';
    let expressAsClose = '';

    if (emotion && emotion !== 'none') {
        expressAsOpen = `<mstts:express-as style="${emotion}">`;
        expressAsClose = `</mstts:express-as>`;
    }

    let prosodyOpen = '';
    let prosodyClose = '';

    let finalSpeed = speed;
    if (customOptions.speed !== undefined) {
        finalSpeed = Number(customOptions.speed);
    }

    if (finalSpeed !== 1.0 && finalSpeed > 0) {
        const speedRate = (finalSpeed - 1) * 100;
        const rateStr = speedRate >= 0 ? `+${Math.round(speedRate)}%` : `${Math.round(speedRate)}%`;
        prosodyOpen = `<prosody rate="${rateStr}">`;
        prosodyClose = `</prosody>`;
    }

    const isOpenRouter = customOptions.apiKeyProvider && customOptions.apiKeyProvider.includes('openrouter.com');

    if (isOpenRouter && serviceName === 'MAI-Voice-2') {
        const audioBuffer = await openrouterTTS({
            model: customOptions.apiKeyProvider.split('.com/')[1] || 'microsoft/mai-voice-2',
            text,
            voice: name,
            speed: finalSpeed,
            apiKey,
            providerOptions: (emotion && emotion !== 'none')
                ? { options: { azure: { style: emotion } } }
                : undefined
        });

        return {
            audioData: arrayBufferToBase64(audioBuffer),
            speechMarks: includeAudioTimestamps ? await getExternalTimestamps(audioBuffer) : null
        };
    }

    let locale = 'en-US';
    const localeMatch = baseVoice.match(/^[a-z]{2}-[A-Z]{2}/i);
    if (localeMatch) {
        locale = localeMatch[0];
    }

    const data = `<speak version='1.0' xml:lang='${locale}' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts'>
    <voice name='${name}'>
        ${expressAsOpen}${prosodyOpen}${ssmlContent}${prosodyClose}${expressAsClose}
    </voice>
  </speak>`;

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: data
    });

    if (!response.ok) {
        const errorBody = await getErrorDetails(response);
        const error = new Error(`Azure MAI API Error: ${response.statusText}`);
        error.responseBody = errorBody;
        error.statusCode = response.status;
        error.requestPayload = data;
        throw error;
    }

    const audioBuffer = await response.arrayBuffer();
    const base64String = arrayBufferToBase64(audioBuffer);

    let speechMarks = null;
    if (includeAudioTimestamps && audioBuffer) {
        speechMarks = await getExternalTimestamps(audioBuffer);
    }

    return { audioData: base64String, speechMarks };
}

export async function azureMAIVoice(text, speakerId, speed, includeAudioTimestamps, serviceKey, options = {}) {
    return handle({ text, serviceOptions: { speaker_id: speakerId, voiceSpeedSetting: speed, includeAudioTimestamps }, userApiKey: serviceKey, customOptions: options, serviceName: options.serviceName || 'MAI-Voice-1' });
}
