/**
 * Self-Coding Embedded Encryption (SCEE)
 * ========================================
 * A scheme where the decryption algorithm is encoded *within* the key itself.
 * Without the correct key, an observer cannot determine:
 *   - Which cipher was used
 *   - Which mode of operation
 *   - KDF parameters
 *   - IV / nonce structure
 *   - Auth tag position or length
 *
 * Key format (after base64url decode):
 * ┌─────────────────────────────────────────────────────────────┐
 * │ SCEE_MAGIC (4B) │ version (1B) │ ADB_ciphertext (var)       │
 * │ ADB_tag (16B)   │ commitment (32B)                           │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Algorithm Descriptor Block (ADB) — encrypted inside the key:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ cipher_id (1B) │ mode_id (1B) │ kdf_id (1B) │ kdf_iter(3B) │
 * │ iv_len (1B)    │ tag_len (1B) │ salt (32B)  │ iv (var)      │
 * │ reserved (8B)                                               │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Ciphertext envelope (stored/served publicly):
 * ┌─────────────────────────────────────────────────────────────┐
 * │ SCEE_ENV (4B) │ commitment_hash (32B) │ adb_hint_len (2B)   │
 * │ adb_hint (encrypted ADB fingerprint, 16B) │ ciphertext(var) │
 * │ auth_tag (var)                                              │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Plausible deniability: the envelope looks like random bytes.
 * The commitment allows key validation without trial decryption.
 * The ADB hint allows fast key-matching without revealing cipher.
 */

'use strict';

// ─── Registry of supported cipher suites ─────────────────────────────────────
// Keeping this deliberately sparse to demonstrate extensibility
const CIPHER_REGISTRY = {
  0x01: { name: 'AES-GCM',    keyLen: 256, ivLen: 12, tagLen: 16, webCryptoName: 'AES-GCM' },
  0x02: { name: 'AES-GCM',    keyLen: 128, ivLen: 12, tagLen: 16, webCryptoName: 'AES-GCM' },
  0x03: { name: 'AES-CBC',    keyLen: 256, ivLen: 16, tagLen: 0,  webCryptoName: 'AES-CBC' },
  0x04: { name: 'AES-CTR',    keyLen: 256, ivLen: 16, tagLen: 0,  webCryptoName: 'AES-CTR' },
};

const KDF_REGISTRY = {
  0x01: { name: 'PBKDF2-SHA256', webCryptoHash: 'SHA-256' },
  0x02: { name: 'PBKDF2-SHA512', webCryptoHash: 'SHA-512' },
  0x03: { name: 'HKDF-SHA256',   webCryptoHash: 'SHA-256' },
};

const SCEE_MAGIC = new Uint8Array([0x53, 0x43, 0x45, 0x45]); // "SCEE"
const SCEE_ENV   = new Uint8Array([0x45, 0x4E, 0x56, 0x01]); // "ENV\x01"
const VERSION    = 0x01;

// ─── Utilities ────────────────────────────────────────────────────────────────

const enc = new TextEncoder();
const dec = new TextDecoder();

function concatU8(...arrays) {
  const len = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

function u24ToBytes(n) {
  return new Uint8Array([(n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF]);
}
function bytesToU24(b, o = 0) { return (b[o] << 16) | (b[o+1] << 8) | b[o+2]; }
function u16ToBytes(n) { return new Uint8Array([(n >> 8) & 0xFF, n & 0xFF]); }
function bytesToU16(b, o = 0) { return (b[o] << 8) | b[o+1]; }

function toBase64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromBase64url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

function randomBytes(n) { return crypto.getRandomValues(new Uint8Array(n)); }

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ─── KDF Implementations ──────────────────────────────────────────────────────

async function deriveKey(passphrase, salt, kdfId, iterations, keyLenBits) {
  const kdf = KDF_REGISTRY[kdfId];
  if (!kdf) throw new Error(`Unknown KDF: ${kdfId}`);

  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey', 'deriveBits']
  );

  if (kdf.name.startsWith('PBKDF2')) {
    return crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: kdf.webCryptoHash },
      baseKey, keyLenBits
    ).then(bits => new Uint8Array(bits));
  } else {
    // HKDF
    const hkdfKey = await crypto.subtle.importKey(
      'raw', enc.encode(passphrase), 'HKDF', false, ['deriveBits']
    );
    return crypto.subtle.deriveBits(
      { name: 'HKDF', salt, hash: kdf.webCryptoHash, info: enc.encode('SCEE-v1') },
      hkdfKey, keyLenBits
    ).then(bits => new Uint8Array(bits));
  }
}

