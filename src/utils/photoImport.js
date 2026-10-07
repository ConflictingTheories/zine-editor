/*
 * Utils: photoImport
 * Reading hundreds of photographs should feel instant. Files go straight to
 * the library (never onto a page) and we read intrinsic dimensions off the
 * decoded bitmap in the background so sorting by aspect or megapixels works
 * without a second pass over the file.
 */

import { makeThumbnail, putPhoto, getPhotoBlob } from '../lib/photoStore.js'
import { isRawPhotoFile, rawFormatLabel, extractEmbeddedJpeg } from '../lib/rawPhoto.js'

/** Filesystem-friendly, sortable name derived from the original filename. */
export const photoNameFromFile = (file) =>
    String(file?.name || 'Untitled')
        .replace(/\.[^.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || 'Untitled'

/** Guess a shoot/folder name from paths like `2024-05-Paris/IMG_0042.RAF`. */
export const shootFromFile = (file) => {
    const path = file?.webkitRelativePath || file?.relativePath || ''
    if (!path.includes('/')) return ''
    const parts = path.split('/')
    return parts.length > 2 ? parts[parts.length - 2] : parts[0]
}

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
})

/**
 * Raw bytes held between import and commit, keyed by asset id. The original
 * file can't live on the asset object — records get JSON-serialised — so
 * commitAssets moves these into IndexedDB under `raw:${id}` and clears them.
 */
const pendingRawFiles = new Map()

const toObjectUrl = async (id) => {
    const blob = await getPhotoBlob(id)
    if (!blob) return null
    return URL.createObjectURL(blob)
}

/**
 * Convert a FileList into library asset descriptors. Returns as soon as the
 * payloads are available; dimensions and thumbnails are patched onto the same
 * objects moments later by `measureAssets`, so callers can render immediately.
 *
 * The `src` returned here is a data URL. `commitAssets` (below) is what moves
 * those bytes into IndexedDB and swaps in a lightweight object URL, so the
 * long-lived library record never carries base64.
 */
export const filesToAssets = async (files) => {
    const images = Array.from(files || []).filter(file => file?.type?.startsWith('image/') || isRawPhotoFile(file))
    if (!images.length) return []

    const stamp = Date.now()
    const assets = []
    for (const [index, file] of images.entries()) {
        let src, kind = 'image', format, rawFile = null
        if (isRawPhotoFile(file)) {
            // Browsers can't decode the Bayer data in .NEF/.CR3/… but each
            // carries a full-resolution JPEG preview — surface that as the
            // working image and tag the asset as RAW.
            const preview = await extractEmbeddedJpeg(file)
            if (!preview) continue
            src = await readAsDataUrl(new File([preview], file.name, { type: 'image/jpeg' }))
            format = rawFormatLabel(file)
            // Stash the original bytes so commitAssets can keep them for develop.
            rawFile = file
        } else {
            src = await readAsDataUrl(file)
        }
        const id = `photo-${stamp}-${index}-${Math.random().toString(36).slice(2, 8)}`
        if (rawFile) pendingRawFiles.set(id, rawFile)
        assets.push({
            id,
            name: photoNameFromFile(file),
            originalName: file.name,
            shoot: shootFromFile(file),
            src,
            bytes: file.size || 0,
            kind,
            format,
            addedAt: new Date().toISOString(),
            favorite: false,
            flagged: false,
            tags: []
        })
    }
    return assets
}

/**
 * Fill in `width`/`height` and a grid thumbnail for assets that are missing
 * them. Resolves once every asset has been measured (or skipped) and mutates
 * in place so the caller's library state picks the values up on the next
 * render.
 */
export const measureAssets = (assets) => {
    const pending = (assets || []).filter(asset => asset?.src && !asset.width)
    if (!pending.length) return Promise.resolve(assets)

    return Promise.all(pending.map(asset => new Promise(resolve => {
        const img = new Image()
        img.onload = () => {
            asset.width = img.naturalWidth
            asset.height = img.naturalHeight
            resolve(asset)
        }
        img.onerror = () => resolve(asset)
        img.src = asset.src
    }))).then(() => assets)
}

/**
 * Move freshly imported data URLs into the blob store, attach thumbnails and
 * hand back assets carrying an object URL. The originals still work if this
 * never resolves, so callers should `await` it rather than depend on it.
 */
export const commitAssets = async (assets) => {
    return Promise.all((assets || []).map(async asset => {
        if (!asset?.id || !asset.src) return asset
        const stored = await putPhoto(asset.id, asset.src)
        if (!stored) return asset
        const rawFile = pendingRawFiles.get(asset.id)
        if (rawFile) {
            await putPhoto(`raw:${asset.id}`, rawFile)
            pendingRawFiles.delete(asset.id)
        }
        const thumb = asset.thumb || await makeThumbnail(asset.src)
        return { ...asset, thumb, src: await toObjectUrl(asset.id) }
    }))
}

/**
 * Normalise a dropped DataTransfer into a File list. Covers drags from the
 * OS file manager as well as images dragged out of the in-app library.
 */
export const filesFromDrop = (dataTransfer) => {
    if (!dataTransfer) return []
    if (dataTransfer.files?.length) return Array.from(dataTransfer.files)
    return []
}

/**
 * The single media import pipeline. Every import path in the app — single
 * image, bulk images, drag-drop, audio from the editor, audio from the asset
 * modal, image replace — funnels through here, so there is exactly one place
 * where "bytes go to IndexedDB, metadata goes to localStorage" can break.
 *
 * Images: filesToAssets → commitAssets (bytes to the blob store, thumbnail,
 * object-URL src). Audio: bytes are written first, so a storage failure can
 * never leave a record whose bytes are nowhere.
 *
 * @param {FileList|File[]} files
 * @param {'image'|'audio'} kind
 * @returns {Promise<{ assets: object[], failed: string[] }>} committed assets
 *          plus the names of files whose bytes could not be stored (quota).
 */
export const importMediaFiles = async (files, kind = 'image') => {
    const list = Array.from(files || []).filter(Boolean)
    if (!list.length) return { assets: [], failed: [] }

    if (kind === 'audio') {
        const audioFiles = list.filter(file => file?.type?.startsWith('audio/'))
        if (!audioFiles.length) return { assets: [], failed: [] }
        const stamp = Date.now()
        const assets = []
        const failed = []
        for (const [i, file] of audioFiles.entries()) {
            const id = `audio-${stamp}-${i}-${Math.random().toString(36).slice(2, 8)}`
            // Write the real bytes first, so a storage failure never leaves a
            // record whose bytes are nowhere.
            const stored = await putPhoto(id, file)
            if (!stored) { failed.push(file.name || 'untitled audio'); continue }
            const url = await toObjectUrl(id)
            assets.push({
                id,
                name: file.name || 'Untitled audio',
                originalName: file.name,
                src: url,
                bytes: file.size || 0,
                kind: 'audio',
                addedAt: new Date().toISOString(),
            })
        }
        return { assets, failed }
    }

    // Images (default): the shared photo pipeline.
    const created = await filesToAssets(list)
    if (!created.length) return { assets: [], failed: [] }
    const measured = await measureAssets(created)
    const settled = await commitAssets(measured)
    // commitAssets leaves the original asset untouched when the blob write
    // fails — those still carry a data: src and must be reported, not
    // silently kept as orphans.
    const assets = []
    const failed = []
    for (const asset of settled) {
        if (asset?.src?.startsWith('data:')) failed.push(asset.name || 'untitled image')
        else assets.push(asset)
    }
    return { assets, failed }
}