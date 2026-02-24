import React, { useRef, useEffect } from 'react'

/**
 * AudioViz - A "Native Engineering" inspired audio visualization component.
 * Uses WebAudio API to render frequency data on a canvas.
 */
function AudioViz({ src, color = 'var(--vp-accent)', height = 100, width = '100%' }) {
    const canvasRef = useRef(null)
    const audioRef = useRef(null)
    const analyzerRef = useRef(null)
    const animationRef = useRef(null)

    useEffect(() => {
        if (!canvasRef.current || !src) return

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
        const analyzer = audioCtx.createAnalyser()
        analyzer.fftSize = 256
        analyzerRef.current = analyzer

        const source = audioCtx.createMediaElementSource(audioRef.current)
        source.connect(analyzer)
        analyzer.connect(audioCtx.destination)

        const bufferLength = analyzer.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')

        const draw = () => {
            animationRef.current = requestAnimationFrame(draw)
            analyzer.getByteFrequencyData(dataArray)

            ctx.clearRect(0, 0, canvas.width, canvas.height)

            const barWidth = (canvas.width / bufferLength) * 2.5
            let barHeight
            let x = 0

            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * canvas.height

                // Titanium glow effect
                ctx.fillStyle = color
                ctx.globalAlpha = dataArray[i] / 255
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)

                x += barWidth + 1
            }
        }

        draw()

        return () => {
            cancelAnimationFrame(animationRef.current)
            audioCtx.close()
        }
    }, [src, color])

    return (
        <div className="audio-viz-container" style={{ width, height, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--vp-border)', padding: '4px' }}>
            <div className="viz-meta" style={{ fontSize: '9px', fontFamily: 'Roboto Mono', color: 'var(--vp-text-dim)', marginBottom: '4px' }}>
                AUDIO_TELEMETRY: ACTIVE
            </div>
            <canvas ref={canvasRef} width={300} height={height - 20} style={{ width: '100%', height: 'calc(100% - 20px)' }} />
            <audio ref={audioRef} src={src} crossOrigin="anonymous" />
            <div className="viz-controls" style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                    onClick={() => audioRef.current?.play()}
                    style={{ background: 'transparent', border: '1px solid var(--vp-border)', color: 'var(--vp-text)', fontSize: '9px', cursor: 'pointer' }}
                >
                    PLAY
                </button>
                <button
                    onClick={() => audioRef.current?.pause()}
                    style={{ background: 'transparent', border: '1px solid var(--vp-border)', color: 'var(--vp-text)', fontSize: '9px', cursor: 'pointer' }}
                >
                    PAUSE
                </button>
            </div>
        </div>
    )
}

export default AudioViz
