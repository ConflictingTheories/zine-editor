/*
 * Utils: photoImport
 * Reading hundreds of photographs should feel instant. Files go straight to
 * the library (never onto a page) and we read intrinsic dimensions off the
 * decoded bitmap in the background so sorting by aspect or megapixels works
 * without a second pass over the file.
 */

import { makeThumbnail, putPhoto, getPhotoBlob } from '../lib/photoStore.js'

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
    const images = Array.from(files || []).filter(file => file?.type?.startsWith('image/'))
    if (!images.length) return []

    const stamp = Date.now()
    const assets = await Promise.all(images.map(async (file, index) => ({
        id: `photo-${stamp}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        name: photoNameFromFile(file),
        originalName: file.name,
        shoot: shootFromFile(file),
        src: await readAsDataUrl(file),
        bytes: file.size || 0,
        kind: 'image',
        addedAt: new Date().toISOString(),
        favorite: false,
        flagged: false,
        tags: []
    })))
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