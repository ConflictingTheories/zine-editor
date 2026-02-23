/**
 * Sovereign Keychain - Popup Script
 * ================================
 */

document.addEventListener('DOMContentLoaded', () => {
    const tokenListEl = document.getElementById('tokenList');
    const importBtn = document.getElementById('importBtn');
    const tokenJsonInput = document.getElementById('tokenJson');

    // Load and display tokens
    function loadTokens() {
        chrome.storage.local.get(['tokens'], (result) => {
            const tokens = result.tokens || [];
            tokenListEl.innerHTML = '';

            if (tokens.length === 0) {
                tokenListEl.innerHTML = '<div style="font-size:11px;opacity:0.3;padding:10px;">No tokens in keychain.</div>';
                return;
            }

            tokens.forEach((t, index) => {
                const item = document.createElement('div');
                item.className = 'token-item';
                item.innerHTML = `
          <span class="token-id">${t.label || t.gateId}</span>
          <button class="delete-btn" data-index="${index}" style="width:auto;padding:2px 8px;margin:0;font-size:9px;background:#ff3355">Remove</button>
        `;
                tokenListEl.appendChild(item);
            });

            // Handle deletes
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.onclick = () => {
                    const idx = parseInt(btn.getAttribute('data-index'));
                    tokens.splice(idx, 1);
                    chrome.storage.local.set({ tokens }, loadTokens);
                };
            });
        });
    }

    importBtn.onclick = () => {
        const raw = tokenJsonInput.value.trim();
        if (!raw) return;

        try {
            const token = JSON.parse(raw);
            // Expected format: { label, gateId, key, passphrase, metaPassphrase }
            chrome.storage.local.get(['tokens'], (result) => {
                const tokens = result.tokens || [];
                tokens.push(token);
                chrome.storage.local.set({ tokens }, () => {
                    tokenJsonInput.value = '';
                    loadTokens();
                });
            });
        } catch (e) {
            alert('Invalid Token JSON format.');
        }
    };

    loadTokens();
});
