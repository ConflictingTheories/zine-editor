/**
 * sovereign-gate.js
 * =================
 * Drop-in Web Component that wraps any HTML content behind a 4D Sovereign Token gate.
 *
 * USAGE — AUTHOR SIDE (encrypt + publish):
 *   const gate = await SovereignGate.seal({
 *     content: '<h1>Secret game</h1><script>...</script>',
 *     identity: 'publisher@example.com',
 *     label: 'My Protected Content',
 *   });
 *   // gate.envelope  → base64url ciphertext (put in your HTML)
 *   // gate.tokenJSON → publisher token JSON  (keep private)
 *   // gate.html()    → drop-in <sovereign-gate> element string
 *
 * USAGE — READER SIDE (decrypt via delegated token):
 *   // Just drop the <sovereign-gate> element in your page.
 *   // The gate UI renders the animated token and an "Unlock" button.
 *   // Paste or load a delegated token JSON → content decrypts and renders.
 *
 * USAGE — DELEGATION:
 *   const delegated = await SovereignGate.delegate(publisherTokenJSON, {
 *     purpose: 'read-only',
 *     ttl: 86400000,  // 24h
 *   });
 *   // Share delegated.tokenJSON with reader
 *
 * FUTURE EXTENSION POINT:
 *   The module emits CustomEvents on the gate element:
 *     'sovereign:locked'    — gate rendered, awaiting token
 *     'sovereign:unlocking' — token presented, verifying
 *     'sovereign:unlocked'  — content decrypted and rendered
 *     'sovereign:denied'    — token rejected
 *   A browser extension can listen for 'sovereign:locked', check its local token store,
 *   and auto-fire 'sovereign:present' with { detail: { tokenJSON } } to auto-decrypt.
 */

(function (root) {
'use strict';

// ══════════════════════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════════════════════

const FRAME_COUNT  = 48;   // animation frames
const FRAME_SIZE   = 96;   // canvas px (offscreen render size)
const GATE_VERSION = 1;
const TE = new TextEncoder();
const TD = new TextDecoder();

// ══════════════════════════════════════════════════════════════════
//  PURE UTILITIES
// ══════════════════════════════════════════════════════════════════

const cat = (...a) => {
  const l = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(l);
  let f = 0; for (const x of a) { o.set(x, f); f += x.length; } return o;
};
const u16 = n => new Uint8Array([(n >> 8) & 255, n & 255]);
const r16 = (b, o = 0) => (b[o] << 8) | b[o + 1];
const w32 = n => { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, n); return a; };
const r32 = (b, o = 0) => new DataView(b.buffer, b.byteOffset + o).getUint32(0);
const rnd = n => crypto.getRandomValues(new Uint8Array(n));
const tsEq = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };
const b64e = b => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const b64d = s => { try { return new Uint8Array([...atob(s.replace(/-/g, '+').replace(/_/g, '/'))].map(c => c.charCodeAt(0))); } catch { return null; } };
const hex  = (b, n = 8) => Array.from(b.slice(0, n)).map(x => x.toString(16).padStart(2, '0')).join('');

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

async function hashSeed(str) {
  const buf = await crypto.subtle.digest('SHA-256', TE.encode(str));
  return new DataView(buf).getUint32(0);
}

function derivePalette(seed) {
  const rng = mulberry32(seed);
  const h1 = Math.floor(rng() * 360);
  const h2 = (h1 + 137 + Math.floor(rng() * 40)) % 360;  // golden-ish split
  const h3 = (h2 + 137 + Math.floor(rng() * 40)) % 360;
  return [h1, h2, h3];
}

// ══════════════════════════════════════════════════════════════════
//  CRYPTO — ECDSA (token signing)
// ══════════════════════════════════════════════════════════════════

async function genKeyPair() {
  return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
}
async function signBytes(privKey, data) {
  return new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, data));
}
async function verifySignature(pubJwk, data, sig) {
  const k = await crypto.subtle.importKey('jwk', pubJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, sig, data);
}
async function exportPub(kp) { return crypto.subtle.exportKey('jwk', kp.publicKey); }
async function exportPriv(kp) { return crypto.subtle.exportKey('jwk', kp.privateKey); }
async function importPriv(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}
async function importPub(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
}

// ══════════════════════════════════════════════════════════════════
//  CRYPTO — AES-GCM (content encryption)
// ══════════════════════════════════════════════════════════════════

async function aesEncrypt(keyBytes, iv, plaintext) {
  const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, k, plaintext));
}
async function aesDecrypt(keyBytes, iv, ciphertext) {
  const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, k, ciphertext));
}

