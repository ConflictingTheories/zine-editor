/*
 * Component: LtHistogram
 * Live RGB histogram with toggleable channel overlays, corner clipping
 * indicators and a stop readout. Recomputed from the current image whenever the
 * source changes, so it reflects the actual pixels rather than the graded
 * preview.
 */

import React, { useEffect, useRef, useState } from 'react'

const SIZE = 256
const HEIGHT = 66
const CHANNELS = [
    { key: 0, id: 'r', color: 'rgba(239,107,115,.75)', label: 'R' },
    { key: 1, id: 'g', color: 'rgba(112,203,145,.75)', label: 'G' },
    { key: 2, id: 'b', color: 'rgba(111,156,255,.75)', label: 'B' }
]

function LtHistogram({ image, stats }) {
    const ref = useRef(null)
    // All three channels is the default because the whole point of an RGB
    // histogram is the overlap; single-channel is for judging one alone.
    const [channels, setChannels] = useState({ r: true, g: true, b: true })
    // Sampling the image is the expensive part, so the result is cached by
    // image and only redrawn when the channel selection actually changes.
    const binsRef = useRef(null)
    const imageRef = useRef(null)

    useEffect(() => {
        if (!image?.naturalWidth) {
            binsRef.current = null
            return
        }
        if (imageRef.current === image && binsRef.current) return
        imageRef.current = image

        // Sample from a small thumbnail: fast, and visually identical.
        const thumb = document.createElement('canvas')
        thumb.width = 128
        thumb.height = 128
        const tctx = thumb.getContext('2d', { willReadFrequently: true })
        tctx.drawImage(image, 0, 0, 128, 128)
        const data = tctx.getImageData(0, 0, 128, 128).data

        const bins = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
        for (let i = 0; i < data.length; i += 4) {
            bins[0][data[i]]++
            bins[1][data[i + 1]]++
            bins[2][data[i + 2]]++
        }

        let max = 1
        for (const bin of bins) for (let i = 0; i < 256; i++) if (bin[i] > max) max = bin[i]
        binsRef.current = { bins, max }
    }, [image])

    useEffect(() => {
        const canvas = ref.current
        const data = binsRef.current
        if (!canvas || !data) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const W = SIZE, H = HEIGHT
        canvas.width = W
        canvas.height = H
        ctx.clearRect(0, 0, W, H)

        const visible = CHANNELS.filter(c => channels[c.id])
        // With one channel on, filling it at low alpha reads as a smear; a
        // single channel is drawn as a line.
        const solo = visible.length === 1

        for (const { key, color } of visible) {
            const bin = data.bins[key]
            ctx.beginPath()
            ctx.moveTo(0, H)
            for (let x = 0; x < 256; x++) {
                const y = H - (bin[x] / data.max) * (H - 3)
                ctx.lineTo(x, y)
            }
            ctx.lineTo(W - 1, H)
            ctx.closePath()
            if (solo) {
                ctx.fillStyle = color.replace('.75', '.12)')
                ctx.fill()
            } else {
                ctx.fillStyle = color.replace('.75', '.22)')
                ctx.fill()
            }
            ctx.strokeStyle = color
            ctx.lineWidth = 1
            ctx.stroke()
        }

        // Clipping indicators, drawn as corner triangles the way a darkroom
        // densitometer does — a badge in the corner is easy to miss, and a
        // blown highlight has to be noticed mid-grade, not after.
        if (visible.length === 3) {
            if (stats?.clippedShadows) drawTriangle(ctx, '#f85149', 'bottom-left')
            if (stats?.clippedHighlights) drawTriangle(ctx, '#d29922', 'top-right')
        }
    }, [image, stats, channels])

    const toggle = (id) => setChannels(prev => {
        const next = { ...prev, [id]: !prev[id] }
        // Never let the user turn every channel off and see an empty panel.
        if (!next.r && !next.g && !next.b) return prev
        return next
    })

    const ev = stats?.meanLuma !== undefined
        ? (Math.log2(Math.max(stats.meanLuma, 1e-4) / 0.18)).toFixed(1)
        : null

    return (
        <div className="lt-histogram-wrap">
            <div className="lt-histogram-channels" role="group" aria-label="Histogram channels">
                {CHANNELS.map(c => (
                    <button
                        key={c.id}
                        type="button"
                        className={`lt-hist-btn${channels[c.id] ? ' on' : ''} ch-${c.id}`}
                        onClick={() => toggle(c.id)}
                        aria-pressed={channels[c.id]}
                        title={`${channels[c.id] ? 'Hide' : 'Show'} the ${c.label} channel`}
                    >
                        {c.label}
                    </button>
                ))}
                {stats && (
                    <span className="lt-histogram-meta">
                        {ev !== null && <span title="Stops relative to middle grey">EV {ev >= 0 ? '+' : ''}{ev}</span>}
                        {stats.clippedShadows && <span className="warn" title="Blacks are crushed">◣</span>}
                        {stats.clippedHighlights && <span className="warn" title="Highlights are blown">◤</span>}
                    </span>
                )}
            </div>
            <canvas ref={ref} className="lt-histogram" aria-label="RGB histogram" />
        </div>
    )
}

/** A solid triangle in one corner: top-left, top-right, bottom-left, bottom-right. */
function drawTriangle(ctx, color, corner) {
    const W = SIZE, H = HEIGHT, s = 9
    const pts = {
        'top-left': [[0, 0], [s, 0], [0, s]],
        'top-right': [[W, 0], [W - s, 0], [W, s]],
        'bottom-left': [[0, H], [s, H], [0, H - s]],
        'bottom-right': [[W, H], [W - s, H], [W, H - s]]
    }[corner]
    ctx.save()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    ctx.lineTo(pts[1][0], pts[1][1])
    ctx.lineTo(pts[2][0], pts[2][1])
    ctx.closePath()
    ctx.fill()
    ctx.restore()
}

export default LtHistogram
