/*
 * Data: portfolioTemplates
 * Photography-first spread layouts. Deliberately separate from
 * `pageTemplates.js`, which serves the expressive zine editor: these are
 * composed of photo frames, mats and quiet typography with real baselines
 * rather than theme placeholders.
 */

import { getFramePreset } from '../lib/photoLibrary.js'
import { PAGE_W, PAGE_H } from '../constants.js'

const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

/**
 * A frame descriptor is resolved into a full element at creation time so
 * templates stay declarative and cheap to preview.
 */
const frame = (x, y, width, height, preset = 'mat', props = {}) => ({
    __frame: true, x, y, width, height, preset, ...props
})

const text = (content, x, y, width, height, props = {}) =>
    ({ __text: true, content, x, y, width, height, ...props })

const caption = (x, y, width, content) =>
    text(content, x, y, width, 16, { fontSize: 8, color: '#8a8578', fontFamily: 'DM Sans', align: 'center', letterSpacing: 1.2, role: 'caption' })

const hairline = (x, y, width, color = '#d8d3c8') =>
    ({ __shape: true, shape: 'line_h', x, y, width, height: 1, fill: color })

/**
 * Normalise a layout to declare how many PAGES it occupies.
 *
 * `pageCount: 2` means "two pages, shown side by side". `pageCount: 1` is a
 * single-page composition. Anything that used to say
 * `orientation: 'landscape'` was really a two-page layout, so that is mapped
 * here rather than requiring every template to be rewritten by hand.
 */
const withPageCount = layout => ({
    ...layout,
    pageCount: layout.pageCount ?? (layout.orientation === 'landscape' ? 2 : 1),
    // A page is never itself landscape. Kept only so the old field cannot be
    // read as page geometry anywhere.
    orientation: 'portrait'
})

const M = 48        // consistent outer margin
const G = 24        // consistent inner gutter
const ONE_W = PAGE_W          // 528
const ONE_H = PAGE_H          // 816
const TWO_W = PAGE_W * 2 + 24 // 1080

