/*
 * Component: PortfolioLayouts
 * Photography layouts presented as a browseable gallery with a small live
 * preview of each arrangement. Clicking one asks whether to add it empty or
 * fill its frames straight from the library — the difference between a
 * five-minute layout and a five-hour one.
 */

import React, { useMemo, useState } from 'react'
import { PORTFOLIO_LAYOUTS, PORTFOLIO_LAYOUT_CATEGORIES, createLayoutPage } from '../../data/portfolioTemplates.js'
import { getFramePreset } from '../../lib/photoLibrary.js'
import { bookGeometry } from '../../lib/bookGeometry.js'
import { DEFAULT_PAPER } from '../../constants.js'
import { useVP } from '../../context/VPContext.jsx'

/**
 * Miniature of a layout, drawn from the *actual* page the layout will produce
 * for this book — the same remapping `createLayoutPage` performs.
 *
 * It used to redraw the raw descriptors against a hardcoded 528x816, which is
 * why the preview disagreed with the result: a layout shown on a square book was
 * still drawn to a digest rectangle, so the arrangement the user approved was
 * not the arrangement they got. Preview and reality are now the same call.
 */
const PREVIEW_H = 120

const LayoutPreview = ({ layout, paperSize }) => {
    // A landscape layout needs landscape geometry. Reusing the *current page's*
    // geometry is what made landscape templates draw a wide arrangement inside a
    // portrait box, so their frames hung off the side of the preview — the
    // arrangement you approved was never the one you got.
    const trim = useMemo(
        () => bookGeometry({ paperSize }, { orientation: layout?.orientation || 'portrait' }),
        [paperSize, layout]
    )

    // Build the real page for this book's trim, then draw that.
    const page = useMemo(() => {
        if (!layout) return null
        try {
            return createLayoutPage(layout, { pageSize: { width: trim.width, height: trim.height } })
        } catch {
            return null
        }
    }, [layout, trim.width, trim.height])

    const width = trim.width
    const height = trim.height
    const scale = PREVIEW_H / height
    const boxW = Math.min(140, Math.round(width * scale))

    const frames = useMemo(
        () => (page?.elements || []).filter(el => el.type === 'photo-frame'),
        [page]
    )
    const texts = useMemo(
        () => (page?.elements || []).filter(el => el.type === 'text'),
        [page]
    )

    if (!page) return <span className="pf-layout-preview" style={{ width: boxW, height: PREVIEW_H }} />

    return (
        <span className="pf-layout-preview" style={{ width: boxW, height: PREVIEW_H }}>
            <span
                className="pf-layout-canvas"
                style={{ width: `${boxW}px`, height: `${PREVIEW_H}px` }}
            >
                {frames.map((el, index) => {
                    const preset = getFramePreset(el.framePreset || 'mat')
                    const border = preset.style.frameBorderWidth || 0
                    return (
                        <span
                            key={el.id || index}
                            className="pf-layout-frame"
                            style={{
                                left: el.x * scale,
                                top: el.y * scale,
                                width: el.width * scale,
                                height: el.height * scale,
                                // Fill the whole cell with the mat colour, then
                                // inset a darker "window" for the photograph, so
                                // the matte proportion reads at thumbnail size the
                                // way it will on the page.
                                background: preset.style.frameColor || '#f6f4f0',
                                border: border
                                    ? `${Math.max(0.5, border * scale)} solid ${preset.style.frameBorderColor}`
                                    : 'none',
                                boxSizing: 'border-box'
                            }}
                        >
                            <span
                                className="pf-layout-window"
                                style={{
                                    inset: `${Math.max(1, (el.frameWidth ?? 0) * scale)}px ${Math.max(1, (el.frameWidth ?? 0) * scale)}px ${Math.max(1, (el.frameWidthBottom ?? el.frameWidth ?? 0) * scale)}px`
                                }}
                            />
                        </span>
                    )
                })}
                {texts.map((el, index) => (
                    <span
                        key={el.id || index}
                        className="pf-layout-text"
                        style={{
                            left: el.x * scale,
                            top: el.y * scale,
                            width: el.width * scale,
                            height: Math.max(1.5, (el.fontSize || 12) * scale * 1.3),
                            color: el.color || '#333',
                            opacity: 0.5
                        }}
                    />
                ))}
            </span>
        </span>
    )
}

export default function PortfolioLayouts({ onApplied, paperSize }) {
    const { addPageFromPortfolioLayout, vpState, toast } = useVP()
    const [category, setCategory] = useState('All')
    const [pending, setPending] = useState(null)
    const [fillWith, setFillWith] = useState(true)

    // The panel can be rendered before the workspace has resolved a trim; fall
    // back to the default paper rather than dividing by undefined.
    const trimKey = paperSize || DEFAULT_PAPER

    const assets = vpState.library?.imported || []
    // Layouts saved from this book's own spreads, shown alongside the built-ins
    // so a saved arrangement is one click from being used again.
    const custom = vpState.currentProject?.customLayouts || []
    const categories = ['All', ...PORTFOLIO_LAYOUT_CATEGORIES]
    const all = [...custom, ...PORTFOLIO_LAYOUTS]
    const visible = category === 'All'
        ? all
        : all.filter(layout => layout.category === category)

    const confirm = (layout) => {
        const pool = fillWith ? assets : null
        if (fillWith && !assets.length) {
            toast('Import photos first, or add the layout empty', 'info')
            setFillWith(false)
            setPending(layout)
            return
        }
        addPageFromPortfolioLayout(layout, { fillWith: pool })
        setPending(null)
        onApplied?.()
    }

    return (
        <div className="pf-layouts">
            <div className="pf-layouts-head">
                <div className="pf-layouts-categories">
                    {categories.map(item => (
                        <button
                            key={item}
                            type="button"
                            className={`pf-chip ${category === item ? 'active' : ''}`}
                            onClick={() => setCategory(item)}
                        >
                            {item}
                        </button>
                    ))}
                </div>
                <label className="pf-fill-toggle">
                    <input type="checkbox" checked={fillWith} onChange={e => setFillWith(e.target.checked)} />
                    Fill with library photos
                </label>
            </div>

            {pending && (
                <div className="pf-layout-confirm">
                    <p>
                        “{pending.name}” has {pending.build().filter(d => d.__frame).length} frame(s).
                        {fillWith && assets.length
                            ? ` Fill them with ${assets.length} library photo${assets.length === 1 ? '' : 's'}?`
                            : ' Add it empty?'}
                    </p>
                    <div className="pf-layout-confirm-actions">
                        <button type="button" className="pf-btn ghost" onClick={() => setPending(null)}>Cancel</button>
                        <button type="button" className="pf-btn primary" onClick={() => confirm(pending)}>Add spread</button>
                    </div>
                </div>
            )}

            <div className="pf-layout-grid">
                {visible.map(layout => (
                    <button
                        key={layout.id}
                        type="button"
                        className="pf-layout-card"
                        onClick={() => confirm(layout)}
                    >
                        <LayoutPreview layout={layout} paperSize={trimKey} />
                        <span className="pf-layout-meta">
                            <strong>{layout.name}</strong>
                            <span>{layout.description}</span>
                            <em>{layout.category} · {layout.orientation}</em>
                        </span>
                    </button>
                ))}
            </div>        </div>
    )
}
