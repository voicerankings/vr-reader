import { AwsClient } from 'aws4fetch';
import { arrayBufferToBase64, parsePollySpeechMarks } from './_shared.js';

export const providerInfo = {
    serviceNames: ['AWS'],
    url: 'https://polly.*.amazonaws.com/v1/speech',
    handle
};

async function handle({ text, serviceOptions, userApiKey, customOptions = {} }) {
    const voiceId = serviceOptions.speaker_id;
    const speed = serviceOptions.voiceSpeedSetting;
    const accessKeyId = userApiKey;
    const {
        secretAccessKey,
        region = 'us-east-1',
        engine = 'neural',
        enableSpeechMarks = 'No'
    } = customOptions;

    if (!accessKeyId || !secretAccessKey) {
        throw new Error("AWS Access Key ID or Secret Access Key is missing.");
    }

    const shouldFetchMarks = enableSpeechMarks === 'Yes';

    const aws = new AwsClient({
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
        region: region,
        service: 'polly'
    });

    const pollyEndpoint = `https://polly.${region}.amazonaws.com/v1/speech`;

    const speedRate = Math.round(speed * 100);
    const ssmlText = `<speak><prosody rate="${speedRate}%">${text}</prosody></speak>`;

    try {
        const audioParams = {
            Engine: engine,
            OutputFormat: 'mp3',
            Text: ssmlText,
            TextType: 'ssml',
            VoiceId: voiceId
        };

        const audioRequest = aws.fetch(pollyEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(audioParams)
        });

        let audioData, speechMarks = null;

        if (shouldFetchMarks) {
            console.log("AWS Polly: Fetching audio and speech marks.");
            const marksParams = {
                ...audioParams,
                OutputFormat: 'json',
                SpeechMarkTypes: ['word']
            };

            const marksRequest = aws.fetch(pollyEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(marksParams)
            });

            const [audioResponse, marksResponse] = await Promise.all([audioRequest, marksRequest]);

            if (!audioResponse.ok) {
                const errorData = await audioResponse.json();
                const error = new Error(`AWS Polly Audio Error: ${errorData.message || audioResponse.statusText}`);
                error.responseBody = errorData;
                error.statusCode = audioResponse.status;
                error.requestPayload = audioParams;
                throw error;
            }
            if (!marksResponse.ok) {
                const errorData = await marksResponse.json();
                const error = new Error(`AWS Polly SpeechMarks Error: ${errorData.message || marksResponse.statusText}`);
                error.responseBody = errorData;
                error.statusCode = marksResponse.status;
                error.requestPayload = marksParams;
                throw error;
            }

            const audioBuffer = await audioResponse.arrayBuffer();
            audioData = arrayBufferToBase64(audioBuffer);

            const marksText = await marksResponse.text();
            speechMarks = parsePollySpeechMarks(marksText);
        } else {
            console.log("AWS Polly: Fetching audio only.");
            const audioResponse = await audioRequest;
            if (!audioResponse.ok) {
                const errorData = await audioResponse.json();
                const error = new Error(`AWS Polly Audio Error: ${errorData.message || audioResponse.statusText}`);
                error.responseBody = errorData;
                error.statusCode = audioResponse.status;
                error.requestPayload = audioParams;
                throw error;
            }
            const audioBuffer = await audioResponse.arrayBuffer();
            audioData = arrayBufferToBase64(audioBuffer);
        }

        return { audioData, speechMarks };
    } catch (error) {
        console.error("AWS Polly synthesis failed:", error);
        throw error;
    }
}

export async function amazonPollySpeech(text, voiceId, speed, includeAudioTimestamps, accessKeyId, options = {}) {
    return handle({ text, serviceOptions: { speaker_id: voiceId, voiceSpeedSetting: speed, includeAudioTimestamps }, userApiKey: accessKeyId, customOptions: options });
}
