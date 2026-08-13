/**
 * ============================================================================
 * Background Service Worker Entry Point
 * ============================================================================
 * This script serves as the central hub for the extension, running persistently 
 * (or waking up as needed) in the background. It orchestrates communication 
 * between content scripts, the offscreen document (for audio playback), the 
 * side panel, and external APIs.
 * 
 * Key Responsibilities:
 * - Initializes extension state and storage on installation/update.
 * - Manages long-lived connections (ports) to tabs and the side panel.
 * - Handles context menu creation and clicks.
 * - Intercepts browser commands (keyboard shortcuts).
 * - Routes all messages (\`chrome.runtime.onMessage\`) using a centralized 
 *   MESSAGE_HANDLERS map for clean event-driven architecture.
 */
import {
  API_NUXT_DOMAIN,
  APP_WEB_DOMAIN,
  runServericeToStorageMap,
  setServiceToStorageKeyMap,
  DEFAULT_KEYS,
  HARDCODED_DEFAULTS
} from './js/background/config.js';
import {
  sendAudioDataToOffscreenDocument,
  stopPlayingAudioOffscreenDocument
} from './js/background/offscreen.js';
import { createContextMenus, openReadLaterArticle, handleContextMenuClick } from './js/background/context-menus.js';
import { VRR_Requests } from './js/background/api-client.js';
import { getUserToken, resetUserToken } from './js/background/auth.js';
import { contentScriptPorts, sendToAllContentScriptPorts } from './js/background/ports.js';
import {
  sidePanelPort,
  setDefaultSidePanelKey,
  setDefaultSidePanelValue,
  setDefaultSidePanelData,
  setDefaultSidePanelTabId,
  setSidePanelPort,
  resetSidePanelDefaults,
  deleteActiveTabUsingSidePanel,
  routeToSidePanel,
  activeTabsUsingSidePanelSuggestions
} from './js/background/sidepanel.js';
import { initDebugConsole } from './js/utils/debug.js';

initDebugConsole();

runServericeToStorageMap()

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    let url = `https://${APP_WEB_DOMAIN}/extension/tour`;
    chrome.tabs.create({ url });

    const storedItems = await chrome.storage.local.get(DEFAULT_KEYS);

    if (Object.keys(storedItems).length === DEFAULT_KEYS.length && DEFAULT_KEYS.every(key => storedItems[key] !== undefined)) {
      console.log('Defaults already exist in storage. Skipping initialization.');
      return;
    }

    try {
      const rawResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/settings/voice-default`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
      });

      if (!rawResponse.ok) {
        throw new Error(`HTTP error! status: ${rawResponse.status}`);
      }

      const responseData = await rawResponse.json();

      if (responseData.status === 'success' && responseData.defaults) {
        await chrome.storage.local.set(responseData.defaults);
        console.log('Saved defaults from server.');
      } else {
        throw new Error('Invalid response from server.');
      }
    } catch (error) {
      console.error('Error fetching defaults from server:', error);
      await chrome.storage.local.set(HARDCODED_DEFAULTS);
      console.log('Saved hardcoded defaults due to server error.');
    }
  } else if (details.reason === "update") {
  }

  if (chrome.runtime.setUninstallURL) {
    chrome.runtime.setUninstallURL(`https://${API_NUXT_DOMAIN}/extension/uninstalled`);
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "playback-pause-play")
    sendAction({ action: "playback-pause-play", shortcutCommand: true });
  else if (command === "playback-next-line")
    sendAction({ action: "playback-next-line", shortcutCommand: true });
  else if (command === "playback-previous-line")
    sendAction({ action: "playback-previous-line", shortcutCommand: true });
  else if (command === "auto-start-reader") {
    sendAction({ action: "auto-start-reader", shortcutCommand: true });
  }
});

async function sendAction(message, tabId) {
  let sendToTabId;
  if (tabId) {
    sendToTabId = tabId;
  } else {
    const selectedTab = await getSelectedTab();
    if (!selectedTab) {
      console.warn('sendAction: no active tab available for', message.action);
      return false;
    }
    sendToTabId = selectedTab.id;
  }
  if (!sendToTabId) {
    console.warn('sendAction: no valid tab id for', message.action);
    return false;
  }
  await chrome.tabs.sendMessage(sendToTabId, message);
  return true;
}

