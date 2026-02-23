/**
 * Sovereign Keychain - Content Script
 * ==================================
 * Scans for <sovereign-content> elements and interacts with the page.
 */

console.log('Sovereign Content Scanner Active.');

// Listen for postMessages from the Web Component (cross-world compatible)
window.addEventListener('message', (e) => {
    if (!e.data || !e.data.type) return;

    if (e.data.type === 'SOVEREIGN_CONTENT_FOUND') {
        const { id, label } = e.data;
        console.log(`Sovereign gate detected: ${label} (${id})`);

        // Safety check for extension context
        if (!chrome.runtime?.id) {
            console.warn('Sovereign Keychain: Extension context invalidated. Please refresh the page.');
            return;
        }

        chrome.runtime.sendMessage({ type: 'CHECK_TOKEN', gateId: id }, (response) => {
            if (chrome.runtime.lastError) return;
            if (response && response.hasToken) {
                console.log('Matching token found in keychain.');
            }
        });
    }

    if (e.data.type === 'SOVEREIGN_REQUEST_TOKEN') {
        const { gateId } = e.data;

        if (!chrome.runtime?.id) {
            alert('Sovereign Keychain: Extension context invalidated. Please refresh the page.');
            return;
        }

        chrome.runtime.sendMessage({ type: 'GET_TOKEN_DATA', gateId }, (response) => {
            if (chrome.runtime.lastError) {
                alert('Keychain communication error. Try refreshing.');
                return;
            }
            if (response && response.tokenData) {
                // Send unlock data back to the element using a CustomEvent (in-world)
                // Note: Content scripts can dispatch events that the page can see!
                const target = document.querySelector(`sovereign-content[gate-id="${gateId}"]`);
                if (target) {
                    target.dispatchEvent(new CustomEvent('sovereign:unlock', {
                        detail: response.tokenData
                    }));
                }
            } else {
                alert('No matching token found in your Sovereign Keychain. Please import the latest token JSON from the publisher.');
            }
        });
    }
});
