import React, { useRef, useEffect } from 'react'

function ShaderElement({ preset = 'plasma', customCode, width = 220, height = 220 }) {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !window.VPShader) return

        const w = Math.max(1, Math.round(width)) || 100
        const h = Math.max(1, Math.round(height)) || 100
        canvas.width = w
        canvas.height = h

        const inst = window.VPShader.start(canvas, preset || 'plasma', customCode)

        const onResize = () => {
            if (canvasRef.current && window.VPShader.resize) {
                window.VPShader.resize(canvasRef.current)
            }
        }
        window.addEventListener('resize', onResize)

        return () => {
            window.removeEventListener('resize', onResize)
            if (window.VPShader) window.VPShader.stop(canvas)
        }
    }, [preset, customCode, width, height])

    const w = Math.max(1, Math.round(width)) || 100
    const h = Math.max(1, Math.round(height)) || 100

    return (
        <canvas
            ref={canvasRef}
            width={w}
            height={h}
            style={{ width: '100%', height: '100%', display: 'block' }}
        />
    )
}

export default ShaderElement