const RAW_PORTFOLIO_LAYOUTS = [
    // ── Single page ──────────────────────────────────────────────────────
    {
        id: 'pf-full-bleed',
        name: 'Full Bleed',
        category: 'Single',
        description: 'One photograph edge to edge. Maximum impact.',
        build: () => [frame(0, 0, ONE_W, ONE_H, 'bleed')]
    },
    {
        id: 'pf-dark-bleed',
        name: 'Night Bleed',
        category: 'Single',
        description: 'A full-bleed print on deep black — for night work.',
        build: () => [frame(0, 0, ONE_W, ONE_H, 'black-mat')],
        background: '#0d0d0d'
    },
    {
        id: 'pf-matted-full',
        name: 'Matted Hero',
        category: 'Single',
        description: 'A single hero print floating on white paper.',
        build: () => [
            frame(M + 8, M + 16, ONE_W - M * 2 - 16, 600, 'mat-asymmetric'),
            caption(M + 8, 700, ONE_W - M * 2 - 16, 'TITLE  ·  01')
        ]
    },
    {
        id: 'pf-diptych',
        name: 'Diptych',
        category: 'Paired',
        description: 'Two frames stacked with even margins.',
        build: () => [
            frame(M, M, ONE_W - M * 2, 344, 'mat'),
            frame(M, M + 344 + G, ONE_W - M * 2, 344, 'mat')
        ]
    },
    {
        id: 'pf-vertical-pair',
        name: 'Vertical Pair',
        category: 'Paired',
        description: 'Two tall frames side by side, suited to portrait work.',
        build: () => [
            frame(M, M, (ONE_W - M * 2 - G) / 2, ONE_H - M * 2, 'mat'),
            frame(M + (ONE_W - M * 2 - G) / 2 + G, M, (ONE_W - M * 2 - G) / 2, ONE_H - M * 2, 'mat')
        ]
    },
    {
        id: 'pf-solo-portrait',
        name: 'Solo Portrait',
        category: 'Single',
        description: 'One tall frame with a caption rail.',
        build: () => [
            frame(112, M, 304, ONE_H - M * 2 - 96, 'mat-asymmetric'),
            caption(112, ONE_H - M - 40, 304, 'PORTRAIT  ·  2024')
        ]
    },
    {
        id: 'pf-portfolio-quad',
        name: 'Quad Study',
        category: 'Grid',
        description: 'Four equal frames on a tight, even grid.',
        build: () => {
            const w = (ONE_W - M * 2 - G) / 2
            const h = (ONE_H - M * 2 - G - 32) / 2
            return [
                frame(M, M, w, h, 'hairline'),
                frame(M + w + G, M, w, h, 'hairline'),
                frame(M, M + h + G, w, h, 'hairline'),
                frame(M + w + G, M + h + G, w, h, 'hairline'),
                caption(M, ONE_H - M - 24, ONE_W - M * 2, 'STUDY  ·  FOUR VIEWS')
            ]
        }
    },
    {
        id: 'pf-hero-caption',
        name: 'Hero + Caption',
        category: 'Editorial',
        description: 'Photograph above, generous caption block below.',
        build: () => [
            frame(M, M, ONE_W - M * 2, 520, 'mat'),
            hairline(M, 616, ONE_W - M * 2),
            text('Untitled Series', M, 640, ONE_W - M * 2, 44, { fontSize: 30, color: '#141414', fontFamily: 'Playfair Display' }),
            text('A short description of the series goes here, set in a quiet serif at a comfortable measure.', M, 692, ONE_W - M * 2 - 90, 70, { fontSize: 13, color: '#6f6a60', fontFamily: 'Source Serif 4', lineHeight: 1.5 })
        ]
    },
    {
        id: 'pf-plinth',
        name: 'Plinth',
        category: 'Single',
        description: 'A floating print, high and alone, with air beneath it.',
        build: () => [
            frame(80, 96, ONE_W - 160, 420, 'float-shadow'),
            caption(80, 548, ONE_W - 160, 'UNTITLED  ·  2025')
        ]
    },
    {
        id: 'pf-title-page',
        name: 'Title Page',
        category: 'Editorial',
        description: 'Minimal cover: title, byline, hairline.',
        build: () => [
            text('YOUR NAME', M, 250, ONE_W - M * 2, 60, { fontSize: 40, color: '#141414', fontFamily: 'Playfair Display', letterSpacing: 2 }),
            hairline(216, 330, 96, '#b7b0a2'),
            text('Selected Works  ·  2019 — 2025', M, 356, ONE_W - M * 2, 30, { fontSize: 11, color: '#8a8578', fontFamily: 'DM Sans', letterSpacing: 3, align: 'center' }),
            text('Contact & commissions', M, 720, ONE_W - M * 2, 24, { fontSize: 10, color: '#a39d92', fontFamily: 'DM Sans', align: 'center', letterSpacing: 2 })
        ]
    },
    {
        id: 'pf-colophon',
        name: 'Colophon',
        category: 'Editorial',
        description: 'Credits, editions and contact for the back of the book.',
        build: () => [
            text('COLOPHON', M, 90, ONE_W - M * 2, 34, { fontSize: 22, color: '#141414', fontFamily: 'Playfair Display', letterSpacing: 4 }),
            hairline(M, 134, ONE_W - M * 2, '#d8d3c8'),
            text('Photography\n\nYour Name\n\nPrinted in an edition of 25.\n\nAll images remain the property of the photographer.\n\nhello@example.com', M, 168, ONE_W - M * 2, 320, { fontSize: 13, color: '#4a453d', fontFamily: 'Source Serif 4', lineHeight: 1.6 })
        ]
    },
    {
        id: 'pf-blank-spread',
        name: 'Blank Page',
        category: 'Single',
        description: 'An empty page — drop a single frame anywhere you like.',
        build: () => [frame(80, 220, ONE_W - 160, 360, 'mat')]
    },

    // ── Two-page spreads ─────────────────────────────────────────────────
    {
        id: 'pf-spread-bleed',
        name: 'Spread Bleed',
        category: 'Spread',
        pageCount: 2,
        description: 'One photograph flowing across both pages.',
        build: () => [
            frame(0, 0, ONE_W, ONE_H, 'bleed'),
            frame(ONE_W + 24, 0, ONE_W, ONE_H, 'bleed')
        ]
    },
    {
        id: 'pf-spread-diptych',
        name: 'Spread Diptych',
        category: 'Spread',
        pageCount: 2,
        description: 'A tall print on each page, balanced across the gutter.',
        build: () => [
            frame(M, M, ONE_W - M * 2, ONE_H - M * 2, 'mat'),
            frame(ONE_W + 24 + M, M, ONE_W - M * 2, ONE_H - M * 2, 'mat')
        ]
    },
    {
        id: 'pf-spread-hero',
        name: 'Spread Hero',
        category: 'Spread',
        pageCount: 2,
        description: 'Full-height photo on the left, title on the right.',
        build: () => [
            frame(M, M, ONE_W - M * 2, ONE_H - M * 2, 'mat'),
            text('Series Title', ONE_W + 24 + M, 340, ONE_W - M * 2, 50, { fontSize: 34, color: '#141414', fontFamily: 'Playfair Display' }),
            hairline(ONE_W + 24 + M, 410, 96, '#b7b0a2'),
            text('A note on the series, the place, or the making of these photographs.', ONE_W + 24 + M, 436, ONE_W - M * 2 - 60, 80, { fontSize: 13, color: '#6f6a60', fontFamily: 'Source Serif 4', lineHeight: 1.5 })
        ]
    },
    {
        id: 'pf-spread-triptych',
        name: 'Spread Triptych',
        category: 'Spread',
        pageCount: 2,
        description: 'One tall print against a pair — the panel split that reads well across a gutter.',
        build: () => [
            frame(M, M, ONE_W - M * 2, ONE_H - M * 2, 'hairline'),
            frame(ONE_W + 24 + M, M, ONE_W - M * 2, (ONE_H - M * 2 - G) / 2, 'hairline'),
            frame(ONE_W + 24 + M, M + (ONE_H - M * 2 - G) / 2 + G, ONE_W - M * 2, (ONE_H - M * 2 - G) / 2, 'hairline'),
            caption(M, ONE_H - M - 24, ONE_W - M * 2, 'I  ·  II  ·  III')
        ]
    },
    {
        id: 'pf-spread-quad',
        name: 'Spread Quad',
        category: 'Spread',
        pageCount: 2,
        description: 'Four equal frames, two per page.',
        build: () => {
            const w = (TWO_W - M * 2 - G) / 2
            const h = (ONE_H - M * 2 - G) / 2
            return [
                frame(M, M, w, h, 'hairline'),
                frame(M + w + G, M, w, h, 'hairline'),
                frame(M, M + h + G, w, h, 'hairline'),
                frame(M + w + G, M + h + G, w, h, 'hairline')
            ]
        }
    },
    {
        id: 'pf-spread-sequence',
        name: 'Sequence Strip',
        category: 'Series',
        pageCount: 2,
        description: 'Four frames in a row for a narrative run.',
        build: () => {
            const w = (TWO_W - M * 2 - G * 3) / 4
            return [
                frame(M, 240, w, 336, 'hairline'),
                frame(M + w + G, 240, w, 336, 'hairline'),
                frame(M + w * 2 + G * 2, 240, w, 336, 'hairline'),
                frame(M + w * 3 + G * 3, 240, w, 336, 'hairline'),
                text('SEQUENCE', M, 600, 400, 28, { fontSize: 12, letterSpacing: 8, color: '#8a8578', fontFamily: 'DM Sans' })
            ]
        }
    },
    {
        id: 'pf-spread-band',
        name: 'Overview Band',
        category: 'Series',
        pageCount: 2,
        description: 'A hero print on one page, a strip of detail shots opposite.',
        build: () => {
            const w = (ONE_W - M * 2 - G) / 2
            const y = ONE_H - M - 276
            return [
                frame(ONE_W + 24 + M, M, ONE_W - M * 2, 720, 'mat'),
                text('DETAILS', M, M + 8, 300, 24, { fontSize: 11, letterSpacing: 6, color: '#8a8578', fontFamily: 'DM Sans' }),
                frame(M, y, w, 276, 'hairline'),
                frame(M + w + G, y, w, 276, 'hairline')
            ]
        }
    },
    {
        id: 'pf-spread-statement',
        name: 'Statement',
        category: 'Editorial',
        pageCount: 2,
        description: 'A single frame with a large pull quote opposite.',
        build: () => [
            frame(M, M, ONE_W - M * 2, ONE_H - M * 2, 'mat'),
            text('Light does the editing for you.', ONE_W + 24 + M, 300, ONE_W - M * 2 - 40, 180, { fontSize: 32, color: '#141414', fontFamily: 'Playfair Display', lineHeight: 1.25, italic: true }),
            hairline(ONE_W + 24 + M, 510, 96, '#b7b0a2')
        ]
    },
    {
        id: 'pf-spread-mosaic',
        name: 'Spread Mosaic',
        category: 'Spread',
        pageCount: 2,
        description: 'One dominant image with a supporting stack.',
        build: () => {
            const sideX = ONE_W + 24 + M
            const sideW = ONE_W - M * 2
            const h = (ONE_H - M * 2 - G) / 2
            return [
                frame(M, M, sideW, ONE_H - M * 2, 'mat'),
                frame(sideX, M, sideW, h, 'hairline'),
                frame(sideX, M + h + G, sideW, h, 'hairline')
            ]
        }
    },
    {
        id: 'pf-spread-contrast',
        name: 'Contrast',
        category: 'Editorial',
        pageCount: 2,
        description: 'A small print against a large one — scale as emphasis.',
        build: () => [
            frame(M, 96, ONE_W - M * 2, ONE_H - 192, 'mat'),
            frame(ONE_W + 24 + M, 264, ONE_W - M * 2, 288, 'black-mat'),
            caption(M, 756, ONE_W - M * 2, 'PLATE I')
        ]
    },
    {
        id: 'pf-spread-mirror',
        name: 'Mirror',
        category: 'Spread',
        pageCount: 2,
        description: 'Two prints of equal size meeting at a centre rule.',
        build: () => [
            frame(M, 96, ONE_W - M * 2, 624, 'mat'),
            frame(ONE_W + 24 + M, 96, ONE_W - M * 2, 624, 'mat'),
            caption(M, 748, ONE_W - M * 2, '01'),
            caption(ONE_W + 24 + M, 748, ONE_W - M * 2, '02')
        ]
    },
    {
        id: 'pf-contact-sheet',
        name: 'Contact Sheet',
        category: 'Series',
        pageCount: 2,
        description: 'Six frames, three rows across both pages — a sequence at a glance.',
        build: () => {
            const w = (ONE_W - M * 2 - G) / 2
            const h = (ONE_H - M * 2 - G * 2) / 3
            const items = []
            for (let row = 0; row < 3; row += 1) {
                for (let col = 0; col < 2; col += 1) {
                    items.push(frame(M + col * (w + G), M + row * (h + G), w, h, 'hairline'))
                    items.push(frame(ONE_W + 24 + M + col * (w + G), M + row * (h + G), w, h, 'hairline'))
                }
            }
            items.push(text('CONTACT SHEET', M, M - 24, 400, 24, { fontSize: 11, letterSpacing: 5, color: '#8a8578', fontFamily: 'DM Sans' }))
            return items
        }
    }
]