let activeReadLaterCache = {};

// Tracks the tab that currently owns offscreen audio playback. When a tab is
// closed we only stop audio if THAT tab is the one playing, so closing other
// unrelated tabs never interrupts playback in the current tab.
let activeAudioTabId = null;

function trackActiveAudioTab(request, sender) {
  const playingTabId = (request && request.data && request.data.tabId) ||
    (request && request.tabId) ||
    (sender && sender.tab && sender.tab.id);
  if (playingTabId) {
    activeAudioTabId = playingTabId;
  }
}

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  if (tabId === activeAudioTabId) {
    activeAudioTabId = null;
    stopPlayingAudioOffscreenDocument();
  }
  if (activeReadLaterCache[tabId]) {
    const payload = activeReadLaterCache[tabId];
    delete activeReadLaterCache[tabId];
    try {
      console.log('💾 Tab closed - saving cached Read Later progress for tab:', tabId);
      await VRR_Requests.saveReadLater(payload);
    } catch (e) {
      console.error('Failed to save Read Later on tab removal:', e);
    }
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    delete activeTabsUsingSidePanelSuggestions[tab.id];
    if (sidePanelPort) {
      try {
        console.log("updated - changed route main-main")
        sidePanelPort.postMessage({
          key: "suggestion",
          value: false,
        });
      } catch (e) { }
    }
  }
});

let lastActiveTabId, currentActiveTabId;

chrome.tabs.onActivated.addListener(function (activeInfo) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var activeTab = tabs[0];
    console.log("New active tab:", activeTab);
    console.log(activeTabsUsingSidePanelSuggestions, activeTab.id);

    lastActiveTabId = currentActiveTabId;
    currentActiveTabId = activeTab.id;

    if (activeTabsUsingSidePanelSuggestions[activeTab.id]) {
      console.log("onActivated - changed route suggestions")
      if (contentScriptPorts[activeTab.id].postMessage({
        action: 'reopen-sidepanel-suggestions'
      }));
    } else {
      console.log("onActivated - changed route main-main")
    }
  });
});

chrome.tabs.onCreated.addListener((tab) => {
  createContextMenus();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    createContextMenus();
  }
});

chrome.contextMenus.onClicked.addListener(async function (info, tab) {
  await handleContextMenuClick(info, tab);
});

async function getCurrentTab() {
  let queryOptions = { active: true, currentWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

async function getSelectedTab() {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, windowType: "normal", currentWindow: true }, (tabs) => {
      resolve(tabs[0]);
    });
  });
}

let popupWindow = null;
let tabIdToUrl = {};
let pendingReadLaterTabs = {};

chrome.runtime.onConnect.addListener(port => {
  if (port.name === "sidepanel-opened-port") {
    port.postMessage({
      key: 'API_NUXT_DOMAIN',
      value: API_NUXT_DOMAIN
    });
    port.postMessage({
      key: setDefaultSidePanelKey,
      value: setDefaultSidePanelValue,
      data: setDefaultSidePanelData,
      tab_id: setDefaultSidePanelTabId
    });

    resetSidePanelDefaults();
    setSidePanelPort(port);
  } else if (port.name === "contentscript-port-iframe") {
    console.log(port, port.sender)
    let tabId = port.sender.tab.id;
    console.log("saving contentscript iframe port", tabId)
    contentScriptPorts[tabId + '-' + port.sender.url.replace(/\/$/, '')] = port;
  } else if (port.name === "contentscript-port") {
    let tabId = port.sender.tab.id;
    console.log("saving contentscript tab port", tabId)
    contentScriptPorts[tabId] = port;
  } else {
    let tabId = port.sender.tab.id;
    contentScriptPorts[tabId + "-"] = port;
  }

  port.onDisconnect.addListener(function () {
    let tabId = port.sender.tab.id;

    if (sidePanelPort) {
      deleteActiveTabUsingSidePanel(tabId);

      if (popupWindow && popupWindow.tabs[0] && popupWindow.tabs[0].id === tabId)
        sidePanelPort.postMessage({
          key: "login-fail",
        });
    }
  });
  port.onMessage.addListener(async message => {
  })
});