// Derive a 256-bit key from a token's identity string + salt using HKDF
async function deriveContentKey(identity, salt) {
  const base = await crypto.subtle.importKey('raw', TE.encode(identity), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', salt, hash: 'SHA-256', info: TE.encode('sovereign-gate-v1') },
    base, 256
  );
  return new Uint8Array(bits);
}

// ══════════════════════════════════════════════════════════════════
//  TOKEN — build / sign / verify / delegate
// ══════════════════════════════════════════════════════════════════

/**
 * Token JSON schema:
 * {
 *   v: 1,
 *   id: string,          // identity string (hashed to visual seed)
 *   role: 'publisher' | 'delegate',
 *   claims: {},          // arbitrary claims
 *   gateId: string,      // which gate(s) this token grants access to
 *   delegation?: {
 *     parentId: string,
 *     purpose: string,
 *     exp: number|null,
 *   },
 *   publicKey: JWK,      // for verification by gate
 *   iat: number,
 *   sig: string,         // b64url ECDSA-P256 over canonical payload
 *   _privateKey?: JWK,   // only present in private token (never shared in gate HTML)
 * }
 */

async function buildToken({ id, role, claims, gateId, delegation, keyPair }) {
  const kp = keyPair || await genKeyPair();
  const pub = await exportPub(kp);
  const priv = await exportPriv(kp);

  const payload = { v: GATE_VERSION, id, role, claims, gateId, delegation: delegation || null, publicKey: pub, iat: Date.now() };
  const payloadBytes = TE.encode(JSON.stringify(payload));
  const sig = await signBytes(kp.privateKey, payloadBytes);

  return {
    ...payload,
    sig: b64e(sig),
    _privateKey: priv,
  };
}