const buildTextElement = (descriptor, index) => ({
    id: uid('el'),
    type: 'text',
    content: descriptor.content,
    x: descriptor.x,
    y: descriptor.y,
    width: descriptor.width,
    height: descriptor.height,
    fontSize: descriptor.fontSize ?? 16,
    fontFamily: descriptor.fontFamily || 'Source Serif 4',
    color: descriptor.color || '#141414',
    align: descriptor.align || 'left',
    bold: Boolean(descriptor.bold),
    italic: Boolean(descriptor.italic),
    lineHeight: descriptor.lineHeight || 'normal',
    letterSpacing: descriptor.letterSpacing || 0,
    role: descriptor.role,
    rotation: 0,
    opacity: 1,
    zIndex: 10 + index,
    locked: false,
    hidden: false
})

const buildShapeElement = (descriptor, index) => ({
    id: uid('el'),
    type: 'shape',
    shape: descriptor.shape,
    x: descriptor.x,
    y: descriptor.y,
    width: descriptor.width,
    height: descriptor.height,
    fill: descriptor.fill || '#000000',
    rotation: 0,
    opacity: 1,
    zIndex: index,
    locked: false,
    hidden: false
})

/** Every layout, normalised to declare how many pages it occupies. */
export const PORTFOLIO_LAYOUTS = RAW_PORTFOLIO_LAYOUTS.map(withPageCount)

