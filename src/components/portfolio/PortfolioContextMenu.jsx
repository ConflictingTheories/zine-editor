/*
 * Component: PortfolioContextMenu
 * A photography-aware right-click menu. Everything a photographer reaches for
 * most — swap the shot, change how it fills, restyle the mount, retouch it,
 * snap it to a page edge — is one click away, and every action preserves the
 * element's position and size so experimentation is risk-free.
 *
 * The organising principle is that *nothing here destroys work*. Replacing an
 * image keeps the frame. Re-fitting keeps the mount. Aligning keeps the
 * photograph. A photographer can try a dozen variants and undo once.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useVP } from '../../context/VPContext.jsx'
import {
    FRAME_PRESETS,
    FIT_MODES,
    IMAGE_POSITIONS,
    isEmptyFrame,
    fitAssetToBox,
    setFrameAspect,
    createPhotoFrame
} from '../../lib/photoLibrary.js'
import { filesToAssets, commitAssets } from '../../utils/photoImport.js'
import { PAGE_W, PAGE_H } from '../../constants.js'

/** A compact horizontal picker for frame treatments and fit modes. */
const SwatchRow = ({ items, activeId, onPick }) => (
    <div className="ctx-menu-swatches">
        {items.map(item => (
            <button
                key={item.id}
                type="button"
                title={item.hint || item.label}
                className={`ctx-swatch ${item.id === activeId ? 'active' : ''}`}
                onClick={onPick}
            >
                <span className="ctx-swatch-chip" style={item.chipStyle} />
                <span className="ctx-swatch-label">{item.name || item.label}</span>
            </button>
        ))}
    </div>
)

const FRAME_CHIPS = FRAME_PRESETS.map(preset => ({
    id: preset.id,
    name: preset.name,
    hint: preset.hint,
    chipStyle: {
        background: preset.style.frameStyle === 'bleed' || preset.style.frameStyle === 'none'
            ? 'linear-gradient(135deg,#2b2b2b 0 40%,#d8d3c8 40% 100%)'
            : preset.style.frameColor,
        boxShadow: preset.style.frameShadow,
        borderRadius: preset.style.frameRadius ? `${preset.style.frameRadius}px` : undefined,
        border: preset.style.frameBorderWidth ? `${preset.style.frameBorderWidth}px solid ${preset.style.frameBorderColor}` : '1px solid rgba(0,0,0,.25)'
    }
}))

/** Aspect ratios a photographer actually crops to. */
const ASPECTS = [
    { id: '3:2', label: '3:2  landscape', value: 3 / 2 },
    { id: '2:3', label: '2:3  portrait', value: 2 / 3 },
    { id: '1:1', label: '1:1  square', value: 1 },
    { id: '4:5', label: '4:5  portrait', value: 4 / 5 },
    { id: '16:9', label: '16:9  wide', value: 16 / 9 },
    { id: '5:7', label: '5:7  print', value: 5 / 7 }
]

const EDGES = [
    { id: 'left', label: '⇤ Left edge' },
    { id: 'right', label: '⇥ Right edge' },
    { id: 'top', label: '⇧ Top edge' },
    { id: 'bottom', label: '⇩ Bottom edge' },
    { id: 'center-h', label: '↔ Centre horizontally' },
    { id: 'center-v', label: '↕ Centre vertically' }
]

/**
 * What a right-click on empty paper offers. Composing a spread mostly means
 * "put a frame here" and "fill the frames I already have", so those lead; the
 * generic editor commands follow rather than competing.
 */
const PageMenuItems = ({ pageIdx, onClose, onFillEmpty }) => {
    const { vpState, addElement, duplicatePage, deletePage } = useVP()
    const page = vpState.currentProject?.pages?.[pageIdx]
    const emptyFrames = (page?.elements || []).filter(el => el.type === 'photo-frame' && !el.src).length

    return (
        <>
            <div className="ctx-menu-label">This spread</div>
            <div className="ctx-menu-item" onClick={e => { e.stopPropagation(); addElement(pageIdx, createPhotoFrame({ width: 260, height: 195 })); onClose() }}>
                ▣ Add an empty frame
            </div>
            <div className="ctx-menu-item" onClick={e => {
                e.stopPropagation(); addElement(pageIdx, {
                    type: 'text', content: 'Add a title or caption',
                    x: 56, y: 56, width: 320, height: 48,
                    fontSize: 24, fontFamily: 'Playfair Display', color: '#141414',
                    align: 'left', role: 'caption', rotation: 0, opacity: 1
                }); onClose()
            }}>
                T Add text
            </div>
            <div
                className={`ctx-menu-item ${emptyFrames ? '' : 'is-disabled'}`}
                onClick={e => { e.stopPropagation(); if (emptyFrames) { onFillEmpty?.(); onClose() } }}
            >
                ⤓ Fill {emptyFrames} empty frame{emptyFrames === 1 ? '' : 's'}
            </div>
            <div className="ctx-menu-sep" />
            <div className="ctx-menu-item" onClick={e => { e.stopPropagation(); duplicatePage(); onClose() }}>⧉ Duplicate spread</div>
            <div className="ctx-menu-item ctx-menu-item-danger" onClick={e => { e.stopPropagation(); deletePage(); onClose() }}>✕ Delete spread</div>
        </>
    )
}

