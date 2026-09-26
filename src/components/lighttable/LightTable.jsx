/*
 * Component: LightTable
 * The develop workspace: browse the shared image library, grade with GPU
 * (or CPU) rendering, crop and rotate, and push results back to the library
 * or straight onto a spread. Every edit is stored as a portable recipe.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVP } from '../../context/VPContext.jsx'
import { cubeText, downloadText, parseCube } from '../../lib/lightTable.js'
import {
    CONTROL_GROUPS,
    GRADE_DEFAULTS,
    FX_DEFAULTS,
    DEFAULT_RECIPE,
    PRESETS,
    getPreset,
    createRecipe,
    normaliseRecipe,
    serialiseRecipe,
    isRecipeDirty,
    analyseImage,
    outputSize,
    renderRecipe,
    centreCrop
} from '../../lib/lightTableEngine.js'
import { LtRenderer } from './ltRenderer.js'
import LtSlider from './LtSlider.jsx'
import LtHistogram from './LtHistogram.jsx'
import LtCurveEditor from './LtCurveEditor.jsx'
import LtCropOverlay from './LtCropOverlay.jsx'
import LtPresetStrip from './LtPresetStrip.jsx'

const TABS = [
    { id: 'develop', label: 'Develop' },
    { id: 'effects', label: 'Effects' },
    { id: 'curves', label: 'Curves' },
    { id: 'crop', label: 'Crop' },
    { id: 'lut', label: 'LUT' }
]

const ASPECTS = [
    { id: 'free', label: 'Free' },
    { id: '1:1', label: '1:1' },
    { id: '4:5', label: '4:5' },
    { id: '3:2', label: '3:2' },
    { id: '16:9', label: '16:9' },
    { id: '2:3', label: '2:3' }
]

function LightTable() {
    const { vpState, updateVpState, addImportedAssets, addElement, toast } = useVP()

    const gallery = vpState.library?.imported || []

    // Per-asset recipe drafts, keyed by asset id, so switching images keeps
    // each photo's edits instead of resetting on every selection change.
    const [drafts, setDrafts] = useState({})
    const [selectedId, setSelectedId] = useState(
        vpState.lightTableAsset?.id || gallery[0]?.id || null
    )
    const [tab, setTab] = useState('develop')
    const [activePreset, setActivePreset] = useState('none')
    const [curveChannel, setCurveChannel] = useState('rgb')
    const [compare, setCompare] = useState(false)
    const [cropping, setCropping] = useState(false)
    const [inspectorOpen, setInspectorOpen] = useState(false)
    const [dragging, setDragging] = useState(false)
    const [rendererMode, setRendererMode] = useState('pending')
    const [zoom, setZoom] = useState(1)

    const canvasRef = useRef(null)
    const rendererRef = useRef(null)
    const imageRef = useRef(null)
    const rafRef = useRef(0)
    const recipeRef = useRef(createRecipe())
    const fileInputRef = useRef(null)

    const selectedAsset = useMemo(
        () => gallery.find(a => a.id === selectedId) || vpState.lightTableAsset || null,
        [gallery, selectedId, vpState.lightTableAsset]
    )

    // The active recipe is the draft for the selected image, restored from
    // any recipe already saved onto the asset.
    const recipe = useMemo(() => {
        const base = selectedAsset?.recipe
        return drafts[selectedId] || (base ? normaliseRecipe(base) : createRecipe())
    }, [drafts, selectedId, selectedAsset])

    recipeRef.current = recipe

    const updateRecipe = useCallback((patch) => {
        setDrafts(prev => ({
            ...prev,
            [selectedId]: { ...recipeRef.current, ...patch }
        }))
    }, [selectedId])

    const updateParam = useCallback((key, value) => {
        updateRecipe({ params: { ...recipeRef.current.params, [key]: value } })
        setActivePreset('custom')
    }, [updateRecipe])

    const updateFx = useCallback((key, value) => {
        updateRecipe({ fx: { ...recipeRef.current.fx, [key]: value } })
        setActivePreset('custom')
    }, [updateRecipe])

    const updateGeometry = useCallback((patch) => {
        updateRecipe({ geometry: { ...recipeRef.current.geometry, ...patch } })
    }, [updateRecipe])

    // ── Renderer lifecycle ───────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const renderer = new LtRenderer(canvas)
        const ok = renderer.init()
        rendererRef.current = renderer
        setRendererMode(ok ? 'gpu' : 'cpu')
        return () => {
            cancelAnimationFrame(rafRef.current)
            renderer.destroy()
            rendererRef.current = null
        }
    }, [])

    // ── Image loading for the selected asset ──────────────────────────────
    useEffect(() => {
        if (!selectedAsset?.src) {
            imageRef.current = null
            return
        }
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            imageRef.current = img
            rendererRef.current?.uploadImage(img)
            draw()
        }
        img.src = selectedAsset.src
    }, [selectedAsset])

    const imageStats = useMemo(() => {
        const img = imageRef.current
        if (!img?.naturalWidth) return null
        const info = analyseImage(img)
        if (!info) return null
        return {
            clippedShadows: info.blacks < -0.3,
            clippedHighlights: info.whites > 0.35
        }
    }, [selectedAsset])

    // ── Draw ─────────────────────────────────────────────────────────────
    // Animated effects (grain) need a continuous loop; everything else is
    // drawn once per recipe change. Compare mode renders the untouched
    // original, so it must always bypass the loop.
    const needsAnimation = recipe.fx.grain > 0.001

    const sizeCanvas = useCallback(() => {
        const canvas = canvasRef.current
        const img = imageRef.current
        if (!canvas || !img?.naturalWidth) return
        const [ow, oh] = outputSize(img.naturalWidth, img.naturalHeight, recipeRef.current.geometry)
        const maxW = 1600, maxH = 1100
        const scale = Math.min(1, maxW / ow, maxH / oh)
        const w = Math.max(1, Math.round(ow * scale))
        const h = Math.max(1, Math.round(oh * scale))
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w
            canvas.height = h
        }
    }, [])

    const draw = useCallback((time = 0) => {
        const renderer = rendererRef.current
        const img = imageRef.current
        if (!renderer || !img?.naturalWidth) return
        sizeCanvas()
        if (compare) {
            // Straight blit of the source, no grading.
            const ctx = renderer.canvas.getContext('2d')
            if (ctx) ctx.drawImage(img, 0, 0, renderer.canvas.width, renderer.canvas.height)
            return
        }
        if (renderer.supported) {
            renderer.draw(recipeRef.current, time)
        } else {
            renderer.drawCpu(img, recipeRef.current)
        }
    }, [compare, sizeCanvas])

    // Redraw whenever anything that affects the pixels changes.
    useEffect(() => {
        if (needsAnimation && !compare) {
            const tick = (t) => { draw(t); rafRef.current = requestAnimationFrame(tick) }
            rafRef.current = requestAnimationFrame(tick)
            return () => cancelAnimationFrame(rafRef.current)
        }
        draw(performance.now())
    }, [recipe, compare, draw, needsAnimation])

    // ── Import ───────────────────────────────────────────────────────────
    const importFiles = useCallback(async (files) => {
        const list = Array.from(files || []).filter(f => f.type.startsWith('image/'))
        if (!list.length) return
        const assets = await Promise.all(list.map(file => new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve({
                id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: file.name,
                src: reader.result,
                kind: 'image',
                addedAt: new Date().toISOString()
            })
            reader.onerror = reject
            reader.readAsDataURL(file)
        })))
        addImportedAssets(assets)
        if (assets[0]) setSelectedId(assets[0].id)
        toast(`${assets.length} image${assets.length === 1 ? '' : 's'} imported`, 'success')
    }, [addImportedAssets, toast])

    const onPickFiles = () => fileInputRef.current?.click()

    // ── Presets & auto ───────────────────────────────────────────────────
    const applyPreset = useCallback((id) => {
        const preset = getPreset(id)
        const next = recipeRef.current
        updateRecipe({
            params: { ...GRADE_DEFAULTS, ...(preset.params || {}) },
            fx: { ...FX_DEFAULTS, ...(preset.fx || {}) },
            bw: Boolean(preset.bw),
            curves: createRecipe().curves
        })
        setActivePreset(id)
    }, [updateRecipe])

    const autoAdjust = useCallback(() => {
        const img = imageRef.current
        if (!img) return
        const info = analyseImage(img)
        if (!info) return
        updateRecipe({
            params: {
                ...recipeRef.current.params,
                ...info.params,
                blacks: Number(info.blacks.toFixed(2)),
                whites: Number(info.whites.toFixed(2))
            }
        })
        setActivePreset('auto')
        toast('Auto-adjusted from the image histogram', 'success')
    }, [updateRecipe, toast])

    const resetAll = useCallback(() => {
        updateRecipe({
            params: { ...GRADE_DEFAULTS },
            fx: { ...FX_DEFAULTS },
            curves: createRecipe().curves,
            geometry: { ...DEFAULT_RECIPE.geometry },
            lut: null,
            lutStrength: 1,
            bw: false
        })
        setActivePreset('none')
        toast('Recipe reset', 'info')
    }, [updateRecipe, toast])

    // ── Output ───────────────────────────────────────────────────────────
    const saveToLibrary = useCallback(() => {
        const img = imageRef.current
        if (!img || !selectedAsset) return
        const out = document.createElement('canvas')
        renderRecipe(img, out, recipeRef.current, { maxWidth: 2400, maxHeight: 2400 })
        const asset = {
            id: `lighttable-${Date.now()}`,
            name: `${(selectedAsset.name || 'image').replace(/\.[^.]+$/, '')} — developed`,
            src: out.toDataURL('image/jpeg', 0.94),
            kind: 'image',
            addedAt: new Date().toISOString(),
            recipe: serialiseRecipe(recipeRef.current)
        }
        addImportedAssets([asset])
        updateVpState({ lightTableAsset: asset })
        toast('Developed image added to the library', 'success')
    }, [selectedAsset, addImportedAssets, updateVpState, toast])

    const downloadImage = useCallback(() => {
        const img = imageRef.current
        if (!img || !selectedAsset) return
        const out = document.createElement('canvas')
        renderRecipe(img, out, recipeRef.current, { maxWidth: 4000, maxHeight: 4000 })
        const link = document.createElement('a')
        link.download = `${(selectedAsset.name || 'image').replace(/\.[^.]+$/, '')}-developed.jpg`
        link.href = out.toDataURL('image/jpeg', 0.95)
        link.click()
        toast('Image downloaded', 'success')
    }, [selectedAsset, toast])

    const placeOnSpread = useCallback(() => {
        if (!selectedAsset || !vpState.currentProject) return
        const pageIdx = vpState.selection?.pageIdx || 0
        addElement(pageIdx, {
            type: 'image',
            src: selectedAsset.src,
            x: 80, y: 80, width: 320, height: 240,
            objectFit: 'cover',
            lightTableRecipe: serialiseRecipe(recipeRef.current)
        })
        toast('Placed on the current spread with the live recipe attached', 'success')
    }, [selectedAsset, vpState.currentProject, vpState.selection, addElement, toast])

    // ── LUT ──────────────────────────────────────────────────────────────
    const importLut = (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
            try {
                const lut = parseCube(reader.result, file.name)
                updateRecipe({ lut })
                setActivePreset('custom')
                toast(`LUT "${file.name}" loaded`, 'success')
            } catch (err) {
                toast(err.message || 'Could not read that .cube file', 'error')
            }
        }
        reader.readAsText(file)
        event.target.value = ''
    }

    const exportLut = () => {
        if (!recipe.lut) return
        downloadText(`${recipe.lut.name.replace(/\.cube$/i, '')}.cube`, cubeText(recipe.lut), 'text/plain')
    }

    const exportRecipe = () => {
        downloadText(
            `${(selectedAsset?.name || 'image').replace(/\.[^.]+$/, '')}-recipe.json`,
            JSON.stringify(serialiseRecipe(recipeRef.current), null, 2),
            'application/json'
        )
    }

    // ── Geometry helpers ─────────────────────────────────────────────────
    const applyAspect = (id) => {
        if (id === 'free') {
            updateGeometry({ crop: [0, 0, 1, 1] })
            return
        }
        const [w, h] = id.split(':').map(Number)
        // centreCrop works in normalised space, so convert the requested
        // ratio into that space by scaling against the image's own aspect.
        const img = imageRef.current
        const imgAspect = img?.naturalWidth && img?.naturalHeight
            ? img.naturalWidth / img.naturalHeight : 1
        const crop = centreCrop((w / h) / imgAspect, recipeRef.current.geometry.crop || [0, 0, 1, 1])
        updateGeometry({ crop: crop.map(v => Number(v.toFixed(5))) })
    }

    const rotate = (delta) => {
        const current = recipeRef.current.geometry.rotate || 0
        updateGeometry({ rotate: Math.round(((current + delta) % 360 + 360) % 360) })
    }

    const back = () => updateVpState({
        currentView: vpState.lightTableReturnView || 'dashboard',
        lightTableAsset: null,
        lightTableReturnView: null
    })

    // ── Keyboard shortcuts ───────────────────────────────────────────────
    useEffect(() => {
        const onKey = (event) => {
            const tag = event.target?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || event.metaKey || event.ctrlKey) return
            if (cropping) {
                if (event.key === 'Escape') setCropping(false)
                if (event.key === 'Enter') setCropping(false)
                return
            }
            const galleryList = gallery
            const index = galleryList.findIndex(a => a.id === selectedId)
            switch (event.key) {
                case 'ArrowRight':
                    if (index >= 0 && index < galleryList.length - 1) setSelectedId(galleryList[index + 1].id)
                    break
                case 'ArrowLeft':
                    if (index > 0) setSelectedId(galleryList[index - 1].id)
                    break
                case '\\':
                    setCompare(v => !v)
                    break
                case 'r':
                    rotate(event.shiftKey ? -90 : 90)
                    break
                case 'f':
                    updateGeometry({ flipH: !recipeRef.current.geometry.flipH })
                    break
                case 'c':
                    setCropping(v => !v)
                    break
                case 'a':
                    autoAdjust()
                    break
                case '0':
                    setZoom(1)
                    break
                case 'Escape':
                    if (compare) setCompare(false)
                    break
                default:
                    break
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [gallery, selectedId, cropping, compare, updateGeometry, autoAdjust])

    const isDirty = isRecipeDirty(recipe)
    const imgDims = imageRef.current
        ? `${imageRef.current.naturalWidth} × ${imageRef.current.naturalHeight}`
        : ''

    return (
        <div className="light-table lt-workspace">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => { importFiles(e.target.files); e.target.value = '' }}
            />

            {/* ── Header ─────────────────────────────────────────────── */}
            <header className="lt-header">
                <button className="lt-btn ghost" onClick={back} title="Back">←</button>
                <div className="lt-title">
                    <strong>LIGHT TABLE</strong>
                    <span className="lt-file">
                        {selectedAsset?.name || 'No image selected'}
                        {isDirty ? ' •' : ''}
                    </span>
                </div>
                <div className="lt-header-actions">
                    <button className="lt-btn" onClick={onPickFiles} title="Import images">Import</button>
                    <button className="lt-btn" onClick={autoAdjust} disabled={!selectedAsset} title="Auto adjust (A)">Auto</button>
                    <button
                        className={`lt-btn${compare ? ' active' : ''}`}
                        onClick={() => setCompare(v => !v)}
                        disabled={!selectedAsset}
                        title="Hold to compare with the original (\\)"
                        onPointerDown={() => setCompare(true)}
                        onPointerUp={() => setCompare(false)}
                        onPointerLeave={() => setCompare(false)}
                    >
                        Compare
                    </button>
                    {vpState.currentProject && (
                        <button className="lt-btn" onClick={placeOnSpread} disabled={!selectedAsset}>Place</button>
                    )}
                    <button className="lt-btn primary" onClick={saveToLibrary} disabled={!selectedAsset}>Save</button>
                    <button className="lt-btn" onClick={downloadImage} disabled={!selectedAsset} title="Download a full-resolution JPEG">↓</button>
                    <button
                        className="lt-btn icon lt-inspector-toggle"
                        onClick={() => setInspectorOpen(v => !v)}
                        title="Toggle inspector"
                    >
                        ⚙
                    </button>
                </div>
            </header>

            {/* ── Filmstrip ─────────────────────────────────────────── */}
            <aside className="lt-library">
                <div className="lt-lib-toolbar">
                    <button className="lt-btn" onClick={onPickFiles} title="Import images">+</button>
                    <button
                        className="lt-btn"
                        onClick={() => setDrafts({})}
                        title="Discard unsaved edits for every image"
                    >
                        ↺
                    </button>
                </div>
                <div className="lt-thumbs">
                    {gallery.map(asset => (
                        <button
                            key={asset.id}
                            className={`lt-thumb${selectedId === asset.id ? ' active' : ''}`}
                            onClick={() => setSelectedId(asset.id)}
                            title={asset.name}
                        >
                            <img src={asset.src} alt={asset.name || ''} />
                            {asset.recipe && <span className="lt-thumb-dirty" />}
                            <span className="lt-thumb-name">{asset.name}</span>
                        </button>
                    ))}
                </div>
                {!gallery.length && (
                    <p className="lt-gallery-empty">
                        No images yet.<br />Import photographs to start developing.
                    </p>
                )}
            </aside>

            {/* ── Stage ─────────────────────────────────────────────── */}
            <main
                className={`lt-stage${compare ? ' compare' : ''}${dragging ? ' dragging' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); importFiles(e.dataTransfer.files) }}
            >
                {selectedAsset ? (
                    <>
                        {/* Top bar: image info + quick geometry */}
                        <div className="lt-stage-bar top">
                            <span className="lt-meta">{imgDims}</span>
                            <div className="divider" />
                            <button className="lt-btn icon" onClick={() => rotate(-90)} title="Rotate left (Shift+R)">↺</button>
                            <button className="lt-btn icon" onClick={() => rotate(90)} title="Rotate right (R)">↻</button>
                            <button
                                className={`lt-btn icon${recipe.geometry.flipH ? ' active' : ''}`}
                                onClick={() => updateGeometry({ flipH: !recipe.geometry.flipH })}
                                title="Flip horizontal (F)"
                            >
                                ⇋
                            </button>
                            <button
                                className={`lt-btn icon${recipe.geometry.flipV ? ' active' : ''}`}
                                onClick={() => updateGeometry({ flipV: !recipe.geometry.flipV })}
                                title="Flip vertical"
                            >
                                ⇵
                            </button>
                            <div className="divider" />
                            <button className="lt-btn icon" onClick={resetAll} title="Reset everything">⟲</button>
                        </div>

                        <div
                            style={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                height: '100%',
                                overflow: 'auto'
                            }}
                        >
                            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform .12s ease' }}>
                                <canvas ref={canvasRef} />
                            </div>
                            {cropping && (
                                <LtCropOverlay
                                    crop={recipe.geometry.crop || [0, 0, 1, 1]}
                                    imageAspect={imageRef.current
                                        ? imageRef.current.naturalWidth / imageRef.current.naturalHeight
                                        : 1}
                                    onCommit={(crop) => { updateGeometry({ crop }); setCropping(false) }}
                                    onCancel={() => setCropping(false)}
                                />
                            )}
                        </div>

                        {/* Bottom bar: zoom + crop toggle */}
                        <div className="lt-stage-bar bottom">
                            <button className="lt-btn icon" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} title="Zoom out">−</button>
                            <span className="lt-zoom-label">{Math.round(zoom * 100)}%</span>
                            <button className="lt-btn icon" onClick={() => setZoom(z => Math.min(4, z + 0.25))} title="Zoom in">+</button>                            <div className="divider" />
                            <button
                                className={`lt-btn${cropping ? ' active' : ''}`}
                                onClick={() => setCropping(v => !v)}
                                title="Crop (C)"
                            >
                                Crop
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="lt-stage-empty">
                        <div className="lt-drop">
                            <h2>Start with a photograph</h2>
                            <p>
                                Import images or drop them here. Develop them with a full
                                grade, crop, tone curves and LUTs — then push the result
                                straight into a spread.
                            </p>
                            <button className="lt-btn primary" onClick={onPickFiles}>Import images</button>
                        </div>
                    </div>
                )}
            </main>

            {/* ── Inspector ─────────────────────────────────────────── */}
            <aside className={`lt-controls${inspectorOpen ? ' open' : ''}`}>
                <div className="lt-inspector-head">
                    <LtHistogram image={imageRef.current} stats={imageStats} />
                    <div className="lt-tabs">
                        {TABS.map(t => (
                            <button
                                key={t.id}
                                className={`lt-tab${tab === t.id ? ' active' : ''}`}
                                onClick={() => setTab(t.id)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="lt-inspector-body">
                    {/* ── Develop ─────────────────────────────────── */}
                    {tab === 'develop' && (
                        <>
                            <div className="lt-group">
                                <div className="lt-group-head">Presets</div>
                                <LtPresetStrip
                                    image={imageRef.current}
                                    recipe={recipe}
                                    activeId={activePreset}
                                    onApply={applyPreset}
                                />
                            </div>
                            {CONTROL_GROUPS.filter(g => g.id === 'tone' || g.id === 'colour').map(group => (
                                <div className="lt-group" key={group.id}>
                                    <div className="lt-group-head">
                                        {group.label}
                                        <button
                                            className="lt-btn ghost"
                                            onClick={() => group.controls.forEach(([key]) => updateParam(
                                                key,
                                                GRADE_DEFAULTS[key]
                                            ))}
                                        >
                                            Reset
                                        </button>
                                    </div>
                                    {group.controls.map(([key, label, min, max, step, bipolar]) => (
                                        <LtSlider
                                            key={key}
                                            label={label}
                                            value={recipe.params[key]}
                                            onChange={v => updateParam(key, v)}
                                            spec={{ min, max, step, bipolar, defaultAtZero: bipolar, neutral: GRADE_DEFAULTS[key] }}
                                        />
                                    ))}
                                </div>
                            ))}
                        </>
                    )}

                    {/* ── Effects ─────────────────────────────────── */}
                    {tab === 'effects' && (
                        <>
                            {CONTROL_GROUPS.filter(g => g.id === 'detail' || g.id === 'effects').map(group => {
                                const isDetail = group.id === 'detail'
                                const values = isDetail ? recipe.params : recipe.fx
                                return (
                                    <div className="lt-group" key={group.id}>
                                        <div className="lt-group-head">
                                            {group.label}
                                            <button
                                                className="lt-btn ghost"
                                                onClick={() => group.controls.forEach(([key]) => isDetail
                                                    ? updateParam(key, GRADE_DEFAULTS[key])
                                                    : updateFx(key, FX_DEFAULTS[key]))}
                                            >
                                                Reset
                                            </button>
                                        </div>
                                        {group.controls.map(([key, label, min, max, step, bipolar]) => (
                                            <LtSlider
                                                key={key}
                                                label={label}
                                                value={values[key]}
                                                onChange={v => (isDetail ? updateParam(key, v) : updateFx(key, v))}
                                                spec={{ min, max, step, bipolar, defaultAtZero: bipolar, neutral: (isDetail ? GRADE_DEFAULTS : FX_DEFAULTS)[key] }}
                                            />
                                        ))}
                                    </div>
                                )
                            })}
                            <div className="lt-group">
                                <div className="lt-group-head">Monochrome</div>
                                <div className="lt-row">
                                    <label>Black &amp; white</label>
                                    <button
                                        className={`lt-switch${recipe.bw ? ' on' : ''}`}
                                        onClick={() => updateRecipe({ bw: !recipe.bw })}
                                        aria-pressed={recipe.bw}
                                        aria-label="Toggle black and white"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── Curves ──────────────────────────────────── */}
                    {tab === 'curves' && (
                        <div className="lt-group">
                            <div className="lt-group-head">
                                Tone Curve
                                <button
                                    className="lt-btn ghost"
                                    onClick={() => updateRecipe({ curves: createRecipe().curves })}
                                >
                                    Reset
                                </button>
                            </div>
                            <LtCurveEditor
                                curves={recipe.curves}
                                activeChannel={curveChannel}
                                onChannelChange={setCurveChannel}
                                onChange={(channel, points) => {
                                    updateRecipe({ curves: { ...recipeRef.current.curves, [channel]: points } })
                                    setActivePreset('custom')
                                }}
                            />
                        </div>
                    )}

                    {/* ── Crop ────────────────────────────────────── */}
                    {tab === 'crop' && (
                        <div className="lt-group">
                            <div className="lt-group-head">Aspect Ratio</div>
                            <div className="lt-crop-grid">
                                {ASPECTS.map(a => (
                                    <button key={a.id} className="lt-btn" onClick={() => applyAspect(a.id)}>{a.label}</button>
                                ))}
                            </div>
                            <div className="lt-group-head" style={{ marginTop: 14 }}>Orientation</div>
                            <div className="lt-row">
                                <label>Rotate</label>
                                <button className="lt-btn" onClick={() => rotate(-90)}>↺ 90°</button>
                                <button className="lt-btn" onClick={() => rotate(90)}>↻ 90°</button>
                            </div>
                            <div className="lt-row">
                                <label>Flip horizontal</label>
                                <button
                                    className={`lt-switch${recipe.geometry.flipH ? ' on' : ''}`}
                                    onClick={() => updateGeometry({ flipH: !recipe.geometry.flipH })}
                                    aria-pressed={recipe.geometry.flipH}
                                    aria-label="Flip horizontal"
                                />
                            </div>
                            <div className="lt-row">
                                <label>Flip vertical</label>
                                <button
                                    className={`lt-switch${recipe.geometry.flipV ? ' on' : ''}`}
                                    onClick={() => updateGeometry({ flipV: !recipe.geometry.flipV })}
                                    aria-pressed={recipe.geometry.flipV}
                                    aria-label="Flip vertical"
                                />
                            </div>
                            <div className="lt-row">
                                <label>Rotation</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="359"
                                    value={recipe.geometry.rotate || 0}
                                    onChange={e => updateGeometry({ rotate: Number(e.target.value) || 0 })}
                                />
                                <span className="lt-crop-info">degrees</span>
                            </div>
                            <div className="lt-group-head" style={{ marginTop: 14 }}>Interactive Crop</div>
                            <button
                                className={`lt-btn${cropping ? ' active' : ''}`}
                                style={{ width: '100%' }}
                                onClick={() => setCropping(v => !v)}
                            >
                                {cropping ? 'Apply crop' : 'Crop on canvas'}
                            </button>
                            <div className="lt-row" style={{ marginTop: 8 }}>
                                <label>Clear crop</label>
                                <button className="lt-btn" onClick={() => updateGeometry({ crop: null })}>Reset</button>
                            </div>
                        </div>
                    )}

                    {/* ── LUT ─────────────────────────────────────── */}
                    {tab === 'lut' && (
                        <div className="lt-group">
                            <div className="lt-group-head">Look Up Table</div>
                            <label className="lt-file-btn">
                                {recipe.lut ? recipe.lut.name : 'Import .cube LUT'}
                                <input type="file" accept=".cube,text/plain" onChange={importLut} style={{ display: 'none' }} />
                            </label>
                            {recipe.lut && (
                                <>
                                    <div style={{ marginTop: 10 }}>
                                        <LtSlider
                                            label="Strength"
                                            value={recipe.lutStrength}
                                            onChange={v => updateRecipe({ lutStrength: v })}
                                            spec={{ min: 0, max: 1, step: 0.01, bipolar: false, neutral: 1 }}
                                        />
                                    </div>
                                    <div className="lt-row">
                                        <label>Export this LUT</label>
                                        <button className="lt-btn" onClick={exportLut}>↓ .cube</button>
                                    </div>
                                    <div className="lt-row">
                                        <label>Remove LUT</label>
                                        <button className="lt-btn danger" onClick={() => updateRecipe({ lut: null })}>Remove</button>
                                    </div>
                                </>
                            )}
                            <div className="lt-group-head" style={{ marginTop: 14 }}>Recipe</div>
                            <button className="lt-btn" style={{ width: '100%' }} onClick={exportRecipe}>
                                Export recipe JSON
                            </button>
                            <p className="lt-help">
                                Recipes are portable. The same file drives the preview, the
                                export and the live treatment when an image is placed on a spread.
                            </p>
                        </div>
                    )}
                </div>
            </aside>

            {/* ── Status bar ───────────────────────────────────── */}
            <footer className="lt-status">
                <span>
                    <span className={`dot ${rendererMode === 'gpu' ? 'gpu' : rendererMode === 'cpu' ? 'cpu' : 'off'}`} />
                    {rendererMode === 'gpu' ? 'GPU' : rendererMode === 'cpu' ? 'CPU fallback' : 'initialising'}
                </span>
                <span>{gallery.length} image{gallery.length === 1 ? '' : 's'}</span>
                {selectedAsset && <span>{imgDims}</span>}
                {recipe.geometry.crop && <span>cropped</span>}
                {recipe.lut && <span>LUT: {recipe.lut.name}</span>}
                <span className="spacer" />
                <span>\ compare · ← → browse · A auto · C crop · R rotate · F flip</span>
            </footer>
        </div>
    )
}

export default LightTable
