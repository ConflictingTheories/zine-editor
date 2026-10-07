/**
 * 4D Sovereign Privacy Token
 * ===========================
 * A self-sovereign identity token system that encodes signed credential data
 * steganographically across animated canvas frames (x, y, color channel, time = 4D).
 *
 * Architecture:
 *  - Key generation: ECDSA P-256 via Web Crypto API
 *  - Steganography: LSB encoding across RGBA channels of animation frames
 *  - Visual layer: Deterministic liquid/flow animation seeded from identity hash
 *  - Token format: [HEADER(16B) | PAYLOAD(nB) | SIGNATURE(64B)] packed into frames
 *
 * Usage:
 *   const token = await SovereignToken.create({ name: 'alice', claims: {...} });
 *   token.mount('#container');
 *   const blob = await token.export();       // Uint8Array of all frames' RGBA
 *   const verified = await SovereignToken.verify(blob, publicKeyJwk);
 */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAGIC = 0x534F5631; // "SOV1"
const FRAME_COUNT = 60;   // animation frames (the T dimension)
const FRAME_SIZE = 128;   // px per side
const BITS_PER_CHANNEL = 1; // LSB steganography depth
const MAX_PAYLOAD_BYTES = 512;

// ─── Utility helpers ──────────────────────────────────────────────────────────

/** Encode arbitrary bytes into LSBs of a flat RGBA Uint8ClampedArray */
function stegEncode(imageData, bytes) {
  const bits = bytesToBits(bytes);
  if (bits.length > imageData.length) throw new Error('Payload too large for carrier');
  for (let i = 0; i < bits.length; i++) {
    imageData[i] = (imageData[i] & 0xFE) | bits[i];
  }
  return imageData;
}

/** Extract LSB-encoded bytes from a flat RGBA Uint8ClampedArray */
function stegDecode(imageData, byteCount) {
  const bits = [];
  for (let i = 0; i < byteCount * 8; i++) bits.push(imageData[i] & 1);
  return bitsToBytes(bits);
}

function bytesToBits(bytes) {
  const bits = [];
  for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  return bits;
}

function bitsToBytes(bits) {
  // Ensure bits is an array and pad to multiple of 8 if needed
  const bitArray = Array.isArray(bits) ? bits : Array.from(bits);
  const paddedLength = Math.ceil(bitArray.length / 8) * 8;
  const paddedBits = [...bitArray];
  while (paddedBits.length < paddedLength) paddedBits.push(0);
  
  const bytes = new Uint8Array(paddedBits.length / 8);
  for (let i = 0; i < bytes.length; i++) {
    let v = 0;
    for (let j = 0; j < 8; j++) {
      const bitIndex = i * 8 + j;
      if (bitIndex < paddedBits.length) {
        v = (v << 1) | (paddedBits[bitIndex] & 1);
      }
    }
    bytes[i] = v;
  }
  return bytes;
}

function concatUint8(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

function u32ToBytes(n) {
  return new Uint8Array([(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF]);
}

function bytesToU32(b, o = 0) {
  return (b[o] << 24 | b[o+1] << 16 | b[o+2] << 8 | b[o+3]) >>> 0;
}

/** Simple seeded PRNG (mulberry32) for deterministic visual generation */
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Hash a string to a 32-bit seed */
async function hashSeed(str) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return new DataView(buf).getUint32(0);
}

// ─── Crypto helpers ───────────────────────────────────────────────────────────

async function generateKeyPair() {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
}

async function signBytes(privateKey, data) {
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, data);
  return new Uint8Array(sig); // 64 bytes for P-256
}

async function verifyBytes(publicKeyJwk, data, signature) {
  const pubKey = await crypto.subtle.importKey(
    'jwk', publicKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['verify']
  );
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, signature, data);
}

async function exportPublicJwk(keyPair) {
  return crypto.subtle.exportKey('jwk', keyPair.publicKey);
}

async function exportPrivateJwk(keyPair) {
  return crypto.subtle.exportKey('jwk', keyPair.privateKey);
}

// ─── Token Packet Format ─────────────────────────────────────────────────────
/*
 Packet layout (packed into frame LSBs across FRAME_COUNT frames):

 Bytes  Field
 ─────────────────────────────────
 0-3    MAGIC (0x534F5631)
 4-7    payload_length (u32 BE)
 8-15   reserved / version / flags
 16 ... payload (UTF-8 JSON, max 512B)
 ...+64 ECDSA-P256 signature over bytes 0..header+payload
*/

