/**
 * serverSync.js — client half of the server sync protocol.
 *
 * Mirrors the client storage contract (src/utils/projectAssets.js):
 * `toStorableProject()` output goes up, `resolveProjectAssets()` runs on
 * what comes down. Bytes never ride inside project JSON — they travel via
 * /api/assets keyed by content hash.
 *
 * Philosophy (docs/CLOUD_SYNC.md): local is the source of truth; the server
 * is backup + cross-device. Push is optimistic-locking — a 409 means the
 * server moved, and the caller merges (never silent).
 *
 * Sync only runs with a real JWT. The demo/offline token stays local-only:
 * syncing the shared demo identity would collide across machines.
 */

const API_BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '')

const token = () => {
    try { return localStorage.getItem('vp_token') } catch { return null }
}

/** Real login, not demo/offline. */
export const canSync = () => {
    const t = token()
    return Boolean(t) && t !== 'local_offline_token'
}

async function api(path, { method = 'GET', body, raw = false } = {}) {
    const t = token()
    if (!t) throw new Error('Not signed in')
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${t}`,
            ...(raw ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body !== undefined ? { body: raw ? body : JSON.stringify(body) } : {}),
    })
    if (res.status === 409) {
        const conflict = await res.json().catch(() => ({}))
        const err = new Error(conflict.error || 'Version conflict')
        err.code = 'conflict'
        err.server = conflict.server
        throw err
    }
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Sync failed (${res.status})`)
    }
    return res.status === 204 ? null : res.json()
}

/**
 * Push one project snapshot.
 * @param {object} storable — toStorableProject() output (must carry a stable id)
 * @param {number|null} baseVersion — last version the server confirmed
 * @returns the server record { id, client_id, version, updated_at }
 * @throws err.code === 'conflict' with err.server = server copy
 */
export async function pushProject(storable, baseVersion = null) {
    const clientId = storable?.id
    if (!clientId) throw new Error('pushProject: project needs a stable id')
    return api('/api/sync/push', {
        method: 'POST',
        body: {
            client_id: String(clientId),
            title: storable.title || storable.name || 'Untitled',
            data: storable,
            base_version: baseVersion,
        },
    })
}

/**
 * Pull changes since an ISO timestamp (or everything when omitted).
 * Returns { items: [{ id, client_id, title, data, version, updated_at, deleted_at }] }
 * — tombstones included so deletions propagate.
 */
export async function pullProjects(since = null) {
    const qs = since ? `?since=${encodeURIComponent(since)}` : ''
    return api(`/api/sync/pull${qs}`)
}

/** Soft-delete a project on the server (tombstone). */
export async function deleteProject(clientId, baseVersion = null) {
    return api('/api/sync/delete', {
        method: 'POST',
        body: { client_id: String(clientId), base_version: baseVersion },
    })
}

/** Ask the server which content hashes it is missing. */
export async function missingAssetHashes(hashes) {
    const { missing } = await api('/api/sync/assets/have', {
        method: 'POST',
        body: { hashes },
    })
    return missing
}

/** Upload one asset's bytes under its content hash (verified server-side). */
export async function uploadAsset(hash, bytes, mime) {
    return fetch(`${API_BASE}/api/assets/${hash}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token()}`,
            'Content-Type': mime || 'application/octet-stream',
        },
        body: bytes,
    }).then(async (res) => {
        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error || `Asset upload failed (${res.status})`)
        }
        return res.json()
    })
}

/**
 * Sync one project's missing assets: diff local asset hashes against the
 * server, upload what's missing. `getBytes` resolves a hash to bytes
 * (e.g. from IndexedDB via getPhotoBlob).
 */
export async function syncProjectAssets(hashes, getBytes) {
    const missing = await missingAssetHashes(hashes)
    for (const hash of missing) {
        const bytes = await getBytes(hash)
        if (!bytes) continue // asset gone locally; project keeps the assetId ref
        await uploadAsset(hash, bytes)
    }
    return { uploaded: missing.length }
}

/**
 * Hook point for VPContext: after a local save, if canSync(), push the
 * storable project and sync its missing assets. Conflict handling (merge UI)
 * is the caller's job — this module only surfaces err.code === 'conflict'.
 */
export const serverSync = {
    canSync,
    pushProject,
    pullProjects,
    deleteProject,
    missingAssetHashes,
    uploadAsset,
    syncProjectAssets,
}
