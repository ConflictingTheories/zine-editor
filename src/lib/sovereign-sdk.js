/**
 * Sovereign SDK
 * =============
 * A unified library for personal sovereignty, identity, and encryption.
 * Combines 4D Steganographic Tokens (Identity) with Self-Coding Embedded Encryption (SCEE).
 */

'use strict';

// ─── Constants ──────────────────────────────────────────────────────────────

const SOV_MAGIC = 0x534F5631; // "SOV1"
const SCEE_MAGIC = 0x53434545; // "SCEE"
const ENV_MAGIC = 0x53474154; // "SGAT" (Sovereign Gate)
const FRAME_COUNT = 60;
const FRAME_SIZE = 128;
const MAX_PAYLOAD_BYTES = 1024;

const CIPHER_REGISTRY = {
    0x01: { name: 'AES-256-GCM', keyLen: 256, ivLen: 12, tagLen: 16, wcName: 'AES-GCM' },
    0x02: { name: 'AES-128-GCM', keyLen: 128, ivLen: 12, tagLen: 16, wcName: 'AES-GCM' },
    0x03: { name: 'AES-256-CBC', keyLen: 256, ivLen: 16, tagLen: 0, wcName: 'AES-CBC' },
};

const KDF_REGISTRY = {
    0x01: { name: 'PBKDF2-SHA256', hash: 'SHA-256', type: 'PBKDF2' },
    0x02: { name: 'PBKDF2-SHA512', hash: 'SHA-512', type: 'PBKDF2' },
    0x03: { name: 'HKDF-SHA256', hash: 'SHA-256', type: 'HKDF' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const TE = new TextEncoder();
const TD = new TextDecoder();

const u16ToBytes = (n) => new Uint8Array([(n >> 8) & 0xFF, n & 0xFF]);
const bytesToU16 = (b, o = 0) => {
    if (!b || b.length < o + 2) return 0;
    return (b[o] << 8) | b[o + 1];
};
const u24ToBytes = (n) => new Uint8Array([(n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF]);
const bytesToU24 = (b, o = 0) => {
    if (!b || b.length < o + 3) return 0;
    return (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];
};
const u32ToBytes = (n) => {
    const a = new Uint8Array(4);
    new DataView(a.buffer).setUint32(0, n);
    return a;
};
const bytesToU32 = (b, o = 0) => {
    if (!b || b.length < o + 4) return 0;
    return new DataView(b.buffer, b.byteOffset + o).getUint32(0);
};

const concatU8 = (...arrays) => {
    const total = arrays.reduce((s, a) => s + (a instanceof Uint8Array ? a.length : 0), 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const a of arrays) {
        if (a instanceof Uint8Array) {
            out.set(a, off);
            off += a.length;
        }
    }
    return out;
};

const toB64u = (b) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const fromB64u = (s) => {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    return new Uint8Array([...atob(b64)].map(c => c.charCodeAt(0)));
};

function mulberry32(seed) {
    return () => {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

async function hashToU32(str) {
    if (globalThis.crypto?.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', TE.encode(str));
        return new DataView(buf).getUint32(0);
    }
    // Fallback for non-secure contexts
    let hash = 5381;
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i);
    return hash >>> 0;
}

// ─── Visual Engine ──────────────────────────────────────────────────────────

class TokenVisualEngine {
    constructor(canvas, seed, palette) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        this.seed = seed;
        this.rng = mulberry32(seed);
        this.palette = palette;
        this.t = 0;
        this.particles = [];
        this._initParticles();
        this._buildSigil();
    }

    _initParticles() {
        const count = 80 + Math.floor(this.rng() * 40);
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: this.rng() * FRAME_SIZE, y: this.rng() * FRAME_SIZE,
                vx: 0, vy: 0, life: this.rng(),
                speed: 0.3 + this.rng() * 0.7,
                size: 0.5 + this.rng() * 1.5,
                hueOffset: this.rng() * 60 - 30,
                phase: this.rng() * Math.PI * 2
            });
        }
    }

    _buildSigil() {
        const arms = 3 + Math.floor(this.rng() * 5);
        this.sigilArms = arms;
        this.sigilPoints = [];
        for (let i = 0; i < arms; i++) {
            const base = (i / arms) * Math.PI * 2;
            const r1 = 12 + this.rng() * 18, r2 = 5 + this.rng() * 10;
            const twist = (this.rng() - 0.5) * 0.8;
            this.sigilPoints.push({ base, r1, r2, twist });
        }
    }

    _flowAngle(x, y, t) {
        // Enhanced liquid-like flow field matching sovereign-token.js
        const nx = x / FRAME_SIZE * 4;
        const ny = y / FRAME_SIZE * 4;
        const centerDist = Math.sqrt((nx - 2) ** 2 + (ny - 2) ** 2);

        const baseFlow = (
            Math.sin(nx * 1.3 + t * 0.5) * Math.cos(ny * 0.9 - t * 0.3) * Math.PI +
            Math.sin(nx * 0.7 - ny * 1.1 + t * 0.2) * Math.PI * 0.5 +
            Math.sin(nx * 2.1 + ny * 1.7 + t * 0.3) * Math.PI * 0.3
        );

        const radialFlow = Math.atan2(ny - 2, nx - 2) + t * 0.4;
        const swirlStrength = Math.sin(centerDist * 0.8 - t * 0.6) * 0.4;
        const distanceWeight = Math.min(1, centerDist / 3);
        return baseFlow * (1 - distanceWeight * 0.3) + radialFlow * swirlStrength * distanceWeight;
    }

    _updateParticles() {
        const t = this.t * 0.02;
        for (const p of this.particles) {
            const angle = this._flowAngle(p.x, p.y, t);
            const accel = 0.25 + Math.sin(p.life * 5) * 0.1;
            p.vx = p.vx * 0.88 + Math.cos(angle) * p.speed * accel;
            p.vy = p.vy * 0.88 + Math.sin(angle) * p.speed * accel;
            p.vx += (this.rng() - 0.5) * 0.02;
            p.vy += (this.rng() - 0.5) * 0.02;
            p.x = (p.x + p.vx + FRAME_SIZE) % FRAME_SIZE;
            p.y = (p.y + p.vy + FRAME_SIZE) % FRAME_SIZE;
            p.life += 0.004 + Math.sin(p.life) * 0.002;
        }
    }

    _drawBackground(f) {
        const ctx = this.ctx, cx = FRAME_SIZE / 2, cy = FRAME_SIZE / 2;
        const norm = f / FRAME_COUNT;
        const timeShift = norm * Math.PI * 2;
        const [h1, h2, h3] = this.palette;
        const pulse = 1 + 0.05 * Math.sin(timeShift);
        const h1Shift = h1 + Math.sin(timeShift * 0.3) * 10;
        const h2Shift = h2 + Math.sin(timeShift * 0.5) * 8;
        const h3Shift = h3 + Math.sin(timeShift * 0.4) * 6;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, FRAME_SIZE * 0.9 * pulse);
        grad.addColorStop(0, `hsla(${h1Shift},85%,14%,1)`);
        grad.addColorStop(0.3, `hsla(${h2Shift},75%,10%,0.95)`);
        grad.addColorStop(0.7, `hsla(${h3Shift},65%,6%,0.9)`);
        grad.addColorStop(1, `hsla(${h3Shift},60%,3%,0.85)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, FRAME_SIZE, FRAME_SIZE);

        for (let i = 0; i < 3; i++) {
            const waveRadius = (FRAME_SIZE * 0.3) + Math.sin(timeShift + i * Math.PI * 0.6) * (FRAME_SIZE * 0.1);
            const waveGrad = ctx.createRadialGradient(cx, cy, waveRadius - 5, cx, cy, waveRadius + 5);
            waveGrad.addColorStop(0, `hsla(${h1Shift},70%,20%,0)`);
            waveGrad.addColorStop(0.5, `hsla(${h2Shift},60%,15%,0.15)`);
            waveGrad.addColorStop(1, `hsla(${h2Shift},60%,15%,0)`);
            ctx.fillStyle = waveGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, waveRadius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _drawParticles(f) {
        const ctx = this.ctx, [h1, h2] = this.palette, norm = f / FRAME_COUNT;
        const timeShift = norm * Math.PI * 2;
        for (const p of this.particles) {
            const lifeWave = p.life * Math.PI * 2 + norm * Math.PI;
            const alpha = 0.35 + 0.45 * Math.sin(lifeWave);
            const hue = h1 + p.hueOffset + norm * 40 + Math.sin(p.life * 3) * 15;
            const lum = 50 + 35 * Math.sin(p.phase + p.life * 4 + norm * Math.PI * 2);
            const glowSize = p.size * 2.5;
            const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
            glowGrad.addColorStop(0, `hsla(${hue},95%,${lum}%,${alpha * 0.8})`);
            glowGrad.addColorStop(0.5, `hsla(${hue + 20},85%,${lum + 10}%,${alpha * 0.3})`);
            glowGrad.addColorStop(1, `hsla(${hue + 40},75%,${lum + 20}%,0)`);
            ctx.beginPath();
            ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
            ctx.fillStyle = glowGrad;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${hue},95%,${lum}%,${alpha})`;
            ctx.fill();
            const trailX = p.x - p.vx * 2, trailY = p.y - p.vy * 2;
            if (trailX >= 0 && trailX < FRAME_SIZE && trailY >= 0 && trailY < FRAME_SIZE) {
                ctx.beginPath();
                ctx.arc(trailX, trailY, p.size * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${hue},90%,${lum}%,${alpha * 0.3})`;
                ctx.fill();
            }
        }
    }

    _drawSigil(f) {
        const ctx = this.ctx, cx = FRAME_SIZE / 2, cy = FRAME_SIZE / 2;
        const norm = f / FRAME_COUNT;
        const [h1, h2, h3] = this.palette;
        const timeShift = norm * Math.PI * 2;
        const pulse = 1 + 0.08 * Math.sin(timeShift) + 0.03 * Math.sin(timeShift * 3);
        const spin = norm * Math.PI * 0.5 + Math.sin(timeShift * 0.5) * 0.1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(spin);
        ctx.scale(pulse, pulse);
        for (let layer = 0; layer < 2; layer++) {
            const layerOffset = layer * 2;
            const rg = ctx.createRadialGradient(0, 0, 26 + layerOffset, 0, 0, 40 + layerOffset);
            const ringAlpha = 0.4 + 0.3 * Math.sin(timeShift + layer * Math.PI);
            rg.addColorStop(0, `hsla(${h1 + layer * 20},95%,75%,0)`);
            rg.addColorStop(0.4, `hsla(${h1 + layer * 20},95%,75%,${ringAlpha})`);
            rg.addColorStop(1, `hsla(${h1 + layer * 20},90%,70%,0)`);
            ctx.beginPath();
            ctx.arc(0, 0, 33 + layerOffset, 0, Math.PI * 2);
            ctx.strokeStyle = rg;
            ctx.lineWidth = 1.0 + layer * 0.3;
            ctx.stroke();
        }
        for (let i = 0; i < this.sigilPoints.length; i++) {
            const arm = this.sigilPoints[i];
            const armPhase = (i / this.sigilPoints.length) * Math.PI * 2;
            const a0 = arm.base + spin * arm.twist + Math.sin(timeShift + armPhase) * 0.2;
            const x1 = Math.cos(a0) * arm.r1, y1 = Math.sin(a0) * arm.r1;
            const a1 = a0 + Math.PI / this.sigilArms + Math.sin(timeShift * 2 + armPhase) * 0.15;
            const x2 = Math.cos(a1) * arm.r2, y2 = Math.sin(a1) * arm.r2;
            const hue = h1 + (norm * 50) + Math.sin(timeShift + armPhase) * 20;
            ctx.shadowBlur = 4;
            ctx.shadowColor = `hsla(${hue},90%,70%,0.6)`;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const cp1x = x1 * 0.7, cp1y = y1 * 0.7;
            ctx.bezierCurveTo(cp1x, cp1y, x1, y1, x2, y2);
            ctx.strokeStyle = `hsla(${hue},90%,70%,0.85)`;
            ctx.lineWidth = 1.0 + Math.sin(timeShift + armPhase) * 0.2;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        const corePulse = 1 + 0.15 * Math.sin(timeShift * 2);
        const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 10 * corePulse);
        cg.addColorStop(0, `hsla(${h2},100%,95%,1)`);
        cg.addColorStop(0.5, `hsla(${h2},100%,85%,0.8)`);
        cg.addColorStop(1, `hsla(${h3},95%,70%,0)`);
        ctx.beginPath();
        ctx.arc(0, 0, 8 * corePulse, 0, Math.PI * 2);
        ctx.fillStyle = cg;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${h2},100%,90%,0.4)`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
    }

    renderFrame(frameIndex) {
        this.t = frameIndex;
        this._updateParticles();
        this._drawBackground();
        this._drawParticles(frameIndex);
        this._drawSigil(frameIndex);
        return this.ctx.getImageData(0, 0, FRAME_SIZE, FRAME_SIZE);
    }
}

// ─── SDK Core ───────────────────────────────────────────────────────────────

export class SovereignSDK {

    static async createToken({ id, claims = {}, keyPair = null }) {
        const seed = await hashToU32(id || Math.random().toString());
        const kp = keyPair || await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
        const publicJwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
        const privateJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);

        const payload = { id, v: 1, claims, pub: publicJwk, iat: Date.now() };
        const payloadBytes = TE.encode(JSON.stringify(payload));

        const header = concatU8(u32ToBytes(SOV_MAGIC), u32ToBytes(payloadBytes.length), new Uint8Array(8));
        const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, concatU8(header, payloadBytes));
        const packet = concatU8(header, payloadBytes, new Uint8Array(signature));

        const palette = this._derivePalette(seed);
        let offscreen;
        if (globalThis.OffscreenCanvas) {
            offscreen = new OffscreenCanvas(FRAME_SIZE, FRAME_SIZE);
        } else {
            offscreen = document.createElement('canvas');
            offscreen.width = FRAME_SIZE;
            offscreen.height = FRAME_SIZE;
        }
        const engine = new TokenVisualEngine(offscreen, seed, palette);

        const bits = this._bytesToBits(packet);
        const bitsPerFrame = Math.ceil(bits.length / FRAME_COUNT);
        while (bits.length < bitsPerFrame * FRAME_COUNT) bits.push(0);

        const frames = [];
        for (let f = 0; f < FRAME_COUNT; f++) {
            const imgData = engine.renderFrame(f);
            const frameBits = bits.slice(f * bitsPerFrame, (f + 1) * bitsPerFrame);
            for (let i = 0; i < frameBits.length && i < imgData.data.length; i++) {
                imgData.data[i] = (imgData.data[i] & 0xFE) | frameBits[i];
            }
            frames.push(new Uint8ClampedArray(imgData.data));
        }

        return {
            id, seed, claims: payload, keyPair: kp, publicJwk, privateJwk, frames, palette,
            export: () => this._exportTokenBlob(frames)
        };
    }

    static async encrypt(content, passphrase, metaPassphrase, opts = {}) {
        const cipherId = opts.cipherId || 0x01;
        const kdfId = opts.kdfId || 0x01;
        const kdfIter = opts.kdfIter || 210_000;
        const cipher = CIPHER_REGISTRY[cipherId];

        const salt = crypto.getRandomValues(new Uint8Array(32));
        const iv = crypto.getRandomValues(new Uint8Array(cipher.ivLen));
        const adb = concatU8(new Uint8Array([cipherId, 0x01, kdfId]), u24ToBytes(kdfIter), new Uint8Array([iv.length, cipher.tagLen]), salt, iv, new Uint8Array(8));

        const metaSalt = crypto.getRandomValues(new Uint8Array(32));
        const metaIV = crypto.getRandomValues(new Uint8Array(12));
        const baseMeta = await crypto.subtle.importKey('raw', TE.encode(metaPassphrase), 'PBKDF2', false, ['deriveKey']);
        const metaKey = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: metaSalt, iterations: 100_000, hash: 'SHA-256' }, baseMeta, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
        const adbEnc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: metaIV, tagLength: 128 }, metaKey, adb));

        const commitment = new Uint8Array(await crypto.subtle.digest('SHA-256', concatU8(u32ToBytes(SCEE_MAGIC), adb, metaSalt)));
        const keyBytes = concatU8(u32ToBytes(SCEE_MAGIC), new Uint8Array([0x01]), metaSalt, metaIV, u16ToBytes(adbEnc.length), adbEnc, commitment);

        const rawKey = await this._deriveContentKey(passphrase, salt, kdfId, kdfIter, cipher.keyLen);
        const contentKey = await crypto.subtle.importKey('raw', rawKey, { name: cipher.wcName, length: cipher.keyLen }, false, ['encrypt']);
        const pt = typeof content === 'string' ? TE.encode(content) : content;
        const ct = new Uint8Array(await crypto.subtle.encrypt({ name: cipher.wcName === 'AES-GCM' ? 'AES-GCM' : cipher.wcName, iv, tagLength: 128 }, contentKey, pt));

        const envelope = concatU8(u32ToBytes(ENV_MAGIC), commitment, u32ToBytes(ct.length), ct);
        return { envelope: toB64u(envelope), key: toB64u(keyBytes) };
    }

    static async decrypt(envelopeStr, keyStr, passphrase, metaPassphrase) {
        if (!envelopeStr || !keyStr) throw new Error('Missing envelope or key');
        const env = fromB64u(envelopeStr);
        const key = fromB64u(keyStr);

        if (env.length < 40) throw new Error('Envelope too short');
        if (key.length < 4) throw new Error('Key too short');

        if (bytesToU32(env, 0) !== ENV_MAGIC) throw new Error('Invalid envelope');
        if (bytesToU32(key, 0) !== SCEE_MAGIC) throw new Error('Invalid key');

        let o = 5;
        const mSalt = key.slice(o, o + 32); o += 32;
        const mIV = key.slice(o, o + 12); o += 12;
        const adbLen = bytesToU16(key, o); o += 2;
        const adbEnc = key.slice(o, o + adbLen); o += adbLen;
        const cmt = key.slice(o, o + 32);

        if (!this._timingSafeEqual(cmt, env.slice(4, 36))) throw new Error('Commitment mismatch');

        const baseMeta = await crypto.subtle.importKey('raw', TE.encode(metaPassphrase), 'PBKDF2', false, ['deriveKey']);
        const metaKey = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: mSalt, iterations: 100_000, hash: 'SHA-256' }, baseMeta, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
        const adb = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: mIV, tagLength: 128 }, metaKey, adbEnc));

        const adbParsed = this._parseADB(adb);
        const cipher = CIPHER_REGISTRY[adbParsed.cipherId];
        const rawKey = await this._deriveContentKey(passphrase, adbParsed.salt, adbParsed.kdfId, adbParsed.kdfIter, cipher.keyLen);
        const contentKey = await crypto.subtle.importKey('raw', rawKey, { name: cipher.wcName, length: cipher.keyLen }, false, ['decrypt']);

        const ctLen = bytesToU32(env, 36);
        if (env.length < 40 + ctLen) throw new Error('Envelope truncated');
        const ct = env.slice(40, 40 + ctLen);
        const pt = await crypto.subtle.decrypt({ name: cipher.wcName === 'AES-GCM' ? 'AES-GCM' : cipher.wcName, iv: adbParsed.iv, tagLength: 128 }, contentKey, ct);
        return TD.decode(pt);
    }

    static async _deriveContentKey(pass, salt, kdfId, iter, len) {
        const kdf = KDF_REGISTRY[kdfId];
        const base = await crypto.subtle.importKey('raw', TE.encode(pass), kdf.type, false, ['deriveBits']);
        return new Uint8Array(await crypto.subtle.deriveBits(kdf.type === 'PBKDF2' ? { name: 'PBKDF2', salt, iterations: iter, hash: kdf.hash } : { name: 'HKDF', salt, hash: kdf.hash, info: TE.encode('Sovereign-v1') }, base, len));
    }

    static _derivePalette(seed) {
        const rng = mulberry32(seed);
        const h1 = Math.floor(rng() * 360);
        const h2 = (h1 + 120 + Math.floor(rng() * 60)) % 360;
        const h3 = (h2 + 120 + Math.floor(rng() * 60)) % 360;
        return [h1, h2, h3];
    }

    static _bytesToBits(bytes) {
        const bits = [];
        for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
        return bits;
    }

    static _exportTokenBlob(frames) {
        const out = new Uint8Array(8 + frames.length * FRAME_SIZE * FRAME_SIZE * 4);
        new DataView(out.buffer).setUint32(0, frames.length);
        new DataView(out.buffer).setUint32(4, FRAME_SIZE);
        let off = 8;
        for (const f of frames) { out.set(f, off); off += f.length; }
        return out;
    }

    static _parseADB(b) {
        return { cipherId: b[0], kdfId: b[2], kdfIter: bytesToU24(b, 3), salt: b.slice(7, 39), iv: b.slice(39, 39 + b[6]) };
    }

    static _timingSafeEqual(a, b) {
        if (a.length !== b.length) return false;
        let r = 0; for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
        return r === 0;
    }

    /**
     * Intercepts and signs outgoing fetch requests with the user's Sovereign Identity.
     * Appends the `X-Sovereign-Signature`, `X-Sovereign-Id`, and `X-Sovereign-Timestamp` headers.
     * @param {RequestInit} fetchOptions - The fetch options object (must have headers defined)
     * @param {Object} token - The loaded Sovereign Token Identity object containing the keyPair
     */
    static async intercept(fetchOptions, token) {
        if (!token || !token.keyPair || !token.keyPair.privateKey) return;

        const timestamp = Date.now().toString();
        const method = fetchOptions.method || 'GET';
        // Note: the URL path isn't natively in RequestInit, so we assume the backend 
        // will verify based on Payload + Timestamp for now, or the caller must attach `url`
        const payloadStr = fetchOptions.body || '';

        const messageToSign = TE.encode(timestamp + method + payloadStr);
        const signatureBuffer = await crypto.subtle.sign(
            { name: 'ECDSA', hash: 'SHA-256' },
            token.keyPair.privateKey,
            messageToSign
        );

        const signatureBase64 = _utils_toB64u(new Uint8Array(signatureBuffer));

        fetchOptions.headers = {
            ...fetchOptions.headers,
            'X-Sovereign-Id': token.id,
            'X-Sovereign-Timestamp': timestamp,
            'X-Sovereign-Signature': signatureBase64
        };
    }
}