function buildPacket(payloadBytes, signature) {
  const header = concatUint8(
    u32ToBytes(MAGIC),
    u32ToBytes(payloadBytes.length),
    new Uint8Array(8) // reserved
  );
  return concatUint8(header, payloadBytes, signature);
}

function parsePacket(bytes) {
  if (bytesToU32(bytes, 0) !== MAGIC) throw new Error('Invalid magic bytes');
  const payloadLen = bytesToU32(bytes, 4);
  const headerLen = 16;
  const payload = bytes.slice(headerLen, headerLen + payloadLen);
  const sig = bytes.slice(headerLen + payloadLen, headerLen + payloadLen + 64);
  const signed = bytes.slice(0, headerLen + payloadLen);
  return { payload, sig, signed };
}

// ─── Visual Engine ────────────────────────────────────────────────────────────
/*
 Each token's visual is a deterministic animated "liquid sigil":
  - Background: deep gradient derived from identity hash palette
  - Flow field: Perlin-like noise field (approximated with sin/cos) seeded by identity
  - Particles: 80-120 luminous particles following the flow field
  - Core: central mandala/sigil glyph composed of bezier arcs, seed-derived
  - Shimmer: subtle HSL color cycling that gives the holographic effect
*/

class TokenVisualEngine {
  constructor(canvas, seed, palette, customization = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.palette = palette;
    this.customization = customization;
    this.t = 0;
    this.particles = [];
    this._initParticles();
    this._buildSigil();
  }

