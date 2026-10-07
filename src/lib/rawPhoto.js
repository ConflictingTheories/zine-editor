/*
 * Lib: rawPhoto
 * RAW files (NEF, CR3, ARW, DNG…) cannot be put straight into a canvas, but
 * every camera-written RAW carries a full-resolution JPEG preview embedded in
 * the TIFF container. For the editor's purposes — contact sheets, light table
 * previews, portfolio placement — that embedded preview is exactly what we
 * want to show, and it imports instantly without a native codec dependency.
 */

const RAW_EXTENSIONS = new Set([
    'nef', 'nrw', 'cr2', 'cr3', 'arw', 'srf', 'sr2', 'dng', 'raf', 'orf',
    'rw2', 'pef', 'srw', '3fr', 'fff', 'iiq', 'rwl', 'x3f'
])

/** Lowercase extension (no dot) of a File-like, or ''. */
export const fileExtension = (file) => {
    const name = String(file?.name || '')
    const i = name.lastIndexOf('.')
    return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export const isRawPhotoFile = (file) =>
    RAW_EXTENSIONS.has(fileExtension(file)) ||
    /^image\/(x-)?(nef|nrw|cr2|cr3|arw|dng|raf|orf|rw2|pef|srw)$/i.test(String(file?.type || ''))

/** Short camera-format label for badges, e.g. "NEF". */
export const rawFormatLabel = (file) => fileExtension(file).toUpperCase() || 'RAW'

export const RAW_ACCEPT = Array.from(RAW_EXTENSIONS).map(ext => `.${ext}`).join(',')

/** Accept attribute value covering ordinary images plus camera RAW files. */
export const PHOTO_ACCEPT = `image/*,${RAW_ACCEPT}`

const TYPE_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 }

const tagValue = (view, entryOffset, type, count, little, dataStart) => {
    const size = (TYPE_SIZES[type] || 1) * count
    if (size <= 4) return view.getUint32(entryOffset + 8, little) & (size === 4 ? 0xffffffff : (1 << (size * 8)) - 1)
    const offset = view.getUint32(entryOffset + 8, little)
    if (offset >= 0 && offset + size <= view.byteLength) {
        if (type === 3 && count === 1) return view.getUint16(offset, little)
        return view.getUint32(offset, little)
    }
    return 0
}

/**
 * Walk the TIFF IFD chain(s) of a RAW buffer and pick out embedded JPEG
 * candidates (tag 513/514 pair), largest first.
 */
export const findEmbeddedJpegs = (view) => {
    const little = view.getUint16(0) === 0x4949
    if (view.getUint16(2, little) !== 42 && view.getUint16(2, little) !== 0x2a00) return []
    const candidates = []
    const visitIfd = (ifdOffset, depth) => {
        if (depth > 8 || ifdOffset <= 0 || ifdOffset + 2 > view.byteLength) return
        const count = view.getUint16(ifdOffset, little)
        let jpegOffset = 0, jpegLength = 0, subIfdOffset = 0
        for (let i = 0; i < count; i++) {
            const e = ifdOffset + 2 + i * 12
            if (e + 12 > view.byteLength) break
            const tag = view.getUint16(e, little)
            const type = view.getUint16(e + 2, little)
            const num = view.getUint32(e + 4, little)
            if (tag === 0x0201) jpegOffset = tagValue(view, e, type, num, little)
            else if (tag === 0x0202) jpegLength = tagValue(view, e, type, num, little)
            else if (tag === 0x014a) subIfdOffset = tagValue(view, e, type, num, little)
        }
        if (jpegOffset > 0 && jpegLength > 1000 && jpegOffset + jpegLength <= view.byteLength) {
            candidates.push({ offset: jpegOffset, length: jpegLength })
        }
        if (subIfdOffset > 0) visitIfd(subIfdOffset, depth + 1)
        const nextOffset = view.getUint32(ifdOffset + 2 + count * 12, little)
        if (nextOffset > ifdOffset) visitIfd(nextOffset, depth + 1)
    }
    visitIfd(view.getUint32(4, little), 0)
    return candidates.sort((a, b) => b.length - a.length)
}

/** Fallback: scan for raw JPEG SOI/EOI marker pairs, largest wins. */
const scanForJpegs = (bytes) => {
    const candidates = []
    for (let i = 0; i < bytes.length - 3; i++) {
        if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
            for (let j = i + 4; j < bytes.length - 1 && j < i + 40 * 1024 * 1024; j++) {
                if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
                    if (j - i > 20000) candidates.push({ offset: i, length: j - i + 2 })
                    i = j + 1
                    break
                }
            }
        }
    }
    return candidates.sort((a, b) => b.length - a.length)
}

/**
 * Extract the best embedded JPEG preview from a RAW file.
 * Accepts an ArrayBuffer or a File/Blob (anything with arrayBuffer()).
 * Returns a Blob of image/jpeg, or null when the file has no usable preview.
 */
export const extractEmbeddedJpeg = async (input) => {
    try {
        const buffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer()
        const view = new DataView(buffer)
        if (view.byteLength < 16) return null
        const candidates = findEmbeddedJpegs(view)
        let best = candidates[0]
        if (!best) best = scanForJpegs(new Uint8Array(buffer))[0]
        if (!best) return null
        return new Blob([buffer.slice(best.offset, best.offset + best.length)], { type: 'image/jpeg' })
    } catch {
        return null
    }
}