async function verifyToken(tokenJSON) {
  try {
    const { sig, _privateKey, ...payload } = tokenJSON;
    const payloadBytes = TE.encode(JSON.stringify(payload));
    const sigBytes = b64d(sig);
    if (!sigBytes) return { valid: false, error: 'Bad signature encoding' };
    const ok = await verifySignature(payload.publicKey, payloadBytes, sigBytes);
    if (!ok) return { valid: false, error: 'Signature invalid' };
    if (payload.delegation?.exp && Date.now() > payload.delegation.exp) {
      return { valid: false, error: 'Token expired' };
    }
    return { valid: true, token: payload };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════
//  ENVELOPE — encrypt / decrypt arbitrary HTML content
// ══════════════════════════════════════════════════════════════════

/**
 * Envelope format (base64url encoded):
 * GATE(4) | version(1) | gateId(32B SHA256) | salt(32B) | iv(12B) | ctLen(4B) | ciphertext
 */
const GATE_MAGIC = new Uint8Array([0x53, 0x47, 0x41, 0x54]); // SGAT

async function sealContent(htmlContent, gateId, identity) {
  const salt = rnd(32);
  const iv   = rnd(12);
  const key  = await deriveContentKey(identity + ':' + gateId, salt);
  const pt   = TE.encode(htmlContent);
  const ct   = await aesEncrypt(key, iv, pt);

  // Encode gateId as 32B SHA256 hash for compact storage
  const gateIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', TE.encode(gateId)));

  const envelope = cat(GATE_MAGIC, new Uint8Array([GATE_VERSION]), gateIdHash, salt, iv, w32(ct.length), ct);
  return b64e(envelope);
}

async function openEnvelope(envelopeStr, identity) {
  const env = b64d(envelopeStr);
  if (!env) throw new Error('Invalid envelope encoding');

  let o = 0;
  const magic = env.slice(o, o + 4); o += 4;
  if (!tsEq(magic, GATE_MAGIC)) throw new Error('Invalid envelope magic');

  o += 1; // version
  const gateIdHash = env.slice(o, o + 32); o += 32;
  const salt = env.slice(o, o + 32); o += 32;
  const iv   = env.slice(o, o + 12); o += 12;
  const ctLen = r32(env, o); o += 4;
  const ct   = env.slice(o, o + ctLen);

  // Reconstruct gate ID hash from claimed identity to verify access
  // (The gate stores the expected gateId hash; we check the token's gateId matches)
  const key = await deriveContentKey(identity, salt);
  throw new Error('Use openEnvelopeWithToken instead');
}

async function openEnvelopeWithToken(envelopeStr, tokenJSON) {
  const { valid, token, error } = await verifyToken(tokenJSON);
  if (!valid) throw new Error('Token invalid: ' + error);

  const env = b64d(envelopeStr);
  if (!env) throw new Error('Invalid envelope encoding');

  let o = 0;
  const magic = env.slice(o, o + 4); o += 4;
  if (!tsEq(magic, GATE_MAGIC)) throw new Error('Invalid envelope magic');
  o += 1; // version

  const storedGateIdHash = env.slice(o, o + 32); o += 32;
  const salt = env.slice(o, o + 32); o += 32;
  const iv   = env.slice(o, o + 12); o += 12;
  const ctLen = r32(env, o); o += 4;
  const ct   = env.slice(o, o + ctLen);

  // Determine identity to use for key derivation
  // For delegates: use parent's identity (the one that sealed the content)
  const sealerIdentity = token.role === 'delegate'
    ? (token.delegation?.parentId || token.id)
    : token.id;

  const gateId = token.gateId;
  const expectedGateHash = new Uint8Array(await crypto.subtle.digest('SHA-256', TE.encode(gateId)));

  if (!tsEq(storedGateIdHash, expectedGateHash)) {
    throw new Error('This token is not authorized for this gate (gateId mismatch)');
  }

  const key = await deriveContentKey(sealerIdentity + ':' + gateId, salt);

  let pt;
  try {
    pt = await aesDecrypt(key, iv, ct);
  } catch (e) {
    throw new Error('Decryption failed — token identity does not match gate key');
  }

  return TD.decode(pt);
}

// ══════════════════════════════════════════════════════════════════
//  VISUAL ENGINE — 4D animated token (runs live in DOM, not offscreen)
// ══════════════════════════════════════════════════════════════════

class TokenRenderer {
  constructor(canvas, seed, palette, state = 'locked') {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.seed = seed;
    this.palette = palette;
    this.state = state; // 'locked' | 'unlocking' | 'unlocked' | 'denied'
    this.t = 0;
    this.rng = mulberry32(seed);
    this.particles = [];
    this.sigil = [];
    this._raf = null;
    this._stateProgress = 0;
    this._initParticles();
    this._buildSigil();
  }

  _initParticles() {
    const rng = mulberry32(this.seed + 1);
    const count = 60 + Math.floor(rng() * 30);
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: rng() * FRAME_SIZE, y: rng() * FRAME_SIZE,
        vx: 0, vy: 0,
        life: rng(),
        speed: 0.25 + rng() * 0.6,
        size: 0.4 + rng() * 1.4,
        hOff: rng() * 50 - 25,
        phase: rng() * Math.PI * 2,
      });
    }
  }

  _buildSigil() {
    const rng = mulberry32(this.seed + 2);
    const arms = 3 + Math.floor(rng() * 5);
    for (let i = 0; i < arms; i++) {
      this.sigil.push({
        base: (i / arms) * Math.PI * 2,
        r1: 10 + rng() * 16,
        r2: 4 + rng() * 9,
        twist: (rng() - 0.5) * 0.9,
      });
    }
    this.sigilArms = arms;
  }

  _flowAngle(x, y, t) {
    const nx = x / FRAME_SIZE * 4, ny = y / FRAME_SIZE * 4;
    return Math.sin(nx * 1.3 + t * 0.5) * Math.cos(ny * 0.9 - t * 0.3) * Math.PI
         + Math.sin(nx * 0.7 - ny * 1.1 + t * 0.2) * Math.PI * 0.5;
  }

  setState(s) {
    this.state = s;
    this._stateProgress = 0;
  }

  _stateColor() {
    // Returns [h, s, l] modifiers based on state
    if (this.state === 'locked')    return [0, 1, 0.6];
    if (this.state === 'unlocking') return [40, 1.1, 0.9];
    if (this.state === 'unlocked')  return [120, 1.2, 1.1];
    if (this.state === 'denied')    return [-30, 1.1, 0.8];
    return [0, 1, 1];
  }

  render() {
    const ctx = this.ctx;
    const t = this.t * 0.018;
    const norm = (this.t % FRAME_COUNT) / FRAME_COUNT;
    const [h1, h2, h3] = this.palette;
    const [hShift, sMul, lMul] = this._stateColor();
    const S = FRAME_SIZE;
    const cx = S / 2, cy = S / 2;

    // — Background —
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.8);
    bg.addColorStop(0,   `hsl(${h1 + hShift},${70 * sMul}%,${10 * lMul}%)`);
    bg.addColorStop(0.5, `hsl(${h2 + hShift},${60 * sMul}%,${6 * lMul}%)`);
    bg.addColorStop(1,   `hsl(${h3 + hShift},${50 * sMul}%,${3 * lMul}%)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, S, S);

    // — Particles —
    this._stateProgress = Math.min(1, this._stateProgress + 0.03);
    const sp = this._stateProgress;

    for (const p of this.particles) {
      const angle = this._flowAngle(p.x, p.y, t);
      p.vx = p.vx * 0.9 + Math.cos(angle) * p.speed * 0.3;
      p.vy = p.vy * 0.9 + Math.sin(angle) * p.speed * 0.3;
      p.x = (p.x + p.vx + S) % S;
      p.y = (p.y + p.vy + S) % S;
      p.life += 0.004;

      const alpha = (0.35 + 0.35 * Math.sin(p.life * Math.PI * 2 + norm * Math.PI)) * sp;
      const hue = h1 + hShift + p.hOff + norm * 25;
      const lum = 50 + 30 * Math.sin(p.phase + p.life * 4 + norm * Math.PI * 2);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue},85%,${lum}%,${alpha})`;
      ctx.fill();
    }

    // — Outer ring —
    const spin = norm * Math.PI * 0.35 + this.t * 0.003;
    const pulse = 1 + 0.05 * Math.sin(norm * Math.PI * 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    ctx.scale(pulse, pulse);

    const rg = ctx.createRadialGradient(0, 0, 22, 0, 0, 32);
    rg.addColorStop(0,   `hsla(${h1 + hShift},90%,70%,0)`);
    rg.addColorStop(0.5, `hsla(${h1 + hShift},90%,70%,${0.5 * sp})`);
    rg.addColorStop(1,   `hsla(${h1 + hShift},90%,70%,0)`);
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2);
    ctx.strokeStyle = rg; ctx.lineWidth = 1.0; ctx.stroke();

    // — Sigil arms —
    for (const arm of this.sigil) {
      const a0 = arm.base + spin * arm.twist;
      const x1 = Math.cos(a0) * arm.r1, y1 = Math.sin(a0) * arm.r1;
      const a1 = a0 + Math.PI / this.sigilArms;
      const x2 = Math.cos(a1) * arm.r2, y2 = Math.sin(a1) * arm.r2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(x1, y1, x2, y2);
      ctx.strokeStyle = `hsla(${h1 + hShift + norm * 35},80%,65%,${0.7 * sp})`;
      ctx.lineWidth = 0.7; ctx.stroke();
    }

    // — Lock / unlock icon overlay —
    if (this.state === 'locked' || this.state === 'denied') {
      const lockAlpha = 0.25 + 0.15 * Math.sin(this.t * 0.08);
      ctx.beginPath();
      // shackle
      ctx.arc(0, -6, 5, Math.PI, 0);
      ctx.strokeStyle = `rgba(255,255,255,${lockAlpha})`;
      ctx.lineWidth = 1.4; ctx.stroke();
      // body
      ctx.fillStyle = `rgba(255,255,255,${lockAlpha * 0.6})`;
      ctx.fillRect(-5, -4, 10, 9);
    } else if (this.state === 'unlocked') {
      // checkmark glow
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
      glow.addColorStop(0, `hsla(120,90%,70%,${0.4 * sp})`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(-14, -14, 28, 28);
      ctx.beginPath();
      ctx.moveTo(-6, 0); ctx.lineTo(-1, 5); ctx.lineTo(7, -5);
      ctx.strokeStyle = `rgba(100,255,160,${0.9 * sp})`;
      ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    } else if (this.state === 'unlocking') {
      // spinning arc
      const arcAlpha = 0.6 + 0.3 * Math.sin(this.t * 0.2);
      ctx.beginPath();
      ctx.arc(0, 0, 10, this.t * 0.12, this.t * 0.12 + Math.PI * 1.4);
      ctx.strokeStyle = `rgba(255,200,80,${arcAlpha})`;
      ctx.lineWidth = 2; ctx.stroke();
    }

    // — Core dot —
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 6);
    cg.addColorStop(0, `hsla(${h2 + hShift},100%,90%,0.85)`);
    cg.addColorStop(1, `hsla(${h2 + hShift},90%,60%,0)`);
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = cg; ctx.fill();

    ctx.restore();
    this.t++;
  }

  start() {
    const tick = () => { this._raf = requestAnimationFrame(tick); this.render(); };
    this._raf = requestAnimationFrame(tick);
  }

  stop() { if (this._raf) cancelAnimationFrame(this._raf); }
}

