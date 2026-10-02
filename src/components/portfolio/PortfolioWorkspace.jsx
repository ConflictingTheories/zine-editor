/*
 * Component: PortfolioWorkspace
 * The photographer's composing surface. Deliberately not the zine editor with
 * the shape tools hidden — the chrome, keyboard flow and defaults are built
 * around placing, sequencing and finishing photographs.
 *
 *   Library (left)  →  Spread (centre)  →  Frame inspector (right)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useVP } from '../../context/VPContext.jsx'
import PhotoLibrary from './PhotoLibrary.jsx'
import PortfolioContextMenu from './PortfolioContextMenu.jsx'
import PortfolioLayouts from './PortfolioLayouts.jsx'
import Canvas from '../Canvas.jsx'
import PropertyPanel from '../PropertyPanel.jsx'
import { FRAME_PRESETS, FIT_MODES, IMAGE_POSITIONS, createPhotoFrame, findFreeSlot } from '../../lib/photoLibrary.js'
import { filesToAssets, commitAssets } from '../../utils/photoImport.js'
import { PAPER_SIZES } from '../../constants.js'
import {
    bookGeometry, formatTrim, spreadGeometry,
    buildNavigation, pageKind, PAGE_KIND
} from '../../lib/bookGeometry.js'

/** Quick frame styles rendered as a compact strip above the canvas. */
const FrameStrip = ({ element, onApply, onOpenMenu }) => {
    if (element?.type !== 'photo-frame') return null
    return (
        <div className="pf-frame-strip">
            <span className="pf-frame-strip-label">Mount</span>
            {FRAME_PRESETS.map(preset => (
                <button
                    key={preset.id}
                    type="button"
                    title={preset.hint}
                    className={`pf-frame-chip ${(element.framePreset || 'mat') === preset.id ? 'active' : ''}`}
                    onClick={() => onApply({ ...preset.style, framePreset: preset.id })}
                >
                    <span
                        className="pf-frame-chip-swatch"
                        style={{
                            background: preset.style.frameStyle === 'bleed' || preset.style.frameStyle === 'none'
                                ? 'linear-gradient(135deg,#2b2b2b 0 45%,#d8d3c8 45% 100%)'
                                : preset.style.frameColor,
                            border: preset.style.frameBorderWidth
                                ? `1px solid ${preset.style.frameBorderColor}`
                                : '1px solid rgba(0,0,0,.25)'
                        }}
                    />
                </button>
            ))}
            <span className="pf-frame-strip-divider" />
            {FIT_MODES.map(mode => (
                <button
                    key={mode.id}
                    type="button"
                    className={`pf-fit-chip ${(element.imageFit || 'cover') === mode.id ? 'active' : ''}`}
                    onClick={() => onApply({ imageFit: mode.id })}
                >
                    {mode.label}
                </button>
            ))}
            <button type="button" className="pf-frame-more" onClick={onOpenMenu} title="More frame options">⋯</button>
        </div>
    )
}

/**
 * Typefaces offered for book captions. Deliberately short: a photo book sets
 * captions in one or two faces, and a 30-item dropdown only makes choosing
 * slower. These are all bundled in `public/fonts`, so every option renders.
 */
const CAPTION_FONTS = ['DM Sans', 'Playfair Display', 'Source Serif 4', 'Inter', 'Roboto Mono']

