/*
 * Component: LtCropOverlay
 * Interactive crop box drawn over the stage. Drag inside to move the box,
 * drag a corner to resize, and the surrounding area is dimmed.
 */

import React, { useCallback, useRef, useState } from 'react'

const MIN_SIZE = 0.08

const HANDLES = ['nw', 'ne', 'sw', 'se']

function handleStyle(handle, box, root) {
    const x = handle.includes('w') ? box[0] : box[2]
    const y = handle.includes('n') ? box[1] : box[3]
    return { left: `${x * 100}%`, top: `${y * 100}%`, transform: 'translate(-50%,-50%)' }
}

function LtCropOverlay({ crop, onCommit, onCancel, imageAspect }) {
    const rootRef = useRef(null)
    const [box, setBox] = useState(crop)
    const drag = useRef(null)

    // Crop is stored in source-normalised space; the overlay works in the
    // displayed stage space. Aspect correction keeps the drawn box square.
    const stageAspect = imageAspect

    const toNorm = (event) => {
        const rect = rootRef.current.getBoundingClientRect()
        const x = (event.clientX - rect.left) / rect.width
        const y = (event.clientY - rect.top) / rect.height
        return [x, y]
    }

    const onPointerDown = (event, mode) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture?.(event.pointerId)
        drag.current = { mode, start: toNorm(event), origin: box.slice() }
        setBox(box.slice())
    }

    const onPointerMove = (event) => {
        if (!drag.current) return
        const [cx, cy] = toNorm(event)
        const { mode, start, origin } = drag.current
        let next = origin.slice()

        if (mode === 'move') {
            const dx = cx - start[0], dy = cy - start[1]
            const w = origin[2] - origin[0], h = origin[3] - origin[1]
            const ndx = Math.max(-origin[0], Math.min(1 - origin[2], dx))
            const ndy = Math.max(-origin[1], Math.min(1 - origin[3], dy))
            next = [origin[0] + ndx, origin[1] + ndy, origin[2] + ndx, origin[3] + ndy]
        } else {
            // Resize from the grabbed corner.
            const dirX = mode.includes('w') ? -1 : 1
            const dirY = mode.includes('n') ? -1 : 1
            let w = Math.abs(cx - start[0]), h = Math.abs(cy - start[1])
            w = Math.max(MIN_SIZE, Math.min(w, 1))
            h = Math.max(MIN_SIZE, Math.min(h, 1))
            const ax = dirX === 1 ? origin[0] : origin[2]
            const ay = dirY === 1 ? origin[1] : origin[3]
            next = [
                Math.min(ax, ax + dirX * w), Math.min(ay, ay + dirY * h),
                Math.max(ax, ax + dirX * w), Math.max(ay, ay + dirY * h)
            ]
        }
        setBox(next)
    }

    const onPointerUp = useCallback(() => {
        if (drag.current) {
            drag.current = null
            onCommit(box)
        }
    }, [box, onCommit])

    // Shade the four bands outside the crop box.
    const [x0, y0, x1, y1] = box
    const shades = [
        { left: 0, top: 0, right: 0, bottom: y0 },
        { left: 0, top: y1, right: 0, bottom: 0 },
        { left: 0, top: y0, right: x0, bottom: y1 - y0 },
        { left: x1, top: y0, right: 0, bottom: y1 - y0 }
    ]

    return (
        <div
            ref={rootRef}
            className="lt-crop-overlay"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            {shades.map((s, i) => (
                <div key={i} className="lt-crop-shade" style={{ left: `${s.left * 100}%`, top: `${s.top * 100}%`, width: `${s.right * 100}%`, height: `${s.bottom * 100}%` }} />
            ))}
            <div
                className="lt-crop-frame"
                style={{ left: `${x0 * 100}%`, top: `${y0 * 100}%`, width: `${(x1 - x0) * 100}%`, height: `${(y1 - y0) * 100}%` }}
                onPointerDown={e => onPointerDown(e, 'move')}
            />
            {HANDLES.map(h => (
                <div
                    key={h}
                    onPointerDown={e => onPointerDown(e, h)}
                    style={{
                        position: 'absolute',
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: 'var(--lt-accent)',
                        border: '1.5px solid #fff',
                        cursor: h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize',
                        ...handleStyle(h, box, rootRef)
                    }}
                />
            ))}
        </div>
    )
}

export default LtCropOverlay
