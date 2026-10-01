/*
 * Library: photoLibrary
 * Pure helpers backing the photography workflow: asset metadata, sorting,
 * filtering, usage indexing, frame presets and automatic placement.
 *
 * Everything here is side-effect free so it can be unit tested and reused by
 * the editor, the Light Table and the export pipeline.
 *
 * Page dimensions are passed in rather than imported, so this module stays
 * free of build-time environment lookups and testable under plain node.
 */

export const SORT_OPTIONS = [
    { id: 'recent', label: 'Newest first' },
    { id: 'oldest', label: 'Oldest first' },
    { id: 'name', label: 'Name A→Z' },
    { id: 'name-desc', label: 'Name Z→A' },
    { id: 'largest', label: 'Largest file' },
    { id: 'aspect', label: 'Widest first' },
    { id: 'used', label: 'Most used' }
]

export const FILTER_OPTIONS = [
    { id: 'all', label: 'All photos' },
    { id: 'unused', label: 'Not yet placed' },
    { id: 'used', label: 'Placed in book' },
    { id: 'favorites', label: 'Favourites' },
    { id: 'flagged', label: 'Needs work' },
    { id: 'picks', label: 'Final selects' },
    { id: 'rejected', label: 'Rejected' },
    { id: 'developed', label: 'Developed' },
    { id: 'portrait', label: 'Portrait' },
    { id: 'landscape', label: 'Landscape' }
]

/** Read a numeric size hint from an asset, tolerating several field names. */
export const assetSize = (asset) => {
    const width = Number(asset?.width || asset?.naturalWidth || 0)
    const height = Number(asset?.height || asset?.naturalHeight || 0)
    return {
        width: width > 0 ? width : null,
        height: height > 0 ? height : null,
        bytes: Number(asset?.bytes || asset?.size || 0) || null
    }
}

export const assetAspect = (asset) => {
    const { width, height } = assetSize(asset)
    return width && height ? width / height : null
}

export const assetOrientation = (asset) => {
    const aspect = assetAspect(asset)
    if (!aspect) return 'unknown'
    if (aspect > 1.02) return 'landscape'
    if (aspect < 0.98) return 'portrait'
    return 'square'
}

/** Human friendly megapixel / dimensions label used across the library UI. */
export const assetDimensionsLabel = (asset) => {
    const { width, height } = assetSize(asset)
    if (!width || !height) return 'Size unknown'
    const mp = (width * height) / 1_000_000
    return `${width} × ${height}${mp >= 0.5 ? `  ·  ${mp.toFixed(1)} MP` : ''}`
}

export const assetLabel = (asset) =>
    String(asset?.name || asset?.id || 'Untitled').replace(/\.[^.]+$/, '')

/**
 * Build an index of which library assets are already placed in a project and
 * how many times. Matching is by `assetId` first, then by source so legacy
 * elements placed before asset linking still count.
 */
export const buildUsageIndex = (project, assets = []) => {
    const usage = {}
    const pages = project?.pages || []

    // Map every known source back to its asset id so elements placed before
    // asset linking existed still register as "used".
    const idBySrc = {}
        ; (assets || []).forEach(asset => { if (asset?.src) idBySrc[asset.src] = asset.id })

    pages.forEach((page, pageIdx) => {
        ; (page.elements || []).forEach(element => {
            if (!element) return
            const id = element.assetId || (element.src ? idBySrc[element.src] : null)
            if (!id) return
            if (!usage[id]) usage[id] = { count: 0, placements: [] }
            usage[id].count += 1
            usage[id].placements.push({ pageIdx, elementId: element.id, type: element.type })
        })
    })
    return { usage }
}

const matchesQuery = (asset, query) => {
    if (!query) return true
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
        assetLabel(asset).toLowerCase().includes(q) ||
        String(asset?.id || '').toLowerCase().includes(q) ||
        String(asset?.shoot || '').toLowerCase().includes(q) ||
        String(asset?.originalName || '').toLowerCase().includes(q) ||
        (asset?.tags || []).some(tag => String(tag).toLowerCase().includes(q))
    )
}

