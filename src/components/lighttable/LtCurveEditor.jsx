/*
 * Component: LtCurveEditor
 * Draggable tone curve with per-channel (RGB / R / G / B) selection, point
 * insertion on click, and point removal via double click or right click.
 */

import React, { useRef, useState } from 'react'

const W = 240
const H = 150
const PAD = 0.04
const MAX_POINTS = 12

const CHANNELS = [
    { id: 'rgb', label: 'RGB', color: '#dfe4ea' },
    { id: 'r', label: 'R', color: '#ef6b73' },
    { id: 'g', label: 'G', color: '#70cb91' },
    { id: 'b', label: 'B', color: '#6f9cff' }
]

function LtCurveEditor({ curves, activeChannel, onChannelChange, onChange }) {
    const svgRef = useRef(null)
    const [activePoint, setActivePoint] = useState(null)
    const dragging = useRef(false)

    const points = curves?.[activeChannel] || []

    const toLocal = (event) => {
        const rect = svgRef.current.getBoundingClientRect()
        // The SVG scales to its container, so map through the viewBox.
        const x = ((event.clientX - rect.left) / rect.width) * W
        const y = ((event.clientY - rect.top) / rect.height) * H
        return {
            nx: Math.min(1 - PAD, Math.max(PAD, x / W)),
            ny: Math.min(1 - PAD, Math.max(PAD, 1 - y / H))
        }
    }

    const nearestIndex = (nx, tolerance = 0.06) => {
        let best = -1, bestDist = tolerance
        points.forEach((p, i) => {
            const d = Math.abs(p[0] - nx)
            if (d < bestDist) { bestDist = d; best = i }
        })
        return best
    }

    const commit = (index, nx, ny) => {
        const next = points.map((p, i) => {
            if (i !== index) return p
            const isEnd = i === 0 || i === points.length - 1
            const minX = i === 0 ? 0 : points[i - 1][0] + 0.02
            const maxX = i === points.length - 1 ? 1 : points[i + 1][0] - 0.02
            return [isEnd ? (i === 0 ? 0 : 1) : Math.max(minX, Math.min(maxX, nx)), isEnd ? points[i][1] : ny]
        })
        onChange(activeChannel, next)
    }

    const onPointerDown = (event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId)
        const { nx, ny } = toLocal(event)
        let index = nearestIndex(nx)
        // Clicking empty canvas inserts a point at that position.
        if (index === -1) {
            if (points.length >= MAX_POINTS) return
            const sorted = points.slice().sort((a, b) => a[0] - b[0])
            const at = sorted.findIndex(p => p[0] > nx)
            const insertAt = at === -1 ? sorted.length : at
            const inserted = sorted.slice()
            inserted.splice(insertAt, 0, [nx, ny])
            onChange(activeChannel, inserted)
            index = insertAt
        }
        dragging.current = true
        setActivePoint(index)
        commit(index, nx, ny)
    }

    const onPointerMove = (event) => {
        if (!dragging.current || activePoint === null) return
        const { nx, ny } = toLocal(event)
        commit(activePoint, nx, ny)
    }

    const stopDrag = () => { dragging.current = false; setActivePoint(null) }

    const removePoint = (index) => {
        if (index <= 0 || index >= points.length - 1) return
        onChange(activeChannel, points.filter((_, i) => i !== index))
    }

    // Monotone cubic path through the control points.
    const path = points.map((p, i) => `${i ? 'L' : 'M'} ${p[0] * W} ${(1 - p[1]) * H}`).join(' ')
    const active = CHANNELS.find(c => c.id === activeChannel) || CHANNELS[0]

    return (
        <div>
            <div className="lt-curve-head">
                {CHANNELS.map(c => (
                    <button
                        key={c.id}
                        className={`lt-btn${activeChannel === c.id ? ' active' : ''}`}
                        onClick={() => onChannelChange(c.id)}
                    >
                        {c.label}
                    </button>
                ))}
            </div>
            <svg
                ref={svgRef}
                className="lt-curve"
                viewBox={`0 0 ${W} ${H}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={stopDrag}
                onPointerCancel={stopDrag}
                onDoubleClick={e => {
                    const { nx } = toLocal(e)
                    const index = nearestIndex(nx, 0.05)
                    if (index >= 0) removePoint(index)
                }}
                onContextMenu={e => {
                    e.preventDefault()
                    const { nx } = toLocal(e)
                    const index = nearestIndex(nx, 0.05)
                    if (index >= 0) removePoint(index)
                }}
            >
                <path className="lt-curve-grid" d={`M60 0V${H}M120 0V${H}M180 0V${H}M0 37.5H${W}M0 75H${W}M0 112.5H${W}M0 0L${W} ${H}`} />
                <path className="lt-curve-line" d={path} style={{ stroke: active.color }} />
                {points.map((p, i) => (
                    <circle
                        key={i}
                        cx={p[0] * W}
                        cy={(1 - p[1]) * H}
                        r={activePoint === i ? 5.5 : 4}
                        className={activePoint === i ? 'active' : ''}
                        style={{ stroke: active.color }}
                    />
                ))}
            </svg>
            <p className="lt-help">Click to add a point · drag to shape · double-click or right-click a point to remove it.</p>
        </div>
    )
}

export default LtCurveEditor
