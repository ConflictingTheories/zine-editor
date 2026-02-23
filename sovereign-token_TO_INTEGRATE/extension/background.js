/**
 * Sovereign Keychain - Background Script
 * =====================================
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CHECK_TOKEN') {
        chrome.storage.local.get(['tokens'], (result) => {
            const tokens = result.tokens || [];
            const hasToken = tokens.some(t => t.gateId === message.gateId);
            sendResponse({ hasToken });
        });
        return true; // Keep channel open for async response
    }

    if (message.type === 'GET_TOKEN_DATA') {
        chrome.storage.local.get(['tokens'], (result) => {
            const tokens = result.tokens || [];
            const token = tokens.find(t => t.gateId === message.gateId);
            sendResponse({ tokenData: token });
        });
        return true;
    }
});
