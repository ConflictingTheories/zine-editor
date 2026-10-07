/*
 * Library: photoStore
 * Persistent blob storage for imported photographs.
 *
 * The reason this exists: a photographer's library runs to hundreds or
 * thousands of files, and the pixels cannot live in `localStorage` next to
 * their metadata. Every metadata edit (a favourite, a flag, a rename) would
 * otherwise re-serialise hundreds of megabytes of base64 and blow the quota.
 *
 * So the split is:
 *   IndexedDB  → the image bytes, keyed by asset id, written once on import
 *   localStorage → the metadata record, a small thumbnail, and nothing else
 *
 * Object URLs are minted on load and are deliberately never persisted — they
 * are dead the moment the tab closes, so writing them to disk would only
 * poison the library with srcs that render as broken images.
 */

const DB_NAME = 'svrn_photos'
const DB_VERSION = 1
const STORE = 'photos'

let dbPromise = null

const openDb = () => {
    if (dbPromise) return dbPromise
    dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return }
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
    // A failed open must not poison the cached promise — the next caller
    // should be free to try again (e.g. after storage pressure clears).
    dbPromise.catch(() => { dbPromise = null })
    return dbPromise
}

const withStore = async (mode, run) => {
    const db = await openDb()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const store = tx.objectStore(STORE)
        let result
        try { result = run(store) } catch (err) { reject(err); return }
        tx.oncomplete = () => resolve(result && result.__req ? result.__req.result : result)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
    })
}

/** Wrap an IDBRequest so the transaction helper can hand back its result. */
const req = (request) => ({ __req: request })

/** Longest edge of the in-library thumbnail, in pixels. */
const THUMB_MAX = 420
const THUMB_QUALITY = 0.72

/**
 * Shrink a bitmap to a thumbnail data URL. Thumbnails are what the library
 * grid draws, so a thousand-photo grid never decodes a hundred megapixels.
 * Returns null when the image cannot be decoded.
 */
export const makeThumbnail = async (src, max = THUMB_MAX) => {
    if (!src) return null
    try {
        const img = await loadImage(src)
        const scale = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max))
        const width = Math.max(1, Math.round((img.naturalWidth || max) * scale))
        const height = Math.max(1, Math.round((img.naturalHeight || max) * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        return canvas.toDataURL('image/jpeg', THUMB_QUALITY)
    } catch {
        return null
    }
}

const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = src
})

/**
 * Persist one photograph. `blobOrDataUrl` may be either form; a data URL is
 * decoded into a Blob first so the stored value is compact binary.
 */
export const putPhoto = async (id, blobOrDataUrl) => {
    if (!id) return false
    try {
        const blob = await toBlob(blobOrDataUrl)
        if (!blob) return false
        await withStore('readwrite', store => req(store.put({ id, blob })))
        return true
    } catch {
        // Storage is full or unavailable. The session still works from the
        // in-memory src, so this is a soft failure by design.
        return false
    }
}

const toBlob = async (input) => {
    if (!input) return null
    if (typeof input === 'object' && typeof Blob !== 'undefined' && input instanceof Blob) return input
    if (typeof input !== 'string' || !input.startsWith('data:')) return null
    const response = await fetch(input)
    return response.blob()
}

export const getPhotoBlob = async (id) => {
    if (!id) return null
    try {
        const record = await withStore('readonly', store => req(store.get(id)))
        return record?.blob || null
    } catch {
        return null
    }
}

export const deletePhotos = async (ids) => {
    const list = Array.isArray(ids) ? ids.filter(Boolean) : [ids].filter(Boolean)
    if (!list.length) return 0
    try {
        await withStore('readwrite', store => {
            list.forEach(id => {
                store.delete(id)
                // Also drop the raw bytes stored at import time for develop.
                if (!id.startsWith('raw:')) store.delete(`raw:${id}`)
            })
        })
        return list.length
    } catch {
        return 0
    }
}

/** Every asset id currently holding bytes on disk. */
export const storedPhotoIds = async () => {
    try {
        return await withStore('readonly', store => req(store.getAllKeys()))
    } catch {
        return []
    }
}

/**
 * Total bytes actually occupied by the blob store, plus a per-asset breakdown.
 *
 * The library record deliberately does not carry `src`, so the size of a photo
 * is not knowable from the metadata — it has to be measured from the bytes. This
 * is what the storage manager shows, and it is the difference between "12 photos"
 * and "12 photos, 340 MB, and you have 1.2 GB left".
 *
 * @returns {Promise<{total:number, byId:Record<string, number>}>}
 */
export const photoStoreUsage = async () => {
    const byId = {}
    try {
        const records = await withStore('readonly', store => req(store.getAll()))
        for (const record of records || []) {
            const size = record?.blob?.size || 0
            byId[record.id] = size
        }
    } catch {
        return { total: 0, byId }
    }
    const total = Object.values(byId).reduce((sum, n) => sum + n, 0)
    return { total, byId }
}

/**
 * What the browser will let us keep, and how much is used.
 *
 * `usage` is the whole origin (this app plus anything else sharing it) and
 * `quota` is an estimate that moves with disk pressure, so the percentage is a
 * guide rather than a promise. Both are null where the API is unavailable —
 * Firefox historically has no StorageManager, and a caller must handle that
 * rather than render "NaN% used".
 */
export const storageEstimate = async () => {
    try {
        if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
            return { usage: null, quota: null, supported: false }
        }
        const { usage, quota } = await navigator.storage.estimate()
        return { usage: usage ?? null, quota: quota ?? null, supported: true }
    } catch {
        return { usage: null, quota: null, supported: false }
    }
}

/**
 * Migrate a legacy `data:` src into the blob store. Returns the id once the
 * bytes are on disk so the caller can drop the base64 from localStorage.
 */
export const absorbLegacyDataUrl = async (asset) => {
    if (!asset?.id || typeof asset.src !== 'string' || !asset.src.startsWith('data:')) return null
    if (await getPhotoBlob(asset.id)) return asset.id
    return (await putPhoto(asset.id, asset.src)) ? asset.id : null
}
