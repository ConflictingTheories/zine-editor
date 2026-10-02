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
 * Resolve a project's paper into concrete page geometry.
 *
 * @param {object} project  the open book (may lack `paperSize` — it predates it)
 * @param {object} [page]   a specific page, for pages with their own orientation
 * @returns {{key:string,label:string,inchW:number,inchH:number,
 *            width:number,height:number,bleed:number,gutter:number,dpi:number,
 *            landscape:boolean}}
 */
export function bookGeometry(project, page = null) {
    const key = project?.paperSize || DEFAULT_PAPER
    const size = PAPER_SIZES[key] || PAPER_SIZES[DEFAULT_PAPER]
    // A page carries its own orientation; a book with no pages yet falls back to
    // portrait, which is what the first spread will be.
    const landscape = (page?.orientation || project?.orientation) === 'landscape'

    // Inches are the source of truth. Orientation swaps them, not the pixel size.
    const inchW = landscape ? size.h : size.w
    const inchH = landscape ? size.w : size.h

    const dpi = WORKING_DPI
    return {
        key,
        label: size.label,
        inchW,
        inchH,
        width: Math.round(inchW * dpi),
        height: Math.round(inchH * dpi),
        bleed: Math.round(DEFAULT_BLEED * dpi),
        gutter: Math.round(DEFAULT_GUTTER * dpi),
        dpi,
        landscape
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
        // The gutter is only eaten on the bound (inner) edge of a spread.
        gutter: geo.gutter
    }
}

/** Human-readable trim size, e.g. "8.5 × 11 in". */
export function formatTrim(geo) {
    return `${geo.inchW} × ${geo.inchH} in`
}
