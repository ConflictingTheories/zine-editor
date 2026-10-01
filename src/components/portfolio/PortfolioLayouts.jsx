/*
 * Component: PortfolioLayouts
 * Photography layouts presented as a browseable gallery with a small live
 * preview of each arrangement. Clicking one asks whether to add it empty or
 * fill its frames straight from the library — the difference between a
 * five-minute layout and a five-hour one.
 */

import React, { useMemo, useState } from 'react'
import { PORTFOLIO_LAYOUTS, PORTFOLIO_LAYOUT_CATEGORIES } from '../../data/portfolioTemplates.js'
import { getFramePreset } from '../../lib/photoLibrary.js'
import { useVP } from '../../context/VPContext.jsx'

/** Miniature of a layout, drawn from the same descriptors it will create. */
const LayoutPreview = ({ layout }) => {
    const descriptors = useMemo(() => (layout?.build?.() || []).filter(Boolean), [layout])
    const width = layout?.orientation === 'landscape' ? 768 : 528
    const height = layout?.orientation === 'landscape' ? 528 : 816
    const scale = 108 / width

    return (
        <span className="pf-layout-preview" style={{ width: 108 * (width / height) > 120 ? 108 : 108 * (width / height), height: 108 }}>
            <span
                className="pf-layout-canvas"
                style={{ width: `${width * scale}px`, height: `${height * scale}px` }}
            >
                {descriptors.map((descriptor, index) => {
                    if (descriptor.__frame) {
                        const preset = getFramePreset(descriptor.preset)
                        return (
                            <span
                                key={index}
                                className="pf-layout-frame"
                                style={{
                                    left: descriptor.x * scale,
                                    top: descriptor.y * scale,
                                    width: descriptor.width * scale,
                                    height: descriptor.height * scale,
                                    background: preset.style.frameColor,
                                    border: preset.style.frameBorderWidth
                                        ? `${Math.max(0.5, preset.style.frameBorderWidth * scale * 2)}px solid ${preset.style.frameBorderColor}`
                                        : 'none'
                                }}
                            >
                                <span className="pf-layout-window" />
                            </span>
                        )
                    }
                    if (descriptor.__text) {
                        return (
                            <span
                                key={index}
                                className="pf-layout-text"
                                style={{
                                    left: descriptor.x * scale,
                                    top: descriptor.y * scale,
                                    width: descriptor.width * scale,
                                    height: Math.max(1.5, (descriptor.fontSize || 12) * scale * 1.6),
                                    color: descriptor.color || '#333',
                                    opacity: 0.65
                                }}
                            />
                        )
                    }
                    if (descriptor.__shape) {
                        return (
                            <span
                                key={index}
                                className="pf-layout-rule"
                                style={{
                                    left: descriptor.x * scale,
                                    top: descriptor.y * scale,
                                    width: descriptor.width * scale,
                                    background: descriptor.fill
                                }}
                            />
                        )
                    }
                    return null
                })}
            </span>
        </span>
    )
}

export default function PortfolioLayouts({ onApplied }) {
    const { addPageFromPortfolioLayout, vpState, toast } = useVP()
    const [category, setCategory] = useState('All')
    const [pending, setPending] = useState(null)
    const [fillWith, setFillWith] = useState(true)

    const assets = vpState.library?.imported || []
    const categories = ['All', ...PORTFOLIO_LAYOUT_CATEGORIES]
    const visible = category === 'All'
        ? PORTFOLIO_LAYOUTS
        : PORTFOLIO_LAYOUTS.filter(layout => layout.category === category)

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
                        <LayoutPreview layout={layout} />
                        <span className="pf-layout-meta">
                            <strong>{layout.name}</strong>
                            <span>{layout.description}</span>
                            <em>{layout.category} · {layout.orientation}</em>
                        </span>
                    </button>
                ))}
            </div>
        </div>
    )
}