const matchesFilter = (asset, filter, useCount) => {
    switch (filter) {
        case 'unused': return !useCount
        case 'used': return useCount > 0
        case 'favorites': return Boolean(asset?.favorite)
        case 'flagged': return Boolean(asset?.flagged)
        case 'picks': return asset?.rating === 3
        case 'rejected': return asset?.rating === 1
        case 'developed': return Boolean(asset?.recipe)
        case 'portrait': return assetOrientation(asset) === 'portrait'
        case 'landscape': return assetOrientation(asset) === 'landscape'
        default: return true
    }
}

/**
 * Filter and sort a photo library. `usageIndex` is the output of
 * `buildUsageIndex`; when omitted the sort/filter simply treats every photo
 * as unused. `shoot` narrows to a single folder of a photographer's import.
 */
export const selectPhotos = (assets, { query = '', filter = 'all', sort = 'recent', shoot = 'all', usageIndex = null } = {}) => {
    const list = (assets || []).filter(asset => asset && asset.kind !== 'audio')
    const used = (asset) => (usageIndex?.usage?.[asset?.id]?.count || 0)

    const filtered = list.filter(asset =>
        matchesQuery(asset, query) &&
        matchesFilter(asset, filter, used(asset)) &&
        (shoot === 'all' || !shoot || asset?.shoot === shoot))

    const time = (asset) => new Date(asset?.addedAt || 0).getTime() || 0
    const name = (asset) => assetLabel(asset).toLowerCase()
    const comparators = {
        recent: (a, b) => time(b) - time(a),
        oldest: (a, b) => time(a) - time(b),
        name: (a, b) => name(a).localeCompare(name(b)),
        'name-desc': (a, b) => name(b).localeCompare(name(a)),
        largest: (a, b) => (assetSize(b).bytes || 0) - (assetSize(a).bytes || 0) || (assetSize(b).width || 0) - (assetSize(a).width || 0),
        aspect: (a, b) => (assetAspect(b) || 0) - (assetAspect(a) || 0),
        used: (a, b) => used(b) - used(a) || time(b) - time(a)
    }
    return [...filtered].sort(comparators[sort] || comparators.recent)
}

// ── Frame presets ──────────────────────────────────────────────────────────

/**
 * Frame treatments for `photo-frame` elements. `id` values are stable so they
 * can live in saved projects and in context menus.
 */
