/**
 * ============================================================================
 * Background Ports Module
 * ============================================================================
 * Maintains active MessagePort connections (long-lived connections) to all 
 * injected content scripts across different tabs. Allows the background worker 
 * to broadcast state changes universally to all active pages.
 */
const contentScriptPorts = {};

function sendToAllContentScriptPorts(request, excludeList = []) {
  for (const property in contentScriptPorts) {
    try {
      if (excludeList.indexOf(String(property)) === -1) {
        contentScriptPorts[property].postMessage(request);
      }
    } catch (e) {
      console.warn(e, "tabId", property);
    }
  }
}

export { contentScriptPorts, sendToAllContentScriptPorts };
