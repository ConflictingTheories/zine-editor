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
import { FRAME_PRESETS, FIT_MODES, IMAGE_POSITIONS, createPhotoFrame, findFreeSlot } from '../../lib/photoLibrary.js'
import { filesToAssets, commitAssets } from '../../utils/photoImport.js'
import { PAGE_W, PAGE_H } from '../../constants.js'

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
                <input
                    id="pf-mat-colour"
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(element.frameColor || '') ? element.frameColor : '#faf8f4'}
                    onChange={e => onChange({ frameColor: e.target.value })}
                />
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
        addElement,
        deleteElement,
        addPage,
        duplicatePage,
        deletePage,
        previewProject,
        addImportedAssetsWithRoom,
        replaceElementImage,
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

    // Photographers work spread-by-spread: the next question is almost always
    // "what's on the next page", not "what's in the library". The library is one
    // click away, so defaulting to Spreads puts the commonest action first.
    const [leftTab, setLeftTab] = useState('spreads')
    const [rightTab, setRightTab] = useState('frame')
    const [zoom, setZoom] = useState(70)
    const [snapOn, setSnapOn] = useState(true)
    const [ctxMenu, setCtxMenu] = useState({ visible: false, x: 0, y: 0, element: null })

    const selection = vpState.selection
    const selectedElement = selection?.type === 'element'
        ? (page.elements || []).find(el => el.id === selection.id) || null
        : null

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

    // ── Placement shortcuts ─────────────────────────────────────────────────
    const addFrame = useCallback((presetId = 'mat', asset = null) => {
        const landscape = page.orientation === 'landscape'
        const slot = findFreeSlot(page.elements, {
            pageWidth: landscape ? PAGE_H : PAGE_W,
            pageHeight: landscape ? PAGE_W : PAGE_H
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
    }, [page, safeIdx, addElement])

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
    }, [safeIdx, addElement])

    /** A small set of type placements a photographer actually reaches for. */
    const TEXT_PRESETS = [
        { id: 'title', label: 'Title', content: 'Series title', fontSize: 34, width: 400, height: 56, fontFamily: 'Playfair Display', role: 'title' },
        { id: 'caption', label: 'Caption', content: 'A quiet caption', fontSize: 12, width: 280, height: 24, fontFamily: 'DM Sans', color: '#6f6a60', role: 'caption' },
        { id: 'body', label: 'Body', content: 'A short statement about the work, set at a comfortable measure.', fontSize: 13, width: 360, height: 80, fontFamily: 'Source Serif 4', color: '#4a453d', role: 'body' },
        { id: 'number', label: 'Plate no.', content: '01', fontSize: 10, width: 60, height: 20, fontFamily: 'DM Sans', color: '#8a8578', role: 'caption' }
    ]

    const addTextPreset = useCallback((preset) => {
        const landscape = page.orientation === 'landscape'
        const w = landscape ? PAGE_H : PAGE_W
        // Sit the block in the lower third: the classic caption position, and
        // it never collides with the frames templates put in the upper area.
        addText({ ...preset, x: Math.round((w - (preset.width ?? 320)) / 2), y: preset.y ?? (landscape ? 700 : 700) })
    }, [addText, page.orientation])

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

    return (
        <div className="pf-workspace">
            {/* ── Top bar ────────────────────────────────────────────── */}
            <header className="pf-topbar">
                <div className="pf-topbar-left">
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
                    <button type="button" className={`pf-btn ${snapOn ? 'active' : ''}`} onClick={() => setSnapOn(v => !v)} title="Snap to grid">Snap</button>
                </div>
                <div className="pf-topbar-center">
                    <span className="pf-spread-label">Spread {safeIdx + 1} / {pages.length}</span>
                </div>
                <div className="pf-topbar-right">
                    <button type="button" className="pf-btn ghost" onClick={saveProject}>Save</button>
                    <button type="button" className="pf-btn" onClick={() => showModal('exportModal')}>
                        Export
                    </button>
                    <button type="button" className="pf-btn" onClick={() => showModal('publishModal')}>
                        Publish
                    </button>
                    <button type="button" className="pf-btn primary" onClick={() => previewProject()}>Preview book</button>
                </div>
            </header>

            <div className="pf-body">
                {/* ── Library / layouts ──────────────────────────────── */}
                <aside className="pf-left">
                    <div className="pf-tabs" role="tablist">
                        {[['library', 'Library'], ['layouts', 'Layouts'], ['spreads', 'Spreads']].map(([id, label]) => (
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

                    {leftTab === 'layouts' && <PortfolioLayouts onApplied={() => setLeftTab('spreads')} />}

                    {leftTab === 'spreads' && (
                        <div className="pf-spreads">
                            <div className="pf-spreads-actions">
                                <button type="button" className="pf-btn" onClick={addPage}>+ Blank spread</button>
                                <button type="button" className="pf-btn ghost" onClick={duplicatePage}>Duplicate</button>
                                <button type="button" className="pf-btn danger ghost" onClick={deletePage}>Delete</button>
                            </div>
                            <div className="pf-spread-list">
                                {pages.map((p, i) => {
                                    const frameCount = (p.elements || []).filter(el => el.type === 'photo-frame').length
                                    const filled = (p.elements || []).filter(el => el.type === 'photo-frame' && el.src).length
                                    return (
                                        <button
                                            key={p.id}
                                            type="button"
                                            className={`pf-spread-item ${i === safeIdx ? 'active' : ''}`}
                                            onClick={() => setPage(i)}
                                        >
                                            <span className="pf-spread-num">{i + 1}</span>
                                            <span className="pf-spread-name">
                                                {p.orientation === 'landscape' ? 'Wide' : 'Portrait'} spread
                                            </span>
                                            <span className="pf-spread-meta">{filled}/{frameCount} filled</span>
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
                                width: `${(page.orientation === 'landscape' ? PAGE_H : PAGE_W) * zoom / 100}px`,
                                height: `${(page.orientation === 'landscape' ? PAGE_W : PAGE_H) * zoom / 100}px`,
                                '--canvas-scale': zoom / 100
                            }}
                        >
                            <Canvas
                                page={page}
                                pageIdx={safeIdx}
                                snapOn={snapOn}
                                zoom={zoom}
                                importFiles={handleImport}
                                onRequestImage={handleRequestImage}
                                onDropAsset={handleDropAsset}
                                renderContextMenu={props => (
                                    <PortfolioContextMenu
                                        {...props}
                                        onPageAction={handlePageAction}
                                    />
                                )}
                            />
                        </div>
                    </div>
                    <div className="pf-zoombar">
                        <button type="button" onClick={() => setZoom(z => Math.max(20, z - 10))}>−</button>
                        <span>{zoom}%</span>
                        <button type="button" onClick={() => setZoom(z => Math.min(200, z + 10))}>+</button>
                        <button type="button" onClick={() => {
                            const wrap = document.getElementById('canvasWrap')
                            if (!wrap) return
                            const landscape = page.orientation === 'landscape'
                            const scale = Math.min(
                                (wrap.clientWidth - 80) / (landscape ? PAGE_H : PAGE_W),
                                (wrap.clientHeight - 80) / (landscape ? PAGE_W : PAGE_H),
                                1)
                            setZoom(Math.round(scale * 100))
                        }}>Fit</button>
                    </div>
                </main>

                {/* ── Inspector ──────────────────────────────────────── */}
                <aside className="pf-right">
                    <div className="pf-tabs" role="tablist">
                        {[['frame', 'Frame'], ['layers', 'Layers']].map(([id, label]) => (
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

                    {rightTab === 'frame' && (
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
                    )}

                    {rightTab === 'layers' && (
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
                    )}
                </aside>
            </div>

            <footer className="pf-statusbar">
                <span>{assets.length} in library</span>
                <span>{emptyFrames} empty frame{emptyFrames === 1 ? '' : 's'}</span>
                <span className="spacer" />
                <span>F frame · T text · R frame options · double-click a photo to place</span>
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
        </div>
    )
}