// ══════════════════════════════════════════════════════════════════
//  SHADOW DOM STYLES
// ══════════════════════════════════════════════════════════════════

const GATE_STYLES = `
  :host { display: block; position: relative; }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .gate-wrap {
    position: relative;
    font-family: 'IBM Plex Mono', 'Fira Code', monospace;
    background: #07080a;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    overflow: hidden;
  }

  /* — Locked state — */
  .locked-ui {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 20px;
    padding: 32px 24px; min-height: 180px;
    position: relative; z-index: 2;
    transition: opacity 0.4s;
  }
  .locked-ui.fading { opacity: 0; }

  .token-ring {
    position: relative; flex-shrink: 0;
    filter: drop-shadow(0 0 18px rgba(var(--palette-h1-rgb, 124,92,252), 0.5));
  }
  .token-ring::before {
    content: '';
    position: absolute; inset: -2px; border-radius: 50%; z-index: -1;
    background: conic-gradient(from 0deg, hsl(var(--h1),70%,55%), hsl(var(--h2),70%,55%), hsl(var(--h3),70%,55%), hsl(var(--h1),70%,55%));
    animation: ring-spin 6s linear infinite;
  }
  @keyframes ring-spin { to { transform: rotate(360deg); } }
  .token-ring::after {
    content: ''; position: absolute; inset: -1px; border-radius: 50%; background: #07080a; z-index: -1;
  }
  canvas.token-canvas { display: block; border-radius: 50%; }

  .gate-info { text-align: center; }
  .gate-label {
    font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(221,228,238,0.55); margin-bottom: 6px;
  }
  .gate-id {
    font-size: 9px; color: rgba(221,228,238,0.25); letter-spacing: 0.08em;
  }
  .gate-status {
    font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase;
    padding: 3px 10px; border-radius: 99px; display: inline-block; margin-top: 6px;
  }
  .status-locked  { background: rgba(255,100,80,0.1);  border: 1px solid rgba(255,100,80,0.25);  color: #ff6450; }
  .status-wait    { background: rgba(255,180,0,0.1);   border: 1px solid rgba(255,180,0,0.25);   color: #ffb400; }
  .status-ok      { background: rgba(0,220,120,0.1);   border: 1px solid rgba(0,220,120,0.25);   color: #00dc78; }
  .status-denied  { background: rgba(255,50,80,0.15);  border: 1px solid rgba(255,50,80,0.3);    color: #ff3250; }

  /* — Controls — */
  .gate-controls { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 280px; }

  button {
    font-family: inherit; font-size: 10px; font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; cursor: pointer; border: none; border-radius: 4px;
    padding: 9px 16px; transition: all 0.15s; width: 100%;
  }
  .btn-unlock {
    background: linear-gradient(135deg, hsl(var(--h1),65%,45%), hsl(var(--h2),65%,40%));
    color: #fff;
  }
  .btn-unlock:hover { filter: brightness(1.2); }
  .btn-paste {
    background: transparent; color: rgba(221,228,238,0.5);
    border: 1px solid rgba(255,255,255,0.08);
  }
  .btn-paste:hover { border-color: hsl(var(--h1),50%,50%); color: rgba(221,228,238,0.9); }
  .btn-sm {
    font-size: 9px; padding: 6px 12px; width: auto;
    background: transparent; color: rgba(221,228,238,0.35);
    border: 1px solid rgba(255,255,255,0.06);
  }
  .btn-sm:hover { color: rgba(221,228,238,0.8); }

  /* — Token input panel — */
  .token-panel {
    display: none; flex-direction: column; gap: 8px;
    background: rgba(0,0,0,0.4); border-top: 1px solid rgba(255,255,255,0.06);
    padding: 16px; position: relative; z-index: 2;
  }
  .token-panel.visible { display: flex; }

  .panel-title {
    font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
    color: rgba(221,228,238,0.3); margin-bottom: 4px;
  }
  textarea.token-input {
    width: 100%; background: rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.08);
    color: hsl(var(--h2),70%,70%); font-family: inherit; font-size: 9px;
    padding: 10px; border-radius: 4px; resize: vertical; min-height: 70px;
    outline: none; transition: border-color 0.15s; line-height: 1.6;
  }
  textarea.token-input:focus { border-color: hsl(var(--h1),50%,45%); }
  textarea.token-input::placeholder { color: rgba(221,228,238,0.15); }

  .panel-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .panel-actions button { width: auto; }

  .error-msg {
    font-size: 9px; color: #ff6450; letter-spacing: 0.05em;
    min-height: 14px; padding: 0 2px;
  }

  /* — Drag-drop zone — */
  .drop-zone {
    border: 1px dashed rgba(255,255,255,0.1); border-radius: 4px;
    padding: 10px; text-align: center; font-size: 9px;
    color: rgba(221,228,238,0.2); cursor: pointer; transition: all 0.2s;
    letter-spacing: 0.1em;
  }
  .drop-zone.drag-over {
    border-color: hsl(var(--h1),60%,50%); color: hsl(var(--h1),70%,65%);
    background: rgba(var(--h1),60%,50%,0.05);
  }
  .drop-zone input { display: none; }

  /* — Content frame — */
  .content-frame {
    display: none; width: 100%; border: none; background: #fff;
  }
  .content-frame.visible { display: block; }

  /* — Blur overlay — */
  .blur-overlay {
    position: absolute; inset: 0; z-index: 1;
    backdrop-filter: blur(12px); background: rgba(7,8,10,0.6);
    pointer-events: none; transition: opacity 0.5s;
  }
  .blur-overlay.clear { opacity: 0; pointer-events: none; }

  /* — Scanlines — */
  .scanlines {
    position: absolute; inset: 0; pointer-events: none; z-index: 0;
    background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.03) 3px, rgba(0,0,0,0.03) 4px);
  }

  /* — Unlocked header bar — */
  .unlocked-bar {
    display: none; align-items: center; gap: 10px;
    padding: 8px 14px; background: rgba(0,0,0,0.5);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    position: relative; z-index: 3;
  }
  .unlocked-bar.visible { display: flex; }
  .unlocked-bar .bar-token { width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0; }
  .unlocked-bar .bar-label {
    font-size: 9px; color: rgba(0,220,120,0.7); letter-spacing: 0.12em; text-transform: uppercase;
    flex: 1;
  }
  .unlocked-bar .bar-lock-btn {
    font-size: 8px; padding: 3px 8px; width: auto;
    background: transparent; color: rgba(221,228,238,0.2);
    border: 1px solid rgba(255,255,255,0.05); border-radius: 3px;
  }
  .unlocked-bar .bar-lock-btn:hover { color: rgba(221,228,238,0.6); }
`;

