/**
 * ============================================================================
 * Background Context Menus Module
 * ============================================================================
 * Dynamically builds and updates the browser's right-click context menus based 
 * on the user's recent and pinned voices. Handles routing for context menu 
 * clicks (e.g., triggering "Read with..." on highlighted text).
 */
import { SERVICE_TO_STORAGE_KEY_MAP, readLocalStorage } from './config.js';
import { makeActiveVoice } from './voice.js';

async function createContextMenus() {
  await chrome.contextMenus.removeAll();

  const storageApiKeys = Object.values(SERVICE_TO_STORAGE_KEY_MAP);
  const keysToGet = [
    'CONTEXT_MENU_VOICES',
    'CONTEXT_MENU_SHOW_RECENT_VOICES',
    'voiceRecentSearches',
    'DEFAULT_PREMIUM_VOICE_ID',
    'DEFAULT_PREMIUM_VOICE_NAME',
    'DEFAULT_PREMIUM_VOICE_GENDER',
    'DEFAULT_PREMIUM_VOICE_INSTRUCTIONS',
    'DEFAULT_PREMIUM_VOICE_LANGUAGE_CODE',
    'DEFAULT_PREMIUM_VOICE_SPEAKER_ID',
    'DEFAULT_PREMIUM_VOICE_WORDS_PER_MINUTE',
    'DEFAULT_PREMIUM_VOICE_SERVICE',
    'DEFAULT_PREMIUM_VOICE_SERVICE_ALIAS',
    'DEFAULT_PREMIUM_VOICE_SPEED',
    'DEFAULT_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT',
    'DEFAULT_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT',
    ...storageApiKeys
  ];

  const storage = await readLocalStorage(keysToGet);

  const hasStoredKey = (serviceName) => {
    const storageKey = SERVICE_TO_STORAGE_KEY_MAP[serviceName];
    if (!storageKey) return false;
    return storage[storageKey] && String(storage[storageKey]).trim() !== '';
  };

  const generateTitle = (voice) => {
    const keyEmoji = hasStoredKey(voice.voice_service) ? '🔑 ' : '';
    const speedIndicator = voice.voice_speed && voice.voice_speed != 1 ? ` [${voice.voice_speed}x]` : '';
    return `${keyEmoji}${voice.voice_name} (${voice.voice_service})${speedIndicator}`;
  };

  const contextVoices = Array.isArray(storage.CONTEXT_MENU_VOICES) ? storage.CONTEXT_MENU_VOICES : [];
  const showRecentVoices = storage.CONTEXT_MENU_SHOW_RECENT_VOICES === true;
  const recentVoices = Array.isArray(storage.voiceRecentSearches) ? storage.voiceRecentSearches : [];
  const defaultVoiceId = storage.DEFAULT_PREMIUM_VOICE_ID;

  const defaultVoiceObject = {
    voice_id: storage.DEFAULT_PREMIUM_VOICE_ID,
    voice_name: storage.DEFAULT_PREMIUM_VOICE_NAME,
    voice_service: storage.DEFAULT_PREMIUM_VOICE_SERVICE,
    voice_speed: storage.DEFAULT_PREMIUM_VOICE_SPEED,
    voice_gender: storage.DEFAULT_PREMIUM_VOICE_GENDER,
    voice_instructions: storage.DEFAULT_PREMIUM_VOICE_INSTRUCTIONS,
    voice_language_code: storage.DEFAULT_PREMIUM_VOICE_LANGUAGE_CODE,
    voice_speaker_id: storage.DEFAULT_PREMIUM_VOICE_SPEAKER_ID,
    voice_words_per_minute: storage.DEFAULT_PREMIUM_VOICE_WORDS_PER_MINUTE,
    voice_service_alias: storage.DEFAULT_PREMIUM_VOICE_SERVICE_ALIAS,
    voice_has_voice_speed_support: storage.DEFAULT_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT,
    voice_has_word_timestamp_support: storage.DEFAULT_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT,
  };

  const hasContextVoices = contextVoices.length > 0;
  const hasRecentVoices = showRecentVoices && recentVoices.length > 0;
  const shouldShowSubmenus = hasContextVoices || hasRecentVoices;
  const defaultMenuItemId = `select_voice--${JSON.stringify(defaultVoiceObject)}`;

  if (!shouldShowSubmenus) {
    chrome.contextMenus.create({
      id: defaultMenuItemId,
      title: `Read with ${generateTitle(defaultVoiceObject)}`,
      contexts: ["selection", "page"]
    });
    return;
  }

  chrome.contextMenus.create({
    id: "readWithVoiceParent",
    title: "Read with...",
    contexts: ["selection", "page"]
  });

  chrome.contextMenus.create({
    id: defaultMenuItemId,
    parentId: "readWithVoiceParent",
    title: generateTitle(defaultVoiceObject),
    contexts: ["selection", "page"],
  });

  chrome.contextMenus.create({
    parentId: "readWithVoiceParent",
    id: "separator_after_default",
    type: "separator",
    contexts: ["page", "selection"]
  });

  const recentVoicesFiltered = recentVoices.filter(voice => voice.voice_id !== defaultVoiceId);
  if (showRecentVoices && recentVoicesFiltered.length > 0) {
    chrome.contextMenus.create({
      id: "recentVoicesParent",
      parentId: "readWithVoiceParent",
      title: "Recent Voices",
      contexts: ["selection", "page"]
    });

    recentVoicesFiltered.forEach((voice) => {
      const voiceFormatted = {
        voice_id: voice.voice_id,
        voice_name: voice.voice_name,
        voice_service: voice.voice_service,
        voice_speed: voice.voice_speed || 1,
        voice_gender: voice.voice_gender,
        voice_instructions: voice.voice_instructions,
        voice_language_code: voice.voice_language_codes ? voice.voice_language_codes[0] : null,
        voice_speaker_id: voice.voice_speaker_id,
        voice_words_per_minute: voice.voice_words_per_minute,
        voice_service_alias: voice.voice_service_alias,
        voice_has_voice_speed_support: voice.voice_has_voice_speed_support,
        voice_has_word_timestamp_support: voice.voice_has_word_timestamp_support,
      };

      chrome.contextMenus.create({
        id: `select_voice--${JSON.stringify(voiceFormatted)}`,
        parentId: "recentVoicesParent",
        title: generateTitle(voiceFormatted),
        contexts: ["selection", "page"],
      });
    });

    if (hasContextVoices) {
      chrome.contextMenus.create({
        parentId: "readWithVoiceParent",
        id: "separator_after_recent",
        type: "separator",
        contexts: ["page", "selection"]
      });
    }
  }

  const contextVoicesFiltered = contextVoices.filter(voice => voice.voice_id !== defaultVoiceId);
  if (contextVoicesFiltered.length > 0) {
    contextVoicesFiltered.forEach((voice) => {
      chrome.contextMenus.create({
        id: `select_voice--${JSON.stringify(voice)}`,
        parentId: "readWithVoiceParent",
        title: generateTitle(voice),
        contexts: ["selection", "page"],
      });
    });
  }
}