/**
 * Instantiate a layout into one or more PAGE objects.
 *
 * Templates are authored in *sheet* space: for a two-page layout that is the two
 * pages side by side separated by a nominal gutter, which is what the old
 * landscape templates were written against. This maps that sheet onto the book's
 * real page size and slices it into the individual pages the book stores.
 *
 * Splitting on the gutter rather than a midpoint is what lets a two-page layout
 * survive a trim change: a layout authored against 528x816 pages lands on an A4
 * book with each page 595px wide, and every frame follows its own page.
 *
 * @returns {Array<object>} one page per page the layout occupies.
 */
export const createLayoutPages = (layout, { background = '#ffffff', pageSize = null, gutter = 0 } = {}) => {
    const descriptors = (layout?.build?.() || []).filter(Boolean)
    const pageCount = Math.max(1, Math.min(2, layout?.pageCount ?? 1))

    // The authoring sheet. 24px is the nominal gutter the two-page templates
    // were laid out around.
    const NOMINAL_GUTTER = 24
    const basePageW = PAGE_W
    const basePageH = PAGE_H
    const baseW = basePageW * pageCount + NOMINAL_GUTTER * (pageCount - 1)
    const baseH = basePageH

    const targetPageW = pageSize?.width || basePageW
    const targetPageH = pageSize?.height || basePageH
    const targetGutter = pageCount > 1 ? (gutter || NOMINAL_GUTTER) : 0
    const targetW = targetPageW * pageCount + targetGutter * (pageCount - 1)

    // Per-axis scale, so a layout fills the page exactly as authored rather than
    // being letterboxed. The paper decides the proportions; the arrangement is
    // preserved.
    const scaleX = targetW / baseW
    const scaleY = targetPageH / baseH
    const remap = value => Math.round(value * scaleX)
    const remapY = value => Math.round(value * scaleY)

    /** Clamp a box so it lies entirely within the sheet. */
    const clampBox = (x, y, width, height) => {
        const nx = Math.max(0, Math.min(x, targetW - 1))
        const ny = Math.max(0, Math.min(y, targetPageH - 1))
        return {
            x: nx,
            y: ny,
            width: Math.max(1, Math.min(width, targetW - nx)),
            height: Math.max(1, Math.min(height, targetPageH - ny))
        }
    }

    /** Scale a text/shape descriptor's geometry into the target page. */
    const remapDescriptor = d => {
        if (!d) return d
        const out = { ...d }
        if (typeof d.x === 'number') out.x = remap(d.x)
        if (typeof d.y === 'number') out.y = remapY(d.y)
        if (typeof d.width === 'number') out.width = remap(d.width)
        if (typeof d.height === 'number') out.height = remapY(d.height)
        if (typeof d.fontSize === 'number') out.fontSize = Math.round(d.fontSize * Math.min(scaleX, scaleY))
        return out
    }

    const stride = targetPageW + targetGutter
    /** Which page of the sheet a horizontal position falls on. */
    const pageOf = x => (pageCount === 1 ? 0 : (x < targetPageW + targetGutter / 2 ? 0 : 1))
    /** Re-base a sheet x into page-local coordinates. */
    const toLocalX = (x, pageIdx) => x - pageIdx * stride

    // One blank page per slot. An empty verso is still a real page in a book, so
    // a slot the template leaves empty is kept rather than dropped.
    const pages = Array.from({ length: pageCount }, (_, i) => ({
        id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        pageKind: null, // assigned by the caller against the whole book
        background: layout?.background || background,
        texture: null,
        elements: []
    }))

    descriptors.forEach((descriptor, index) => {
        let element
        if (descriptor.__frame) {
            const preset = getFramePreset(descriptor.preset)
            const box = clampBox(
                remap(descriptor.x),
                remapY(descriptor.y),
                remap(descriptor.width),
                remapY(descriptor.height)
            )
            element = {
                id: uid('el'),
                type: 'photo-frame',
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
                rotation: 0,
                opacity: 1,
                zIndex: index,
                locked: false,
                hidden: false,
                imageFit: descriptor.fit || 'cover',
                framePreset: preset.id,
                frameStyle: preset.style.frameStyle,
                frameWidth: descriptor.frameWidth ?? preset.style.frameWidth,
                frameWidthBottom: descriptor.frameWidthBottom ?? preset.style.frameWidthBottom,
                frameWidthRight: descriptor.frameWidthRight ?? preset.style.frameWidthRight,
                frameColor: preset.style.frameColor,
                frameBorderWidth: descriptor.frameBorderWidth ?? preset.style.frameBorderWidth,
                frameBorderColor: preset.style.frameBorderColor,
                frameShadow: descriptor.frameShadow ?? preset.style.frameShadow,
                frameRadius: descriptor.frameRadius ?? preset.style.frameRadius,
                frameWindowColor: preset.style.frameWindowColor,
                caption: descriptor.caption || ''
            }
        } else if (descriptor.__text) {
            element = buildTextElement(remapDescriptor(descriptor), index)
        } else if (descriptor.__shape) {
            element = buildShapeElement(remapDescriptor(descriptor), index)
        } else {
            element = { ...descriptor, id: uid('el'), zIndex: index }
        }

        // Route the element to the page its position falls on, then re-base into
        // page-local coordinates. An element starting on the left page but
        // overhanging the gutter stays on the left, so a full-bleed frame is
        // never split across two pages.
        const pageIdx = pageOf(element.x)
        const localX = toLocalX(element.x, pageIdx)
        if (localX < 0 || localX + element.width > targetPageW) {
            element.x = Math.max(0, Math.min(localX, targetPageW - 1))
            element.width = Math.max(1, Math.min(element.width, targetPageW - element.x))
        } else {
            element.x = localX
        }
        pages[pageIdx].elements.push(element)
    })

    return pages
}

/** Back-compat single-page wrapper, for callers that only want one page. */
export const createLayoutPage = (layout, opts = {}) => createLayoutPages(layout, opts)[0]

export const PORTFOLIO_LAYOUT_CATEGORIES = (() => {
    const seen = []
    PORTFOLIO_LAYOUTS.forEach(layout => { if (!seen.includes(layout.category)) seen.push(layout.category) })
    return seen
})()

export const getPortfolioLayout = (id) => PORTFOLIO_LAYOUTS.find(layout => layout.id === id) || null
