import { getApiKey } from './_shared.js';

export const providerInfo = {
    serviceNames: ['Google'],
    url: 'https://texttospeech.googleapis.com/v1/text:synthesize',
    handle
};

async function handle({ text, serviceOptions, userApiKey }) {
    const ssmlGender = serviceOptions.gender;
    const name = serviceOptions.speaker_id;
    const languageCode = serviceOptions.languageCode;
    const speakingRate = serviceOptions.voiceSpeedSetting;

    const apiKey = await getApiKey('GOOGLE_API_KEY', userApiKey);
    if (!apiKey) throw new Error("Google API Key is missing.");

    const words = text.trim().split(/\s+/);
    const ssml = `<speak>${words.map((w, i) => `<mark name="w${i}"/>${w}`).join(' ')}</speak>`;
    console.log("apiKey:", apiKey);
    const url = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`;
    const body = {
        input: { ssml },
        voice: { languageCode, ssmlGender: ssmlGender.toUpperCase(), name },
        audioConfig: { audioEncoding: 'MP3', speakingRate },
        enableTimePointing: ['SSML_MARK']
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(`Google TTS API error: ${errorData.error.message}`);
        error.responseBody = errorData;
        error.statusCode = response.status;
        error.requestPayload = body;
        throw error;
    }

    const data = await response.json();
    const wordTimings = (data.timepoints || []).map(tp => {
        const idx = parseInt(tp.markName.slice(1), 10);
        return {
            word: words[idx] || '',
            startTime: tp.timeSeconds * 1000
        };
    });

    for (let i = 0; i < wordTimings.length - 1; i++) {
        wordTimings[i].duration = wordTimings[i + 1].startTime - wordTimings[i].startTime;
    }

    return { audioData: data.audioContent, speechMarks: wordTimings };
}

export async function googleSpeechWithSpeechMarks(text, ssmlGender, name, languageCode, speakingRate, serviceKey) {
    return handle({ text, serviceOptions: { gender: ssmlGender, speaker_id: name, languageCode, voiceSpeedSetting: speakingRate }, userApiKey: serviceKey });
}