// Internal util referenced above
const _utils_toB64u = (b) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

export class TokenRenderer {
    constructor(canvas, seed, palette, state = 'locked') {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        this.seed = seed;
        this.palette = palette;
        this.state = state;
        this.t = 0;
        this.engine = new TokenVisualEngine(canvas, seed, palette);
        this._raf = null;
        this._progress = 0;
    }

    setState(s) { this.state = s; this._progress = 0; }

    start() {
        const tick = () => {
            this._raf = requestAnimationFrame(tick);
            this._progress = Math.min(1, this._progress + 0.03);
            this.engine.renderFrame(this.t % FRAME_COUNT);
            this._drawOverlay();
            this.t++;
        };
        this._raf = requestAnimationFrame(tick);
    }

    stop() { if (this._raf) cancelAnimationFrame(this._raf); }

    _drawOverlay() {
        const ctx = this.ctx, S = FRAME_SIZE, cx = S / 2, cy = S / 2, p = this._progress;
        ctx.save();
        ctx.translate(cx, cy);
        if (this.state === 'locked') {
            ctx.fillStyle = `rgba(0,0,0,${0.4 * (1 - p)})`;
            ctx.fillRect(-cx, -cy, S, S);
        } else if (this.state === 'unlocking') {
            ctx.beginPath(); ctx.arc(0, 0, 10, this.t * 0.1, this.t * 0.1 + Math.PI * 1.5);
            ctx.strokeStyle = `rgba(255,200,80,${0.8 * p})`; ctx.lineWidth = 2; ctx.stroke();
        } else if (this.state === 'unlocked') {
            ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-1, 5); ctx.lineTo(7, -5);
            ctx.strokeStyle = `rgba(100,255,160,${p})`; ctx.lineWidth = 3; ctx.stroke();
        }
        ctx.restore();
    }
}