  _initParticles() {
    const baseCount = this.customization.particleCount || (80 + Math.floor(this.rng() * 40));
    const count = Math.max(20, Math.min(200, baseCount)); // Clamp between 20-200
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: this.rng() * FRAME_SIZE,
        y: this.rng() * FRAME_SIZE,
        vx: 0, vy: 0,
        life: this.rng(),
        speed: 0.3 + this.rng() * 0.7,
        size: 0.5 + this.rng() * 1.5,
        hueOffset: this.rng() * 60 - 30,
      });
    }
  }

  _buildSigil() {
    // Generate a set of bezier control points for the sigil
    const baseArms = this.customization.sigilArms || (3 + Math.floor(this.rng() * 5));
    const arms = Math.max(2, Math.min(12, baseArms)); // Clamp between 2-12
    this.sigilArms = arms;
    this.sigilPoints = [];
    for (let i = 0; i < arms; i++) {
      const base = (i / arms) * Math.PI * 2;
      const r1 = 12 + this.rng() * 18;
      const r2 = 5 + this.rng() * 10;
      const twist = (this.rng() - 0.5) * 0.8;
      this.sigilPoints.push({ base, r1, r2, twist });
    }
  }

  _flowAngle(x, y, t) {
    // Enhanced liquid-like flow field with multiple harmonics for organic movement
    const speedMult = this.customization.animationSpeed || 1.0;
    const nx = x / FRAME_SIZE * 4;
    const ny = y / FRAME_SIZE * 4;
    const centerDist = Math.sqrt((nx - 2) ** 2 + (ny - 2) ** 2);
    
    // Base flow with multiple frequencies for complexity
    const baseFlow = (
      Math.sin(nx * 1.3 + t * 0.5 * speedMult) * Math.cos(ny * 0.9 - t * 0.3 * speedMult) * Math.PI +
      Math.sin(nx * 0.7 - ny * 1.1 + t * 0.2 * speedMult) * Math.PI * 0.5 +
      Math.sin(nx * 2.1 + ny * 1.7 + t * 0.3 * speedMult) * Math.PI * 0.3
    );
    
    // Add radial component for swirling liquid effect
    const radialFlow = Math.atan2(ny - 2, nx - 2) + t * 0.4 * speedMult;
    const swirlStrength = Math.sin(centerDist * 0.8 - t * 0.6 * speedMult) * 0.4;
    
    // Combine flows with distance-based weighting
    const distanceWeight = Math.min(1, centerDist / 3);
    return baseFlow * (1 - distanceWeight * 0.3) + radialFlow * swirlStrength * distanceWeight;
  }

  _updateParticles() {
    const speedMult = this.customization.animationSpeed || 1.0;
    const t = this.t * 0.02 * speedMult;
    for (const p of this.particles) {
      const angle = this._flowAngle(p.x, p.y, t);
      // More fluid acceleration with momentum preservation
      const accel = 0.25 + Math.sin(p.life * 5) * 0.1;
      p.vx = p.vx * 0.88 + Math.cos(angle) * p.speed * accel;
      p.vy = p.vy * 0.88 + Math.sin(angle) * p.speed * accel;
      
      // Add subtle random drift for organic feel
      p.vx += (this.rng() - 0.5) * 0.02;
      p.vy += (this.rng() - 0.5) * 0.02;
      
      p.x += p.vx;
      p.y += p.vy;
      p.life += 0.004 + Math.sin(p.life) * 0.002;
      
      // Smooth wrapping with fade effect at edges
      if (p.x < 0) { p.x += FRAME_SIZE; p.vx *= 0.8; }
      if (p.x >= FRAME_SIZE) { p.x -= FRAME_SIZE; p.vx *= 0.8; }
      if (p.y < 0) { p.y += FRAME_SIZE; p.vy *= 0.8; }
      if (p.y >= FRAME_SIZE) { p.y -= FRAME_SIZE; p.vy *= 0.8; }
    }
  }

  _drawBackground(t) {
    const ctx = this.ctx;
    const cx = FRAME_SIZE / 2, cy = FRAME_SIZE / 2;
    const norm = t / FRAME_COUNT;
    const [h1, h2, h3] = this.palette;
    
    // More dynamic, liquid-like background with subtle animation
    const timeShift = norm * Math.PI * 2;
    const pulse = 1 + 0.05 * Math.sin(timeShift);
    
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, FRAME_SIZE * 0.9 * pulse);
    const h1Shift = h1 + Math.sin(timeShift * 0.3) * 10;
    const h2Shift = h2 + Math.sin(timeShift * 0.5) * 8;
    const h3Shift = h3 + Math.sin(timeShift * 0.4) * 6;
    
    grad.addColorStop(0,   `hsla(${h1Shift}, 85%, 14%, 1)`);
    grad.addColorStop(0.3, `hsla(${h2Shift}, 75%, 10%, 0.95)`);
    grad.addColorStop(0.7, `hsla(${h3Shift}, 65%, 6%, 0.9)`);
    grad.addColorStop(1,   `hsla(${h3Shift}, 60%, 3%, 0.85)`);
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FRAME_SIZE, FRAME_SIZE);
    
    // Add subtle radial waves for liquid effect
    for (let i = 0; i < 3; i++) {
      const waveRadius = (FRAME_SIZE * 0.3) + Math.sin(timeShift + i * Math.PI * 0.6) * (FRAME_SIZE * 0.1);
      const waveGrad = ctx.createRadialGradient(cx, cy, waveRadius - 5, cx, cy, waveRadius + 5);
      waveGrad.addColorStop(0, `hsla(${h1Shift}, 70%, 20%, 0)`);
      waveGrad.addColorStop(0.5, `hsla(${h2Shift}, 60%, 15%, 0.15)`);
      waveGrad.addColorStop(1, `hsla(${h2Shift}, 60%, 15%, 0)`);
      ctx.fillStyle = waveGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, waveRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawParticles(t) {
    const ctx = this.ctx;
    const [h1, h2] = this.palette;
    const norm = t / FRAME_COUNT;
    const timeShift = norm * Math.PI * 2;
    
    for (const p of this.particles) {
      // More fluid, organic particle movement with trailing effect
      const lifeWave = p.life * Math.PI * 2 + norm * Math.PI;
      const alpha = 0.35 + 0.45 * Math.sin(lifeWave);
      const hue = h1 + p.hueOffset + norm * 40 + Math.sin(p.life * 3) * 15;
      const lightness = 50 + 35 * Math.sin(p.life * 4 + norm * Math.PI * 2);
      
      // Add glow/halo effect for holographic look
      const glowSize = p.size * 2.5;
      const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
      glowGrad.addColorStop(0, `hsla(${hue}, 95%, ${lightness}%, ${alpha * 0.8})`);
      glowGrad.addColorStop(0.5, `hsla(${hue + 20}, 85%, ${lightness + 10}%, ${alpha * 0.3})`);
      glowGrad.addColorStop(1, `hsla(${hue + 40}, 75%, ${lightness + 20}%, 0)`);
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();
      
      // Core particle
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 95%, ${lightness}%, ${alpha})`;
      ctx.fill();
      
      // Add subtle trail for flow effect
      const trailX = p.x - p.vx * 2;
      const trailY = p.y - p.vy * 2;
      if (trailX >= 0 && trailX < FRAME_SIZE && trailY >= 0 && trailY < FRAME_SIZE) {
        ctx.beginPath();
        ctx.arc(trailX, trailY, p.size * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 90%, ${lightness}%, ${alpha * 0.3})`;
        ctx.fill();
      }
    }
  }

  _drawSigil(t) {
    const ctx = this.ctx;
    const cx = FRAME_SIZE / 2, cy = FRAME_SIZE / 2;
    const norm = t / FRAME_COUNT;
    const [h1, h2, h3] = this.palette;
    const timeShift = norm * Math.PI * 2;
    
    // More dynamic, flowing pulse and rotation
    const pulse = 1 + 0.08 * Math.sin(timeShift) + 0.03 * Math.sin(timeShift * 3);
    const spin = norm * Math.PI * 0.5 + Math.sin(timeShift * 0.5) * 0.1;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    ctx.scale(pulse, pulse);

    // Enhanced outer ring with multiple layers for depth
    for (let layer = 0; layer < 2; layer++) {
      const layerOffset = layer * 2;
      const ringGrad = ctx.createRadialGradient(0, 0, 26 + layerOffset, 0, 0, 40 + layerOffset);
      const ringAlpha = 0.4 + 0.3 * Math.sin(timeShift + layer * Math.PI);
      ringGrad.addColorStop(0, `hsla(${h1 + layer * 20}, 95%, 75%, 0)`);
      ringGrad.addColorStop(0.4, `hsla(${h1 + layer * 20}, 95%, 75%, ${ringAlpha})`);
      ringGrad.addColorStop(1, `hsla(${h1 + layer * 20}, 90%, 70%, 0)`);
      ctx.beginPath();
      ctx.arc(0, 0, 33 + layerOffset, 0, Math.PI * 2);
      ctx.strokeStyle = ringGrad;
      ctx.lineWidth = 1.0 + layer * 0.3;
      ctx.stroke();
    }

    // Sigil arms with flowing, liquid-like curves
    for (let i = 0; i < this.sigilPoints.length; i++) {
      const arm = this.sigilPoints[i];
      const armPhase = (i / this.sigilPoints.length) * Math.PI * 2;
      const a0 = arm.base + spin * arm.twist + Math.sin(timeShift + armPhase) * 0.2;
      
      const x1 = Math.cos(a0) * arm.r1;
      const y1 = Math.sin(a0) * arm.r1;
      const a1 = a0 + Math.PI / this.sigilArms + Math.sin(timeShift * 2 + armPhase) * 0.15;
      const x2 = Math.cos(a1) * arm.r2;
      const y2 = Math.sin(a1) * arm.r2;
      
      // Dynamic hue shift for holographic effect
      const hue = h1 + (norm * 50) + Math.sin(timeShift + armPhase) * 20;
      
      // Add glow around sigil lines
      ctx.shadowBlur = 4;
      ctx.shadowColor = `hsla(${hue}, 90%, 70%, 0.6)`;
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      // Use bezier curve for smoother, more liquid flow
      const cp1x = x1 * 0.7;
      const cp1y = y1 * 0.7;
      ctx.bezierCurveTo(cp1x, cp1y, x1, y1, x2, y2);
      ctx.strokeStyle = `hsla(${hue}, 90%, 70%, 0.85)`;
      ctx.lineWidth = 1.0 + Math.sin(timeShift + armPhase) * 0.2;
      ctx.lineCap = 'round';
      ctx.stroke();
      
      ctx.shadowBlur = 0;
    }

    // Enhanced inner core with pulsing effect
    const corePulse = 1 + 0.15 * Math.sin(timeShift * 2);
    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 10 * corePulse);
    coreGrad.addColorStop(0, `hsla(${h2}, 100%, 95%, 1)`);
    coreGrad.addColorStop(0.5, `hsla(${h2}, 100%, 85%, 0.8)`);
    coreGrad.addColorStop(1, `hsla(${h3}, 95%, 70%, 0)`);
    ctx.beginPath();
    ctx.arc(0, 0, 8 * corePulse, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();
    
    // Add inner ring for depth
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${h2}, 100%, 90%, 0.4)`;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.restore();
  }

  renderFrame(frameIndex) {
    this.t = frameIndex;
    this._updateParticles();
    this._drawBackground(frameIndex);
    this._drawParticles(frameIndex);
    this._drawSigil(frameIndex);
    return this.ctx.getImageData(0, 0, FRAME_SIZE, FRAME_SIZE);
  }
}

// ─── Derive palette from identity ────────────────────────────────────────────

function derivePalette(seed) {
  const rng = mulberry32(seed);
  const h1 = Math.floor(rng() * 360);
  const h2 = (h1 + 120 + Math.floor(rng() * 60)) % 360;
  const h3 = (h2 + 120 + Math.floor(rng() * 60)) % 360;
  return [h1, h2, h3];
}

// ─── Main API ─────────────────────────────────────────────────────────────────

class SovereignToken {
  constructor({ keyPair, publicJwk, claims, seed, palette, frames }) {
    this.keyPair = keyPair;
    this.publicJwk = publicJwk;
    this.claims = claims;
    this.seed = seed;
    this.palette = palette;
    this.frames = frames; // Array<Uint8ClampedArray> - rendered pixel data
    this._raf = null;
    this._currentFrame = 0;
  }

  /**
   * Create a new SovereignToken from identity info and claims.
   * @param {Object} opts
   * @param {string} opts.id       - identity string (username, DID, etc.)
   * @param {Object} opts.claims   - arbitrary credential claims to embed
   * @param {CryptoKeyPair} [opts.keyPair] - existing key pair; generates new if omitted
   * @param {Object} [opts.customization] - Visual customization options
   * @param {number[]} [opts.customization.palette] - Override palette [h1, h2, h3] in HSL hue degrees (0-360)
   * @param {number} [opts.customization.particleCount] - Override particle count (default: 80-120)
   * @param {number} [opts.customization.sigilArms] - Override sigil arm count (default: 3-8)
   * @param {number} [opts.customization.animationSpeed] - Animation speed multiplier (default: 1.0)
   * @returns {Promise<SovereignToken>}
   */
  static async create({ id, claims = {}, keyPair: existingKP, customization = {} } = {}) {
    const seed = await hashSeed(id || Math.random().toString());
    // Allow palette override while maintaining determinism
    const palette = customization.palette || derivePalette(seed);
    const keyPair = existingKP || await generateKeyPair();
    const publicJwk = await exportPublicJwk(keyPair);

    // Build payload
    const payload = { id, claims, publicKey: publicJwk, iat: Date.now() };
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    if (payloadBytes.length > MAX_PAYLOAD_BYTES) throw new Error('Claims payload too large (max 512B)');

    // Sign header+payload
    const headerBytes = concatUint8(u32ToBytes(MAGIC), u32ToBytes(payloadBytes.length), new Uint8Array(8));
    const toBeSigned = concatUint8(headerBytes, payloadBytes);
    const signature = await signBytes(keyPair.privateKey, toBeSigned);
    const packet = buildPacket(payloadBytes, signature);

    // Render frames and encode packet steganographically
    const offscreen = new OffscreenCanvas(FRAME_SIZE, FRAME_SIZE);
    const engine = new TokenVisualEngine(offscreen, seed, palette, customization);
    const frames = [];

    // Spread packet bits across all frames (distributes data across T dimension)
    const packetBits = bytesToBits(packet);
    const totalBits = packetBits.length;
    const bitsPerFrame = Math.ceil(totalBits / FRAME_COUNT);
    const totalEncodedBits = bitsPerFrame * FRAME_COUNT;
    
    // Pad packet bits to fill all frames evenly
    const paddedBits = [...packetBits];
    while (paddedBits.length < totalEncodedBits) paddedBits.push(0);

    for (let f = 0; f < FRAME_COUNT; f++) {
      const imgData = engine.renderFrame(f);
      const frameStart = f * bitsPerFrame;
      const frameEnd = Math.min(frameStart + bitsPerFrame, totalEncodedBits);
      const frameBits = paddedBits.slice(frameStart, frameEnd);
      
      // Encode into LSBs of RGBA channels
      for (let i = 0; i < frameBits.length && i < imgData.data.length; i++) {
        imgData.data[i] = (imgData.data[i] & 0xFE) | frameBits[i];
      }
      frames.push(new Uint8ClampedArray(imgData.data));
    }

    return new SovereignToken({ keyPair, publicJwk, claims: payload, seed, palette, frames });
  }

  /**
   * Export a Uint8Array blob of all frames for storage/transport.
   * Format: [frameCount(4B)][frameSize(4B)][frame0...frameN]
   */
  export() {
    const frameBytes = FRAME_SIZE * FRAME_SIZE * 4;
    const out = new Uint8Array(8 + frameBytes * FRAME_COUNT);
    new DataView(out.buffer).setUint32(0, FRAME_COUNT);
    new DataView(out.buffer).setUint32(4, FRAME_SIZE);
    let off = 8;
    for (const frame of this.frames) { out.set(frame, off); off += frameBytes; }
    return out;
  }

  /**
   * Get the public key JWK for sharing with verifiers.
   */
  getPublicKey() { return this.publicJwk; }

  /**
   * Get private key JWK (for secure storage by owner).
   */
  async getPrivateKey() { return exportPrivateJwk(this.keyPair); }

  /**
   * Mount the animated token onto a DOM element (by selector or element).
   * @param {string|HTMLElement} target
   * @param {Object} [opts]
   * @param {number} [opts.size=FRAME_SIZE] - display size in px
   * @param {number} [opts.fps=30]
   */
  mount(target, { size = FRAME_SIZE, fps = 30 } = {}) {
    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) throw new Error(`Target not found: ${target}`);

    // Stop any existing animation
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = FRAME_SIZE;
    canvas.height = FRAME_SIZE;
    canvas.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;display:block;`;
    container.innerHTML = '';
    container.appendChild(canvas);

    if (!this.frames || this.frames.length === 0) {
      throw new Error('Token has no frames. Cannot mount.');
    }

    const ctx = canvas.getContext('2d');
    let frame = 0;
    let last = 0;
    const interval = 1000 / fps;
    const frameCount = this.frames.length;

    const tick = (now) => {
      this._raf = requestAnimationFrame(tick);
      if (now - last < interval) return;
      last = now;
      
      const frameData = this.frames[frame];
      if (frameData && frameData.length === FRAME_SIZE * FRAME_SIZE * 4) {
        const imgData = new ImageData(new Uint8ClampedArray(frameData), FRAME_SIZE, FRAME_SIZE);
        ctx.putImageData(imgData, 0, 0);
      }
      frame = (frame + 1) % frameCount;
    };
    this._raf = requestAnimationFrame(tick);
    return () => {
      if (this._raf) {
        cancelAnimationFrame(this._raf);
        this._raf = null;
      }
    };
  }

  /** Stop animation */
  unmount() { 
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  // ─── Static: Verify ─────────────────────────────────────────────────────────

  /**
   * Verify and decode a token blob.
   * @param {Uint8Array} blob       - output of token.export()
   * @param {Object} [publicJwk]   - if provided, verifies against this key.
   *                                  If omitted, uses the key embedded in the payload.
   * @returns {Promise<{valid: boolean, claims: Object}>}
   */
  static async verify(blob, publicJwk) {
    const view = new DataView(blob.buffer, blob.byteOffset);
    const frameCount = view.getUint32(0);
    const frameSize  = view.getUint32(4);
    const frameBytes = frameSize * frameSize * 4;

    if (frameCount !== FRAME_COUNT || frameSize !== FRAME_SIZE) {
      return { valid: false, claims: null, error: 'Invalid frame dimensions' };
    }

    // Extract LSBs from all frames and reassemble (matching encoding logic)
    // Calculate bits per frame the same way as encoding
    const maxPacketBytes = MAX_PAYLOAD_BYTES + 16 + 64; // header + payload + signature
    const maxPacketBits = maxPacketBytes * 8;
    const bitsPerFrame = Math.ceil(maxPacketBits / FRAME_COUNT);
    const totalEncodedBits = bitsPerFrame * FRAME_COUNT;
    
    const allBits = [];
    for (let f = 0; f < frameCount; f++) {
      const off = 8 + f * frameBytes;
      const frameStart = f * bitsPerFrame;
      const frameEnd = Math.min(frameStart + bitsPerFrame, totalEncodedBits);
      const bitsToExtract = frameEnd - frameStart;
      
      for (let i = 0; i < bitsToExtract && i < frameBytes; i++) {
        allBits.push(blob[off + i] & 1);
      }
    }

    // Convert bits to bytes - extract enough to read header first
    // Header is 16 bytes: MAGIC(4) + payloadLen(4) + reserved(8)
    const headerBits = 16 * 8;
    if (allBits.length < headerBits) {
      return { valid: false, claims: null, error: 'Insufficient data to read header' };
    }
    
    const headerBytes = bitsToBytes(allBits.slice(0, headerBits));
    
    // Parse header to get payload length
    if (bytesToU32(headerBytes, 0) !== MAGIC) {
      return { valid: false, claims: null, error: 'Invalid magic bytes' };
    }
    
    const payloadLen = bytesToU32(headerBytes, 4);
    if (payloadLen > MAX_PAYLOAD_BYTES) {
      return { valid: false, claims: null, error: 'Payload length exceeds maximum' };
    }
    
    // Calculate total packet size: header(16) + payload(n) + signature(64)
    const totalPacketBytes = 16 + payloadLen + 64;
    const totalPacketBits = totalPacketBytes * 8;
    
    if (allBits.length < totalPacketBits) {
      return { valid: false, claims: null, error: 'Insufficient data to read complete packet' };
    }
    
    // Extract complete packet
    const packetBits = allBits.slice(0, totalPacketBits);
    const packetBytes = bitsToBytes(packetBits);

    let parsed;
    try { 
      parsed = parsePacket(packetBytes);
    } catch (e) { 
      return { valid: false, claims: null, error: e.message }; 
    }

    try {
      const payload = JSON.parse(new TextDecoder().decode(parsed.payload));
      const keyToUse = publicJwk || payload.publicKey;
      if (!keyToUse) return { valid: false, claims: payload, error: 'No public key' };

      const valid = await verifyBytes(keyToUse, parsed.signed, parsed.sig);
      return { valid, claims: payload };
    } catch (e) {
      return { valid: false, claims: null, error: e.message };
    }
  }

  // ─── Static: Delegate (split token) ─────────────────────────────────────────

  /**
   * Create a delegated sub-token ("Tulpa split") with reduced claims and scoped permissions.
   * The sub-token is signed by the original key and embeds a reference to the parent.
   * This allows splitting your identity token into smaller, purpose-specific tokens
   * that can be shared without exposing your full identity.
   * @param {Object} delegation
   * @param {string[]} delegation.allowedClaims - subset of claim keys to expose
   * @param {string}   delegation.purpose       - what this delegate is for (e.g., 'read-only', 'preview')
   * @param {number}   [delegation.ttl]         - expiry ms from now (null = never expires)
   * @returns {Promise<SovereignToken>} A new token instance representing the delegated token
   */
  async delegate({ allowedClaims = [], purpose = 'delegation', ttl }) {
    // Extract only allowed claims from the original token
    const subClaims = {};
    const originalClaims = this.claims.claims || {};
    for (const k of allowedClaims) {
      if (originalClaims[k] !== undefined) {
        subClaims[k] = originalClaims[k];
      }
    }
    
    // Create delegated token with parent reference
    const delegatedToken = await SovereignToken.create({
      id: `${this.claims.id}::${purpose}::${Date.now()}`,
      claims: {
        ...subClaims,
        _delegation: {
          purpose,
          parentId: this.claims.id,
          parentPublicKey: this.publicJwk,
          allowedClaims,
          iat: Date.now(),
          exp: ttl ? Date.now() + ttl : null,
        }
      },
      keyPair: this.keyPair, // Use same key pair to maintain cryptographic link
    });
    
    return delegatedToken;
  }
  
  /**
   * Generate a SCEE (Self-Coding Embedded Encryption) key from this token.
   * This binds encryption capability to token possession - the token's visual data
   * provides entropy for the meta-passphrase, creating a cryptographic link.
   * @param {string} contentPassphrase - Passphrase for encrypting content
   * @param {Object} [opts] - SCEE options (cipherId, kdfId, kdfIter)
   * @returns {Promise<{key: string, metaPass: string, keyBytes: Uint8Array}>}
   */
  async generateSCEEKey(contentPassphrase, opts = {}) {
    // Import SCEE if available, otherwise throw helpful error
    let SCEE;
    if (typeof window !== 'undefined' && window.SCEE) {
      SCEE = window.SCEE;
    } else if (typeof module !== 'undefined' && module.exports && module.exports.SCEE) {
      SCEE = module.exports.SCEE;
    } else {
      throw new Error('SCEE module not found. Load self-coding-encryption.js first.');
    }
    
    const tokenBlob = this.export();
    return SCEE.fromSovereignToken(tokenBlob, contentPassphrase, opts);
  }
}

// ─── Module export ────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SovereignToken };
} else if (typeof window !== 'undefined') {
  window.SovereignToken = SovereignToken;
}
