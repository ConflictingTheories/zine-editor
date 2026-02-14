import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useVP } from '../context/VPContext.jsx'

function VfxSystem() {
    const { activeVfx } = useVP()
    const [style, setStyle] = useState({})
    const [shakeClass, setShakeClass] = useState('')

    useEffect(() => {
        if (!activeVfx) return

        if (activeVfx === 'flash') {
            setStyle({ background: '#fff', opacity: 1, pointerEvents: 'none', transition: 'opacity 0.45s ease' })
            setTimeout(() => setStyle({ background: '#fff', opacity: 0, pointerEvents: 'none', transition: 'opacity 0.45s ease' }), 50)
        } else if (activeVfx === 'lightning') {
            setStyle({ background: '#fff', opacity: 1, pointerEvents: 'none', animation: 'vfx-lightning 0.4s' })
            setTimeout(() => setStyle({ background: '#fff', opacity: 0, pointerEvents: 'none', transition: 'opacity 0.3s ease' }), 450)
        } else if (activeVfx === 'shake') {
            // Apply shake animation to app container
            const container = document.querySelector('.app-container')
            if (container) {
                container.classList.remove('shake-anim')
                void container.offsetWidth // force reflow to restart animation
                container.classList.add('shake-anim')
                setTimeout(() => container.classList.remove('shake-anim'), 500)
            }
        } else if (activeVfx === 'pulse') {
            // Apply pulse animation to app container
            const container = document.querySelector('.app-container')
            if (container) {
                container.classList.remove('pulse-anim')
                void container.offsetWidth
                container.classList.add('pulse-anim')
                setTimeout(() => container.classList.remove('pulse-anim'), 500)
            }
        }

        const timer = setTimeout(() => setStyle({}), 1000)
        return () => clearTimeout(timer)
    }, [activeVfx])

    if (typeof document === 'undefined') return null

    const node = (
        <>
            <div className={`vfx-overlay ${activeVfx === 'flash' || activeVfx === 'lightning' ? 'active' : ''}`} style={style} />
            <style>{`
                .vfx-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 2147483647;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.35s ease;
                    mix-blend-mode: normal;
                }
                .vfx-overlay.active { opacity: 1; }
                @keyframes vfx-lightning {
                    0%,100%{opacity:0}
                    20%,80%{opacity:1}
                    40%{opacity:0.2}
                    60%{opacity:1}
                }
            `}</style>
        </>
    )

    return createPortal(node, document.body)
}

export default VfxSystem
