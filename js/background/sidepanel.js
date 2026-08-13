/**
 * ============================================================================
 * Background Sidepanel Module
 * ============================================================================
 * Orchestrates communication between the background worker and the extension's 
 * Side Panel UI. Manages routing to specific tabs in the side panel (e.g., 
 * opening directly to settings or error logs).
 */
export let sidePanelPort = null;
export let setDefaultSidePanelKey = "";
export let setDefaultSidePanelValue = "";
export let setDefaultSidePanelData = null;
export let setDefaultSidePanelTabId = "";
export let activeTabsUsingSidePanelSuggestions = {};

export function setSidePanelPort(port) {
  sidePanelPort = port;
}
export function resetSidePanelDefaults() {
  setDefaultSidePanelKey = "";
  setDefaultSidePanelData = null;
  setDefaultSidePanelValue = "";
  setDefaultSidePanelTabId = "";
}
export function setSidePanelDefaults(key, value, data, tabId) {
  setDefaultSidePanelKey = key;
  setDefaultSidePanelValue = value;
  setDefaultSidePanelData = data;
  setDefaultSidePanelTabId = tabId;
}
export function deleteActiveTabUsingSidePanel(tabId) {
  delete activeTabsUsingSidePanelSuggestions[tabId];
}

export function routeToSidePanel(request, sender, isErrorLogs = false) {
  chrome.windows.getCurrent((currWindow) => {
    const currentWindowId = currWindow.id;
    try {
      if (!isErrorLogs) {
        setSidePanelDefaults(
          (request.key) ? request.key : 'route',
          request.route,
          request.data,
          sender.tab.id
        );
        chrome.sidePanel.open({ windowId: currentWindowId });
        if (sidePanelPort) {
          sidePanelPort.postMessage({
            key: (request.key) ? request.key : 'route',
            data: request.data,
            value: request.route,
            tab_id: sender.tab.id
          });
        } else {
          // The panel is (or will be) open but we have no live port reference
          // (e.g. the background service worker restarted since the panel
          // connected). Broadcast the route so an already-open panel page still
          // receives it; when the panel is closed, chrome.sidePanel.open +
          // onConnect delivers it via the stored defaults instead.
          chrome.runtime.sendMessage({
            action: 'navigate-sidepanel',
            value: request.route,
            data: request.data
          }).catch(() => {});
        }
      } else {
        if (sidePanelPort) {
          sidePanelPort.postMessage({
            key: 'route',
            value: '/settings',
            data: { tab: 'byok', showErrorLogs: true },
            tab_id: sender.tab.id
          });
        } else {
          setSidePanelDefaults('route', '/settings', { tab: 'byok', showErrorLogs: true }, sender.tab.id);
          chrome.sidePanel.open({ windowId: currentWindowId });
          chrome.runtime.sendMessage({
            action: 'navigate-sidepanel',
            value: '/settings',
            data: { tab: 'byok', showErrorLogs: true }
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.log('catch routeToSidePanel', e);
      setSidePanelDefaults(
        isErrorLogs ? 'route' : ((request.key) ? request.key : 'route'),
        isErrorLogs ? '/settings' : request.route,
        isErrorLogs ? { tab: 'byok', showErrorLogs: true } : request.data,
        sender.tab.id
      );
      chrome.sidePanel.open({ windowId: currentWindowId });
      chrome.runtime.sendMessage({
        action: 'navigate-sidepanel',
        value: isErrorLogs ? '/settings' : request.route,
        data: isErrorLogs ? { tab: 'byok', showErrorLogs: true } : request.data
      }).catch(() => {});
    }
  });
}