// ══════════════════════════════════════════════════════════════════
//  CUSTOM ELEMENT — <sovereign-gate>
// ══════════════════════════════════════════════════════════════════

class SovereignGateElement extends HTMLElement {
  static get observedAttributes() {
    return ['label', 'gate-id', 'envelope', 'size', 'content-height'];
  }

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
    this._renderer = null;
    this._unlocked = false;
    this._currentToken = null;
  }

  connectedCallback() {
    this._render();
    // Listen for extension auto-present events
    this.addEventListener('sovereign:present', (e) => {
      if (e.detail?.tokenJSON) this._tryToken(e.detail.tokenJSON);
    });
  }

  disconnectedCallback() {
    if (this._renderer) this._renderer.stop();
  }

  async _render() {
    const label    = this.getAttribute('label') || 'Protected Content';
    const gateId   = this.getAttribute('gate-id') || 'unknown';
    const size     = parseInt(this.getAttribute('size') || '80');
    const contentH = this.getAttribute('content-height') || '400px';

    // Derive visual seed from gateId
    const seed    = await hashSeed(gateId);
    const palette = derivePalette(seed);
    const [h1, h2, h3] = palette;

    this._seed    = seed;
    this._palette = palette;
    this._gateId  = gateId;
    this._label   = label;

    const shadow = this._shadow;
    shadow.innerHTML = `
      <style>
        ${GATE_STYLES}
        :host {
          --h1: ${h1}; --h2: ${h2}; --h3: ${h3};
        }
        .content-frame { height: ${contentH}; }
      </style>
      <div class="gate-wrap">
        <div class="scanlines"></div>
        <div class="unlocked-bar" id="unlockedBar">
          <canvas class="bar-token" id="barToken" width="24" height="24"></canvas>
          <span class="bar-label">✓ UNLOCKED — ${label}</span>
          <button class="bar-lock-btn" id="btnRelock">⬡ Re-lock</button>
        </div>
        <div class="locked-ui" id="lockedUI">
          <div class="token-ring">
            <canvas class="token-canvas" id="tokenCanvas"
              width="${size}" height="${size}"
              style="width:${size}px;height:${size}px"></canvas>
          </div>
          <div class="gate-info">
            <div class="gate-label">${label}</div>
            <div class="gate-id">gate · ${gateId.slice(0, 16)}${gateId.length > 16 ? '…' : ''}</div>
            <div class="gate-status status-locked" id="statusChip">● LOCKED</div>
          </div>
          <div class="gate-controls">
            <button class="btn-unlock" id="btnUnlock">⬡ Present Token</button>
            <button class="btn-paste" id="btnPaste">Paste Token JSON</button>
          </div>
        </div>
        <div class="token-panel" id="tokenPanel">
          <div class="panel-title">Present Delegated Token</div>
          <textarea class="token-input" id="tokenInput"
            placeholder='Paste token JSON here, or drag a .token file below...'></textarea>
          <div class="drop-zone" id="dropZone">
            <input type="file" id="fileInput" accept=".token,.json">
            Drag &amp; drop .token file — or click to browse
          </div>
          <div class="panel-actions">
            <button class="btn-unlock" id="btnSubmit">Verify + Unlock</button>
            <button class="btn-sm" id="btnCancel">Cancel</button>
          </div>
          <div class="error-msg" id="errMsg"></div>
        </div>
        <iframe class="content-frame" id="contentFrame"
          sandbox="allow-scripts allow-same-origin allow-forms"
          style="height:${contentH}"></iframe>
      </div>
    `;

    // Start token animation
    const canvas = shadow.getElementById('tokenCanvas');
    this._renderer = new TokenRenderer(canvas, seed, palette, 'locked');
    this._renderer.start();

    // Wire events
    shadow.getElementById('btnUnlock').onclick = () => this._showPanel();
    shadow.getElementById('btnPaste').onclick  = () => this._showPanel();
    shadow.getElementById('btnCancel').onclick = () => this._hidePanel();
    shadow.getElementById('btnSubmit').onclick = () => this._submitToken();
    shadow.getElementById('btnRelock').onclick = () => this._relock();

    // File drop
    const dropZone = shadow.getElementById('dropZone');
    const fileInput = shadow.getElementById('fileInput');
    dropZone.onclick = () => fileInput.click();
    fileInput.onchange = (e) => this._loadFile(e.target.files[0]);
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); };
    dropZone.ondragleave = () => dropZone.classList.remove('drag-over');
    dropZone.ondrop = (e) => {
      e.preventDefault(); dropZone.classList.remove('drag-over');
      const f = e.dataTransfer.files[0]; if (f) this._loadFile(f);
    };

    // Emit ready event
    this.dispatchEvent(new CustomEvent('sovereign:locked', { bubbles: true, detail: { gateId, label } }));
  }

  _showPanel() {
    const p = this._shadow.getElementById('tokenPanel');
    p.classList.add('visible');
    this._shadow.getElementById('tokenInput').focus();
  }

  _hidePanel() {
    this._shadow.getElementById('tokenPanel').classList.remove('visible');
    this._shadow.getElementById('errMsg').textContent = '';
  }

  async _loadFile(file) {
    if (!file) return;
    const text = await file.text();
    this._shadow.getElementById('tokenInput').value = text;
    this._shadow.getElementById('dropZone').textContent = `✓ ${file.name} loaded`;
  }

  async _submitToken() {
    const raw = this._shadow.getElementById('tokenInput').value.trim();
    if (!raw) { this._setError('Paste a token JSON first'); return; }

    let tokenJSON;
    try { tokenJSON = JSON.parse(raw); }
    catch (e) { this._setError('Invalid JSON — check token format'); return; }

    await this._tryToken(tokenJSON);
  }

  async _tryToken(tokenJSON) {
    const envelope = this.getAttribute('envelope');
    if (!envelope) { this._setError('No envelope set on this gate'); return; }

    this._setStatus('wait', '⟳ VERIFYING');
    this._renderer.setState('unlocking');
    this._setError('');

    this.dispatchEvent(new CustomEvent('sovereign:unlocking', { bubbles: true }));

    try {
      const html = await openEnvelopeWithToken(envelope, tokenJSON);

      // Success
      this._renderer.setState('unlocked');
      this._currentToken = tokenJSON;
      this._unlocked = true;

      // Animate locked UI out
      const lockedUI = this._shadow.getElementById('lockedUI');
      lockedUI.classList.add('fading');
      this._hidePanel();

      setTimeout(() => {
        lockedUI.style.display = 'none';

        // Show unlocked bar with mini token
        const bar = this._shadow.getElementById('unlockedBar');
        bar.classList.add('visible');

        // Render mini token in bar
        const barCanvas = this._shadow.getElementById('barToken');
        const miniRenderer = new TokenRenderer(barCanvas, this._seed, this._palette, 'unlocked');
        miniRenderer.start();

        // Inject content into sandboxed iframe
        const frame = this._shadow.getElementById('contentFrame');
        frame.classList.add('visible');

        // Write content to iframe
        frame.addEventListener('load', () => {}, { once: true });
        const doc = frame.contentDocument || frame.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();

        // Auto-size iframe
        const resize = () => {
          try {
            const h = doc.body?.scrollHeight;
            if (h && h > 50) frame.style.height = h + 'px';
          } catch(e) {}
        };
        setTimeout(resize, 200);
        frame.onload = resize;

      }, 400);

      this.dispatchEvent(new CustomEvent('sovereign:unlocked', {
        bubbles: true,
        detail: { tokenId: tokenJSON.id, role: tokenJSON.role }
      }));

    } catch (e) {
      this._renderer.setState('denied');
      this._setStatus('denied', '✗ DENIED');
      this._setError(e.message);
      setTimeout(() => {
        this._renderer.setState('locked');
        this._setStatus('locked', '● LOCKED');
      }, 2000);
      this.dispatchEvent(new CustomEvent('sovereign:denied', { bubbles: true, detail: { error: e.message } }));
    }
  }

  _relock() {
    this._unlocked = false;
    this._currentToken = null;
    this._renderer.setState('locked');

    const frame = this._shadow.getElementById('contentFrame');
    frame.classList.remove('visible');
    try { (frame.contentDocument || frame.contentWindow.document).open(); } catch(e) {}

    this._shadow.getElementById('unlockedBar').classList.remove('visible');
    const lockedUI = this._shadow.getElementById('lockedUI');
    lockedUI.style.display = '';
    lockedUI.classList.remove('fading');
    this._setStatus('locked', '● LOCKED');
    this._shadow.getElementById('tokenInput').value = '';

    this.dispatchEvent(new CustomEvent('sovereign:locked', { bubbles: true }));
  }

  _setStatus(type, text) {
    const chip = this._shadow.getElementById('statusChip');
    if (!chip) return;
    chip.className = 'gate-status status-' + type;
    chip.textContent = text;
  }

  _setError(msg) {
    const el = this._shadow.getElementById('errMsg');
    if (el) el.textContent = msg;
  }
}