async function sendActionWithFallback(action, data, callbackID, tabId, sender) {
  let delivered = false;
  try {
    delivered = await sendAction({ action, data, callbackID }, tabId);
  } catch (e) {
    console.log(e, 'backup send to contentscript port');
  }
  const portTabId = tabId || (sender && sender.tab && sender.tab.id);
  if (!delivered && portTabId && contentScriptPorts[portTabId]) {
    try {
      contentScriptPorts[portTabId].postMessage({ action, data, callbackID });
    } catch (e) {
      console.warn(e, 'port send failed for tabId', portTabId);
    }
  }
}

const resolveTabId = (request, sender) => request.tabId || (sender && sender.tab && sender.tab.id);

const MESSAGE_HANDLERS = {
  // === API HANDLERS ===
  'uploadAudioAndSaveRating': async (request, sender) => {
    let data = await VRR_Requests.uploadAudioAndSaveRating(request.payload);
    await sendActionWithFallback('VRR_Requests', data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'mergeAudioClips': async (request, sender) => {
    let data = await VRR_Requests.mergeAudioClips(request.payload);
    await sendActionWithFallback('VRR_Requests', data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'getVoiceRatingsList': async (request, sender) => {
    let data = await VRR_Requests.getVoiceRatingsList(request.payload);
    await sendActionWithFallback('VRR_Requests', data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'getVoiceRatingsSummary': async (request, sender) => {
    let data = await VRR_Requests.getVoiceRatingsSummary(request.payload);
    await sendActionWithFallback('VRR_Requests', data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'getVoiceRankings': async (request, sender) => {
    let data = await VRR_Requests.getVoiceRankings(request.payload);
    await sendActionWithFallback('VRR_Requests', data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'saveVoiceRating': async (request, sender) => {
    let data = await VRR_Requests.saveVoiceRating(request.payload);
    await sendActionWithFallback('VRR_Requests', data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'recordReviewNudgeEvent': async (request, sender) => {
    let data = await VRR_Requests.writeReviewNudgeEvent(request.payload);
    await sendActionWithFallback('VRR_Requests', data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'updateReadLaterCache': (request, sender) => {
    if (sender && sender.tab && sender.tab.id) {
      activeReadLaterCache[sender.tab.id] = request.payload;
    }
  },
  'saveReadLater': async (request, sender) => {
    let data = await VRR_Requests.saveReadLater(request.payload);
    await sendActionWithFallback('VRR_Requests', data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'getReadLater': async (request, sender) => {
    let data = await VRR_Requests.getReadLater();
    await sendActionWithFallback('VRR_Requests', data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'markReadLater': async (request, sender) => {
    let data = await VRR_Requests.markReadLater(request.payload);
    await sendActionWithFallback('VRR_Requests', data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'getVoiceFavorites': async (request, sender) => {
    let data = await VRR_Requests.getVoiceFavorites();
    await sendActionWithFallback('VRR_Requests', data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'getVoiceSearch': async (request, sender) => {
    let data = await VRR_Requests.getVoiceSearch(request.payload);
    await sendActionWithFallback('VRR_Requests', data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'getVoiceCollections': async (request, sender) => {
    let data = await VRR_Requests.getVoiceCollections();
    await sendActionWithFallback('VRR_Requests', data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'getVoiceList': async (request, sender) => {
    let data = await VRR_Requests.getVoiceList(request.payload);
    await sendActionWithFallback('VRR_Requests', data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'recordPlayEvent': async (request, sender) => {
    await VRR_Requests.recordPlayEvent(request.payload);
  },
  'saveVoiceDefaultOnServer': async (request, sender) => {
    await VRR_Requests.saveVoiceDefaultOnServer(request.payload);
  },
  'getAudioDataFromExternalTTS': async (request, sender) => {
    let data = await VRR_Requests.getAudioDataFromExternalTTS(request.payload);
    if (request.callbackID && request.callbackID.startsWith('sidepanel_premium_tts') && sidePanelPort) {
      sidePanelPort.postMessage({ key: 'load-audio', data, callbackID: request.callbackID });
    } else {
      await sendActionWithFallback('VRR_Requests', data, request.callbackID, resolveTabId(request, sender), sender);
    }
  },
  'saveChat': async (request, sender) => {
    let data = await VRR_Requests.saveChat(request.payload);
    await sendActionWithFallback('VRR_Requests', data, request.callbackID, null, sender);
    if (request.callbackID && request.callbackID.startsWith('save_chat') && sidePanelPort) {
      sidePanelPort.postMessage({ key: 'saveChat' });
    }
  },
  'getDomainFilters': async (request, sender) => {
    try {
      let data = await VRR_Requests.getDomainFilters(request.payload);
      await sendActionWithFallback('VRR_Requests', data, request.callbackID, null, sender);
    } catch (e) {
      console.warn("Failed to fetch remote domain filters:", e);
      await sendActionWithFallback('VRR_Requests', { domain_filters: [], css_selectors: [] }, request.callbackID, null, sender);
    }
  },
  'getUserAndAutoSettings': async (request, sender) => {
    let data = await VRR_Requests.getUserAndAutoSettings(request.payload);
    await sendActionWithFallback('VRR_Requests', data, request.callbackID, null, sender);
  },
  'action': async (request, sender) => {
    await VRR_Requests.action(request.payload);
  },

  // === UI & WINDOW HANDLERS ===
  'checkPendingReadLater': async (request, sender) => {
    if (sender && sender.tab && pendingReadLaterTabs[sender.tab.id]) {
      const bookmark = pendingReadLaterTabs[sender.tab.id];
      delete pendingReadLaterTabs[sender.tab.id];
      chrome.tabs.sendMessage(sender.tab.id, { action: 'resumeReadLater', bookmark });
    }
  },
  'openReadLaterArticle': async (request, sender) => {
    chrome.tabs.create({ url: request.payload.text_fragment_url }, (tab) => {
      pendingReadLaterTabs[tab.id] = request.payload;
    });
  },
  'open-sidepanel-error-logs': (request, sender) => { routeToSidePanel(request, sender, true); },
  'open-sidepanel': (request, sender) => { routeToSidePanel(request, sender, false); },
  'navigateTo': (request, sender) => { chrome.tabs.create({ url: request.url }); },
  'open-byok-guide': (request, sender) => { chrome.tabs.create({ url: `https://${API_NUXT_DOMAIN}/reader/${request.serviceName}#get-api-key` }); },
  'sameTabNavigateTo': (request, sender) => { chrome.tabs.update({ active: true, url: request.url }); },
  'createWindow': (request, sender) => {
    chrome.windows.create({ width: 696, height: 700, url: request.url }, (window) => { popupWindow = window; });
  },
  'closeWindow': (request, sender) => {
    chrome.windows.remove(popupWindow.id);
    popupWindow = null;
  },
  'getCurrentTabId': async (request, sender) => {
    const requestingTabId = sender && sender.tab && sender.tab.id;
    if (requestingTabId) {
      try {
        await chrome.tabs.sendMessage(requestingTabId, { action: 'getCurrentTabId', data: { tabId: requestingTabId }, callbackID: request.callbackID });
      } catch (e) {
        if (contentScriptPorts[requestingTabId]) {
          contentScriptPorts[requestingTabId].postMessage({ action: 'getCurrentTabId', data: { tabId: requestingTabId }, callbackID: request.callbackID });
        }
      }
      tabIdToUrl[requestingTabId] = request.url;
      createContextMenus({ url: request.url });
    }
  },

  // === STATE HANDLERS ===
  'update-contentscript-user-logged-in': (request, sender) => { sendToAllContentScriptPorts(request); },
  'UPDATE_CONTEXT_MENU_VOICES': (request, sender) => { createContextMenus(); },
  'update-contentscript-storage': (request, sender) => {
    if (request.key === 'DEFAULT_PREMIUM_VOICE_SPEAKER_ID' || request.key === 'DEFAULT_PREMIUM_VOICE_SPEED' || request.key === 'CONTEXT_MENU_SHOW_RECENT_VOICES') {
      createContextMenus();
    }
    sendToAllContentScriptPorts(request);
  },
  'update-background-storage': async (request, sender) => {
    await chrome.storage.local.set({ [request.key]: request.value });
    if (request.key === 'SERVICE_TO_STORAGE_KEY_MAP') {
      setServiceToStorageKeyMap(request.value);
    }
  },
  'save-user-settings-to-server': async (request, sender) => {
    await VRR_Requests.saveUserSettings();
    sendToAllContentScriptPorts(request);
  },
  'update-auto-save-and-play': (request, sender) => { sendToAllContentScriptPorts(request); },
  'resetTokenAction': (request, sender) => {
    resetUserToken();
  },
  'getShortcutCommands': (request, sender) => {
    chrome.commands.getAll(async (commands) => {
      await sendActionWithFallback('VRR_Requests', commands, request.callbackID, resolveTabId(request, sender), sender);
    });
  },

  // === AUDIO HANDLERS ===
  'play-audio': async (request, sender) => {
    trackActiveAudioTab(request, sender);
    await sendAudioDataToOffscreenDocument(request.action, request.data);
  },
  'pause-audio': async (request, sender) => { await sendAudioDataToOffscreenDocument(request.action, request.data); },
  'load-audio-metadata': async (request, sender) => { await sendAudioDataToOffscreenDocument(request.action, request.data); },
  'resume-audio': async (request, sender) => {
    trackActiveAudioTab(request, sender);
    await sendAudioDataToOffscreenDocument(request.action, request.data);
  },
  'stop-audio': async (request, sender) => {
    activeAudioTabId = null;
    await stopPlayingAudioOffscreenDocument();
  },
  'check-audio-playing': async (request, sender) => { await sendAudioDataToOffscreenDocument(request.action, request.data); },
  'tab-visibility-change': (request, sender) => {
    chrome.runtime.sendMessage({ action: 'update-interval-speed', target: 'offscreen', isFocused: request.isFocused });
  },
  'check-audio-playing-eventhandler': async (request, sender) => {
    await sendActionWithFallback('VRR_Requests', request.data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'play-audio-error-eventhandler': async (request, sender) => {
    await sendActionWithFallback('VRR_Requests', request.data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'loadedmetadata-audio-eventhandler': async (request, sender) => {
    await sendActionWithFallback('VRR_Requests', request.data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'pause-audio-eventhandler': async (request, sender) => {
    await sendActionWithFallback('VRR_Requests', request.data, request.callbackID, resolveTabId(request, sender), sender);
  },
  'play-audio-eventhandler': async (request, sender) => {
    if (request.callbackID && request.callbackID.startsWith('sidepanel_premium_tts') && sidePanelPort) {
      sidePanelPort.postMessage({ key: 'play-audio', data: request.data, callbackID: request.callbackID });
    } else {
      await sendActionWithFallback('VRR_Requests', request.data, request.callbackID, resolveTabId(request, sender), sender);
    }
  },
  'play-audio-eventhandler2': async (request, sender) => {
    if (request.callbackID && request.callbackID.startsWith('sidepanel_premium_tts') && sidePanelPort) {
      sidePanelPort.postMessage({ key: 'stop-audio', data: request.data, callbackID: request.callbackID });
    } else {
      await sendActionWithFallback('VRR_Requests', request.data, request.callbackID, resolveTabId(request, sender), sender);
    }
  },
  'timeupdate-audio-eventhandler': async (request, sender) => {
    await sendActionWithFallback('VRR_Requests', request.data, request.callbackID, resolveTabId(request, sender), sender);
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  sendResponse(true);
  if (request.action && MESSAGE_HANDLERS[request.action]) {
    MESSAGE_HANDLERS[request.action](request, sender);
  }
  return true;
});


