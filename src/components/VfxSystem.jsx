import React, { useEffect, useState } from 'react'
import { useVP } from '../context/VPContext.jsx'

function VfxSystem() {
    const { activeVfx } = useVP()
    const [style, setStyle] = useState({})

    useEffect(() => {
        if (!activeVfx) return

        if (activeVfx === 'flash') {
            setStyle({ background: '#fff', opacity: 1, pointerEvents: 'none' })
            setTimeout(() => setStyle({ background: '#fff', opacity: 0, transition: 'opacity 0.5s', pointerEvents: 'none' }), 50)
        } else if (activeVfx === 'lightning') {
            setStyle({ background: '#fff', animation: 'lightning 0.4s' })
        }

        const timer = setTimeout(() => setStyle({}), 1000)
        return () => clearTimeout(timer)
    }, [activeVfx])

    return (
        <>
            <div className={`vfx-overlay ${activeVfx === 'flash' || activeVfx === 'lightning' ? 'active' : ''}`} style={style} />
            <style>{`
                .vfx-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 9999;
                    pointer-events: none;
                    opacity: 0;
                }
                .vfx-overlay.active {
                    opacity: 1;
                }
                @keyframes lightning {
                    0%, 100% { opacity: 0; }
                    20%, 80% { opacity: 1; }
                    40% { opacity: 0.2; }
                    60% { opacity: 1; }
                }
                .shake-anim {
                    animation: shake 0.3s;
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-10px); }
                    75% { transform: translateX(10px); }
                }
                .pulse-anim {
                    animation: pulse 0.4s;
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.02); }
                }
            `}</style>
        </>
    )
}

export default VfxSystem