export const FRAME_PRESETS = [
    {
        id: 'none',
        name: 'Bare',
        hint: 'Image to the edge',
        style: { frameStyle: 'none', frameWidth: 0, frameColor: '#ffffff', frameBorderWidth: 0, frameBorderColor: '#000000', frameShadow: 'none' }
    },
    {
        id: 'hairline',
        name: 'Hairline',
        hint: '1px keyline, no mat',
        style: { frameStyle: 'mat', frameWidth: 0, frameColor: '#ffffff', frameBorderWidth: 1, frameBorderColor: '#0d0d0d', frameShadow: 'none' }
    },
    {
        id: 'mat',
        name: 'Mat',
        hint: 'Even white mat board',
        style: { frameStyle: 'mat', frameWidth: 22, frameColor: '#faf8f4', frameBorderWidth: 0, frameBorderColor: '#000000', frameShadow: '0 6px 18px rgba(0,0,0,.18)' }
    },
    {
        id: 'mat-asymmetric',
        name: 'Offset Mat',
        hint: 'Wider bottom — caption rail',
        style: { frameStyle: 'mat', frameWidth: 20, frameWidthBottom: 62, frameColor: '#faf8f4', frameBorderWidth: 0, frameBorderColor: '#000000', frameShadow: '0 6px 18px rgba(0,0,0,.18)' }
    },
    {
        id: 'black-mat',
        name: 'Black Mat',
        hint: 'Deep mount, high contrast',
        style: { frameStyle: 'mat', frameWidth: 26, frameColor: '#111111', frameBorderWidth: 0, frameBorderColor: '#111111', frameShadow: '0 8px 24px rgba(0,0,0,.45)' }
    },
    {
        id: 'inset-rule',
        name: 'Inset Rule',
        hint: 'Windowed keyline inside a mat',
        style: { frameStyle: 'inset', frameWidth: 18, frameColor: '#f2efe9', frameBorderWidth: 1, frameBorderColor: '#1a1a1a', frameShadow: '0 4px 14px rgba(0,0,0,.16)' }
    },
    {
        id: 'bleed',
        name: 'Full Bleed',
        hint: 'Edge to edge, no mount',
        style: { frameStyle: 'bleed', frameWidth: 0, frameColor: '#000000', frameBorderWidth: 0, frameBorderColor: '#000000', frameShadow: 'none' }
    },
    {
        id: 'float-shadow',
        name: 'Floating',
        hint: 'Soft drop shadow on paper',
        style: { frameStyle: 'mat', frameWidth: 10, frameColor: '#ffffff', frameBorderWidth: 0, frameBorderColor: '#000000', frameShadow: '0 18px 40px rgba(0,0,0,.35)' }
    },
    {
        id: 'museum',
        name: 'Museum',
        hint: 'Deep white mount, generous, gallery weight',
        style: { frameStyle: 'mat', frameWidth: 40, frameColor: '#ffffff', frameBorderWidth: 0, frameBorderColor: '#0d0d0d', frameShadow: '0 10px 30px rgba(0,0,0,.22)' }
    },
    {
        id: 'gallery-print',
        name: 'Gallery Print',
        hint: 'Thin white mount, hairline outer rule',
        style: { frameStyle: 'mat', frameWidth: 14, frameColor: '#ffffff', frameBorderWidth: 3, frameBorderColor: '#1c1c1c', frameShadow: '0 4px 12px rgba(0,0,0,.16)' }
    },
    {
        id: 'darkroom',
        name: 'Darkroom',
        hint: 'Charcoal mount, low sheen',
        style: { frameStyle: 'mat', frameWidth: 24, frameColor: '#1c1c1c', frameBorderWidth: 0, frameBorderColor: '#000000', frameShadow: '0 12px 32px rgba(0,0,0,.55)' }
    },
    {
        id: 'ivory-mat',
        name: 'Ivory',
        hint: 'Warm off-white mount, softer than pure white',
        style: { frameStyle: 'mat', frameWidth: 26, frameColor: '#efe9dd', frameBorderWidth: 0, frameBorderColor: '#b7b0a2', frameShadow: '0 6px 18px rgba(0,0,0,.14)' }
    },
    {
        id: 'lobby-card',
        name: 'Rounded',
        hint: 'Soft radius, modern web/app presentation',
        style: { frameStyle: 'mat', frameWidth: 10, frameColor: '#ffffff', frameBorderWidth: 0, frameBorderColor: '#000000', frameRadius: 10, frameShadow: '0 6px 20px rgba(0,0,0,.18)' }
    },
    {
        id: 'bleed-edge',
        name: 'Bleed + Keyline',
        hint: 'Edge to edge with a hairline to hold the eye',
        style: { frameStyle: 'bleed', frameWidth: 0, frameColor: '#000000', frameBorderWidth: 2, frameBorderColor: '#ffffff', frameShadow: 'none' }
    },
    {
        id: 'pillar-caption',
        name: 'Pillar Caption',
        hint: 'Tall side rail for a vertical caption',
        style: { frameStyle: 'mat', frameWidth: 16, frameWidthBottom: 16, frameWidthRight: 58, frameColor: '#ffffff', frameBorderWidth: 0, frameBorderColor: '#000000', frameShadow: '0 6px 18px rgba(0,0,0,.18)' }
    }
]

