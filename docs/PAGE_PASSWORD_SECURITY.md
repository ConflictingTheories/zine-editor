# Page-Password Security — Threat Model (P10)

Page passwords in SVRN Publisher are **real encryption**, not a UI gate.
A locked page's content is encrypted client-side with a key derived from the
password; the server, the database, sync payloads, `.svrn` archives, and
static exports only ever carry the opaque lock envelope.

## Mechanism

- **Key derivation:** PBKDF2-HMAC-SHA256, 600,000 iterations (OWASP 2023),
  16-byte random salt per page. Implemented in
  `packages/svrn-format/src/pageCrypto.js` on WebCrypto, so the same code
  runs in browsers and Node 18+. The derived `CryptoKey` is non-extractable.
- **Encryption:** AES-256-GCM with a fresh 12-byte IV per encryption.
  Authentication failures (wrong password **or** tampered ciphertext/salt)
  fail closed with a generic "Incorrect password".
- **Envelope** (`page.lock`): `{ v, alg, iter, salt, iv, ct }` — all base64.
  It contains no plaintext and no password.
- **Scope:** whole page. Locking encrypts everything except the page `id`
  (elements, background, texture, BGM, interactions). A locked page stored
  anywhere is `{ id, isLocked: true, lock }`.

## What it protects against

- Anyone with read access to the database, a sync payload, a `.svrn`
  archive, or a static export **cannot recover page content or the password**
  without the password itself. Brute force costs ~1s per guess per page
  (PBKDF2), so dictionary attacks against weak passwords remain feasible —
  see below.
- Tampering with the envelope (or swapping salts/ciphertexts between pages)
  is detected by AES-GCM and rejected.
- The server never sees passwords or plaintext: unlock/decrypt and
  lock/encrypt happen in the browser; `sync()` re-encrypts working copies
  with the cached session key before POSTing.

## What it does NOT protect against

- **Weak passwords.** PBKDF2 slows guessing; it does not stop it. A password
  like `1234` will fall to a dictionary attack by anyone holding the
  envelope. The UI does not enforce password strength today.
- **The author's own device.** While a page is unlocked for editing, the
  decrypted working copy lives in memory and in the browser's localStorage
  project cache. Session keys are memory-only and die on reload, but a
  compromised device during an editing session exposes the content.
- **Metadata.** Page `id`, page count, and the fact that a page is locked
  are visible. Timing/size of the envelope leaks approximate content size.
- **No forward secrecy.** Changing a password re-encrypts with a new salt,
  but anyone who captured an older envelope + the old password can still
  read the old content.
- **Static exports cannot be unlocked.** Exported HTML/PDF renders locked
  pages as opaque placeholders. There is deliberately no password in the
  export (the old `data-pass` plaintext leak was removed in P10).

## Operational notes

- Legacy plaintext `page.password` values are **migrated transparently**:
  the next successful unlock (reader or editor) re-encrypts the page into
  the envelope form and the plaintext is dropped before the next sync.
- `encryption.cjs` (server-side AES-CBC with an all-zeros dev fallback key
  and silent-plaintext `catch` blocks) was deleted in P5. Do not revive it;
  page crypto is client-side by design.
- Session keys (`VPContext` `pageKeysRef`) are never persisted. Closing the
  project or reloading drops them; the page stays safely locked.