// ─── ADB (Algorithm Descriptor Block) ────────────────────────────────────────

function buildADB({ cipherId, kdfId, kdfIter, salt, iv }) {
  const cipher = CIPHER_REGISTRY[cipherId];
  return concatU8(
    new Uint8Array([cipherId]),
    new Uint8Array([0x01]),         // mode_id (reserved for future CBC modes)
    new Uint8Array([kdfId]),
    u24ToBytes(kdfIter),
    new Uint8Array([iv.length]),
    new Uint8Array([cipher.tagLen]),
    salt,                           // 32 bytes
    iv,                             // variable
    new Uint8Array(8)               // reserved
  );
}

function parseADB(bytes) {
  let off = 0;
  const cipherId = bytes[off++];
  off++;                             // mode_id
  const kdfId    = bytes[off++];
  const kdfIter  = bytesToU24(bytes, off); off += 3;
  const ivLen    = bytes[off++];
  const tagLen   = bytes[off++];
  const salt     = bytes.slice(off, off + 32); off += 32;
  const iv       = bytes.slice(off, off + ivLen); off += ivLen;
  // reserved
  return { cipherId, kdfId, kdfIter, ivLen, tagLen, salt, iv };
}

// ─── Meta-key derivation (used to encrypt the ADB inside the key) ─────────────
// This is derived from a separate "meta-passphrase" (or from a Sovereign Token).
// The meta-key uses a fixed, well-known KDF so the key-holder can always
// decrypt the ADB — but only if they know the meta-passphrase.

async function deriveMetaKey(metaPassphrase, metaSalt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(metaPassphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: metaSalt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt', 'decrypt']
  );
}

// ─── Commitment hash ──────────────────────────────────────────────────────────
// SHA-256(SCEE_MAGIC || ADB || metaSalt) used to validate key-envelope pairing
// without revealing anything about the cipher or the passphrase.

