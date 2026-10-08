/*
 * SVRN Player bootstrap — bundled PixoSpritz player.
 *
 * This page is loaded inside a sandboxed iframe (sandbox="allow-scripts" only)
 * by PlayableEmbed. It reads the game bundle from URL params, verifies
 * integrity, and runs it with the bundled SpritzPlayer.
 *
 * URL params:
 *   bundle       — URL of the .svrn/.pxz game bundle (required)
 *   manifestHash — expected SHA-256 of the bundle manifest (required)
 *   playerVersion — pinned player version from the playable block (required)
 *
 * Version pinning: BUNDLED_PLAYER_VERSION must match the playable's pinned
 * playerVersion on MAJOR version. A major mismatch refuses to run (never
 * partial state). Minor/patch drift is allowed with a console warning.
 *
 * Build: this module imports SpritzPlayer from the engine repo. The reader's
 * vite config aliases `@pixospritz/player` to the engine checkout (see
 * apps/reader/vite.config.js). The built player ships INSIDE the reader
 * package — no separate deploy, works offline from the same origin.
 *
 * ENGINE GAP (honest): SpritzPlayer currently has no standalone embedding
 * API. Its runtime lifecycle is driven by `init(engine)` where `engine` is a
 * full engine instance — there is no `player.mount(el, bytes)` yet. The
 * validation path below uses the real, tested API (`prepareManifest`). The
 * final mount step is marked TODO and needs an engine-side `mountBundle()`
 * API. See the TODO in main() below.
 */

// BUNDLED_PLAYER_VERSION must track the released player. Update on release.
// (Matches PINNED_PLAYER_VERSION in the engine's svrn-publish/bundle.js.)
export const BUNDLED_PLAYER_VERSION = '1.0.0'

import SpritzPlayer, { PackageValidationError } from '@pixospritz/player'

const statusEl = document.getElementById('player-status')
const rootEl = document.getElementById('player-root')

function showError(title, body) {
  statusEl.innerHTML = ''
  const box = document.createElement('div')
  box.className = 'player-error'
  const h = document.createElement('h2')
  h.textContent = title
  const p = document.createElement('p')
  p.textContent = body
  box.appendChild(h)
  box.appendChild(p)
  statusEl.appendChild(box)
}

function setStatus(text) {
  const label = statusEl.querySelector('div:last-child')
  if (label) label.textContent = text
}

function majorOf(v) {
  return String(v || '').split('.')[0]
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

async function main() {
  const params = new URLSearchParams(location.search)
  const bundleUrl = params.get('bundle')
  const expectedHash = params.get('manifestHash')
  const pinnedVersion = params.get('playerVersion')

  if (!bundleUrl || !expectedHash || !pinnedVersion) {
    showError('Invalid playable', 'Missing bundle, manifestHash, or playerVersion.')
    return
  }

  // Pinned-version check: major must match, never run on mismatch.
  if (majorOf(pinnedVersion) !== majorOf(BUNDLED_PLAYER_VERSION)) {
    showError(
      'Player version mismatch',
      `This playable needs player v${pinnedVersion}, but the bundled player is v${BUNDLED_PLAYER_VERSION}. Ask the creator to re-publish.`
    )
    return
  }
  if (pinnedVersion !== BUNDLED_PLAYER_VERSION) {
    console.warn(`[svrn-player] minor version drift: playable wants ${pinnedVersion}, bundled ${BUNDLED_PLAYER_VERSION}`)
  }

  try {
    setStatus('Downloading bundle…')
    const res = await fetch(bundleUrl)
    if (!res.ok) throw new Error(`Bundle fetch failed: ${res.status}`)
    const bytes = new Uint8Array(await res.arrayBuffer())

    // Integrity: verify BEFORE executing anything (format §8).
    setStatus('Verifying bundle…')
    const { unzipSync, strFromU8 } = await import('fflate')
    let manifestText
    try {
      const entries = unzipSync(bytes)
      const manifestEntry = entries['manifest.json']
      if (!manifestEntry) throw new Error('Bundle has no manifest.json')
      manifestText = strFromU8(manifestEntry)
    } catch (e) {
      throw new Error(`Bundle is not a valid archive: ${e.message}`)
    }
    const actualHash = await sha256Hex(new TextEncoder().encode(manifestText))
    if (actualHash !== expectedHash.toLowerCase()) {
      throw new Error('Bundle integrity check failed: manifest hash mismatch.')
    }

    // Validate + migrate the manifest (real API, never executes scripts).
    setStatus('Loading…')
    let prepared
    try {
      prepared = SpritzPlayer.prepareManifest(JSON.parse(manifestText))
    } catch (e) {
      if (e instanceof PackageValidationError) throw new Error(`Invalid game bundle: ${e.message}`)
      throw e
    }

    // Mount the bundle using SpritzPlayer.mountBundle() - real engine bootstrap
    console.info('[svrn-player] bundle validated:', prepared.manifest.title, `(${prepared.migration})`)
    setStatus('Starting game…')

    try {
      const rootEl = document.getElementById('player-root') || document.body;
      const result = await SpritzPlayer.mountBundle(rootEl, bytes, {
        manifestHash: expectedHash,
        width: 480,
        height: 640,
      });
      console.info('[svrn-player] game mounted:', result.manifest.title);
      setStatus('');

      // Store for cleanup
      window.__svrnPlayer = result;
    } catch (mountErr) {
      console.error('[svrn-player] mount failed:', mountErr);
      showError(
        'Could not start game',
        `Bundle validated but failed to mount: ${mountErr.message}`
      );
    }
  } catch (err) {
    console.error('[svrn-player]', err)
    showError('Could not load playable', err.message || 'Unknown error.')
  }
}

main()
