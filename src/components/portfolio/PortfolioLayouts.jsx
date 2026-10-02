/*
 * Component: PortfolioLayouts
 * Photography layouts presented as a browseable gallery with a small live
 * preview of each arrangement. Clicking one asks whether to add it empty or
 * fill its frames straight from the library — the difference between a
 * five-minute layout and a five-hour one.
 */

import React, { useMemo, useState } from 'react'
import { PORTFOLIO_LAYOUTS, PORTFOLIO_LAYOUT_CATEGORIES, createLayoutPages } from '../../data/portfolioTemplates.js'
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
const PREVIEW_H = 124
const PREVIEW_MAX_W = 220
const PREVIEW_PAD = 8

const LayoutPreview = ({ layout, paperSize, assets = [] }) => {
    const trim = useMemo(() => bookGeometry({ paperSize }), [paperSize])
    const pages = useMemo(() => {
        if (!layout) return []
        try {
            return createLayoutPages(layout, {
                pageSize: { width: trim.width, height: trim.height },
                gutter: trim.gutter
            })
        } catch {
            return []
        }
    }, [layout, trim.width, trim.height, trim.gutter])

    const spreadWidth = trim.width * pages.length + trim.gutter * Math.max(0, pages.length - 1)
    const scale = Math.min(PREVIEW_H / trim.height, PREVIEW_MAX_W / Math.max(1, spreadWidth))
    const boxW = Math.max(1, Math.round(spreadWidth * scale))
    const boxH = Math.max(1, Math.round(trim.height * scale))
    const frames = pages.flatMap((page, pageIndex) => (page.elements || [])
        .filter(element => element.type === 'photo-frame')
        .map(element => ({ element, pageIndex })))
    const texts = pages.flatMap((page, pageIndex) => (page.elements || [])
        .filter(element => element.type === 'text')
        .map(element => ({ element, pageIndex })))

    if (!pages.length) return <span className="pf-layout-preview" style={{ width: boxW + PREVIEW_PAD * 2, height: boxH + PREVIEW_PAD * 2 }} />

    return (
        <span className="pf-layout-preview" style={{ width: boxW + PREVIEW_PAD * 2, height: boxH + PREVIEW_PAD * 2 }}>
            <span className="pf-layout-canvas" style={{ width: `${boxW}px`, height: `${boxH}px` }}>
                {pages.length > 1 && <span className="pf-layout-gutter" style={{ left: trim.width * scale, width: trim.gutter * scale }} />}
                {frames.map(({ element, pageIndex }, index) => {
                    const preset = getFramePreset(element.framePreset || 'mat')
                    const border = preset.style.frameBorderWidth || 0
                    const asset = assets[index % Math.max(1, assets.length)]
                    const left = pageIndex * (trim.width + trim.gutter) + element.x
                    return (
                        <span
                            key={element.id || index}
                            className="pf-layout-frame"
                            style={{
                                left: left * scale,
                                top: element.y * scale,
                                width: element.width * scale,
                                height: element.height * scale,
                                background: preset.style.frameColor || '#f6f4f0',
                                border: border ? `${Math.max(0.5, border * scale)} solid ${preset.style.frameBorderColor}` : 'none',
                                boxSizing: 'border-box'
                            }}
                        >
                            <span
                                className="pf-layout-window"
                                style={{
                                    inset: `${Math.max(1, (element.frameWidth ?? 0) * scale)}px ${Math.max(1, (element.frameWidthRight ?? element.frameWidth ?? 0) * scale)}px ${Math.max(1, (element.frameWidthBottom ?? element.frameWidth ?? 0) * scale)}px ${Math.max(1, (element.frameWidth ?? 0) * scale)}px`
                                }}
                            >
                                {asset && <img src={asset.thumb || asset.src} alt="" loading="lazy" />}
                            </span>
                        </span>
                    )
                })}
                {texts.map(({ element, pageIndex }, index) => (
                    <span
                        key={element.id || index}
                        className="pf-layout-text"
                        style={{
                            left: (pageIndex * (trim.width + trim.gutter) + element.x) * scale,
                            top: element.y * scale,
                            width: element.width * scale,
                            height: Math.max(1.5, (element.fontSize || 12) * scale * 1.3),
                            color: element.color || '#333',
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
                        <LayoutPreview layout={layout} paperSize={trimKey} assets={assets} />
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
