/*
 * Component: VfxSystem
 * Manages visual effects overlays, particle systems, and cinematic UI transitions.
 */

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useVP } from '../context/VPContext.jsx'

/**
 * Component: VfxSystem
 * Global visual effect layer. Reacts to `activeVfx` from context and
 * briefly overlays/animates the app to produce flashes, glitches, shakes,
 * and other cinematic effects.
 */
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
        } else if (activeVfx === 'shake' || activeVfx === 'zoom') {
            // Apply shake / zoom animation to app container
            const container = document.querySelector('.app-container')
            if (container) {
                container.classList.remove('shake-anim', 'zoom-anim')
                void container.offsetWidth // force reflow to restart animation
                container.classList.add(activeVfx === 'zoom' ? 'zoom-anim' : 'shake-anim')
                setTimeout(() => container.classList.remove('shake-anim', 'zoom-anim'), 500)
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
        } else if (activeVfx === 'glitch') {
            // RGB-split + displacement glitch on the whole app
            const container = document.querySelector('.app-container')
            if (container) {
                container.classList.remove('glitch-anim')
                void container.offsetWidth
                container.classList.add('glitch-anim')
                setTimeout(() => container.classList.remove('glitch-anim'), 600)
            }
            setStyle({ background: 'rgba(255,0,80,0.12)', opacity: 1, pointerEvents: 'none', animation: 'vfx-glitch 0.5s steps(2, end)', mixBlendMode: 'screen' })
            setTimeout(() => setStyle({ background: 'transparent', opacity: 0, pointerEvents: 'none', transition: 'opacity 0.2s ease' }), 550)
        } else if (activeVfx === 'scanline') {
            setStyle({ background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0px, rgba(0,0,0,0.25) 1px, transparent 1px, transparent 3px)', opacity: 0.8, pointerEvents: 'none', animation: 'vfx-scan 0.2s linear infinite' })
            setTimeout(() => setStyle({ opacity: 0, transition: 'opacity 0.3s ease' }), 600)
        } else if (activeVfx === 'static') {
            setStyle({ background: 'rgba(50,50,60,0.6)', opacity: 1, pointerEvents: 'none', animation: 'vfx-static 0.15s steps(3) infinite' })
            setTimeout(() => setStyle({ opacity: 0, transition: 'opacity 0.3s ease' }), 650)
        } else if (activeVfx === 'fade-black') {
            setStyle({ background: '#000', opacity: 1, pointerEvents: 'none', transition: 'opacity 0.6s ease' })
            setTimeout(() => setStyle({ background: '#000', opacity: 0, pointerEvents: 'none', transition: 'opacity 0.6s ease' }), 650)
        } else if (activeVfx === 'blood') {
            setStyle({ background: 'radial-gradient(circle at 50% 50%, rgba(139,0,0,0.5), rgba(60,0,0,0.8) 60%, rgba(20,0,0,0.9))', opacity: 1, pointerEvents: 'none', animation: 'vfx-blood 0.5s ease-out' })
            setTimeout(() => setStyle({ opacity: 0, transition: 'opacity 0.4s ease' }), 550)
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
