<p align="center">
<img src="./images/logo.png" width="96" alt="Description">
</p>

<div align="center">
  <h1>VoiceRankings Reader (<code>vr-reader</code>) </h1>
</div>

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](manifest.json)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-4fc08d.svg)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646cff.svg)](https://vitejs.dev/)

Welcome to **VoiceRankings Reader** — an open-source Chrome extension providing seamless, high-quality text-to-speech (TTS), web page reading, content filtering, and bring your own keys(BYOK) right in your browser.


Designed to integrate seamlessly with [VoiceRankings.com](https://voicerankings.com) voice catelogs while keeping client logic fully open-source and customizable.

<img width="1280" height="800" alt="1280x800-sidepanel-voice-options-preview" src="https://github.com/user-attachments/assets/63e84eb5-178a-4f71-a1c4-2eeb184e8412" />

<p align="center">
<em>VR-Reader supports over 30+ models with over 3000+ voices <a href="docs/SUPPORTED_MODELS.md" rel="nofollow">view full list</a></em>
</p>

https://github.com/user-attachments/assets/a25affa5-26a8-423d-abd2-bd41184b517b


---

## 🌟 Key Features

- 🔊 **Bring Your Own Key (BYOK) TTS Providers**: Connect your own API keys for OpenAI, Deepgram, Azure, Google Chirp, Amazon Polly, Rime AI, Mistral, Stepfun, Grok, Kokoro, DeepInfra,OpenRouter and more!
- 🧹 **Custom Domain Filters**: Clean unwanted words (like citations `[1]` or URLs), skip entire sentences/lines using plain text or Regular Expressions, or keep specific page elements out of playback with CSS selectors.
- 📖 **Smart Web Article Reader**: Automatically extracts article content using Readability and JSON-LD, providing instant text-to-speech with precision word highlighting.
- ⚡ **Floating Reader Widget & Side Panel**: Minimalist overlay controls with keyboard shortcuts and auto-scroll highlighting.

---

## 📚 Documentation (`/docs/`)

Explore our detailed documentation guides:
- 🔊 [**Supported Models & Providers**](docs/SUPPORTED_MODELS.md) — Every supported TTS model: single-provider API keys vs. one-key-many-models aggregators (OpenRouter, DeepInfra).
- 🧹 [**Domain Filters Guide**](docs/DOMAIN_FILTERS.md) — Comprehensive guide on word-level vs sentence-level filtering, CSS selector element removal, Regex patterns, and domain scope matching.

- 🧘 [**Relaxed Mode Customization**](docs/RELAXED_MODE_CUSTOMIZATION.md) — How to add site-specific cleanup selectors for the non-strict / relaxed page extractor.
- 🏷️ [**Trademark & Brand Policy**](TRADEMARK.md) — Brand usage rules, trademark notices, and GPLv3 Section 7(c) requirements for forks.
- 🏗️ [**Architecture & Messaging**](ARCHITECTURE.md) — Technical overview of Chrome Manifest V3 service workers, offscreen audio, and content script ports.
- 🤝 [**Contributing Guidelines**](CONTRIBUTING.md) — Guidelines for submitting PRs, adding TTS providers, and state management.

---

## 🔊 TTS Provider Plugin Architecture

The extension features a provider system located in `js/tts-providers/`. Each provider implements a simple modular interface:

```
js/tts-providers/
├── index.js           # Barrel file & provider registry
├── _shared.js         # Shared helpers (getApiKey, speech mark parsers, etc.)
├── openai.js          # Provider implementations
├── deepgram.js
├── azure.js
├── google-chirp.js
└── ... (20+ providers)
```

### Adding a Custom TTS Provider

1. Create `js/tts-providers/my-provider.js`:

```javascript
import { getApiKey, getErrorDetails, arrayBufferToBase64 } from './_shared.js';

export const providerInfo = {
  serviceNames: ['MyProvider'],
  url: 'https://api.myprovider.com/v1/tts',
  handle
};

async function handle({ text, serviceOptions, userApiKey }) {
  const apiKey = await getApiKey('MY_PROVIDER_KEY', userApiKey);
  
  const response = await fetch(providerInfo.url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: serviceOptions.speaker_id })
  });

  if (!response.ok) {
    const errorBody = await getErrorDetails(response);
    throw new Error(`MyProvider API Error: ${response.status}`);
  }

  const audioBuffer = await response.arrayBuffer();
  return { audioData: arrayBufferToBase64(audioBuffer), speechMarks: null };
}
```

2. Register your provider in `js/tts-providers/index.js`.

---

## 🛠️ Getting Started for Developers

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm** or **yarn**

### Local Setup & Build

1. **Clone the repository:**
   ```bash
   git clone https://github.com/voicerankings/vr-reader.git
   cd vr-reader
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the extension:**
   ```bash
   # Development build with HMR
   npm run dev

   # Production bundle
   npm run build
   ```

4. **Load into Chrome:**
   - Go to `chrome://extensions/`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked** and select the `dist/` directory.

---

## 🔒 Privacy & Credentials Security

- All **BYOK API keys** are stored locally in `chrome.storage.local`.
- Credentials are **never** sent to VoiceRankings servers.
- Anonymous telemetry can be toggled on/off under **Settings > General**.

---

## 🏷️ Trademarks & Branding Protection

**VoiceRankings Reader™**, **VR Reader™**, and **VRR™** (along with logos, branding, and promotional imagery) are trademarks owned by **VoiceRankings**.

While the codebase is licensed under the **GNU GPLv3**, the open-source license **does not grant permission** to use our brand names, trademarks, or official logos in forks or redistributions. Pursuant to **Section 7(c) of the GNU GPLv3**, any modified fork or redistribution published to Chrome Web Store or third-party marketplaces **must be completely rebranded** (changing app name, logo, and removing official brand references).

For full brand usage guidelines, see [`TRADEMARK.md`](TRADEMARK.md).

---

## 📄 License

Distributed under the **GNU General Public License v3.0 (GPL-3.0)**. See [`LICENSE`](LICENSE) for more information.
