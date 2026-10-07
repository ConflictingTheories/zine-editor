/**
 * pageCrypto.js — real page-password encryption for pixozines (P10).
 *
 * Whole-page encryption with client-side key derivation:
 *   - PBKDF2-HMAC-SHA256 (600k iterations, OWASP 2023) derives a 256-bit key
 *   - AES-256-GCM encrypts the page content (authenticated: tampering and
 *     wrong passwords both fail closed)
 *   - The server only ever stores the opaque lock envelope — it never sees
 *     the password or the plaintext.
 *
 * Built on WebCrypto (`globalThis.crypto.subtle`), so the same module runs
 * in browsers and in Node 18+. The derived CryptoKey is non-extractable:
 * the raw key material never leaves the WebCrypto boundary.
 */

export const PAGE_CRYPTO_VERSION = 1
/** OWASP 2023 recommendation for PBKDF2-HMAC-SHA256. */
export const PBKDF2_ITERATIONS = 600_000

function getCrypto() {
  const c = globalThis.crypto
  if (!c?.subtle || typeof c.getRandomValues !== 'function') {
    throw new Error('pageCrypto: WebCrypto (globalThis.crypto.subtle) is unavailable in this environment')
  }
  return c
}

/** base64 encode a Uint8Array — works in browsers and Node. */
export function b64encode(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64')
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

/** base64 decode to a Uint8Array — works in browsers and Node. */
export function b64decode(b64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'))
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

/** Random 16-byte salt, base64-encoded. */
export function randomSaltB64() {
  return b64encode(getCrypto().getRandomValues(new Uint8Array(16)))
}

/**
 * Derive the page key. Slow by design (~1s at 600k iterations) — derive once
 * per unlock and reuse the CryptoKey for re-encryption.
 */
export async function derivePageKey(password, saltB64, iterations = PBKDF2_ITERATIONS) {
  if (!password) throw new Error('pageCrypto: a password is required')
  const subtle = getCrypto().subtle
  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: b64decode(saltB64), iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: raw key never leaves WebCrypto
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt a content object with a derived key. Returns the lock envelope.
 * A fresh IV is generated per encryption; the salt travels in the envelope
 * so the key can be re-derived, and travels in the session for key reuse.
 */
export async function encryptContentWithKey(content, key, saltB64, iterations = PBKDF2_ITERATIONS) {
  const subtle = getCrypto().subtle
  const iv = getCrypto().getRandomValues(new Uint8Array(12))
  const ct = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(content))
  )
  return {
    v: PAGE_CRYPTO_VERSION,
    alg: 'PBKDF2-SHA256/AES-256-GCM',
    iter: iterations,
    salt: saltB64,
    iv: b64encode(iv),
    ct: b64encode(new Uint8Array(ct)),
  }
}

/** Encrypt with a password (fresh random salt). */
export async function encryptContent(content, password, iterations = PBKDF2_ITERATIONS) {
  const saltB64 = randomSaltB64()
  const key = await derivePageKey(password, saltB64, iterations)
  return encryptContentWithKey(content, key, saltB64, iterations)
}

function assertEnvelope(envelope) {
  if (
    !envelope ||
    envelope.v !== PAGE_CRYPTO_VERSION ||
    typeof envelope.salt !== 'string' ||
    typeof envelope.iv !== 'string' ||
    typeof envelope.ct !== 'string'
  ) {
    throw new Error('pageCrypto: malformed lock envelope')
  }
}

/** Decrypt with a derived key. Wrong password / tampered data throws. */
export async function decryptContentWithKey(envelope, key) {
  assertEnvelope(envelope)
  const subtle = getCrypto().subtle
  let pt
  try {
    pt = await subtle.decrypt(
      { name: 'AES-GCM', iv: b64decode(envelope.iv) },
      key,
      b64decode(envelope.ct)
    )
  } catch {
    // AES-GCM authentication failure: wrong key or tampered ciphertext.
    throw new Error('Incorrect password')
  }
  return JSON.parse(new TextDecoder().decode(pt))
}

/** Decrypt with a password (re-derives the key). */
export async function decryptContent(envelope, password) {
  assertEnvelope(envelope)
  const key = await derivePageKey(password, envelope.salt, envelope.iter || PBKDF2_ITERATIONS)
  return decryptContentWithKey(envelope, key)
}

/** A page is locked when it carries a lock envelope. */
export function isPageLocked(page) {
  return !!page?.lock
}

/** Legacy (pre-P10) pages carry the password in plaintext. */
export function hasLegacyPassword(page) {
  return !isPageLocked(page) && typeof page?.password === 'string' && page.password.length > 0
}

/**
 * Lock a whole page: encrypt everything except the id/isLocked bookkeeping
 * into the envelope. The returned page contains NO plaintext content and NO
 * plaintext password.
 */
export async function lockPage(page, password, iterations = PBKDF2_ITERATIONS) {
  if (!password) throw new Error('pageCrypto: a password is required to lock a page')
  const { id, isLocked, lock, password: _pw, ...content } = page
  const envelope = await encryptContent(content, password, iterations)
  return { id, isLocked: true, lock: envelope }
}

/**
 * Unlock a page for viewing/editing. Returns the working copy (plaintext
 * content, no lock, no password). The caller is responsible for never
 * persisting the working copy — re-lock with relockPage before storage.
 */
export async function unlockPage(page, password) {
  if (!isPageLocked(page)) throw new Error('pageCrypto: page is not locked')
  const content = await decryptContent(page.lock, password)
  return { id: page.id, isLocked: true, ...content }
}

/**
 * Re-encrypt a working copy with an already-derived session key.
 * @param {object} page — working copy (may still carry the old envelope)
 * @param {{ key: CryptoKey, salt: string, iter: number }} session
 */
export async function relockPage(page, session) {
  if (!session?.key) throw new Error('pageCrypto: a session key is required to re-lock a page')
  const { id, isLocked, lock, password: _pw, ...content } = page
  const envelope = await encryptContentWithKey(content, session.key, session.salt, session.iter)
  return { id, isLocked: true, lock: envelope }
}

/**
 * Transparent migration for pre-P10 pages: if the entered password matches
 * the legacy plaintext password, re-encrypt the page into the new envelope
 * form. Call this on the next successful unlock; the caller persists the
 * returned page (which no longer contains the plaintext password).
 */
export async function migrateLegacyPageLock(page, enteredPassword, iterations = PBKDF2_ITERATIONS) {
  if (!hasLegacyPassword(page) || enteredPassword !== page.password) {
    throw new Error('Incorrect password')
  }
  return lockPage(page, enteredPassword, iterations)
}
