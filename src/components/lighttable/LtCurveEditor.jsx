/*
 * Component: LtCurveEditor
 * The tone curve surface.
 *
 * Three things make or break a curve tool, and all three used to be missing:
 *
 *  1. The drawn line has to be the applied line. It was drawn as straight
 *     segments between control points while the renderer evaluated a smoothstep
 *     spline, so the shape on screen lied about the result. It is now sampled
 *     from the same `curveValue()` the CPU and GPU pipelines use.
 *  2. All channels at once. Grading a curve while judging it against the
 *     per-channel red/green/blue curves is the normal workflow, so the other
 *     channels are drawn behind the active one.
 *  3. A number. Input and output for the selected point, editable, because
 *     nudging one point by a pixel is most of what curve work actually is.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { curveValue } from '../../lib/lightTableEngine.js'

const W = 240
const H = 150
const PAD = 0.04
const MAX_POINTS = 12
const SAMPLES = 96

const CHANNELS = [
    { id: 'rgb', label: 'RGB', color: '#dfe4ea' },
    { id: 'r', label: 'R', color: '#ef6b73' },
    { id: 'g', label: 'G', color: '#70cb91' },
    { id: 'b', label: 'B', color: '#6f9cff' }
]

/** A channel curve inherits the shared RGB curve until it is edited itself. */
const effectivePoints = (curves, channel) => {
    const own = curves?.[channel]
    if (Array.isArray(own) && own.length >= 2) return own
    return curves?.rgb || []
}

const toPath = (points) => {
    if (!points || points.length < 2) return ''
    let d = ''
    for (let i = 0; i < SAMPLES; i++) {
        const v = i / (SAMPLES - 1)
        d += `${i ? 'L' : 'M'} ${(v * W).toFixed(2)} ${((1 - curveValue(v, points)) * H).toFixed(2)} `
    }
    return d.trim()
}

const asPct = (v) => Math.round(v * 100)

function LtCurveEditor({ curves, activeChannel, onChannelChange, onChange }) {
    const svgRef = useRef(null)
    const [activePoint, setActivePoint] = useState(null)
    const dragging = useRef(false)
    // The active index is mirrored into a ref because inserting a point and
    // immediately dragging it must not wait for a React re-render — otherwise
    // the first pointermove after an insert is dropped.
    const activeIndex = useRef(null)

    const selectPoint = useCallback((index) => {
        activeIndex.current = index
        setActivePoint(index)
    }, [])

    const points = useMemo(
        () => effectivePoints(curves, activeChannel),
        [curves, activeChannel]
    )

    // Ghosts for every channel besides the one being edited, so the red curve
    // stays visible while the master curve is shaped — and is hidden when it
    // has never been overridden, because then it *is* the master curve.
    const ghosts = useMemo(
        () => CHANNELS
            .filter(c => c.id !== activeChannel)
            .filter(c => c.id === 'rgb' || (Array.isArray(curves?.[c.id]) && curves[c.id].length >= 2))
            .map(c => ({ ...c, d: toPath(effectivePoints(curves, c.id)) }))
            .filter(c => c.d),
        [curves, activeChannel]
    )

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
        selectPoint(index)
        commit(index, nx, ny)
    }

    const onPointerMove = (event) => {
        if (!dragging.current || activeIndex.current === null) return
        const { nx, ny } = toLocal(event)
        commit(activeIndex.current, nx, ny)
    }

    const stopDrag = () => { dragging.current = false }

    const removePoint = (index) => {
        if (index <= 0 || index >= points.length - 1) return
        onChange(activeChannel, points.filter((_, i) => i !== index))
    }

    const path = toPath(points)
    const active = CHANNELS.find(c => c.id === activeChannel) || CHANNELS[0]

    const selected = activePoint !== null ? points[activePoint] : null

    return (
        <div>
            <div className="lt-curve-head">
                {CHANNELS.map(c => (
                    <button
                        key={c.id}
                        className={`lt-btn${activeChannel === c.id ? ' active' : ''}`}
                        onClick={() => { selectPoint(null); onChannelChange(c.id) }}
                        aria-pressed={activeChannel === c.id}
                        title={
                            Array.isArray(curves?.[c.id]) && curves[c.id].length >= 2
                                ? `${c.label} channel — edited separately`
                                : `${c.label} channel — currently follows the master curve`
                        }
                    >
                        <span className="lt-curve-swatch" style={{ background: c.color }} />
                        {c.label}
                    </button>
                ))}
            </div>
            <svg
                ref={svgRef}
                className="lt-curve"
                viewBox={`0 0 ${W} ${H}`}
                tabIndex={0}
                onKeyDown={(event) => {
            if (activeIndex.current === null) return
            const step = event.shiftKey ? 0.01 : 0.001
            const delta = {
                ArrowLeft: [-step, 0], ArrowRight: [step, 0],
                ArrowUp: [0, step], ArrowDown: [0, -step]
            }[event.key]
            if (!delta) return
            event.preventDefault()
            const [dx, dy] = delta
            const current = points[activeIndex.current]
            if (!current) return
            commit(activeIndex.current, current[0] + dx, current[1] + dy)
        }}
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

                {ghosts.map(ghost => (
                    <path key={ghost.id} className="lt-curve-ghost" d={ghost.d} style={{ stroke: ghost.color }} />
                ))}

                <path className="lt-curve-line" d={path} style={{ stroke: active.color }} />
                {points.map((p, i) => (
                    <circle
                        key={i}
                        cx={p[0] * W}
                        cy={(1 - p[1]) * H}
                        r={activePoint === i ? 5.5 : 4}
                        className={activePoint === i ? 'active' : ''}
                        style={{ stroke: active.color }}
                        onPointerDown={e => {
                            e.stopPropagation()
                            dragging.current = true
                            selectPoint(i)
                        }}
                    />
                ))}
            </svg>

            <div className="lt-curve-readout">
                {selected ? (
                    <>
                        <label>
                            In
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={asPct(selected[0])}
                                aria-label="Selected point input"
                                onChange={e => commit(
                                    activePoint,
                                    Math.min(1, Math.max(0, Number(e.target.value) / 100)),
                                    selected[1]
                                )}
                            />
                            <span>%</span>
                        </label>
                        <label>
                            Out
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={asPct(selected[1])}
                                aria-label="Selected point output"
                                onChange={e => commit(
                                    activePoint,
                                    selected[0],
                                    Math.min(1, Math.max(0, Number(e.target.value) / 100))
                                )}
                            />
                            <span>%</span>
                        </label>
                        <button
                            type="button"
                            className="lt-btn ghost"
                            disabled={activePoint <= 0 || activePoint >= points.length - 1}
                            onClick={() => removePoint(activePoint)}
                            title="Remove this point"
                        >
                            Remove point
                        </button>
                    </>
                ) : (
                    <p className="lt-help">
                        Click to add a point · drag to shape · arrow keys nudge ·
                        double-click a point to remove it.
                    </p>
                )}
            </div>
        </div>
    )
}

export default LtCurveEditor