/** Right-hand inspector for the selected photo frame. */
const FrameInspector = ({ element, pageIdx, usage, onChange, onDevelop, onReplace, onDelete, onFillEmpty }) => {
    if (!element) {
        return (
            <div className="pf-inspector pf-inspector-empty">
                <p className="prop-hint">Select a frame to adjust its mount, fit and caption.</p>
                <button type="button" className="pf-btn" onClick={onFillEmpty}>Fill empty frames from library</button>
            </div>
        )
    }
    if (element.type !== 'photo-frame') {
        return (
            <div className="pf-inspector">
                <h4>Selected item</h4>
                <p className="prop-hint">This is a {element.type}. Use the Design tab for its full settings.</p>
            </div>
        )
    }

    const matColour = /^#[0-9a-f]{6}$/i.test(element.frameColor || '') ? element.frameColor : '#faf8f4'

    return (
        <div className="pf-inspector">
            <h4>Photo frame</h4>

            <div className="pf-inspector-row">
                <button type="button" className="pf-btn" onClick={onReplace}>⇄ Replace image</button>
                <button type="button" className="pf-btn" onClick={onDevelop}>◐ Develop</button>
            </div>

            {element.assetName && <p className="pf-inspector-source">From library: <strong>{element.assetName}</strong></p>}
            {element.lightTableRecipe && <p className="pf-inspector-badge">Developed — recipe is live and non-destructive</p>}

            <div className="pf-field">
                <label htmlFor="pf-fit">How it fills</label>
                <select id="pf-fit" value={element.imageFit || 'cover'} onChange={e => onChange({ imageFit: e.target.value })}>
                    {FIT_MODES.map(mode => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
                </select>
            </div>

            <div className="pf-field">
                <label>Focal point</label>
                <div className="pf-focal-row">
                    {IMAGE_POSITIONS.map(pos => (
                        <button
                            key={pos.id}
                            type="button"
                            title={pos.label}
                            className={`pf-focal ${(element.imagePosition || 'center') === pos.id ? 'active' : ''}`}
                            onClick={() => onChange({ imagePosition: pos.id })}
                        >
                            <span className={`ctx-focal-dot is-${pos.id}`} />
                        </button>
                    ))}
                </div>
            </div>

            <div className="pf-field">
                <label htmlFor="pf-caption">Caption</label>
                <input
                    id="pf-caption"
                    type="text"
                    value={element.caption || ''}
                    placeholder="Title, year, location…"
                    onChange={e => onChange({ caption: e.target.value })}
                />
            </div>

            {/* Typography is inline rather than behind a tab: a caption's size,
                weight and alignment are judged against the image next to them,
                so the controls have to be visible while the frame is on screen. */}
            <div className="pf-field">
                <label>Caption type</label>
                <div className="pf-caption-type">
                    <select
                        className="pf-ct-font"
                        aria-label="Caption font"
                        value={element.fontFamily || 'DM Sans'}
                        onChange={e => onChange({ fontFamily: e.target.value })}
                    >
                        {CAPTION_FONTS.map(font => <option key={font} value={font}>{font}</option>)}
                    </select>
                    <input
                        type="number"
                        aria-label="Caption size"
                        className="pf-ct-size"
                        min="6"
                        max="72"
                        value={element.fontSize ?? 11}
                        onChange={e => onChange({ fontSize: Math.min(72, Math.max(6, Number(e.target.value) || 6)) })}
                    />
                    <select
                        className="pf-ct-weight"
                        aria-label="Caption weight"
                        value={element.fontWeight || '400'}
                        onChange={e => onChange({ fontWeight: e.target.value })}
                    >
                        <option value="300">Light</option>
                        <option value="400">Regular</option>
                        <option value="500">Medium</option>
                        <option value="600">Semibold</option>
                        <option value="700">Bold</option>
                    </select>
                    <select
                        className="pf-ct-align"
                        aria-label="Caption alignment"
                        value={element.align || 'left'}
                        onChange={e => onChange({ align: e.target.value })}
                    >
                        <option value="left">Left</option>
                        <option value="center">Centre</option>
                        <option value="right">Right</option>
                    </select>
                </div>
            </div>

            <div className="pf-field">
                <label htmlFor="pf-mat">Mat width</label>
                <input
                    id="pf-mat"
                    type="range"
                    min="0"
                    max="80"
                    value={element.frameWidth ?? 18}
                    onChange={e => onChange({ frameWidth: Number(e.target.value) })}
                />
                <span className="pf-field-value">{element.frameWidth ?? 18}px</span>
            </div>

            <div className="pf-field">
                <label htmlFor="pf-mat-bottom">Caption rail</label>
                <input
                    id="pf-mat-bottom"
                    type="range"
                    min="0"
                    max="140"
                    value={element.frameWidthBottom ?? element.frameWidth ?? 18}
                    onChange={e => onChange({ frameWidthBottom: Number(e.target.value) })}
                />
                <span className="pf-field-value">{element.frameWidthBottom ?? element.frameWidth ?? 18}px</span>
            </div>

            <div className="pf-field">
                <label htmlFor="pf-mat-colour">Mat colour</label>
                {/* The colour input is wrapped in a swatch so the current mat is
                    visible as a chip, not hidden behind a swatch the OS paints. */}
                <label className="pf-colour-chip" htmlFor="pf-mat-colour">
                    <span className="pf-colour-swatch" style={{ background: matColour }} />
                    <span className="pf-colour-value">{matColour.toUpperCase()}</span>
                    <input
                        id="pf-mat-colour"
                        type="color"
                        value={matColour}
                        onChange={e => onChange({ frameColor: e.target.value })}
                    />
                </label>
            </div>

            <div className="pf-field">
                <label htmlFor="pf-border">Border</label>
                <div className="pf-input-group">
                    <input
                        id="pf-border"
                        type="number"
                        min="0"
                        max="24"
                        value={element.frameBorderWidth ?? 0}
                        onChange={e => onChange({ frameBorderWidth: Math.max(0, Number(e.target.value) || 0) })}
                    />
                    <input
                        type="color"
                        aria-label="Border colour"
                        value={/^#[0-9a-f]{6}$/i.test(element.frameBorderColor || '') ? element.frameBorderColor : '#111111'}
                        onChange={e => onChange({ frameBorderColor: e.target.value })}
                    />
                </div>
            </div>

            <div className="pf-field">
                <label htmlFor="pf-radius">Corner radius</label>
                <div className="pf-input-group">
                    <input
                        id="pf-radius"
                        type="number"
                        min="0"
                        max="64"
                        value={element.frameRadius ?? 0}
                        onChange={e => onChange({ frameRadius: Math.max(0, Number(e.target.value) || 0) })}
                    />
                </div>
            </div>

            <div className="pf-field">
                <label>Mount</label>
                <div className="pf-preset-row">
                    {FRAME_PRESETS.map(preset => (
                        <button
                            key={preset.id}
                            type="button"
                            className={`pf-chip ${(element.framePreset || 'mat') === preset.id ? 'active' : ''}`}
                            onClick={() => onChange({ ...preset.style, framePreset: preset.id })}
                        >
                            {preset.name}
                        </button>
                    ))}
                </div>
            </div>

            {usage?.count > 0 && (
                <p className="prop-hint">This photograph appears {usage.count}× in the book.</p>
            )}

            {/* Shot info: the EXIF a photographer actually wants on the frame
                when they come back to it. Read-only, because it describes the
                file rather than the layout. */}
            {(element.exif?.location || element.shotInfo?.location || element.exif?.date || element.shotInfo?.date || element.exif?.camera || element.shotInfo?.camera) && (
                <div className="pf-field pf-shot-info">
                    <label>Shot info</label>
                    <dl>
                        {(element.exif?.location || element.shotInfo?.location) && (
                            <><dt>Location</dt><dd>{element.exif?.location || element.shotInfo?.location}</dd></>
                        )}
                        {(element.exif?.date || element.shotInfo?.date) && (
                            <><dt>Date</dt><dd>{element.exif?.date || element.shotInfo?.date}</dd></>
                        )}
                        {(element.exif?.camera || element.shotInfo?.camera) && (
                            <><dt>Camera</dt><dd>{element.exif?.camera || element.shotInfo?.camera}</dd></>
                        )}
                    </dl>
                </div>
            )}

            <div className="pf-inspector-row">
                <button type="button" className="pf-btn danger" onClick={onDelete}>✕ Remove from spread</button>
            </div>
        </div>
    )
}

export default function PortfolioWorkspace({ project, pageIdx }) {
    const {
        vpState,
        updateVpState,
        updateElement,
        updateProjectSettings,
        addElement,
        deleteElement,
        addPage,
        duplicatePage,
        deletePage,
        previewProject,
        addImportedAssetsWithRoom,
        replaceElementImage,
        saveCurrentSpreadAsLayout,
        openLightTableFor,
        fillEmptyFrames,
        undo,
        redo,
        saveProject,
        showModal,
        toast
    } = useVP()

    const pages = project?.pages || []
    const safeIdx = Math.min(Math.max(pageIdx ?? 0, 0), Math.max(pages.length - 1, 0))
    const page = pages[safeIdx] || { id: 'empty', elements: [], background: '#ffffff' }
    const geo = useMemo(() => bookGeometry(project, page), [project, page])
    const pageWidth = geo.width
    const pageHeight = geo.height
    // Photographers work spread-by-spread: the next question is almost always
    // "what's on the next page", not "what's in the library". The library is one
    // click away, so defaulting to Spreads puts the commonest action first.
    const [leftTab, setLeftTab] = useState('spreads')
    const [rightTab, setRightTab] = useState('frame')
    const [zoom, setZoom] = useState(70)
    const [snapOn, setSnapOn] = useState(project?.portfolioSnapOn ?? true)
    // On by default: a book is trimmed, so knowing where the trim falls is not
    // an edge case, it is the thing that decides whether a composition prints.
    const [guides, setGuides] = useState(project?.portfolioShowGuides ?? true)
    // How many pages are shown at once. A book is read one page at a time or as
    // a two-page spread; a cover or back cover is always a single page because
    // that is how it is bound.
    const [viewMode, setViewMode] = useState(project?.portfolioViewMode || 'spread')
    const [ctxMenu, setCtxMenu] = useState({ visible: false, x: 0, y: 0, element: null })

    const selection = vpState.selection
    const selectedElement = selection?.type === 'element'
        ? (page.elements || []).find(el => el.id === selection.id) || null
        : null

    useEffect(() => {
        if (selectedElement) setRightTab(selectedElement.type === 'photo-frame' ? 'frame' : 'design')
    }, [selectedElement?.id, selectedElement?.type])

    useEffect(() => {
        setSnapOn(project?.portfolioSnapOn ?? true)
        setGuides(project?.portfolioShowGuides ?? true)
        setViewMode(project?.portfolioViewMode || 'spread')
    }, [project?.id])

    const assets = vpState.library?.imported || []

    const usageIndex = useMemo(() => {
        const usage = {}
        const idBySrc = {}
        assets.forEach(asset => { if (asset?.src) idBySrc[asset.src] = asset.id })
        pages.forEach((p, pIdx) => {
            ; (p.elements || []).forEach(el => {
                const id = el?.assetId || (el?.src ? idBySrc[el.src] : null)
                if (!id) return
                if (!usage[id]) usage[id] = { count: 0, placements: [] }
                usage[id].count += 1
                usage[id].placements.push({ pageIdx: pIdx, elementId: el.id })
            })
        })
        return usage
    }, [pages, assets])

    /* ── Page & spread navigation ────────────────────────────────────────
       The book is a list of pages. What the canvas shows is a *group*: one page
       (a cover, a back cover, or any page when the user is reading
       single-page) or two adjacent body pages shown as a spread. */
    const nav = useMemo(
        () => buildNavigation(pages, viewMode, safeIdx),
        [pages, viewMode, safeIdx]
    )
    /** The group containing the current page. `nav` is ordered with that group
        first, but reading `nav[0]` blindly would show the wrong pages whenever
        the user is on a cover or the back cover. */
    const currentGroup = useMemo(
        () => nav.find(g => g.indices.includes(safeIdx)) || nav[0] || { kind: 'single', indices: [safeIdx] },
        [nav, safeIdx]
    )
    /** The pages currently on the canvas: one or two indices. */
    const visibleIndices = currentGroup.indices?.length ? currentGroup.indices : [safeIdx]
    const isSpread = visibleIndices.length > 1
    const leftIdx = visibleIndices[0]
    const rightIdx = visibleIndices.length > 1 ? visibleIndices[1] : null
    const leftPage = pages[leftIdx] || page
    const rightPage = rightIdx != null ? pages[rightIdx] : null
    // Resolve only after the active group is known; calling useMemo before this
    // value existed read `isSpread` in its temporal dead zone during render.
    const shownWidth = isSpread ? pageWidth * 2 + geo.gutter : pageWidth

    // What the status readout calls the thing on screen.
    const viewLabel = useMemo(() => {
        if (!isSpread) {
            const kind = pageKind(page, safeIdx, pages.length)
            if (kind === PAGE_KIND.COVER) return 'Front cover'
            if (kind === PAGE_KIND.BACK) return 'Back cover'
            return `Page ${safeIdx + 1}`
        }
        return `Pages ${leftIdx + 1}–${rightIdx + 1}`
    }, [isSpread, page, safeIdx, pages.length, leftIdx, rightIdx])

    const gotoPage = (idx) => updateVpState({
        selection: { type: 'page', id: pages[idx]?.id, pageIdx: idx }
    })
    /**
     * Fit what is on screen. A two-page spread is roughly twice as wide as one
     * page, so switching view modes at the current zoom pushes half the spread
     * off the right edge. Re-fitting on the change keeps the whole opening
     * visible, which is the only reason to switch to it.
     */
    const fitToView = useCallback(() => {
        const wrap = document.getElementById('canvasWrap')
        if (!wrap) return
        const scale = Math.min(
            (wrap.clientWidth - 80) / shownWidth,
            (wrap.clientHeight - 80) / pageHeight,
            1
        )
        if (scale > 0) setZoom(Math.round(scale * 100))
    }, [shownWidth, pageHeight])

    useEffect(() => {
        let secondFrame = 0
        const firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(fitToView)
        })
        return () => {
            cancelAnimationFrame(firstFrame)
            if (secondFrame) cancelAnimationFrame(secondFrame)
        }
    }, [fitToView])

    const changeViewMode = (mode) => {
        setViewMode(mode)
        updateProjectSettings({ portfolioViewMode: mode })
        // The layout updates on the next render, so fit after it.
        requestAnimationFrame(() => requestAnimationFrame(fitToView))
    }

    const changeSnap = (enabled) => {
        setSnapOn(enabled)
        updateProjectSettings({ portfolioSnapOn: enabled })
    }

    const changeGuides = (enabled) => {
        setGuides(enabled)
        updateProjectSettings({ portfolioShowGuides: enabled })
    }

    const step = (delta) => {
        const at = nav.findIndex(g => g.indices.includes(safeIdx))
        const next = nav[at + delta]
        if (next) gotoPage(next.indices[0])
    }

    // ── Placement shortcuts ─────────────────────────────────────────────────
    const addFrame = useCallback((presetId = 'mat', asset = null) => {
        const slot = findFreeSlot(page.elements, {
            pageWidth,
            pageHeight
        })
        const element = createPhotoFrame({
            asset,
            x: slot.x,
            y: slot.y,
            width: slot.width,
            height: slot.height,
            presetId,
            zIndex: (page.elements || []).length
        })
        addElement(safeIdx, element)
    }, [page, pageWidth, pageHeight, safeIdx, addElement])

    const addText = useCallback((preset = {}) => {
        // Text defaults to a quiet caption rail rather than a headline: in a
        // book, most type is a caption, and the user promotes it if needed.
        addElement(safeIdx, {
            type: 'text',
            content: preset.content || 'Add a title or caption',
            x: preset.x ?? 56,
            y: preset.y ?? 56,
            width: preset.width ?? 320,
            height: preset.height ?? 48,
            fontSize: preset.fontSize ?? 24,
            fontFamily: preset.fontFamily || 'Playfair Display',
            color: preset.color || '#141414',
            align: preset.align || 'left',
            role: preset.role || 'caption',
            rotation: 0,
            opacity: 1
        })
        setRightTab('design')
    }, [safeIdx, addElement])

    /** A small set of type placements a photographer actually reaches for. */
    const TEXT_PRESETS = [
        { id: 'title', label: 'Title', content: 'Series title', fontSize: 34, width: 400, height: 56, fontFamily: 'Playfair Display', role: 'title' },
        { id: 'caption', label: 'Caption', content: 'A quiet caption', fontSize: 12, width: 280, height: 24, fontFamily: 'DM Sans', color: '#6f6a60', role: 'caption' },
        { id: 'body', label: 'Body', content: 'A short statement about the work, set at a comfortable measure.', fontSize: 13, width: 360, height: 80, fontFamily: 'Source Serif 4', color: '#4a453d', role: 'body' },
        { id: 'number', label: 'Plate no.', content: '01', fontSize: 10, width: 60, height: 20, fontFamily: 'DM Sans', color: '#8a8578', role: 'caption' }
    ]

    const addTextPreset = useCallback((preset) => {
        const w = pageWidth
        // Sit the block in the lower third: the classic caption position, and
        // it never collides with the frames templates put in the upper area.
        addText({ ...preset, x: Math.round((w - (preset.width ?? 320)) / 2), y: preset.y ?? Math.round(pageHeight - 116) })
    }, [addText, pageWidth, pageHeight])

    const handleRequestImage = useCallback((element) => {
        if (assets.length) {
            // With a library at hand, "click to add" fills with the next photo.
            const used = new Set(Object.keys(usageIndex))
            const next = assets.find(asset => !used.has(asset.id)) || assets[0]
            if (next) {
                replaceElementImage(safeIdx, element.id, next)
                toast(`Added “${next.name || 'photo'}”`, 'success')
                return
            }
        }
        toast('Import photographs from the library to fill frames', 'info')
    }, [assets, usageIndex, safeIdx, replaceElementImage, toast])

    const handleDropAsset = useCallback((element, event) => {
        const assetId = event.dataTransfer.getData('application/x-svrn-asset')
        const src = event.dataTransfer.getData('text/plain')
        const asset = assets.find(a => a.id === assetId)
            || (src ? { id: `external-${Date.now()}`, src, name: 'Dropped image' } : null)
        if (asset) replaceElementImage(safeIdx, element.id, asset)
    }, [assets, safeIdx, replaceElementImage])

    const handleImport = useCallback(async (files) => {
        const list = Array.from(files || []).filter(file => file?.type?.startsWith('image/'))
        if (!list.length) return
        const created = await filesToAssets(list)
        if (!created.length) return
        addImportedAssetsWithRoom(created)
        toast(`${created.length} photo${created.length === 1 ? '' : 's'} added to the library`, 'success')
        // Dropping files onto the canvas fills the frames *and* keeps the
        // originals in the library, so nothing is lost by placing.
        addImportedAssetsWithRoom(await commitAssets(created))
    }, [addImportedAssetsWithRoom, toast])

    const openReplacePicker = useCallback((element) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const [asset] = await filesToAssets([file])
            if (!asset) return
            addImportedAssetsWithRoom([asset])
            replaceElementImage(safeIdx, element.id, asset)
        }
        input.click()
    }, [safeIdx, addImportedAssetsWithRoom, replaceElementImage])

    const handleFillEmpty = useCallback(() => {
        const count = fillEmptyFrames(safeIdx, assets)
        toast(count
            ? `Filled ${count} frame${count === 1 ? '' : 's'} from the library`
            : 'No empty frames on this spread', count ? 'success' : 'info')
    }, [fillEmptyFrames, safeIdx, assets, toast])

    // ── Keyboard: portfolio-specific flow ───────────────────────────────────
    /**
     * Actions the page-level context menu can trigger. It is rendered from
     * inside Canvas but the state lives here, so the menu calls back rather
     * than reaching across.
     */
    const handlePageAction = useCallback((action) => {
        if (action === 'fill') handleFillEmpty()
    }, [handleFillEmpty])

    useEffect(() => {
        const onKey = (event) => {
            const tag = event.target?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) return
            if (event.metaKey || event.ctrlKey) return

            if (event.key === 'f') {
                event.preventDefault()
                addFrame()
                return
            }
            if (event.key === 't') {
                event.preventDefault()
                addText()
                return
            }
            if (event.key === 'r' && selectedElement?.type === 'photo-frame') {
                event.preventDefault()
                setCtxMenu({
                    visible: true,
                    x: window.innerWidth / 2 - 120,
                    y: window.innerHeight / 2 - 160,
                    element: selectedElement
                })
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [addFrame, addText, selectedElement])

    const setPage = (idx) => {
        const clamped = Math.min(Math.max(idx, 0), pages.length - 1)
        const target = pages[clamped]
        if (target) updateVpState({ selection: { type: 'page', id: target.id, pageIdx: clamped } })
    }

    const emptyFrames = (page.elements || []).filter(el => el.type === 'photo-frame' && !el.src).length
    // A book is a physical object. Every dimension on screen — the canvas, the
    // zoom, the grid, the status readout — is derived from the paper size, so
    // the preview is the book rather than an approximation of it.
    /**
     * Saving a layout prompts for a name rather than inventing one: "Grid 3×2"
     * is only recognisable to the person who made it, and every unnamed spread
     * called "Custom layout" is a layout nobody opens again.
     */
    const handleSaveLayout = useCallback(() => {
        const suggested = project?.title ? `${project.title} layout` : 'Custom layout'
        const name = prompt('Name this layout:', suggested)
        if (name === null) return
        // Save what is on screen: one page, or the two-page spread.
        saveCurrentSpreadAsLayout(name, visibleIndices)
    }, [project, saveCurrentSpreadAsLayout, visibleIndices])

    /**
     * Change the book's paper. Every dimension on the canvas is derived from it,
     * so existing elements are left exactly where they are: a frame placed at
     * x=200 keeps its relationship to the page rather than jumping, and the user
     * re-composes against the new trim. Reflowing every element automatically
     * would be more impressive and completely wrong — it would silently move
     * photographs the user had composed by hand.
     */
    const handlePaperChange = useCallback((paperSize) => {
        if (!project) return
        updateProjectSettings({ paperSize })
        toast(`Trim set to ${PAPER_SIZES[paperSize]?.label || paperSize}`, 'info')
    }, [project, updateProjectSettings, toast])

    return (
        <div className="pf-workspace">
            {/* No pf-topbar: the mode switcher in TopNav owns navigation, and a
                second header here disagreed with it about which mode you were
                in. What remains is a slim spread bar carrying only book-local
                actions that have no equivalent in the editor. */}
            <div className="pf-spreadbar">
                <div className="pf-spreadbar-left">
                    <button type="button" className="pf-btn ghost" onClick={undo} title="Undo (Ctrl+Z)">↩</button>
                    <button type="button" className="pf-btn ghost" onClick={redo} title="Redo (Ctrl+Shift+Z)">↪</button>
                    <span className="pf-topbar-divider" />
                    <button type="button" className="pf-btn" onClick={() => addFrame('mat')} title="Add an empty frame (F)">▣ Frame</button>
                    <button type="button" className="pf-btn" onClick={() => addText()} title="Add text (T)">T Text</button>
                    <div className="pf-text-menu">
                        {TEXT_PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                type="button"
                                className="pf-btn ghost"
                                onClick={() => addTextPreset(preset)}
                                title={`Add a ${preset.label.toLowerCase()} block`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                    <button type="button" className="pf-btn" onClick={handleFillEmpty} disabled={!emptyFrames} title="Fill every empty frame from the library">
                        ⤓ Fill {emptyFrames || ''} empty
                    </button>
                    <span className="pf-topbar-divider" />
                    <button type="button" className={`pf-btn ${snapOn ? 'active' : ''}`} onClick={() => changeSnap(!snapOn)} title="Snap to grid">Snap</button>
                </div>
                <div className="pf-spreadbar-center">
                    <div className="pf-page-nav">
                        <button
                            type="button"
                            onClick={() => step(-1)}
                            disabled={nav.findIndex(g => g.indices.includes(safeIdx)) <= 0}
                            aria-label="Previous page"
                            title="Previous (←)"
                        >‹</button>                        <span className="pf-spread-label">{viewLabel}</span>
                        <button
                            type="button"
                            onClick={() => step(1)}
                            disabled={nav.findIndex(g => g.indices.includes(safeIdx)) >= nav.length - 1}
                            aria-label="Next page"
                            title="Next (→)"
                        >›</button>
                    </div>
                    {/* One page or two. A cover or back cover ignores this: they
                        are physically single pages however you are reading the
                        rest of the book, and the control reflects that. */}
                    <div className="pf-view-toggle" role="group" aria-label="Pages shown">
                        <button
                            type="button"
                            className={!isSpread ? 'active' : ''}
                            onClick={() => changeViewMode('single')}
                            title="Single page"
                        >1 page</button>
                        <button
                            type="button"
                            className={isSpread ? 'active' : ''}
                            onClick={() => changeViewMode('spread')}
                            title="Two-page spread"
                        >2 pages</button>
                    </div>
                    {/* Trim size lives here rather than in a settings pane: a book
                        is a physical object, and choosing the paper is the first
                        decision that changes every measurement on screen. */}
                    <label className="pf-paper-picker" title={`Print at ${formatTrim(geo)}`}>
                        <span className="pf-paper-label">Trim</span>
                        <select
                            value={geo.key}
                            onChange={e => handlePaperChange(e.target.value)}
                            aria-label="Book trim size"
                        >
                            {Object.entries(PAPER_SIZES).map(([id, s]) => (
                                <option key={id} value={id}>{s.label} — {s.w} × {s.h} in</option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="pf-spreadbar-right">
                    <button
                        type="button"
                        className="pf-btn ghost"
                        onClick={handleSaveLayout}
                        title="Save this arrangement of frames as a reusable layout"
                    >
                        ⊞ Save layout
                    </button>
                    <button type="button" className="pf-btn ghost" onClick={saveProject}>Save</button>
                    <button type="button" className="pf-btn" onClick={() => showModal('exportModal')}>
                        Export
                    </button>
                    <button type="button" className="pf-btn" onClick={() => showModal('publishModal')}>
                        Publish
                    </button>
                    <button type="button" className="pf-btn primary" onClick={() => previewProject()}>Preview book</button>
                </div>
            </div>

            <div className="pf-body">
                {/* ── Library / layouts ──────────────────────────────── */}
                <aside className="pf-left">
                    <div className="pf-tabs" role="tablist">
                        {[['library', 'Library'], ['layouts', 'Layouts'], ['spreads', 'Pages']].map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                aria-selected={leftTab === id}
                                className={`pf-tab ${leftTab === id ? 'active' : ''}`}
                                onClick={() => setLeftTab(id)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {leftTab === 'library' && (
                        <PhotoLibrary
                            page={page}
                            pageIdx={safeIdx}
                            selectedElement={selectedElement}
                            onPickFiles={() => { }}
                        />
                    )}

                    {leftTab === 'layouts' && <PortfolioLayouts onApplied={() => setLeftTab('spreads')} paperSize={project?.paperSize} />}

                    {leftTab === 'spreads' && (
                        <div className="pf-spreads">
                            <div className="pf-spreads-actions">
                                <button type="button" className="pf-btn" onClick={addPage}>+ Blank page</button>
                                <button type="button" className="pf-btn ghost" onClick={duplicatePage}>Duplicate</button>
                                <button type="button" className="pf-btn danger ghost" onClick={deletePage}>Delete</button>
                            </div>
                            <div className="pf-spread-list">
                                {/* The list is of PAGES, not spreads. In two-page
                                    view a spread is just two adjacent rows, and
                                    saying so is more useful than a synthetic
                                    "Wide spread" row that is not a page at all. */}
                                {pages.map((p, i) => {
                                    const frames = (p.elements || []).filter(el => el.type === 'photo-frame')
                                    const filled = frames.filter(el => el.src).length
                                    const kind = pageKind(p, i, pages.length)
                                    const kindLabel =
                                        kind === PAGE_KIND.COVER ? 'Front cover'
                                            : kind === PAGE_KIND.BACK ? 'Back cover'
                                                : `Page ${i + 1}`
                                    // In spread view, odd/even pairs share a number so
                                    // the two rows read as one opening.
                                    const pairing = viewMode === 'spread' && kind === PAGE_KIND.BODY
                                        ? `${Math.floor((i - 1) / 2) + 1}`
                                        : null
                                    return (
                                        <button
                                            key={p.id}
                                            type="button"
                                            className={`pf-spread-item ${visibleIndices.includes(i) ? 'active' : ''} kind-${kind}`}
                                            onClick={() => gotoPage(i)}
                                        >
                                            <span className="pf-spread-num">{pairing || i + 1}</span>
                                            <span className="pf-spread-name">{kindLabel}</span>
                                            <span className="pf-spread-meta">{filled}/{frames.length} filled</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </aside>

                {/* ── Canvas ──────────────────────────────────────────── */}
                <main className="pf-canvas-area">
                    <FrameStrip
                        element={selectedElement}
                        onApply={updates => selectedElement && updateElement(safeIdx, selectedElement.id, updates)}
                        onOpenMenu={() => selectedElement && setCtxMenu({
                            visible: true,
                            x: window.innerWidth / 2 - 120,
                            y: window.innerHeight / 2 - 200,
                            element: selectedElement
                        })}
                    />
                    <div className="pf-canvas-wrap" id="canvasWrap">
                        <div
                            className="pf-canvas-zoom"
                            style={{
                                // The box occupies the *visual* size of what is on
                                // screen — one page, or two with the gutter between —
                                // and the pages inside are laid out at true trim size
                                // then scaled to match.
                                width: `${shownWidth * zoom / 100}px`,
                                height: `${pageHeight * zoom / 100}px`
                            }}
                        >
                            <div
                                className="pf-page"
                                style={{
                                    width: `${shownWidth}px`,
                                    height: `${pageHeight}px`,
                                    transform: `scale(${zoom / 100})`
                                }}
                            >
                                {/* A spread is literally two page canvases with the
                                    binding gutter between them. Each keeps its own
                                    elements and its own page index, so editing across
                                    the gutter edits two real pages. */}
                                <div className="pf-sheet">
                                    <div className="pf-sheet-page">
                                        <Canvas
                                            page={leftPage}
                                            pageIdx={leftIdx}
                                            pageSize={{ width: pageWidth, height: pageHeight }}
                                            snapOn={snapOn}
                                            zoom={zoom}
                                            importFiles={handleImport}
                                            onRequestImage={handleRequestImage}
                                            onDropAsset={handleDropAsset}
                                            renderContextMenu={props => (
                                                <PortfolioContextMenu
                                                    {...props}
                                                    bookSize={{ width: pageWidth, height: pageHeight }}
                                                    onPageAction={handlePageAction}
                                                />
                                            )}
                                        />
                                    </div>
                                    {rightPage && (
                                        <>
                                            <div
                                                className="pf-gutter"
                                                style={{ width: `${geo.gutter}px` }}
                                                aria-hidden="true"
                                            />
                                            <div className="pf-sheet-page">
                                                <Canvas
                                                    page={rightPage}
                                                    pageIdx={rightIdx}
                                                    pageSize={{ width: pageWidth, height: pageHeight }}
                                                    snapOn={snapOn}
                                                    zoom={zoom}
                                                    importFiles={handleImport}
                                                    onRequestImage={handleRequestImage}
                                                    onDropAsset={handleDropAsset}
                                                    renderContextMenu={props => (
                                                        <PortfolioContextMenu
                                                            {...props}
                                                            bookSize={{ width: pageWidth, height: pageHeight }}
                                                            onPageAction={handlePageAction}
                                                        />
                                                    )}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                                {/* Trim guides. The safe area is per-page, so one
                                    dashed box is drawn over each sheet page; the
                                    binding gutter is now real layout, not an
                                    overlay, so it needs no guide of its own. */}
                                {guides && visibleIndices.map(idx => {
                                    const left = idx * (pageWidth + geo.gutter)
                                    return (
                                        <div
                                            key={idx}
                                            className="pf-guide-safe"
                                            style={{ inset: `${geo.bleed}px`, left: `${left + geo.bleed}px` }}
                                        />
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="pf-zoombar">
                        <button type="button" onClick={() => setZoom(z => Math.max(20, z - 10))}>−</button>
                        <span>{zoom}%</span>
                        <button type="button" onClick={() => setZoom(z => Math.min(200, z + 10))}>+</button>
                        <button
                            type="button"
                            className={guides ? 'active' : ''}
                            onClick={() => changeGuides(!guides)}
                            title="Show trim and safe-area guides"
                        >
                            Guides
                        </button>
                        <button type="button" onClick={fitToView} title="Fit the page(s) to the window">Fit</button>
                    </div>
                </main>

                {/* ── Inspector ──────────────────────────────────────── */}
                <aside className="pf-right">
                    <div className="pf-tabs" role="tablist">
                        {[['frame', 'Frame'], ['design', 'Design'], ['layers', 'Layers'], ['settings', 'Settings']].map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                aria-selected={rightTab === id}
                                className={`pf-tab ${rightTab === id ? 'active' : ''}`}
                                onClick={() => setRightTab(id)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {
                        rightTab === 'frame' && (
                            <FrameInspector
                                element={selectedElement}
                                pageIdx={safeIdx}
                                usage={selectedElement ? usageIndex[selectedElement.assetId] : null}
                                onChange={updates => selectedElement && updateElement(safeIdx, selectedElement.id, updates)}
                                onDevelop={() => selectedElement && openLightTableFor({
                                    assetId: selectedElement.assetId || null,
                                    src: selectedElement.src,
                                    name: selectedElement.assetName,
                                    target: { pageIdx: safeIdx, elementId: selectedElement.id }
                                })}
                                onReplace={() => selectedElement && openReplacePicker(selectedElement)}
                                onDelete={() => selectedElement && deleteElement()}
                                onFillEmpty={handleFillEmpty}
                            />
                        )
                    }

                    {
                        rightTab === 'design' && <PropertyPanel activeTab="props" />
                    }

                    {
                        rightTab === 'settings' && (
                            <div className="pf-inspector pf-book-settings">
                                <h4>Book settings</h4>
                                <div className="pf-field">
                                    <label htmlFor="pf-book-title">Book title</label>
                                    <input
                                        id="pf-book-title"
                                        type="text"
                                        value={project?.title || ''}
                                        onChange={event => updateProjectSettings({ title: event.target.value })}
                                    />
                                </div>
                                <div className="pf-field">
                                    <label htmlFor="pf-book-paper">Trim size</label>
                                    <select id="pf-book-paper" value={geo.key} onChange={event => handlePaperChange(event.target.value)}>
                                        {Object.entries(PAPER_SIZES).map(([id, size]) => (
                                            <option key={id} value={id}>{size.label} · {size.w} × {size.h} in</option>
                                        ))}
                                    </select>
                                    <p className="prop-hint">{formatTrim(geo)} · {pageWidth} × {pageHeight} px at {geo.dpi} DPI</p>
                                </div>
                                <div className="pf-field">
                                    <label>Workspace view</label>
                                    <div className="pf-view-toggle" role="group" aria-label="Default workspace view">
                                        <button type="button" className={viewMode === 'single' ? 'active' : ''} onClick={() => changeViewMode('single')}>1 page</button>
                                        <button type="button" className={viewMode === 'spread' ? 'active' : ''} onClick={() => changeViewMode('spread')}>2 pages</button>
                                    </div>
                                </div>
                                <div className="pf-field">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input type="checkbox" checked={guides} onChange={event => changeGuides(event.target.checked)} style={{ width: 'auto' }} />
                                        Trim and safe-area guides
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input type="checkbox" checked={snapOn} onChange={event => changeSnap(event.target.checked)} style={{ width: 'auto' }} />
                                        Snap objects to page
                                    </label>
                                </div>
                            </div>
                        )
                    }

                    {
                        rightTab === 'layers' && (
                            <div className="pf-layers">
                                <h4>Layers <span>{(page.elements || []).length}</span></h4>
                                {[...(page.elements || [])].reverse().map(el => (
                                    <div
                                        key={el.id}
                                        className={`pf-layer ${selection?.id === el.id ? 'active' : ''}`}
                                        onClick={() => updateVpState({ selection: { type: 'element', id: el.id, pageIdx: safeIdx } })}
                                    >
                                        <span className="pf-layer-name">
                                            {el.type === 'photo-frame'
                                                ? (el.assetName || (el.src ? 'Photo' : 'Empty frame'))
                                                : el.type === 'text'
                                                    ? (typeof el.content === 'string' ? el.content.slice(0, 22) : 'Text')
                                                    : el.type}
                                        </span>
                                        <button
                                            type="button"
                                            className="pf-layer-btn"
                                            onClick={(e) => { e.stopPropagation(); updateElement(safeIdx, el.id, { hidden: !el.hidden }) }}
                                            title="Toggle visibility"
                                        >
                                            {el.hidden ? '◌' : '◉'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )
                    }
                </aside >
            </div >

            <footer className="pf-statusbar">
                <span>{assets.length} in library</span>
                <span>{emptyFrames} empty frame{emptyFrames === 1 ? '' : 's'}</span>
                <span className="pf-status-paper" title={`Trim ${formatTrim(geo)} · working at ${geo.dpi} DPI · ${geo.bleed / geo.dpi}" bleed`}>
                    {geo.label} · {formatTrim(geo)}
                </span>
                <span>{pageWidth} × {pageHeight} px per page</span>
                <span>{pages.length} page{pages.length === 1 ? '' : 's'} in book</span>
                <span className="spacer" />
                <span>F frame · T text · R frame options · ← → page · double-click a photo to place</span>
            </footer>

            <PortfolioContextMenu
                x={ctxMenu.x}
                y={ctxMenu.y}
                visible={ctxMenu.visible}
                element={ctxMenu.element}
                page={page}
                pageIdx={safeIdx}
                onClose={() => setCtxMenu(prev => ({ ...prev, visible: false }))}
            />
        </div >
    )
}
