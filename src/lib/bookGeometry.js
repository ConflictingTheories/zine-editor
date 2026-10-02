/*
 * Book geometry — the single place that turns a paper size into numbers.
 *
 * Everything about a printed book has to agree: the canvas you lay out on, the
 * spread preview you judge it from, and the PDF a printer receives. They used
 * to disagree, because three different places each hardcoded 528x816 and the
 * PDF was built in CSS pixels — so a "digest" book exported as 5.5x8.5in only
 * by accident of the 96dpi CSS convention, and any other trim size could not be
 * expressed at all.
 *
 * The rule here: a book is measured in inches, and a page's pixel size is
 * always *derived* from its physical size at a declared DPI. The working
 * resolution is 150 DPI; print export is 300. Because both come from the same
 * inch figures, the matte ratios in the preview are the matte ratios in the
 * printed book.
 */

import { PAGE_W, PAGE_H, PAPER_SIZES, DEFAULT_BLEED, DEFAULT_GUTTER, DEFAULT_PAPER } from '../constants.js'

/** DPI for on-screen composition and matte compositing. */
export const WORKING_DPI = 150

/** DPI for print export. */
export const PRINT_DPI = 300

/**
 * Resolve a project's paper into concrete PAGE geometry.
 *
 * The page is always the trim size, upright. `page` is accepted for call-site
 * compatibility but deliberately does not change the result: a page is not
 * "landscape", a book is, and a book has one page size either way.
 *
 * @param {object} project  the open book (may lack `paperSize` — it predates it)
 * @returns {{key:string,label:string,inchW:number,inchH:number,
 *            width:number,height:number,bleed:number,gutter:number,dpi:number,
 *            landscape:boolean}}
 */
export function bookGeometry(project, page = null) {
    void page // a page never changes the trim; see the note above
    const key = project?.paperSize || DEFAULT_PAPER
    const size = PAPER_SIZES[key] || PAPER_SIZES[DEFAULT_PAPER]
    // Every page of a book has the SAME trim. A page is never itself
    // "landscape" — a book whose pages are wider than they are tall is a
    // landscape book, and it still has one page size. What changes is how many
    // pages you look at together, not the shape of a page.
    const dpi = WORKING_DPI
    const width = Math.round(size.w * dpi)
    const height = Math.round(size.h * dpi)
    return {
        key,
        label: size.label,
        inchW: size.w,
        inchH: size.h,
        width,
        height,
        bleed: Math.round(DEFAULT_BLEED * dpi),
        gutter: Math.round(DEFAULT_GUTTER * dpi),
        dpi,
        landscape: false
    }
}

/**
 * Legacy pixel size for code that has not been moved onto the paper model yet
 * (the zine editor, the .svrn reader bundle). Kept as one function so the
 * fallback is visible rather than a scattered 528 and 816.
 */
export function legacyPageSize(landscape = false) {
    return landscape ? { width: PAGE_H, height: PAGE_W } : { width: PAGE_W, height: PAGE_H }
}

/**
 * The printable area inside the trim: the page minus bleed and the binding
 * gutter. A photograph placed here cannot be trimmed away, which is the whole
 * point of knowing the paper size.
 */
export function safeArea(geo) {
    return {
        x: geo.bleed,
        y: geo.bleed,
        width: Math.max(1, geo.width - geo.bleed * 2),
        height: Math.max(1, geo.height - geo.bleed * 2),
        gutter: geo.gutter
    }
}

/** Human-readable trim size, e.g. "8.5 × 11 in". */
export function formatTrim(geo) {
    return `${geo.inchW} × ${geo.inchH} in`
}

/* ── Page & spread model ───────────────────────────────────────────────────
   A book is a sequence of PAGES. A "spread" is not a stored thing: it is two
   adjacent pages shown side by side, which is how a bound book is read. This is
   the correction that makes the rest of the maths fall out — there is no such
   thing as a "wide spread" page, only a portrait or landscape trim viewed as
   one page or as two. */

export const PAGE_KIND = {
    COVER: 'cover',
    BODY: 'body',
    BACK: 'back'
}

/**
 * Classify a page. The first and last pages of a book are the cover and back
 * cover and are always shown — and laid out — as single pages, because that is
 * how they are physically bound. Everything between is a body page.
 *
 * `explicit` lets a saved page declare its own kind so a book's structure
 * survives a page being inserted or deleted at the front.
 */
export function pageKind(page, index, total) {
    if (page?.pageKind && page.pageKind !== PAGE_KIND.BODY) return page.pageKind
    if (index === 0) return PAGE_KIND.COVER
    if (total > 1 && index === total - 1) return PAGE_KIND.BACK
    return PAGE_KIND.BODY
}

/** Covers and back covers are single pages; only body pages form spreads. */
export function isSpreadable(page, index, total) {
    return pageKind(page, index, total) === PAGE_KIND.BODY
}

/**
 * Group a page list into the things the UI actually shows.
 *
 * A cover or back cover is always its own group. Body pages are paired, and an
 * odd trailing body page is shown alone rather than dragged across a gap.
 *
 * @returns {Array<{kind:'single'|'spread', indices:number[], left:number|null, right:number|null}>}
 */
export function buildNavigation(pages, viewMode = 'single', anchor = 0) {
    const total = (pages || []).length
    if (!total) return []

    // In single-page mode every page stands alone, in order.
    if (viewMode === 'single') {
        return pages.map((page, i) => ({
            kind: 'single',
            indices: [i],
            left: i,
            right: null
        }))
    }

    const groups = []
    let i = 0
    while (i < total) {
        const kindHere = pageKind(pages[i], i, total)
        if (kindHere !== PAGE_KIND.BODY) {
            // A cover or back cover is never paired with anything.
            groups.push({ kind: 'single', indices: [i], left: i, right: null })
            i++
            continue
        }
        // A body page pairs with its neighbour only if that neighbour is also a
        // body page; pairing across a cover would put the cover in the middle.
        const next = i + 1
        if (next < total && pageKind(pages[next], next, total) === PAGE_KIND.BODY) {
            groups.push({ kind: 'spread', indices: [i, next], left: i, right: next })
            i = next + 1
        } else {
            groups.push({ kind: 'single', indices: [i], left: i, right: null })
            i++
        }
    }

    // Keep the requested page on screen by returning the group containing it.
    if (anchor != null) {
        const idx = groups.findIndex(g => g.indices.includes(anchor))
        if (idx > 0) {
            const [g] = groups.splice(idx, 1)
            groups.unshift(g)
        }
    }
    return groups
}

/** Geometry for a two-page spread laid out side by side, with a gutter between. */
export function spreadGeometry(geo) {
    return {
        pageWidth: geo.width,
        pageHeight: geo.height,
        width: geo.width * 2 + geo.gutter,
        height: geo.height,
        gutter: geo.gutter,
        bleed: geo.bleed
    }
}
