/*
 * Component: LtHistogram
 * Live RGB histogram with black/white clipping indicators. Recomputed from
 * the current image whenever the source changes, so it reflects the actual
 * pixels rather than the graded preview.
 */

import React, { useEffect, useRef } from 'react'

const SIZE = 256
const HEIGHT = 66
const CHANNELS = [
    { key: 0, color: 'rgba(239,107,115,.75)' },
    { key: 1, color: 'rgba(112,203,145,.75)' },
    { key: 2, color: 'rgba(111,156,255,.75)' }
]

function LtHistogram({ image, stats }) {
    const ref = useRef(null)

    useEffect(() => {
        const canvas = ref.current
        if (!canvas || !image?.naturalWidth) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const W = SIZE, H = HEIGHT
        canvas.width = W
        canvas.height = H

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

        ctx.clearRect(0, 0, W, H)
        ctx.globalAlpha = 1
        // Filled areas read better than strokes at this size.
        for (const { key, color } of CHANNELS) {
            ctx.beginPath()
            ctx.moveTo(0, H)
            for (let x = 0; x < 256; x++) {
                const y = H - (bins[key][x] / max) * (H - 3)
                ctx.lineTo(x, y)
            }
            ctx.lineTo(W - 1, H)
            ctx.closePath()
            ctx.fillStyle = color.replace('.75', '.22)')
            ctx.fill()
            ctx.strokeStyle = color
            ctx.lineWidth = 1
            ctx.stroke()
        }

        // Clipping badges so the user can see crushed blacks / blown highlights.
        if (stats?.clippedShadows) drawBadge(ctx, '#f85149', '◀', 'shadows clipped')
        if (stats?.clippedHighlights) drawBadge(ctx, '#d29922', '▶', 'highlights clipped')
    }, [image, stats])

    return (
        <div className="lt-histogram-wrap">
            <canvas ref={ref} className="lt-histogram" aria-label="RGB histogram" />
            {stats && (
                <div className="lt-histogram-meta">
                    {stats.meanLuma !== undefined ? `L ${Math.round(stats.meanLuma * 100)}%` : ''}
                </div>
            )}
        </div>
    )
}

function drawBadge(ctx, color, glyph, title) {
    ctx.save()
    ctx.fillStyle = color
    ctx.font = 'bold 11px system-ui, sans-serif'
    ctx.textBaseline = 'top'
    ctx.fillText(glyph, 4, 3)
    ctx.restore()
    void title
}

export default LtHistogram