async function openReadLaterArticle(bookmark) {
  const tab = await chrome.tabs.create({ url: bookmark.url, active: true });
  return tab;
}

/**
 * Sends a message to the tab's content script, retrying automatically if the
 * page hasn't finished loading yet (content script not ready).
 * Shows a badge on the extension icon while waiting.
 */
async function sendMessageWithRetry(tabId, message, options, maxRetries = 8) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await chrome.tabs.sendMessage(tabId, message, options);
      // Success — clear any waiting badge
      if (attempt > 0) {
        chrome.action.setBadgeText({ text: '', tabId });
      }
      return true;
    } catch (e) {
      // Content script not ready yet
      if (attempt === maxRetries) {
        console.warn(`[context-menus] Failed to send "${message.action}" after ${maxRetries} retries.`);
        chrome.action.setBadgeText({ text: '', tabId });
        return false;
      }

      // Show "waiting" badge on first failure
      if (attempt === 0) {
        chrome.action.setBadgeBackgroundColor({ color: '#7c3aed', tabId });
        chrome.action.setBadgeText({ text: '⏳', tabId });
      }

      // Wait for tab to finish loading, or fall back to a delay
      await waitForTabReady(tabId, 2000);
    }
  }
  return false;
}

/**
 * Returns a promise that resolves when the tab status becomes 'complete',
 * or after `timeoutMs` — whichever comes first.
 */
function waitForTabReady(tabId, timeoutMs = 2000) {
  return new Promise((resolve) => {
    let resolved = false;

    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete' && !resolved) {
        resolved = true;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        // Small extra delay to let content script initialize after DOM complete
        setTimeout(resolve, 300);
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdated);

    // Also check immediately in case the tab is already complete
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete' && !resolved) {
        resolved = true;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        // Still add a small delay — content script may be initializing
        setTimeout(resolve, 500);
      }
    }).catch(() => {
      // Tab might have been closed
      if (!resolved) {
        resolved = true;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    });

    // Timeout fallback
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    }, timeoutMs);
  });
}

async function handleContextMenuClick(info, tab) {
  let action = null;
  let payload = {};

  if (info.menuItemId.startsWith("select_voice--")) {
    const voiceString = info.menuItemId.substring("select_voice--".length);
    const selectedVoice = JSON.parse(voiceString);

    makeActiveVoice(selectedVoice);

    if (info.selectionText) {
      action = "readHighlightWithVRR";
      payload = { selection: info.selectionText };
    } else {
      action = "vrrPageRead";
    }
  }
  else if (info.menuItemId === "readWithDefault") {
    if (info.selectionText) {
      action = "readHighlightWithVRR";
      payload = { selection: info.selectionText };
    } else {
      action = "vrrPageRead";
    }
  }
  else if (info.menuItemId === "vrrPageRead") {
    action = "vrrPageRead";
  }
  else if (info.menuItemId === "readHighlightWithVRR") {
    action = "readHighlightWithVRR";
    payload = { selection: info.selectionText };
  }

  if (action) {
    const success = await sendMessageWithRetry(
      tab.id,
      { action, ...payload },
      { frameId: info.frameId }
    );
    if (!success) {
      console.warn(`[context-menus] Could not deliver "${action}" to tab ${tab.id} — page may not support content scripts.`);
    }
  }
}

export { createContextMenus, openReadLaterArticle, handleContextMenuClick };