// ══════════════════════════════════════════════════════════════════
//  PUBLIC API — SovereignGate
// ══════════════════════════════════════════════════════════════════

const SovereignGate = {

  /**
   * Seal HTML content behind a gate.
   * @param {Object} opts
   * @param {string} opts.content      - any HTML string (games, scripts, articles...)
   * @param {string} opts.identity     - publisher identity (email, DID, username)
   * @param {string} [opts.label]      - human-readable label shown on gate
   * @param {string} [opts.gateId]     - stable gate identifier (default: random)
   * @param {Object} [opts.claims]     - additional claims for the publisher token
   * @returns {Promise<{
   *   gateId: string,
   *   envelope: string,          // base64url ciphertext (put in HTML)
   *   publisherToken: Object,    // full token JSON with private key (keep private)
   *   html: () => string,        // generates drop-in <sovereign-gate> element
   *   scriptTag: () => string,   // generates complete embeddable script block
   * }>}
   */
  async seal({ content, identity, label = 'Protected Content', gateId, claims = {} }) {
    gateId = gateId || b64e(rnd(12));
    const token = await buildToken({ id: identity, role: 'publisher', claims, gateId });
    const envelope = await sealContent(content, gateId, identity);

    return {
      gateId,
      envelope,
      publisherToken: token,
      html: (opts = {}) => SovereignGate._gateElementHTML({ envelope, gateId, label, ...opts }),
      scriptTag: () => SovereignGate._scriptTag({ envelope, gateId, label }),
    };
  },

  /**
   * Create a delegated token from a publisher token.
   * @param {Object} publisherToken - full token JSON (with _privateKey)
   * @param {Object} opts
   * @param {string} [opts.purpose]    - e.g. 'read-only', 'preview', 'trial'
   * @param {number} [opts.ttl]        - ms until expiry (null = never)
   * @param {Object} [opts.claims]     - additional delegate claims
   * @returns {Promise<{ tokenJSON: Object, shareText: string }>}
   */
  async delegate(publisherToken, { purpose = 'delegate', ttl = null, claims = {} } = {}) {
    if (!publisherToken._privateKey) throw new Error('Publisher token must include private key');
    const privKey = await importPriv(publisherToken._privateKey);
    const kp = { privateKey: privKey, publicKey: await importPub(publisherToken.publicKey) };

    const token = await buildToken({
      id: `${publisherToken.id}::${purpose}::${Date.now()}`,
      role: 'delegate',
      claims: { ...claims, delegatedFrom: publisherToken.id },
      gateId: publisherToken.gateId,
      delegation: {
        parentId: publisherToken.id,
        purpose,
        exp: ttl ? Date.now() + ttl : null,
      },
      keyPair: kp,
    });

    // Remove private key from delegate token before sharing
    const { _privateKey, ...shareToken } = token;

    return {
      tokenJSON: shareToken,
      shareText: JSON.stringify(shareToken, null, 2),
    };
  },

  /**
   * Verify a token without decrypting content.
   * Returns { valid, token, error }.
   */
  verify: verifyToken,

  /**
   * Register the <sovereign-gate> custom element.
   * Called automatically when this script loads.
   */
  register() {
    if (!customElements.get('sovereign-gate')) {
      customElements.define('sovereign-gate', SovereignGateElement);
    }
  },

  // Internal: build HTML for the gate element
  _gateElementHTML({ envelope, gateId, label, size = 80, contentHeight = '400px' }) {
    return `<sovereign-gate\n  label="${label}"\n  gate-id="${gateId}"\n  envelope="${envelope}"\n  size="${size}"\n  content-height="${contentHeight}"\n></sovereign-gate>`;
  },

  _scriptTag({ envelope, gateId, label }) {
    return `<script src="sovereign-gate.js"><\/script>\n` +
           SovereignGate._gateElementHTML({ envelope, gateId, label });
  },
};

// Auto-register custom element
SovereignGate.register();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SovereignGate };
} else {
  root.SovereignGate = SovereignGate;
}

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
