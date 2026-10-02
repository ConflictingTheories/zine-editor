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

const RAW_PORTFOLIO_LAYOUTS = [
    {
        id: 'pf-full-bleed',
        name: 'Full Bleed',
        category: 'Single',
        orientation: 'landscape',
        description: 'One photograph edge to edge. Maximum impact.',
        build: () => [frame(0, 0, PAGE_H, PAGE_W, 'bleed')]
    },
    {
        id: 'pf-matted-full',
        name: 'Matted Hero',
        category: 'Single',
        orientation: 'landscape',
        description: 'A single hero print floating on white paper.',
        build: () => [
            frame(96, 92, PAGE_H - 192, PAGE_W - 184, 'mat-asymmetric'),
            caption(PAGE_H / 2 - 160, 740, 320, 'TITLE  ·  01')
        ]
    },
    {
        id: 'pf-diptych',
        name: 'Diptych',
        category: 'Paired',
        orientation: 'portrait',
        description: 'Two frames stacked with a generous margin.',
        build: () => [
            frame(56, 56, 260, 330, 'mat'),
            frame(56, 430, 260, 330, 'mat')
        ]
    },
    {
        id: 'pf-pair-offset',
        name: 'Offset Pair',
        category: 'Paired',
        orientation: 'landscape',
        description: 'Two prints on a shared baseline, deliberately unbalanced.',
        build: () => [
            frame(72, 150, 300, 380, 'mat'),
            frame(452, 260, 240, 306, 'mat'),
            hairline(72, 594, 620)
        ]
    },
    {
        id: 'pf-triptych',
        name: 'Triptych',
        category: 'Series',
        orientation: 'landscape',
        description: 'Three frames in a row, tight gutters.',
        build: () => [
            frame(60, 180, 202, 270, 'hairline'),
            frame(288, 180, 202, 270, 'hairline'),
            frame(516, 180, 202, 270, 'hairline'),
            caption(60, 476, 658, 'I  ·  II  ·  III')
        ]
    },
    {
        id: 'pf-four-grid',
        name: 'Quad Grid',
        category: 'Series',
        orientation: 'landscape',
        description: 'A calm 2×2 contact-sheet arrangement.',
        build: () => [
            frame(60, 110, 296, 224, 'hairline'),
            frame(412, 110, 296, 224, 'hairline'),
            frame(60, 358, 296, 224, 'hairline'),
            frame(412, 358, 296, 224, 'hairline')
        ]
    },
    {
        id: 'pf-six-contact',
        name: 'Contact Sheet',
        category: 'Series',
        orientation: 'landscape',
        description: 'Six small frames — a sequence at a glance.',
        build: () => [
            frame(60, 130, 200, 150, 'hairline'),
            frame(288, 130, 200, 150, 'hairline'),
            frame(516, 130, 200, 150, 'hairline'),
            frame(60, 300, 200, 150, 'hairline'),
            frame(288, 300, 200, 150, 'hairline'),
            frame(516, 300, 200, 150, 'hairline'),
            text('CONTACT SHEET', 60, 490, 656, 24, { fontSize: 11, letterSpacing: 5, color: '#8a8578', fontFamily: 'DM Sans' })
        ]
    },
    {
        id: 'pf-mosaic',
        name: 'Editorial Mosaic',
        category: 'Grid',
        orientation: 'landscape',
        description: 'One dominant image with a supporting stack.',
        build: () => [
            frame(56, 96, 400, 500, 'mat'),
            frame(496, 96, 216, 236, 'hairline'),
            frame(496, 360, 216, 236, 'hairline')
        ]
    },
    {
        id: 'pf-staircase',
        name: 'Staircase',
        category: 'Grid',
        orientation: 'portrait',
        description: 'A descending rhythm of equal frames.',
        build: () => [
            frame(96, 60, 190, 240, 'mat'),
            frame(126, 300, 190, 240, 'mat'),
            frame(156, 540, 190, 240, 'mat')
        ]
    },
    {
        id: 'pf-hero-caption',
        name: 'Hero + Caption',
        category: 'Editorial',
        orientation: 'landscape',
        description: 'Photograph above, generous caption block below.',
        build: () => [
            frame(120, 60, 520, 400, 'mat'),
            hairline(120, 500, 520),
            text('Untitled Series', 120, 524, 520, 44, { fontSize: 30, color: '#141414', fontFamily: 'Playfair Display' }),
            text('A short description of the series goes here, set in a quiet serif at a comfortable measure.', 120, 574, 430, 70, { fontSize: 13, color: '#6f6a60', fontFamily: 'Source Serif 4', lineHeight: 1.5 })
        ]
    },
    {
        id: 'pf-quote-spread',
        name: 'Statement',
        category: 'Editorial',
        orientation: 'landscape',
        description: 'A single frame with a large pull quote.',
        build: () => [
            frame(56, 96, 268, 340, 'mat'),
            text('Light does the editing for you.', 372, 190, 340, 160, { fontSize: 30, color: '#141414', fontFamily: 'Playfair Display', lineHeight: 1.25, italic: true }),
            hairline(372, 372, 60, '#b7b0a2')
        ]
    },
    {
        id: 'pf-vertical-pair',
        name: 'Vertical Pair',
        category: 'Paired',
        orientation: 'portrait',
        description: 'Two tall frames side by side, suited to portrait work.',
        build: () => [
            frame(48, 48, 202, 480, 'mat'),
            frame(278, 48, 202, 480, 'mat')
        ]
    },
    {
        id: 'pf-solo-portrait',
        name: 'Solo Portrait',
        category: 'Single',
        orientation: 'portrait',
        description: 'One tall frame with a caption rail.',
        build: () => [
            frame(112, 40, 304, 600, 'mat-asymmetric'),
            caption(112, 668, 304, 'PORTRAIT  ·  2024')
        ]
    },
    {
        id: 'pf-title-page',
        name: 'Title Page',
        category: 'Editorial',
        orientation: 'portrait',
        description: 'Minimal cover: title, byline, hairline.',
        build: () => [
            text('YOUR NAME', 56, 250, 416, 60, { fontSize: 40, color: '#141414', fontFamily: 'Playfair Display', letterSpacing: 2 }),
            hairline(216, 330, 96, '#b7b0a2'),
            text('Selected Works  ·  2019 — 2025', 56, 356, 416, 30, { fontSize: 11, color: '#8a8578', fontFamily: 'DM Sans', letterSpacing: 3, align: 'center' }),
            text('Contact & commissions', 56, 720, 416, 24, { fontSize: 10, color: '#a39d92', fontFamily: 'DM Sans', align: 'center', letterSpacing: 2 })
        ]
    },
    {
        id: 'pf-colophon',
        name: 'Colophon',
        category: 'Editorial',
        orientation: 'portrait',
        description: 'Credits, editions and contact for the back of the book.',
        build: () => [
            text('COLOPHON', 56, 90, 416, 34, { fontSize: 22, color: '#141414', fontFamily: 'Playfair Display', letterSpacing: 4 }),
            hairline(56, 134, 416, '#d8d3c8'),
            text('Photography\n\nYour Name\n\nPrinted in an edition of 25.\n\nAll images remain the property of the photographer.\n\nhello@example.com', 56, 168, 416, 320, { fontSize: 13, color: '#4a453d', fontFamily: 'Source Serif 4', lineHeight: 1.6 })
        ]
    },
    {
        id: 'pf-blank-spread',
        name: 'Blank Spread',
        category: 'Single',
        orientation: 'landscape',
        description: 'An empty page — drop a single frame anywhere you like.',
        build: () => [frame(200, 200, 368, 276, 'mat')]
    },
    {
        id: 'pf-honours-fifteen',
        name: 'Fifteen',
        category: 'Grid',
        orientation: 'landscape',
        description: 'Fifteen small frames, five across — a sequence at a glance.',
        build: () => {
            const items = []
            const w = 106; const h = 88; const x0 = 44; const y0 = 168
            for (let row = 0; row < 3; row += 1) {
                for (let col = 0; col < 5; col += 1) {
                    items.push(frame(x0 + col * (w + 12), y0 + row * (h + 12), w, h, 'hairline'))
                }
            }
            items.push(text('FIFTEEN', x0, 96, 300, 24, { fontSize: 11, letterSpacing: 6, color: '#8a8578', fontFamily: 'DM Sans' }))
            return items
        }
    },
    {
        id: 'pf-mirror-duo',
        name: 'Mirror',
        category: 'Paired',
        orientation: 'landscape',
        description: 'Two prints of equal size meeting at a centre rule.',
        build: () => [
            frame(56, 96, 200, 268, 'mat'),
            frame(512, 96, 200, 268, 'mat'),
            hairline(430, 96, 1, '#c9c3b6'),
            caption(56, 392, 200, '01'),
            caption(512, 392, 200, '02')
        ]
    },
    {
        id: 'pf-dark-bleed',
        name: 'Night Bleed',
        category: 'Single',
        orientation: 'landscape',
        description: 'A full-bleed print on deep black — for night work.',
        build: () => [frame(0, 0, PAGE_H, PAGE_W, 'black-mat')],
        background: '#0d0d0d'
    },
    {
        id: 'pf-portfolio-quad',
        name: 'Quad Study',
        category: 'Grid',
        orientation: 'portrait',
        description: 'Four equal frames on a tight, even grid.',
        build: () => [
            frame(56, 56, 196, 300, 'hairline'),
            frame(276, 56, 196, 300, 'hairline'),
            frame(56, 396, 196, 300, 'hairline'),
            frame(276, 396, 196, 300, 'hairline'),
            caption(56, 736, 416, 'STUDY  ·  FOUR VIEWS')
        ]
    },
    {
        id: 'pf-overview-band',
        name: 'Overview Band',
        category: 'Series',
        orientation: 'landscape',
        description: 'A hero print above a strip of supporting detail shots.',
        build: () => [
            frame(56, 72, 624, 300, 'mat'),
            frame(56, 404, 196, 148, 'hairline'),
            frame(272, 404, 196, 148, 'hairline'),
            frame(488, 404, 192, 148, 'hairline')
        ]
    },
    {
        id: 'pf-plinth',
        name: 'Plinth',
        category: 'Single',
        orientation: 'landscape',
        description: 'A floating print, high and alone, with air beneath it.',
        build: () => [
            frame(200, 64, 368, 276, 'float-shadow'),
            caption(200, 380, 368, 'UNTITLED  ·  2025')
        ]
    },
    {
        id: 'pf-pair-stack-wide',
        name: 'Wide Stack',
        category: 'Paired',
        orientation: 'landscape',
        description: 'Two wide prints stacked with a deliberate overlap.',
        build: () => [
            frame(120, 96, 480, 216, 'mat'),
            frame(248, 330, 480, 216, 'mat')
        ]
    },
    {
        id: 'pf-sequence-strip',
        name: 'Sequence Strip',
        category: 'Series',
        orientation: 'landscape',
        description: 'Four frames in a row for a narrative run of images.',
        build: () => [
            frame(48, 208, 144, 108, 'hairline'),
            frame(216, 208, 144, 108, 'hairline'),
            frame(384, 208, 144, 108, 'hairline'),
            frame(552, 208, 144, 108, 'hairline'),
            text('SEQUENCE', 48, 132, 648, 28, { fontSize: 12, letterSpacing: 8, color: '#8a8578', fontFamily: 'DM Sans' })
        ]
    },
    {
        id: 'pf-contrast-spread',
        name: 'Contrast',
        category: 'Editorial',
        orientation: 'landscape',
        description: 'A small print against a large one — scale as emphasis.',
        build: () => [
            frame(56, 120, 340, 432, 'mat'),
            frame(456, 240, 216, 272, 'black-mat'),
            caption(56, 580, 340, 'PLATE I')
        ]
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