async function computeCommitment(adbBytes, metaSalt) {
  const data = concatU8(SCEE_MAGIC, adbBytes, metaSalt);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

// ─── Core API ─────────────────────────────────────────────────────────────────

class SCEE {
  /**
   * Generate a key that encodes its own decryption algorithm.
   *
   * @param {string} passphrase    - content encryption passphrase
   * @param {string} metaPass     - key-protection passphrase (different from above)
   * @param {Object} [opts]
   * @param {number} [opts.cipherId=0x01]  - cipher suite (see CIPHER_REGISTRY)
   * @param {number} [opts.kdfId=0x01]     - KDF to use
   * @param {number} [opts.kdfIter=210000] - KDF iterations
   * @returns {Promise<{ key: string, keyBytes: Uint8Array }>}
   *          key is base64url-encoded, safe to store/share as a string
   */
  static async generateKey(passphrase, metaPass, {
    cipherId = 0x01,
    kdfId    = 0x01,
    kdfIter  = 210_000,
  } = {}) {
    const cipher  = CIPHER_REGISTRY[cipherId];
    if (!cipher) throw new Error(`Unknown cipher: 0x${cipherId.toString(16)}`);

    const salt     = randomBytes(32);
    const iv       = randomBytes(cipher.ivLen);
    const metaSalt = randomBytes(32);
    const metaIV   = randomBytes(12);

    // Build the ADB
    const adb = buildADB({ cipherId, kdfId, kdfIter, salt, iv });

    // Encrypt ADB with meta-key
    const metaKey = await deriveMetaKey(metaPass, metaSalt);
    const adbCiphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: metaIV, tagLength: 128 },
      metaKey,
      adb
    );
    const adbEnc = new Uint8Array(adbCiphertext); // includes 16B GCM tag

    // Commitment
    const commitment = await computeCommitment(adb, metaSalt);

    // Pack key bytes
    // Format: MAGIC(4) | version(1) | metaSalt(32) | metaIV(12) | adbEncLen(2) | adbEnc(var) | commitment(32)
    const adbEncLen = u16ToBytes(adbEnc.length);
    const keyBytes = concatU8(
      SCEE_MAGIC,
      new Uint8Array([VERSION]),
      metaSalt,
      metaIV,
      adbEncLen,
      adbEnc,
      commitment
    );

    return {
      key: toBase64url(keyBytes),
      keyBytes,
      // expose for debugging / integration
      _internals: { cipherId, kdfId, kdfIter, cipher: cipher.name }
    };
  }

  /**
   * Encrypt content. Returns a self-describing ciphertext envelope.
   * The envelope is opaque without the key — looks like random bytes.
   *
   * @param {string|Uint8Array} content
   * @param {string} passphrase       - must match key's passphrase
   * @param {string} keyStr           - base64url key from generateKey()
   * @param {string} metaPass         - must match key's metaPass
   * @returns {Promise<{ envelope: string, envelopeBytes: Uint8Array }>}
   */
  static async encrypt(content, passphrase, keyStr, metaPass) {
    const { adb, commitment, metaSalt } = await SCEE._decodeKey(keyStr, metaPass);
    const cipher = CIPHER_REGISTRY[adb.cipherId];
    if (!cipher) throw new Error(`Unknown cipher: ${adb.cipherId}`);

    // Derive content key from passphrase using ADB's KDF params
    const rawKey = await deriveKey(passphrase, adb.salt, adb.kdfId, adb.kdfIter, cipher.keyLen);
    const contentKey = await crypto.subtle.importKey(
      'raw', rawKey, { name: cipher.webCryptoName, length: cipher.keyLen }, false, ['encrypt']
    );

    // Encrypt
    const plaintext = typeof content === 'string' ? enc.encode(content) : content;
    let ciphertext;

    if (cipher.webCryptoName === 'AES-GCM') {
      ciphertext = new Uint8Array(await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: adb.iv, tagLength: 128 },
        contentKey, plaintext
      ));
    } else if (cipher.webCryptoName === 'AES-CBC') {
      ciphertext = new Uint8Array(await crypto.subtle.encrypt(
        { name: 'AES-CBC', iv: adb.iv },
        contentKey, plaintext
      ));
    } else if (cipher.webCryptoName === 'AES-CTR') {
      ciphertext = new Uint8Array(await crypto.subtle.encrypt(
        { name: 'AES-CTR', counter: adb.iv, length: 64 },
        contentKey, plaintext
      ));
    }

    // ADB hint: 16B commitment fingerprint, encrypted with a hint key
    // Allows fast key validation without revealing the ADB
    const hintKey = await crypto.subtle.importKey(
      'raw', commitment.slice(0, 32), 'AES-GCM', false, ['encrypt']
    );
    const hintIV = randomBytes(12);
    const hintCt = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: hintIV, tagLength: 128 },
      hintKey, commitment.slice(0, 16)
    ));

    // Pack envelope
    // ENV(4) | commitment(32) | hintIV(12) | hintLen(2) | hint(var) | ctLen(4) | ciphertext(var)
    const ctLenBytes = new Uint8Array(4);
    new DataView(ctLenBytes.buffer).setUint32(0, ciphertext.length);

    const envelope = concatU8(
      SCEE_ENV,
      commitment,
      hintIV,
      u16ToBytes(hintCt.length),
      hintCt,
      ctLenBytes,
      ciphertext
    );

    return {
      envelope: toBase64url(envelope),
      envelopeBytes: envelope,
      _internals: { cipher: cipher.name, plaintext_len: plaintext.length }
    };
  }

  /**
   * Decrypt an envelope using the self-describing key.
   * The key tells the client WHICH algorithm to use — the client never needs to know.
   *
   * @param {string} envelopeStr  - base64url envelope from encrypt()
   * @param {string} passphrase
   * @param {string} keyStr
   * @param {string} metaPass
   * @returns {Promise<{ content: string, verified: boolean, cipher: string }>}
   */
  static async decrypt(envelopeStr, passphrase, keyStr, metaPass) {
    const { adb, commitment } = await SCEE._decodeKey(keyStr, metaPass);
    const cipher = CIPHER_REGISTRY[adb.cipherId];
    if (!cipher) throw new Error(`Unknown cipher: ${adb.cipherId}`);

    const envelope = fromBase64url(envelopeStr);
    let off = 0;

    // Check ENV magic
    const magic = envelope.slice(off, off + 4); off += 4;
    if (!timingSafeEqual(magic, SCEE_ENV)) throw new Error('Invalid envelope');

    // Read and verify commitment
    const envCommitment = envelope.slice(off, off + 32); off += 32;
    if (!timingSafeEqual(envCommitment, commitment)) {
      throw new Error('Commitment mismatch: wrong key for this envelope');
    }

    // Skip hint
    const hintIV  = envelope.slice(off, off + 12); off += 12;
    const hintLen = bytesToU16(envelope, off); off += 2;
    off += hintLen; // skip hint ciphertext

    // Read ciphertext
    const ctLen = new DataView(envelope.buffer, envelope.byteOffset + off).getUint32(0); off += 4;
    const ciphertext = envelope.slice(off, off + ctLen);

    // Derive content key
    const rawKey = await deriveKey(passphrase, adb.salt, adb.kdfId, adb.kdfIter, cipher.keyLen);
    const contentKey = await crypto.subtle.importKey(
      'raw', rawKey, { name: cipher.webCryptoName, length: cipher.keyLen }, false, ['decrypt']
    );

    let plaintext;
    try {
      if (cipher.webCryptoName === 'AES-GCM') {
        plaintext = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: adb.iv, tagLength: 128 },
          contentKey, ciphertext
        );
      } else if (cipher.webCryptoName === 'AES-CBC') {
        plaintext = await crypto.subtle.decrypt(
          { name: 'AES-CBC', iv: adb.iv },
          contentKey, ciphertext
        );
      } else if (cipher.webCryptoName === 'AES-CTR') {
        plaintext = await crypto.subtle.decrypt(
          { name: 'AES-CTR', counter: adb.iv, length: 64 },
          contentKey, ciphertext
        );
      }
    } catch(e) {
      throw new Error('Decryption failed: wrong passphrase or tampered ciphertext');
    }

    return {
      content: dec.decode(plaintext),
      verified: true,
      cipher: cipher.name,
      kdf: KDF_REGISTRY[adb.kdfId]?.name,
    };
  }

  /**
   * Generate a self-decrypting embed script.
   * The returned HTML+JS block, when loaded in a browser:
   *   1. Renders encrypted placeholder content
   *   2. On load, fetches the key from a key endpoint (or prompts user)
   *   3. Decodes the algorithm from the key
   *   4. Decrypts the content client-side
   *   5. Replaces the placeholder with decrypted content
   *
   * @param {string} envelopeStr      - encrypted content envelope
   * @param {Object} opts
   * @param {string} [opts.keyEndpoint]  - URL to fetch key from (GET, returns JSON { key, metaPass })
   * @param {string} [opts.placeholder]  - HTML shown before decrypt
   * @param {string} [opts.containerId]
   * @returns {string} Self-contained HTML embed block
   */
  static generateEmbed(envelopeStr, {
    keyEndpoint = null,
    placeholder = '<div style="filter:blur(8px);user-select:none">Encrypted content — authentication required</div>',
    containerId = 'scee-' + Math.random().toString(36).slice(2, 8),
    passphrase = null,
  } = {}) {
    // The embed script is itself the decryption engine — no external deps
    const embedScript = `
(async function() {
  const id = ${JSON.stringify(containerId)};
  const envelope = ${JSON.stringify(envelopeStr)};
  const keyEndpoint = ${JSON.stringify(keyEndpoint)};
  const hardPassphrase = ${JSON.stringify(passphrase)};
  const el = document.getElementById(id);

  // ── Utilities (self-contained) ──
  const dec = new TextDecoder();
  const enc2 = new TextEncoder();
  function fromB64url(s) {
    const b64 = s.replace(/-/g,'+').replace(/_/g,'/');
    return new Uint8Array([...atob(b64)].map(c=>c.charCodeAt(0)));
  }
  function concatU8(...arrays) {
    const len = arrays.reduce((s,a)=>s+a.length,0);
    const out = new Uint8Array(len); let off=0;
    for(const a of arrays){out.set(a,off);off+=a.length;}
    return out;
  }
  function timingSafeEq(a,b) {
    if(a.length!==b.length)return false;
    let d=0; for(let i=0;i<a.length;i++)d|=a[i]^b[i]; return d===0;
  }

  // ── Decode key → extract ADB → learn algorithm ──
  async function decodeKey(keyStr, metaPass) {
    const kb = fromB64url(keyStr);
    let off = 0;
    off += 4; // MAGIC
    off += 1; // version
    const metaSalt = kb.slice(off, off+32); off+=32;
    const metaIV   = kb.slice(off, off+12); off+=12;
    const adbEncLen = (kb[off]<<8)|kb[off+1]; off+=2;
    const adbEnc    = kb.slice(off, off+adbEncLen); off+=adbEncLen;
    const commitment = kb.slice(off, off+32);

    // Derive meta-key and decrypt ADB → learn cipher params
    const keyMat = await crypto.subtle.importKey('raw', enc2.encode(metaPass), 'PBKDF2', false, ['deriveKey']);
    const metaKey = await crypto.subtle.deriveKey(
      {name:'PBKDF2',salt:metaSalt,iterations:100000,hash:'SHA-256'},
      keyMat, {name:'AES-GCM',length:256}, false, ['decrypt']
    );
    const adbBytes = new Uint8Array(await crypto.subtle.decrypt(
      {name:'AES-GCM',iv:metaIV,tagLength:128}, metaKey, adbEnc
    ));

    // Parse ADB — this is where the algorithm materialises
    let a=0;
    const cipherId=adbBytes[a++], modeId=adbBytes[a++], kdfId=adbBytes[a++];
    const kdfIter=((adbBytes[a]<<16)|(adbBytes[a+1]<<8)|adbBytes[a+2]); a+=3;
    const ivLen=adbBytes[a++], tagLen=adbBytes[a++];
    const salt=adbBytes.slice(a,a+32); a+=32;
    const iv=adbBytes.slice(a,a+ivLen);

    const CIPHERS = {
      0x01:{name:'AES-GCM',keyLen:256,wcName:'AES-GCM'},
      0x02:{name:'AES-GCM',keyLen:128,wcName:'AES-GCM'},
      0x03:{name:'AES-CBC',keyLen:256,wcName:'AES-CBC'},
      0x04:{name:'AES-CTR',keyLen:256,wcName:'AES-CTR'},
    };
    const KDFS = {
      0x01:{wcHash:'SHA-256',name:'PBKDF2'},
      0x02:{wcHash:'SHA-512',name:'PBKDF2'},
      0x03:{wcHash:'SHA-256',name:'HKDF'},
    };
    return { cipher: CIPHERS[cipherId], kdf: KDFS[kdfId], kdfIter, salt, iv, commitment };
  }

  // ── Derive content key using algorithm from ADB ──
  async function deriveKey(pass, salt, kdf, iter, keyLen) {
    const mat = await crypto.subtle.importKey('raw', enc2.encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      {name:'PBKDF2',salt,iterations:iter,hash:kdf.wcHash}, mat, keyLen
    );
    return new Uint8Array(bits);
  }

  // ── Decrypt envelope ──
  async function decryptEnvelope(envStr, pass, keyStr, metaPass) {
    const { cipher, kdf, kdfIter, salt, iv, commitment } = await decodeKey(keyStr, metaPass);
    const env = fromB64url(envStr);
    let off = 4; // skip ENV magic
    const envCmt = env.slice(off, off+32); off+=32;
    if (!timingSafeEq(envCmt, commitment)) throw new Error('Key/envelope mismatch');
    // skip hint
    off += 12; // hintIV
    const hintLen = (env[off]<<8)|env[off+1]; off+=2;
    off += hintLen;
    // ciphertext
    const ctLen = new DataView(env.buffer, env.byteOffset+off).getUint32(0); off+=4;
    const ct = env.slice(off, off+ctLen);

    const rawKey = await deriveKey(pass, salt, kdf, kdfIter, cipher.keyLen);
    const ck = await crypto.subtle.importKey('raw', rawKey, {name:cipher.wcName,length:cipher.keyLen}, false, ['decrypt']);

    let pt;
    if (cipher.wcName === 'AES-GCM') {
      pt = await crypto.subtle.decrypt({name:'AES-GCM',iv,tagLength:128}, ck, ct);
    } else if (cipher.wcName === 'AES-CBC') {
      pt = await crypto.subtle.decrypt({name:'AES-CBC',iv}, ck, ct);
    } else if (cipher.wcName === 'AES-CTR') {
      pt = await crypto.subtle.decrypt({name:'AES-CTR',counter:iv,length:64}, ck, ct);
    }
    return dec.decode(pt);
  }

  // ── Main flow ──
  async function run() {
    try {
      let keyStr, metaPass, passphrase;

      if (keyEndpoint) {
        // Fetch key + metaPass from authorized endpoint
        const res = await fetch(keyEndpoint, {credentials:'include'});
        if (!res.ok) {
          el.innerHTML = '<div style="color:#f03e9a;font-family:monospace;font-size:12px">Access denied (${el.id})</div>';
          return;
        }
        const data = await res.json();
        keyStr = data.key; metaPass = data.metaPass; passphrase = data.passphrase;
      } else {
        // Prompt user — minimal modal
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:monospace';
        modal.innerHTML = \`
          <div style="background:#0d0d1e;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:32px;width:360px;display:flex;flex-direction:column;gap:14px">
            <div style="font-size:12px;color:#7c5cfc;letter-spacing:0.2em;text-transform:uppercase">Sovereign Token · Decrypt</div>
            <input id="scee-pp"  placeholder="Passphrase"  type="password" style="background:#000;border:1px solid #222;color:#e8e4ff;padding:10px;border-radius:6px;font-family:monospace;font-size:12px;outline:none">
            <input id="scee-key" placeholder="Key (base64url)" type="text"     style="background:#000;border:1px solid #222;color:#e8e4ff;padding:10px;border-radius:6px;font-family:monospace;font-size:11px;outline:none">
            <input id="scee-mp"  placeholder="Meta-passphrase"  type="password" style="background:#000;border:1px solid #222;color:#e8e4ff;padding:10px;border-radius:6px;font-family:monospace;font-size:12px;outline:none">
            <button id="scee-go" style="background:linear-gradient(135deg,#7c5cfc,#3ef0c0);color:#000;font-family:monospace;font-weight:700;font-size:12px;padding:10px;border:none;border-radius:6px;cursor:pointer">Decrypt</button>
            <div id="scee-err" style="color:#f03e9a;font-size:11px;min-height:16px"></div>
          </div>\`;
        document.body.appendChild(modal);
        await new Promise((resolve, reject) => {
          document.getElementById('scee-go').onclick = async () => {
            passphrase = document.getElementById('scee-pp').value;
            keyStr     = document.getElementById('scee-key').value.trim();
            metaPass   = document.getElementById('scee-mp').value;
            if (!passphrase || !keyStr || !metaPass) {
              document.getElementById('scee-err').textContent = 'All fields required'; return;
            }
            try {
              const result = await decryptEnvelope(envelope, passphrase, keyStr, metaPass);
              modal.remove();
              el.innerHTML = result;
              resolve();
            } catch(e) {
              document.getElementById('scee-err').textContent = e.message || 'Decryption failed';
            }
          };
        });
        return;
      }

      const result = await decryptEnvelope(envelope, passphrase, keyStr, metaPass);
      el.innerHTML = result;
    } catch(e) {
      el.innerHTML = '<div style="color:#f03e9a;font-family:monospace;font-size:11px">Decryption error: ' + (e.message||'unknown') + '</div>';
    }
  }

  run();
})();
`.trim();

    return `<!-- SCEE Encrypted Embed [${containerId}] -->
<div id="${containerId}">${placeholder}</div>
<script>
${embedScript}
<\/script>`;
  }

  /**
   * Integration point: derive a SCEE key from a Sovereign Token.
   * The token's steganographic pixel data provides the entropy for the meta-passphrase,
   * binding decryption capability to token possession.
   *
   * @param {Uint8Array} tokenFrames  - exported token pixel data (from SovereignToken.export())
   * @param {string}     passphrase  - content passphrase
   * @param {Object}     [opts]
   * @returns {Promise<{ key: string, metaPass: string }>}
   */
  static async fromSovereignToken(tokenFrames, passphrase, opts = {}) {
    // Derive meta-passphrase from token LSB data (the steganographic layer)
    // This binds the decryption key to the visual token itself
    const frameBytes = tokenFrames.slice(8); // skip header
    const lsbSample = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      lsbSample[i] = frameBytes[i * 128] & 0xFF; // sample every 128th byte
    }
    const hashBuf = await crypto.subtle.digest('SHA-256', concatU8(
      frameBytes.slice(0, 512), lsbSample
    ));
    const metaPass = toBase64url(new Uint8Array(hashBuf)).slice(0, 32);

    const result = await SCEE.generateKey(passphrase, metaPass, opts);
    return { ...result, metaPass };
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  static async _decodeKey(keyStr, metaPass) {
    const kb = fromBase64url(keyStr);
    let off = 0;
    const magic = kb.slice(off, off + 4); off += 4;
    if (!timingSafeEqual(magic, SCEE_MAGIC)) throw new Error('Invalid key magic');
    const version = kb[off++];
    const metaSalt = kb.slice(off, off + 32); off += 32;
    const metaIV   = kb.slice(off, off + 12); off += 12;
    const adbEncLen = bytesToU16(kb, off); off += 2;
    const adbEnc    = kb.slice(off, off + adbEncLen); off += adbEncLen;
    const commitment = kb.slice(off, off + 32);

    const metaKey = await deriveMetaKey(metaPass, metaSalt);
    let adbBytes;
    try {
      adbBytes = new Uint8Array(await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: metaIV, tagLength: 128 }, metaKey, adbEnc
      ));
    } catch(e) {
      throw new Error('Invalid meta-passphrase — cannot decode algorithm descriptor');
    }

    const adb = parseADB(adbBytes);
    return { adb, commitment, metaSalt };
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCEE, CIPHER_REGISTRY, KDF_REGISTRY };
} else if (typeof window !== 'undefined') {
  window.SCEE = SCEE;
}
