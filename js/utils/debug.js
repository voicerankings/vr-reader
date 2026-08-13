const DEBUG_MODE_KEY = 'DEBUG_MODE';

const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error
};

const noop = function () { };

export function applyDebugMode(enabled) {
    if (enabled) {
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
    } else {
        console.log = noop;
        console.warn = noop;
        console.error = noop;
    }
}

export function initDebugConsole() {
    applyDebugMode(false);

    try {
        chrome.storage.local.get(DEBUG_MODE_KEY, (result) => {
            applyDebugMode(result[DEBUG_MODE_KEY] === true);
        });
    } catch (e) {
        applyDebugMode(false);
    }

    try {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes[DEBUG_MODE_KEY]) {
                applyDebugMode(changes[DEBUG_MODE_KEY].newValue === true);
            }
        });
    } catch (e) {
        applyDebugMode(false);
    }
}