export default function PortfolioContextMenu({ x, y, visible, onClose, pageIdx, element, page, onPageAction }) {
    const {
        vpState,
        updateElement,
        duplicateElement,
        deleteElement,
        moveLayer,
        copyElement,
        pasteElement,
        replaceElementImage,
        addImportedAssetsWithRoom,
        openLightTableFor,
        toast
    } = useVP()
    const [showFrames, setShowFrames] = useState(false)
    const [showFits, setShowFits] = useState(false)
    const [showLibrary, setShowLibrary] = useState(false)
    const [showAspects, setShowAspects] = useState(false)
    const [showEdges, setShowEdges] = useState(false)
    const closeRef = useRef(null)

    useEffect(() => {
        if (!visible) return
        // Dismiss on the next click anywhere. This has to be deferred to the
        // next macrotask: the click that opened this menu (the right-click)
        // is still propagating when the effect runs, and closing on it would
        // make the menu flash and vanish before it could be read. A ref holds
        // the listener so the effect can remove exactly what it added.
        const timer = setTimeout(() => {
            const close = () => onClose()
            document.addEventListener('click', close)
            closeRef.current = close
        }, 0)
        const onKey = (event) => { if (event.key === 'Escape') onClose() }
        document.addEventListener('keydown', onKey)
        return () => {
            clearTimeout(timer)
            document.removeEventListener('keydown', onKey)
            if (closeRef.current) {
                document.removeEventListener('click', closeRef.current)
                closeRef.current = null
            }
        }
    }, [visible, onClose])

    useEffect(() => {
        if (!visible) {
            setShowFrames(false); setShowFits(false); setShowLibrary(false)
            setShowAspects(false); setShowEdges(false)
        }
    }, [visible])

    const assets = vpState.library?.imported || []
    const currentPage = page || vpState.currentProject?.pages?.[pageIdx] || null

    // Final selects first, then by recency — those are the images a
    // photographer reaches for when re-composing a spread.
    const recentAssets = useMemo(() => {
        const picks = assets.filter(asset => asset.rating === 3)
        const byRecency = [...assets]
            .filter(asset => asset.rating !== 3)
            .sort((a, b) => new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime())
        return [...picks, ...byRecency].slice(0, 12)
    }, [assets])

    if (!visible) return null

    const isFrame = element?.type === 'photo-frame'
    const isImage = element?.type === 'image'
    const isText = element?.type === 'text'
    const carriesImage = isFrame || isImage
    const empty = isEmptyFrame(element)

    const pageSize = () => {
        const landscape = currentPage?.orientation === 'landscape'
        return { pageWidth: landscape ? PAGE_H : PAGE_W, pageHeight: landscape ? PAGE_W : PAGE_H }
    }

    const run = (fn) => (event) => {
        event.stopPropagation()
        fn()
        onClose()
    }

    const replaceWith = (asset) => {
        replaceElementImage(pageIdx, element.id, asset)
        toast(`Swapped in “${asset.name || asset.id}” — position kept`, 'success')
        onClose()
    }

    const pickFromDisk = async () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.multiple = true
        input.onchange = async (e) => {
            const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'))
            if (!files.length) return
            const created = await filesToAssets(files)
            if (!created.length) return
            // Import into the library rather than binding directly to the
            // frame — the photo belongs in the shoot, not only in this spread.
            addImportedAssetsWithRoom(created)
            addImportedAssetsWithRoom(await commitAssets(created))
            if (element) replaceElementImage(pageIdx, element.id, created[0])
            toast(`Imported ${created.length} photo${created.length === 1 ? '' : 's'} to the library`, 'success')
        }
        input.click()
        onClose()
    }

    /**
     * Re-fit the frame to the photograph. "Original ratio" resizes the box to
     * the image's own shape; the other modes keep the box and change the crop.
     * Either way the mount, caption and layer order are untouched.
     */
    const applyFit = (mode) => {
        const asset = assets.find(a => a.id === element.assetId)
            || (element.src ? { src: element.src, width: element.assetWidth, height: element.assetHeight } : null)
        const updates = { imageFit: mode }
        if (mode === 'original' && asset) {
            const sized = fitAssetToBox(asset, element.width, element.height, 'contain')
            if (sized) {
                updates.width = Math.round(sized.width)
                updates.height = Math.round(sized.height)
            }
        }
        updateElement(pageIdx, element.id, updates)
        setShowFits(false)
    }

    const applyAspect = (aspect) => {
        updateElement(pageIdx, element.id, setFrameAspect(element, aspect.value))
        setShowAspects(false)
    }

    const applyFrame = (preset) => {
        if (!preset) return
        updateElement(pageIdx, element.id, { ...preset.style, framePreset: preset.id })
        setShowFrames(false)
    }

    /** Snap to a page edge, keeping the photograph's size. */
    const applyEdge = (edge) => {
        const { pageWidth, pageHeight } = pageSize()
        const w = element.width || 0
        const h = element.height || 0
        const next = {}
        if (edge.id === 'left') next.x = 0
        if (edge.id === 'right') next.x = pageWidth - w
        if (edge.id === 'top') next.y = 0
        if (edge.id === 'bottom') next.y = pageHeight - h
        if (edge.id === 'center-h') next.x = Math.round((pageWidth - w) / 2)
        if (edge.id === 'center-v') next.y = Math.round((pageHeight - h) / 2)
        updateElement(pageIdx, element.id, next)
        setShowEdges(false)
    }

    /** Take the frame to the full page — the "make this the spread" move. */
    const fillBleed = () => {
        const { pageWidth, pageHeight } = pageSize()
        updateElement(pageIdx, element.id, {
            x: 0, y: 0, width: pageWidth, height: pageHeight,
            framePreset: 'bleed-edge',
            frameStyle: 'bleed', frameWidth: 0,
            frameBorderWidth: 2, frameBorderColor: '#ffffff',
            imageFit: 'cover'
        })
    }

    const setCaption = () => {
        const caption = window.prompt('Caption for this photograph', element.caption || '')
        if (caption == null) return
        updateElement(pageIdx, element.id, { caption })
    }

    const develop = () => {
        openLightTableFor({
            assetId: element.assetId || null,
            src: element.src,
            name: element.assetName || 'Page image',
            target: { pageIdx, elementId: element.id }
        })
        onClose()
    }

    return (
        <div className="ctx-menu active portfolio-ctx" style={{ left: x, top: y }} onClick={e => e.stopPropagation()}>
            {!element && (
                <PageMenuItems
                    pageIdx={pageIdx}
                    onClose={onClose}
                    onFillEmpty={() => onPageAction?.('fill')}
                />
            )}
            {carriesImage && (
                <>
                    {empty && <div className="ctx-menu-label">Empty frame</div>}
                    <div className="ctx-menu-item" onClick={e => { e.stopPropagation(); setShowLibrary(v => !v) }}>
                        ⇄ Replace image {showLibrary ? '▴' : '▾'}
                    </div>
                    {showLibrary && (
                        <div className="ctx-menu-sub">
                            {recentAssets.length === 0 && <p className="ctx-menu-empty">Library is empty — import photos first.</p>}
                            {recentAssets.map(asset => (
                                <button
                                    key={asset.id}
                                    type="button"
                                    className="ctx-menu-item ctx-library-item"
                                    onClick={e => { e.stopPropagation(); replaceWith(asset) }}
                                >
                                    <img src={asset.thumb || asset.src} alt="" />
                                    <span>{asset.name || asset.id}</span>
                                    {asset.recipe && <em title="Developed">◐</em>}
                                </button>
                            ))}
                            <div className="ctx-menu-item" onClick={run(pickFromDisk)}>＋ Choose from this computer…</div>
                        </div>
                    )}
                    <div className="ctx-menu-item" onClick={run(develop)}>◐ Develop in Light Table</div>
                    <div className="ctx-menu-item" onClick={e => { e.stopPropagation(); setShowFits(v => !v) }}>
                        ⤢ How it fills {showFits ? '▴' : '▾'}
                    </div>
                    {showFits && (
                        <div className="ctx-menu-sub">
                            {FIT_MODES.map(mode => (
                                <div
                                    key={mode.id}
                                    className={`ctx-menu-item ${(element.imageFit || 'cover') === mode.id ? 'active' : ''}`}
                                    onClick={e => { e.stopPropagation(); applyFit(mode.id) }}
                                >
                                    {mode.label}
                                </div>
                            ))}
                            <div className="ctx-menu-sep" />
                            <div className="ctx-menu-label">Focal point</div>
                            <div className="ctx-menu-row">
                                {IMAGE_POSITIONS.map(pos => (
                                    <button
                                        key={pos.id}
                                        type="button"
                                        title={pos.label}
                                        className={`ctx-focal ${(element.imagePosition || 'center') === pos.id ? 'active' : ''}`}
                                        onClick={e => { e.stopPropagation(); updateElement(pageIdx, element.id, { imagePosition: pos.id }) }}
                                    >
                                        <span className={`ctx-focal-dot is-${pos.id}`} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="ctx-menu-item" onClick={e => { e.stopPropagation(); setShowAspects(v => !v) }}>
                        ▭ Crop to shape {showAspects ? '▴' : '▾'}
                    </div>
                    {showAspects && (
                        <div className="ctx-menu-sub">
                            {ASPECTS.map(aspect => (
                                <div key={aspect.id} className="ctx-menu-item" onClick={e => { e.stopPropagation(); applyAspect(aspect) }}>
                                    {aspect.label}
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="ctx-menu-item" onClick={run(fillBleed)}>⛶ Full-bleed the page</div>
                    {isFrame && (
                        <>
                            <div className="ctx-menu-item" onClick={(e) => { e.stopPropagation(); setShowFrames(v => !v) }}>
                                ▣ Frame &amp; mount {showFrames ? '▴' : '▾'}
                            </div>
                            {showFrames && (
                                <div className="ctx-menu-sub">
                                    <SwatchRow items={FRAME_CHIPS} activeId={element.framePreset} onPick={preset => applyFrame(FRAME_PRESETS.find(p => p.id === preset.id))} />
                                </div>
                            )}
                            <div className="ctx-menu-item" onClick={e => { e.stopPropagation(); setShowEdges(v => !v) }}>
                                ⌖ Align on page {showEdges ? '▴' : '▾'}
                            </div>
                            {showEdges && (
                                <div className="ctx-menu-sub">
                                    {EDGES.map(edge => (
                                        <div key={edge.id} className="ctx-menu-item" onClick={e => { e.stopPropagation(); applyEdge(edge) }}>
                                            {edge.label}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="ctx-menu-item" onClick={run(setCaption)}>✎ {element.caption ? 'Edit caption' : 'Add caption'}</div>
                        </>
                    )}
                    <div className="ctx-menu-sep" />
                </>
            )}

            {isText && (
                <>
                    <div className="ctx-menu-label">Text</div>
                    <div className="ctx-menu-item" onClick={run(() => updateElement(pageIdx, element.id, { align: 'left' }))}>Align left</div>
                    <div className="ctx-menu-item" onClick={run(() => updateElement(pageIdx, element.id, { align: 'center' }))}>Align centre</div>
                    <div className="ctx-menu-item" onClick={run(() => updateElement(pageIdx, element.id, { align: 'right' }))}>Align right</div>
                    <div className="ctx-menu-sep" />
                </>
            )}

            <div className="ctx-menu-item" onClick={run(() => copyElement())}>📋 Copy</div>
            <div className="ctx-menu-item" onClick={run(() => pasteElement())}>📄 Paste</div>
            <div className="ctx-menu-item" onClick={run(() => duplicateElement())}>⧉ Duplicate</div>
            <div className="ctx-menu-sep" />
            <div className="ctx-menu-item" onClick={run(() => moveLayer('top'))}>⬆ Bring to Front</div>
            <div className="ctx-menu-item" onClick={run(() => moveLayer('bottom'))}>⬇ Send to Back</div>
            <div className="ctx-menu-item" onClick={run(() => updateElement(pageIdx, element.id, { locked: !element.locked }))}>
                {element.locked ? '🔓 Unlock' : '🔒 Lock'}
            </div>
            <div className="ctx-menu-sep" />
            <div className="ctx-menu-item ctx-menu-item-danger" onClick={run(() => deleteElement())}>✕ Delete</div>
        </div>
    )
}
