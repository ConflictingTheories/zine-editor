/*
 * Utils: projectAssets
 * The element-level half of the storage contract.
 *
 * The library keeps metadata in localStorage and bytes in IndexedDB, but
 * pages were persisting whatever `src` an element happened to carry — an
 * in-session `blob:` object URL (dead after reload → broken image) or a
 * base64 `data:` URL (portable, but eats the ~5MB localStorage quota and
 * re-serialises on every keystroke of autosave).
 *
 * The rule from here on:
 *   - Elements reference library bytes by `assetId`. `src` is a render-time
 *     concern, resolved when a project opens and stripped when it saves.
 *   - `blob:` URLs are session-ephemeral and must never reach disk.
 *   - `data:` URLs are portable but bulky: absorbed into the blob store on
 *     load (once), inlined from the blob store on publish/encrypt (per use).
 *
 * Locked (encrypted) pages need portable srcs *inside* the envelope, because
 * the envelope is opaque to this module after encryption. Callers inline a
 * page's assets before lockPage/relockPage; unlock yields the inlined form,
 * which renders without any further resolution.
 */

import { getPhotoBlob, putPhoto } from '../lib/photoStore.js'

/** Session-ephemeral: minted per tab, dead the moment it closes. Never persist. */
export const isEphemeralSrc = (src) => typeof src === 'string' && src.startsWith('blob:')

/** Portable but bulky: survives reload, but belongs in the blob store. */
export const isInlineDataSrc = (src) => typeof src === 'string' && src.startsWith('data:')

/**
 * Visit every media reference in a project: element `src`s plus page and
 * project background audio. `fn(ref)` receives `{ get, set, assetId }` where
 * get()/set() read/write the src string and assetId is the linked library id
 * (or undefined).
 */
export const eachMediaRef = (project, fn) => {
    if (!project || typeof project !== 'object') return
    for (const page of project.pages || []) {
        if (!page || typeof page !== 'object') continue
        for (const element of page.elements || []) {
            if (!element || typeof element !== 'object' || !('src' in element)) continue
            fn({
                get: () => element.src,
                set: (src) => { element.src = src },
                setAssetId: (id) => { if (id) element.assetId = id },
                assetId: element.assetId,
                kind: element.type === 'audio-log' ? 'audio' : 'image',
            })
        }
        if (page.backgroundAudio && typeof page.backgroundAudio === 'object') {
            const audio = page.backgroundAudio
            fn({
                get: () => audio.src,
                set: (src) => { audio.src = src },
                setAssetId: (id) => { if (id) audio.assetId = id },
                assetId: audio.assetId,
                kind: 'audio',
            })
        }
    }
    if (project.backgroundAudio && typeof project.backgroundAudio === 'object') {
        const audio = project.backgroundAudio
        fn({
            get: () => audio.src,
            set: (src) => { audio.src = src },
            setAssetId: (id) => { if (id) audio.assetId = id },
            assetId: audio.assetId,
            kind: 'audio',
        })
    }
}

const deepCopy = (value) => JSON.parse(JSON.stringify(value))

/**
 * Project form safe for localStorage: every `blob:` src is stripped (the
 * `assetId` stays, so open re-resolves it). `data:` srcs are left alone —
 * they are portable, and the open-time migration absorbs them.
 */
export const toStorableProject = (project) => {
    if (!project || typeof project !== 'object') return project
    const copy = deepCopy(project)
    eachMediaRef(copy, (ref) => {
        if (isEphemeralSrc(ref.get())) ref.set(undefined)
    })
    return copy
}

/** Fetch a Blob as a data: URL (for publish payloads and lock envelopes). */
export const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    if (!blob) { reject(new Error('no blob')); return }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('could not read blob'))
    reader.readAsDataURL(blob)
})

const mintObjectUrl = async (assetId) => {
    const blob = await getPhotoBlob(assetId)
    return blob ? URL.createObjectURL(blob) : null
}

/**
 * Make a project renderable: resolve every `assetId` to a fresh object URL,
 * and absorb legacy `data:` srcs into the blob store (attaching the new
 * assetId) so the next save drops the base64 from localStorage for good.
 *
 * Never throws — an unresolvable ref keeps its current src and is reported
 * in `missing` so the UI can say so instead of rendering silence.
 *
 * @returns {Promise<{ project, resolved: number, absorbed: number, missing: string[] }>}
 */
export const resolveProjectAssets = async (project) => {
    if (!project || typeof project !== 'object') return { project, resolved: 0, absorbed: 0, missing: [] }
    const copy = deepCopy(project)
    let resolved = 0
    let absorbed = 0
    const missing = []
    const jobs = []
    eachMediaRef(copy, (ref) => {
        jobs.push((async () => {
            const src = ref.get()
            // Already renderable and portable — nothing to do.
            if (!src || (!isEphemeralSrc(src) && !isInlineDataSrc(src))) return
            // Dead object URL with a library link: re-mint from the blob store.
            if (isEphemeralSrc(src) && ref.assetId) {
                const url = await mintObjectUrl(ref.assetId)
                if (url) { ref.set(url); resolved++ }
                else missing.push(ref.assetId)
                return
            }
            // Legacy inline bytes: park them in the blob store once, then
            // treat the element like any other library reference.
            if (isInlineDataSrc(src) && !ref.assetId) {
                const id = `absorbed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                const stored = await putPhoto(id, src)
                if (!stored) return // quota/full: keep the data: URL; it still renders
                const url = await mintObjectUrl(id)
                if (url) {
                    ref.setAssetId(id)
                    ref.set(url)
                    absorbed++
                }
                return
            }
            // data: URL that already has an assetId (inlined at publish/lock
            // time): leave it — it renders as-is.
        })())
    })
    await Promise.all(jobs)
    return { project: copy, resolved, absorbed, missing }
}

/**
 * Portable project form for publish/sync payloads and lock envelopes:
 * every `assetId`-linked ref is inlined as a `data:` URL from the blob
 * store. Refs that cannot be inlined keep their src and are reported.
 *
 * Operates on a copy; the caller's in-memory project is untouched.
 *
 * @returns {Promise<{ project, inlined: number, missing: string[] }>}
 */
export const inlineProjectAssets = async (project) => {
    if (!project || typeof project !== 'object') return { project, inlined: 0, missing: [] }
    const copy = deepCopy(project)
    const cache = new Map() // assetId -> dataUrl (or null)
    let inlined = 0
    const missing = []
    const dataUrlFor = async (assetId) => {
        if (cache.has(assetId)) return cache.get(assetId)
        const p = (async () => {
            try {
                const blob = await getPhotoBlob(assetId)
                return blob ? await blobToDataUrl(blob) : null
            } catch {
                return null
            }
        })()
        cache.set(assetId, p)
        return p
    }
    const jobs = []
    eachMediaRef(copy, (ref) => {
        jobs.push((async () => {
            if (!ref.assetId || isInlineDataSrc(ref.get())) return
            const dataUrl = await dataUrlFor(ref.assetId)
            if (dataUrl) { ref.set(dataUrl); inlined++ }
            else missing.push(ref.assetId)
        })())
    })
    await Promise.all(jobs)
    return { project: copy, inlined, missing }
}