export const getFramePreset = (id) => FRAME_PRESETS.find(preset => preset.id === id) || FRAME_PRESETS[0]

/** CSS box-shadow for a frame, honouring the soft/sharp/hard choices. */
export const frameShadowStyle = (presetId) => {
    const preset = getFramePreset(presetId)
    return preset.style.frameShadow || 'none'
}

// ── Geometry ───────────────────────────────────────────────────────────────

export const FIT_MODES = [
    { id: 'cover', label: 'Fill frame' },
    { id: 'contain', label: 'Fit inside' },
    { id: 'original', label: 'Original ratio' }
]

/**
 * Focal points for a frame. A photographer judges a crop by where the subject
 * is, not by the geometric centre, so the placement control is first-class.
 */
export const IMAGE_POSITIONS = [
    { id: 'center', label: 'Centre' },
    { id: 'top', label: 'Top' },
    { id: 'bottom', label: 'Bottom' },
    { id: 'left', label: 'Left' },
    { id: 'right', label: 'Right' }
]

/**
 * Size an element so an image of `asset` fills (or fits) a box of the given
 * size. Returns null when the asset size is unknown, so callers can fall back
 * to their requested geometry.
 */
export const fitAssetToBox = (asset, boxWidth, boxHeight, mode = 'cover') => {
    const { width, height } = assetSize(asset)
    if (!width || !height || !boxWidth || !boxHeight) return null
    const imageAspect = width / height
    const boxAspect = boxWidth / boxHeight
    if (mode === 'contain' || imageAspect === boxAspect) {
        return imageAspect > boxAspect
            ? { width: boxWidth, height: Math.round(boxWidth / imageAspect) }
            : { width: Math.round(boxHeight * imageAspect), height: boxHeight }
    }
    return imageAspect > boxAspect
        ? { width: Math.round(boxHeight * imageAspect), height: boxHeight }
        : { width: boxWidth, height: Math.round(boxWidth / imageAspect) }
}

const DEFAULT_MARGIN = 56
const DEFAULT_GUTTER = 18
const DEFAULT_COLUMNS = 2

/**
 * Find an empty slot for a new photo on the page: walks a column-major grid
 * over the page and returns the first cell that does not intersect an existing
 * element. This keeps bulk placement tidy instead of stacking everything on
 * top of the last drop point.
 */
export const findFreeSlot = (elements = [], { pageWidth, pageHeight, margin = DEFAULT_MARGIN, gutter = DEFAULT_GUTTER, columns = DEFAULT_COLUMNS } = {}) => {
    const safeW = pageWidth || 528
    const safeH = pageHeight || 816
    const used = elements.filter(element => element && element.type !== 'shape')
    const innerW = safeW - margin * 2
    const innerH = safeH - margin * 2
    const colW = (innerW - gutter * (columns - 1)) / columns
    const cellHeight = Math.round(colW * 0.75)

    const overlaps = (x, y) => used.some(element => {
        const ew = element.width || 0
        const eh = element.height || 0
        return x < (element.x || 0) + ew && x + colW > (element.x || 0) &&
            y < (element.y || 0) + eh && y + cellHeight > (element.y || 0)
    })

    // Walk the grid once, left to right and top to bottom, and take the first
    // free cell. The row count is derived from the page so the scan always
    // terminates — a full page falls through to the overflow placement below.
    const rows = Math.max(1, Math.floor((innerH + gutter) / (cellHeight + gutter)))
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < columns; col += 1) {
            const x = Math.round(margin + col * (colW + gutter))
            const y = Math.round(margin + row * (cellHeight + gutter))
            if (y + cellHeight > safeH) continue
            if (!overlaps(x, y)) return { x, y, width: Math.round(colW), height: cellHeight }
        }
    }

    // The page is full. Stagger below the content rather than failing silently
    // or looping, so the action is still discoverable and undoable.
    const lowest = used.reduce((max, element) => Math.max(max, (element.y || 0) + (element.height || 0)), margin)
    return {
        x: margin,
        y: Math.round(lowest + gutter),
        width: Math.round(colW),
        height: cellHeight
    }
}

