export const providerInfo = {
    serviceNames: [],
    url: null,
    handle
};

async function handle() {
    throw new Error("Client-side Amazon Polly integration is complex and requires a request signing implementation. A backend proxy is recommended.");
}

export async function amazonSpeechWithSpeechMarks(text, voiceId, speed, serviceKey) {
    return handle();
}
