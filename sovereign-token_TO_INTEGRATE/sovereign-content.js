/**
 * <sovereign-content>
 * ==================
 * A high-fidelity Web Component for serving gated Sovereign Content.
 * Integrates with SovereignSDK and the Sovereign Keychain Extension.
 */

import { SovereignSDK, TokenRenderer } from './sovereign-sdk.js';

const STYLES = `
  :host { display: block; overflow: hidden; position: relative; }
  .sov-wrap {
    font-family: 'Space Mono', monospace;
    background: #06060e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 32px;
    text-align: center;
    color: #e8e4ff;
    position: relative;
    z-index: 1;
  }
  .sov-wrap::before {
    content: ''; position: absolute; inset: 0; z-index: -1;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
    opacity: 0.03; pointer-events: none;
  }
  .token-box {
    position: relative; width: 128px; height: 128px; margin: 0 auto 24px;
    filter: drop-shadow(0 0 20px rgba(124,92,252,0.4));
  }
  canvas { border-radius: 50%; width: 128px; height: 128px; display: block; }
  .sov-label { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 18px; letter-spacing: -0.02em; margin-bottom: 8px; }
  .sov-meta { font-size: 10px; color: rgba(232,228,255,0.4); text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 24px; }
  .sov-btn {
    font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px;
    background: linear-gradient(135deg, #7c5cfc, #5b3dd4);
    color: white; border: none; padding: 12px 28px;
    border-radius: 8px; cursor: pointer;
    transition: all 0.2s;
  }
  .sov-btn:hover { transform: translateY(-1px); filter: brightness(1.2); box-shadow: 0 4px 15px rgba(124,92,252,0.4); }
  .sov-btn:active { transform: translateY(0); }
  .sov-hidden { display: none !important; }
  .error-txt { font-size: 10px; color: #ff3355; margin-top: 12px; }
`;

class SovereignContent extends HTMLElement {
    static get observedAttributes() { return ['label', 'envelope', 'gate-id']; }

    constructor() {
        super();
        this._shadow = this.attachShadow({ mode: 'open' });
        this._renderer = null;
        this._unlocked = false;
    }

    connectedCallback() {
        this._render();
        this.addEventListener('sovereign:unlock', (e) => this._onUnlock(e.detail));

        // Auto-scan for extension via postMessage (cross-world compatible)
        window.postMessage({
            type: 'SOVEREIGN_CONTENT_FOUND',
            id: this.getAttribute('gate-id'),
            label: this.getAttribute('label')
        }, '*');
    }

    attributeChangedCallback(name) {
        if (this._shadow.innerHTML) this._render();
    }

    async _render() {
        const label = this.getAttribute('label') || 'Protected Content';
        const gateId = this.getAttribute('gate-id') || 'unknown';

        // Hash gate-id to get a consistent palette/seed for visuals
        const encoder = new TextEncoder();
        const data = encoder.encode(gateId);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const seed = new DataView(hashBuffer).getUint32(0);
        const h1 = Math.floor(seed % 360);
        const palette = [h1, (h1 + 137) % 360, (h1 + 250) % 360];

        this._shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="sov-wrap" id="lockedState">
        <div class="token-box">
          <canvas id="tokenCanvas" width="128" height="128"></canvas>
        </div>
        <div class="sov-label">${label}</div>
        <div class="sov-meta">Gated · personal sovereignty token required</div>
        <button class="sov-btn" id="unlockBtn">Present Token</button>
        <div id="errorArea" class="error-txt"></div>
      </div>
      <div class="sov-hidden" id="unlockedState"></div>
    `;

        const canvas = this._shadow.getElementById('tokenCanvas');
        if (this._renderer) this._renderer.stop();
        this._renderer = new TokenRenderer(canvas, seed, palette, 'locked');
        this._renderer.start();

        this._shadow.getElementById('unlockBtn').onclick = () => {
            window.postMessage({
                type: 'SOVEREIGN_REQUEST_TOKEN',
                gateId: this.getAttribute('gate-id')
            }, '*');
        };
    }

    async _onUnlock({ key, passphrase, metaPassphrase }) {
        if (this._unlocked) return;
        const envelope = this.getAttribute('envelope');
        this._renderer.setState('unlocking');
        this._shadow.getElementById('errorArea').textContent = '';

        try {
            const decrypted = await SovereignSDK.decrypt(envelope, key, passphrase, metaPassphrase);
            setTimeout(() => {
                this._renderer.setState('unlocked');
                setTimeout(() => this._showContent(decrypted), 600);
            }, 800);
        } catch (e) {
            console.error('Decryption failed:', e);
            this._renderer.setState('locked');
            this._shadow.getElementById('errorArea').textContent = 'Verification Failed: Invalid credentials.';
        }
    }

    _showContent(html) {
        this._unlocked = true;
        if (this._renderer) this._renderer.stop();
        this._shadow.getElementById('lockedState').classList.add('sov-hidden');
        const unlocked = this._shadow.getElementById('unlockedState');
        unlocked.classList.remove('sov-hidden');
        unlocked.innerHTML = html;

        // Evaluate scripts safely
        const scripts = unlocked.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
            newScript.appendChild(document.createTextNode(oldScript.innerHTML));
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    }
}

customElements.define('sovereign-content', SovereignContent);
