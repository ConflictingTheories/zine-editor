import React, { useRef, useEffect } from 'react'

function ShaderElement({ preset, customCode, width, height }) {
    const canvasRef = useRef(null)

    useEffect(() => {
        if (!canvasRef.current || !window.VPShader) return

        const inst = window.VPShader.start(canvasRef.current, preset, customCode)

        return () => {
            if (window.VPShader) window.VPShader.stop(canvasRef.current)
        }
    }, [preset, customCode])

    return (
        <canvas
            ref={canvasRef}
            width={width || 100}
            height={height || 100}
            style={{ width: '100%', height: '100%', display: 'block' }}
        />
    )
}

export default ShaderElement
