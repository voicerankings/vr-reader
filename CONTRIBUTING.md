# Contributing to VoiceRankings Reader

First off, thank you for considering contributing to the VoiceRankings Reader open-source project! We are building a modular, fast, and accessible reading extension. 

The following guidelines will help you navigate the codebase, understand our state management paradigms, and learn how to add new features or TTS providers smoothly.

## 🛠 Getting Started (Local Development)

1.  **Install Node.js & npm.**
2.  **Clone the repository.**
3.  **Install dependencies:**
    ```bash
    npm install
    ```
4.  **Start the Vite Dev Server:**
    ```bash
    npm run dev
    ```
5.  **Load the Extension in Chrome:**
    *   Open `chrome://extensions/`
    *   Enable **Developer mode**.
    *   Click **Load unpacked**.
    *   Select the `dist/` directory (which Vite generates).
    *   *Note: Thanks to CRXJS, HMR (Hot Module Replacement) is enabled for the content script and side panel. If you modify background scripts, you may need to click the refresh button on the extension card.*

## 🧪 Testing Your Code

We use [Vitest](https://vitest.dev/) for unit testing core algorithmic logic (like the Word Highlighter and Buffer Manager).

*   **Run tests once:** `npm run test`
*   **Run tests in watch mode:** `npx vitest`

> [!IMPORTANT]
> If you touch `js/components/speech/external-voice-player/WordHighlighter.js` or `BufferManager.js`, **you must run the tests** to ensure the precise word-sync and preloading logic remains intact.

## 🧠 State Management Guidelines

Because Chrome extensions run in heavily isolated contexts (Content Script, Background Worker, Offscreen Document), state management can become a spiderweb if not strictly organized. 

Please adhere to the following rules:

### 1. The Background Worker is the Source of Truth
The `ExternalVoicePlayer` (living in the background worker) holds the definitive state for what is playing (`currentPlayingIndex`), what is buffered (`completedDownloads`), and what voice is active. 

### 2. The Content Script Asks, Never Demands
If a user clicks "Pause" in the widget UI (Content Script), the Content Script should **not** manipulate the DOM audio element directly (it can't anyway, because audio plays in the Offscreen document). 
Instead, it sends a message:
```javascript
chrome.runtime.sendMessage({ action: "pauseText" });
```
The Background worker receives this, pauses the audio, and optionally broadcasts a state change back down to the UI.

### 3. WidgetState.js
The UI state (whether the widget is expanded, loading, or showing the tab controller) is managed by `WidgetState.js` inside `js/components/tts-widget/`. Keep this class clean. Do not store audio blobs or complex timestamps here—that belongs in the Background worker.

## 🎤 Adding a New TTS Provider

Adding a new text-to-speech engine is designed to be completely decoupled from the rest of the application. 

1.  Create a new file in `js/tts-providers/` (e.g., `my-awesome-tts.js`).
2.  Export a `providerInfo` object containing the `serviceNames`, `url`, and a `handle` function.
3.  Import and export it inside `js/tts-providers/index.js`.
4.  The system will automatically route audio synthesis requests to your file whenever a user selects that voice service!

For a full breakdown of the `handle` function arguments and return types, see the **TTS Provider System** section in the root `README.md`.

## 📝 Pull Request Process

1.  Create a new branch from `main` (e.g., `feature/new-voice-provider` or `fix/word-sync-bug`).
2.  Add JSDoc comments to any new methods you write. 
3.  Run `npm run test` to ensure existing algorithms are not broken.
4.  Submit your PR! Our maintainers will review it as soon as possible.