/**
 * Build a `photo-frame` element for an asset. Frames are the portfolio's
 * primary placement primitive: they carry borders, captions and a live
 * reference back to the library so Light Table edits follow the image.
 */
export const createPhotoFrame = ({
    asset = null,
    x = 0,
    y = 0,
    width = 200,
    height = 260,
    presetId = 'mat',
    fit = 'cover',
    caption = '',
    zIndex = 0
} = {}) => {
    const preset = getFramePreset(presetId)
    const sized = asset ? fitAssetToBox(asset, width, height, fit) : null
    const base = {
        type: 'photo-frame',
        x: Math.round(x),
        y: Math.round(y),
        width: sized ? sized.width : Math.round(width),
        height: sized ? sized.height : Math.round(height),
        rotation: 0,
        opacity: 1,
        zIndex,
        locked: false,
        hidden: false,
        imageFit: fit,
        framePreset: preset.id,
        caption: caption || ''
    }
    return {
        ...base,
        ...preset.style,
        ...(asset
            ? {
                src: asset.src,
                assetId: asset.id,
                assetName: asset.name || asset.id,
                // A snapshot keeps older publications reproducible; the live
                // recipe from the library wins whenever the asset is present.
                lightTableRecipe: asset.recipe || null
            }
            : {})
    }
}

// ── Arrangement ────────────────────────────────────────────────────────────

/**
 * Snap a frame to a page edge with an even margin, optionally preserving its
 * size. This is the "put it on the bleed" move a photographer makes
 * constantly, and it should never require dragging to an exact coordinate.
 */
export const alignToPage = (element, { pageWidth, pageHeight }, edge, { margin = 0, preserveSize = true } = {}) => {
    if (!element || !pageWidth || !pageHeight) return element
    const w = preserveSize ? (element.width || 0) : pageWidth - margin * 2
    const h = preserveSize ? (element.height || 0) : pageHeight - margin * 2
    const next = { width: w, height: h }
    if (edge.includes('left')) next.x = margin
    if (edge.includes('right')) next.x = pageWidth - margin - w
    if (edge.includes('top')) next.y = margin
    if (edge.includes('bottom')) next.y = pageHeight - margin - h
    if (edge === 'center-h') next.x = Math.round((pageWidth - w) / 2)
    if (edge === 'center-v') next.y = Math.round((pageHeight - h) / 2)
    return { ...element, ...next }
}

/** Fit an element's box to the page's printable area at a given margin. */
export const fillPage = (element, page, { margin = 0 } = {}) =>
    alignToPage(element, page, 'top-left bottom-right', { margin, preserveSize: false })

/**
 * Crop a frame to a target aspect ratio, keeping the centre of the current
 * box. The result is the smallest change that makes the frame that shape.
 */
export const setFrameAspect = (element, ratio) => {
    if (!element || !ratio || !element.width || !element.height) return element
    const current = element.width / element.height
    if (current > ratio) return { ...element, width: Math.round(element.height * ratio) }
    return { ...element, height: Math.round(element.width / ratio) }
}

export const isEmptyFrame = (element) =>
    Boolean(element) && element.type === 'photo-frame' && !element.src

/** Swap the image inside a frame, keeping all frame styling and position. */
export const replaceFrameImage = (element, asset) => {
    if (!element || !asset) return element
    return {
        ...element,
        src: asset.src,
        assetId: asset.id,
        assetName: asset.name || asset.id,
        lightTableRecipe: asset.recipe || element.lightTableRecipe || null,
        caption: element.caption || ''
    }
}
