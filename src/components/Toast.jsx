import React from 'react'
import { useVP } from '../context/VPContext.jsx'

const Toast = () => {
    const { vpState } = useVP()

    if (!vpState || !vpState.toasts) return null

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
        }}>
            {vpState.toasts.map(t => (
                <div key={t.id} style={{
                    padding: '12px 24px',
                    background: t.type === 'error' ? 'var(--vp-danger)' : 'var(--vp-gold)',
                    color: '#000',
                    borderRadius: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    fontWeight: 'bold',
                    animation: 'slideIn 0.3s ease'
                }}>
                    {t.msg}
                </div>
            ))}
        </div>
    )
}

export default Toast