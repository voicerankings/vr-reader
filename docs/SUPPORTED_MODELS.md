# 🔊 Supported TTS Models & Providers

This guide lists every text-to-speech (TTS) model and provider supported by **VoiceRankings Reader**, and how each one obtains its API key.

- 🧩 **Single Provider Key** — sign up directly with the provider and use its own API key.
- 🎟️ **One Key, Multiple Providers (Aggregator)** — a single API key unlocks models from many different vendors at once.

Voice previews and the full, day-to-day list of available voices are served from the [VoiceRankings](https://voicerankings.com) voice catalog.

---

## 🧩 Single Provider Key

Sign up for an account with the provider and paste the API key it gives you into **Settings**. The key is stored locally in `chrome.storage.local` — it is **never** sent to VoiceRankings servers.

| Provider | Settings Key | Models | Voice List
| :--- | :--- | :--- | :--- |
| **Deepgram** | `DEEPGRAM_API_KEY` | Deepgram **Aura 1** voices (`aura-1-*`) | [voice list](https://voicerankings.com/filters?service=Deepgram) |
| **Deepgram Aura 2** | `DEEPGRAM_A2_API_KEY` | Deepgram **Aura 2** voices (`aura-2-*`) | [voice list](https://voicerankings.com/filters?service=Deepgram-A2) |
| **Grok TTS** | `GROK_API_KEY` | `grok-tts`, `x-ai/grok-voice-tts-1.0` | [voice list](https://voicerankings.com/filters?service=grok-tts) |
| **OpenAI** | `OPENAI_API_KEY` | `tts-1`, `tts-1-hd` | [voice list](https://voicerankings.com/filters?service=OpenAI) |
| **GPT-4o-mini-tts** | `GPT_4O_MINI_TTS_API_KEY` | `gpt-4o-mini-tts` | [voice list](https://voicerankings.com/filters?service=GPT-4o-mini-tts) |
| **Google Cloud TTS** | `GOOGLE_API_KEY` | Standard / WaveNet / Neural2 voices | [voice list](https://voicerankings.com/filters?service=Google) |
| **Google Chirp 3 HD** | `GOOGLE_CHIRP3_HD_API_KEY` | Chirp 3 HD voices | [voice list](https://voicerankings.com/filters?service=Google-Chirp-3-HD) |
| **Gemini 3.1 Flash TTS / vd** | `GEMINI_3_1_FLASH_TTS_API_KEY` | `gemini-3.1-flash-tts-preview` | [voice list](https://voicerankings.com/filters?service=gemini-3-1-flash-tts) |
| **Gemini 2.5 Flash TTS / vd** | `GEMINI_2_5_FLASH_TTS_API_KEY` | `gemini-2.5-flash-preview-tts` | [voice list](https://voicerankings.com/filters?service=gemini-2-5-flash-tts) |
| **Azure** | `AZURE_API_KEY` | Azure neural voices | [voice list](https://voicerankings.com/filters?service=Azure) |
| **Azure MAI Voice 1** | `MAI_VOICE_1_AZURE_API_KEY` | Microsoft MAI voices (e.g. `en-US-Jasper`) | [voice list](https://voicerankings.com/filters?service=MAI-Voice-1) |
| **Azure MAI Voice 2** | `MAI_VOICE_2_AZURE_API_KEY` | Microsoft MAI voices (e.g. `en-US-Jasper`) | [voice list](https://voicerankings.com/filters?service=MAI-Voice-2) |
| **Amazon Polly (AWS)** | `AWS_API_KEY` | AWS access key **+ secret key** (region, engine configurable), neural voices | [voice list](https://voicerankings.com/filters?service=AWS) |
| **Mistral Voxtral** | `MISTRAL_API_KEY` | `voxtral-mini-tts-2603` | [voice list](https://voicerankings.com/filters?service=voxtral-tts) |
| **Qwen 3** | `QWEN_API_KEY` | `qwen3-tts-flash-2025-11-27` | [voice list](https://voicerankings.com/filters?service=qwen3-tts-flash) |
| **MiMo V2.5** | `MIMO_API_KEY` | `mimo-v2.5-tts` (Xiaomi) | [voice list](https://voicerankings.com/filters?service=MiMo-V2-5-TTS) |
| **StepFun TTS-2** | `STEPFUN_API_KEY` | `step-tts-2` | [voice list](https://voicerankings.com/filters?service=StepFun-TTS-2) |
| **Rime** | `RIME_API_KEY` | Mist, MistV2, Arcana, Coda | [voice list](https://voicerankings.com/filters?service=Rime-Mist) |
| **Speechify** | `SPEECHIFY_API_KEY` | `simba-3.0`, `simba-english`, `simba-multilingual` | [voice list](https://voicerankings.com/filters?service=Speechify) |
| **Murf AI** | `MURFAI_API_KEY` | GEN2, FALCON (streaming) | [voice list](https://voicerankings.com/filters?service=MurfAI) |
| **Inworld** | `INWORLD_API_KEY` | `inworld-tts-1.5-mini`, `inworld-tts-1.5-max`, `inworld-tts-2` | [voice list](https://voicerankings.com/filters?service=Inworld) |
| **AsyncAI** | `ASYNCAI_API_KEY` | `async_flash_v1.0`,`async_flash_v1.5`, `async_pro_v1.0` | [voice list](https://voicerankings.com/filters?service=AsyncAI) |
| **Resemble AI** | `RESEMBLEAI_API_KEY` | Your custom cloned voice UUIDs | [voice list](https://voicerankings.com/filters?service=ResembleAI) |

> 💡 Deepgram models are selected by voice ID: voices matching `aura-1-*` use the Aura 1 key, voices matching `aura-2-*` use the Aura 2 key.

---

## 🎟️ One Key, Multiple Providers (Aggregator)

Sign up for **one** account with an aggregator and use that single API key to access models from many different vendors — no per-provider accounts needed.

### OpenRouter

One **OpenRouter** API key (`https://openrouter.ai`) provides access to all of the following TTS models out of the box:

| Model ID | Underlying Model |
| :--- | :--- |
| `deepgram/aura-2` | Deepgram Aura 2 |
| `google/gemini-3.1-flash-tts-preview` | Google Gemini 3.1 Flash TTS |
| `x-ai/grok-voice-tts-1.0` | Grok TTS |
| `microsoft/mai-voice-2` | Microsoft MAI Voice 2 |
| `mistralai/voxtral-mini-tts-2603` | Mistral Voxtral |
| `canopylabs/orpheus-3b-0.1-ft` | Canopy Labs Orpheus |
| `hexgrad/kokoro-82m` | Kokoro |

> 🔧 **Any OpenRouter model can be used.** Enter the key in Settings as `openrouter.com/<model-id>` and the extension routes all matching providers through that model (e.g. `openrouter.com/deepgram/aura-2`, `openrouter.com/google/gemini-3.1-flash-tts-preview`).

OpenRouter also powers optional word-level **speech timing** (STT) for playback highlighting, including `openai/gpt-transcribe`, `openai/gpt-4o-transcribe`, `openai/gpt-4o-mini-transcribe`, `openai/whisper-1`, `openai/whisper-large-v3`, `openai/whisper-large-v3-turbo`, `x-ai/grok-stt-1.0`, `mistralai/voxtral-mini-transcribe`, and `qwen/qwen3-asr-flash-2026-02-10`.

### DeepInfra.com

One **DeepInfra** API key (`https://deepinfra.com`) provides access to the following TTS models:

| Model ID | Underlying Model |
| :--- | :--- |
| `hexgrad/Kokoro-82M` | Kokoro |
| `canopylabs/orpheus-3b-0.1-ft` | Canopy Labs Orpheus |
| `mimo-v2.5-tts` | Xiaomi MiMo V2.5 |

> 💡 Only the models above are supported on DeepInfra — the extension calls each hardcoded inference endpoint directly.

---

## 🔑 Getting Keys & Where to Enter Them

1. Create an account on the provider's site and generate an API key.
   - Direct providers: sign up on each provider's dashboard (OpenAI, Deepgram, Azure, Google Cloud, Grok/xAI, Mistral, Qwen, StepFun, Rime, Speechify, Murf, Inworld, AsyncAI, Resemble, Xiaomi, Amazon).
   - Aggregators: **one** key from `openrouter.ai` or `deepinfra.com` covers many models.
2. Open **Settings > Bring Your Own Key** in the VoiceRankings Reader side panel and paste the key next to the matching provider.
3. Keys are **stored locally** (`chrome.storage.local`) and are **never** sent to VoiceRankings servers. Anonymous telemetry can be toggled off under **Settings > General**.
4. Pick a voice from the catalog, enter the aggregator key format above if you prefer aggregator routing, and start reading.